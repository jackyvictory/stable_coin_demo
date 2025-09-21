package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"payment-backend/internal/blockchain"
	"payment-backend/internal/models"
	"payment-backend/internal/service"
)

// MessageType represents the type of WebSocket message
type MessageType string

const (
	ConnectionAckMsg     MessageType = "connection_ack"
	PaymentStatusUpdateMsg MessageType = "payment_status_update"
	ErrorMsg             MessageType = "error"
	PingMsg              MessageType = "ping"
	PongMsg              MessageType = "pong"
)

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type      MessageType    `json:"type"`
	PaymentID string         `json:"paymentId"`
	Data      interface{}    `json:"data,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
}

// ConnectionAckData represents connection acknowledgment data
type ConnectionAckData struct {
	Status    string `json:"status"`
	SessionID string `json:"sessionId"`
}

// PaymentStatusUpdateData represents payment status update data
type PaymentStatusUpdateData struct {
	Status          string `json:"status"`
	TransactionHash string `json:"transactionHash,omitempty"`
	BlockNumber     int64  `json:"blockNumber,omitempty"`
	Confirmations   int    `json:"confirmations,omitempty"`
	Amount          string `json:"amount,omitempty"`
	Token           string `json:"token,omitempty"`
}

// ErrorMessageData represents error message data
type ErrorMessageData struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// WebSocketMessageLog represents a logged WebSocket message
type WebSocketMessageLog struct {
	Type      MessageType    `json:"type"`
	PaymentID string         `json:"paymentId"`
	Direction string         `json:"direction"` // "in" or "out"
	Data      interface{}    `json:"data,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
}


// Manager handles WebSocket connections
type Manager struct {
	connections map[string]*Connection // paymentID -> connection
	service     *service.PaymentService
	upgrader    websocket.Upgrader
	mu          sync.RWMutex
	paymentCh   chan *blockchain.PaymentStatusUpdate
	stopCh      chan struct{}

	// Connection statistics
	totalConnections     int64
	activeConnections    int64
	connectionErrors     int64
	reconnectAttempts    int64
	lastConnectionTime   time.Time
	lastDisconnectionTime time.Time

	// Message logging
	messageLog []WebSocketMessageLog
	logMu      sync.RWMutex
	maxLogSize int
}

// Connection represents a WebSocket connection
type Connection struct {
	conn       *websocket.Conn
	paymentID  string
	sessionID  string
	lastPing   time.Time
	closeOnce  sync.Once
}

// NewManager creates a new WebSocket manager
func NewManager(paymentService *service.PaymentService) *Manager {
	manager := &Manager{
		connections: make(map[string]*Connection),
		service:     paymentService,
		paymentCh:   make(chan *blockchain.PaymentStatusUpdate, 100),
		stopCh:      make(chan struct{}),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for development
			},
		},
		totalConnections:      0,
		activeConnections:     0,
		connectionErrors:      0,
		reconnectAttempts:     0,
		lastConnectionTime:    time.Time{},
		lastDisconnectionTime: time.Time{},
		messageLog:            make([]WebSocketMessageLog, 0),
		maxLogSize:            1000, // Keep last 1000 messages
	}

	// Start payment status listener
	go manager.paymentStatusListener()

	return manager
}

// paymentStatusListener listens for payment status updates and pushes them to connected clients
func (m *Manager) paymentStatusListener() {
	for {
		select {
		case update := <-m.paymentCh:
			// Push the payment status update to the connected client
			m.PushPaymentStatusUpdate(
				update.PaymentID,
				update.Status,
				update.TransactionHash,
				update.BlockNumber,
				update.Confirmations,
				update.Amount,
				update.Token,
			)
		case <-m.stopCh:
			log.Println("Payment status listener stopped")
			return
		}
	}
}

// Close stops the WebSocket manager and cleans up resources
func (m *Manager) Close() {
	close(m.stopCh)

	// Close all active connections
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, conn := range m.connections {
		conn.closeOnce.Do(func() {
			conn.conn.Close()
		})
	}

	m.connections = make(map[string]*Connection)
}

// GetPaymentChannel returns the payment status update channel
func (m *Manager) GetPaymentChannel() chan<- *blockchain.PaymentStatusUpdate {
	return m.paymentCh
}

// logMessage adds a message to the message log
func (m *Manager) logMessage(msgType MessageType, paymentID, direction string, data interface{}) {
	m.logMu.Lock()
	defer m.logMu.Unlock()

	logEntry := WebSocketMessageLog{
		Type:      msgType,
		PaymentID: paymentID,
		Direction: direction,
		Data:      data,
		Timestamp: time.Now(),
	}

	// Add to log
	m.messageLog = append(m.messageLog, logEntry)

	// Trim log if it exceeds max size
	if len(m.messageLog) > m.maxLogSize {
		// Keep the most recent entries
		startIndex := len(m.messageLog) - m.maxLogSize
		m.messageLog = m.messageLog[startIndex:]
	}
}

// GetMessageLog returns the message log
func (m *Manager) GetMessageLog(limit int) []WebSocketMessageLog {
	m.logMu.RLock()
	defer m.logMu.RUnlock()

	// If limit is 0 or negative, return all messages
	if limit <= 0 || limit >= len(m.messageLog) {
		// Return a copy of the slice
		result := make([]WebSocketMessageLog, len(m.messageLog))
		copy(result, m.messageLog)
		return result
	}

	// Return the most recent 'limit' messages
	startIndex := len(m.messageLog) - limit
	result := make([]WebSocketMessageLog, limit)
	copy(result, m.messageLog[startIndex:])
	return result
}

