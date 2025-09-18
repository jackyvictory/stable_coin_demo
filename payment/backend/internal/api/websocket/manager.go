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


// Manager handles WebSocket connections
type Manager struct {
	connections map[string]*Connection // paymentID -> connection
	service     *service.PaymentService
	upgrader    websocket.Upgrader
	mu          sync.RWMutex
	paymentCh   chan *blockchain.PaymentStatusUpdate
	stopCh      chan struct{}
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

	// Add connection to manager
	m.mu.Lock()
	m.connections[paymentID] = connection
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
		}
	}
}