package websocket

import (
	"log"
	"time"
)

// PushPaymentStatusUpdate sends a payment status update to the client
func (m *Manager) PushPaymentStatusUpdate(paymentID string, status string, transactionHash string, blockNumber int64, confirmations int, amount string, token string) {
	m.mu.RLock()
	conn, exists := m.connections[paymentID]
	m.mu.RUnlock()

	if !exists {
		log.Printf("[Frontend WebSocket] No active connection for payment %s", paymentID)
		return
	}

	// Create payment status update message
	updateMsg := &WebSocketMessage{
		Type:      PaymentStatusUpdateMsg,
		PaymentID: paymentID,
		Data: PaymentStatusUpdateData{
			Status:          status,
			TransactionHash: transactionHash,
			BlockNumber:     blockNumber,
			Confirmations:   confirmations,
			Amount:          amount,
			Token:           token,
		},
		Timestamp: time.Now(),
	}

	// Send message
	if err := m.sendMessage(conn, updateMsg); err != nil {
		log.Printf("[Frontend WebSocket] Failed to send payment status update: %v", err)
		m.closeConnection(conn)
	}
}

// PushError sends an error message to the client
func (m *Manager) PushError(paymentID string, code int, message string) {
	m.mu.RLock()
	conn, exists := m.connections[paymentID]
	m.mu.RUnlock()

	if !exists {
		log.Printf("[Frontend WebSocket] No active connection for payment %s", paymentID)
		return
	}

	// Create error message
	errorMsg := &WebSocketMessage{
		Type:      ErrorMsg,
		PaymentID: paymentID,
		Data: ErrorMessageData{
			Code:    code,
			Message: message,
		},
		Timestamp: time.Now(),
	}

	// Send message
	if err := m.sendMessage(conn, errorMsg); err != nil {
		log.Printf("[Frontend WebSocket] Failed to send error message: %v", err)
		m.closeConnection(conn)
	}
}

// StartPaymentStatusListener starts listening for payment status changes
func (m *Manager) StartPaymentStatusListener() {
	// In a real implementation, this would listen for payment status changes
	// from the payment service or blockchain service and push updates to clients.
	// For now, we'll just log that the listener is started.
	log.Println("[Frontend WebSocket] Payment status listener started")
}

// GetConnectionCount returns the number of active connections
func (m *Manager) GetConnectionCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.connections)
}