// GetConnectionStats returns WebSocket connection statistics
func (m *Manager) GetConnectionStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := make(map[string]interface{})
	stats["totalConnections"] = m.totalConnections
	stats["activeConnections"] = m.activeConnections
	stats["connectionErrors"] = m.connectionErrors
	stats["reconnectAttempts"] = m.reconnectAttempts
	stats["lastConnectionTime"] = m.lastConnectionTime
	stats["lastDisconnectionTime"] = m.lastDisconnectionTime
	stats["currentConnections"] = len(m.connections)

	return stats
}

// HandleConnection handles a new WebSocket connection
func (m *Manager) HandleConnection(c *gin.Context) {
	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "paymentId is required"})
		return
	}

	// Verify payment exists
	payment, err := m.service.GetPaymentSession(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := m.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[Frontend WebSocket] Failed to upgrade connection: %v", err)
		return
	}

	// Create new connection
	sessionID := fmt.Sprintf("sess_%d", time.Now().UnixNano())
	connection := &Connection{
		conn:      conn,
		paymentID: paymentID,
		sessionID: sessionID,
		lastPing:  time.Now(),
	}

	// Add connection to manager and update statistics
	m.mu.Lock()
	m.connections[paymentID] = connection
	m.totalConnections++
	m.activeConnections++
	m.lastConnectionTime = time.Now()
	m.mu.Unlock()

	// Send connection acknowledgment
	ackMsg := &WebSocketMessage{
		Type:      ConnectionAckMsg,
		PaymentID: paymentID,
		Data: ConnectionAckData{
			Status:    "connected",
			SessionID: sessionID,
		},
		Timestamp: time.Now(),
	}
	m.sendMessage(connection, ackMsg)

	// Start handling messages
	go m.handleMessages(connection, payment)

	// Start heartbeat
	go m.heartbeat(connection)
}

// handleMessages handles incoming messages from a connection
func (m *Manager) handleMessages(conn *Connection, payment *models.PaymentSession) {
	defer func() {
		m.closeConnection(conn)
	}()

	for {
		// Read message
		_, message, err := conn.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Frontend WebSocket] WebSocket error: %v", err)
			}
			break
		}

		// Parse message
		var msg WebSocketMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("[Frontend WebSocket] Failed to parse message: %v", err)
			continue
		}

		// Log the incoming message
		m.logMessage(msg.Type, conn.paymentID, "in", msg.Data)

		// Handle ping messages
		if msg.Type == PingMsg {
			log.Printf("[Frontend WebSocket] Received ping from payment %s, sending pong", conn.paymentID)
			pongMsg := &WebSocketMessage{
				Type:      PongMsg,
				PaymentID: conn.paymentID,
				Timestamp: time.Now(),
			}
			m.sendMessage(conn, pongMsg)
			conn.lastPing = time.Now()
		}

		// Handle pong messages
		if msg.Type == PongMsg {
			log.Printf("[Frontend WebSocket] Received pong from payment %s, updating lastPing from %v to %v", conn.paymentID, conn.lastPing, time.Now())
			conn.lastPing = time.Now()
		}
	}
}

// sendMessage sends a message to a connection
func (m *Manager) sendMessage(conn *Connection, msg *WebSocketMessage) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Log the outgoing message
	m.logMessage(msg.Type, conn.paymentID, "out", msg.Data)

	return conn.conn.WriteJSON(msg)
}

// closeConnection closes a connection
func (m *Manager) closeConnection(conn *Connection) {
	log.Printf("[Frontend WebSocket] Closing connection for payment %s", conn.paymentID)
	m.mu.Lock()
	defer m.mu.Unlock()

	conn.closeOnce.Do(func() {
		// Remove from connections map
		delete(m.connections, conn.paymentID)

		// Update statistics
		m.activeConnections--
		m.lastDisconnectionTime = time.Now()

		// Close WebSocket connection
		conn.conn.Close()
		log.Printf("[Frontend WebSocket] Connection closed for payment %s", conn.paymentID)
	})
}

// heartbeat sends periodic ping messages to keep connection alive
func (m *Manager) heartbeat(conn *Connection) {
	ticker := time.NewTicker(25 * time.Second) // Ping every 25 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.mu.RLock()
			_, exists := m.connections[conn.paymentID]
			m.mu.RUnlock()

			if !exists {
				return
			}

			// Log before sending ping
			log.Printf("[Frontend WebSocket] Sending ping to payment %s, lastPing was %v ago", conn.paymentID, time.Since(conn.lastPing))

			// Send ping message
			pingMsg := &WebSocketMessage{
				Type:      PingMsg,
				PaymentID: conn.paymentID,
				Timestamp: time.Now(),
			}
			if err := m.sendMessage(conn, pingMsg); err != nil {
				log.Printf("[Frontend WebSocket] Failed to send ping: %v", err)
				m.closeConnection(conn)
				return
			}

			// Check if connection is still alive (timeout after 90 seconds without pong)
			// Use conn.lastPing which gets updated when we receive pong messages
			sinceLastPong := time.Since(conn.lastPing)
			log.Printf("[Frontend WebSocket] Checking connection for payment %s, lastPong was %v ago", conn.paymentID, sinceLastPong)
			if sinceLastPong > 90*time.Second {
				log.Printf("[Frontend WebSocket] Connection timeout for payment %s (lastPong was %v ago)", conn.paymentID, sinceLastPong)
				m.closeConnection(conn)
				return
			}
		case <-m.stopCh:
			// Stop heartbeat when manager is closing
			return
		}
	}
}