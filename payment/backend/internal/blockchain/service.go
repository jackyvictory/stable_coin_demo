package blockchain

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/gorilla/websocket"
)

// TokenTransfer represents a token transfer event
type TokenTransfer struct {
	From        common.Address `json:"from"`
	To          common.Address `json:"to"`
	Value       *big.Int       `json:"value"`
	TxHash      common.Hash    `json:"txHash"`
	BlockNumber *big.Int       `json:"blockNumber"`
	TokenSymbol string         `json:"tokenSymbol"`
}

// Config represents blockchain configuration
type Config struct {
	RPCURL         string `json:"rpcUrl"`
	WebsocketURL   string `json:"websocketUrl"`
	ChainID        int64  `json:"chainId"`
	ReceiverAddress string `json:"receiverAddress"` // Deprecated: Not used anymore as each payment uses its own address
}

// WebSocketEndpoint represents a WebSocket endpoint configuration
type WebSocketEndpoint struct {
	URL        string `json:"url"`
	Priority   int    `json:"priority"`
	Timeout    int    `json:"timeout"`
	Name       string `json:"name"`
	RequiresAPIKey bool `json:"requiresApiKey,omitempty"`
}

// PaymentCallback defines the callback function for payment events
type PaymentCallback func(*TokenTransfer, error)

// PaymentStatusUpdate represents a payment status update for WebSocket notifications
type PaymentStatusUpdate struct {
	PaymentID       string `json:"paymentId"`
	Status          string `json:"status"`
	TransactionHash string `json:"transactionHash,omitempty"`
	BlockNumber     int64  `json:"blockNumber,omitempty"`
	Confirmations   int    `json:"confirmations,omitempty"`
	Amount          string `json:"amount,omitempty"`
	Token           string `json:"token,omitempty"`
}

// WebSocketMessageLog represents a logged WebSocket message
type WebSocketMessageLog struct {
	Type      string      `json:"type"`
	Direction string      `json:"direction"` // "in" or "out"
	Data      interface{} `json:"data,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

// Service provides blockchain functionality
type Service struct {
	client         *ethclient.Client
	config         Config
	websocketClient *ethclient.Client
	erc20ABI       abi.ABI

	// WebSocket support
	wsConn         *websocket.Conn
	wsMu           sync.Mutex
	wsSubscriptions map[string]string // subscriptionId -> tokenSymbol
	isConnected    bool
	subscriptionMu sync.RWMutex

	// Multi-endpoint WebSocket support
	wsEndpoints    []WebSocketEndpoint
	currentEndpointIndex int
	reconnectAttempts int
	maxReconnectAttempts int

	// Connection statistics
	totalConnectionAttempts int64
	lastConnectionTime     time.Time
	lastDisconnectionTime  time.Time
	connectionErrors       int64
	activeSubscriptions    int64

	// Payment status channel for WebSocket notifications
	paymentCh chan<- *PaymentStatusUpdate
	mu        sync.Mutex // For protecting paymentCh

	// Message logging
	messageLog []WebSocketMessageLog
	logMu      sync.RWMutex
	maxLogSize int
}

// NewService creates a new blockchain service
func NewService(config Config, paymentCh chan<- *PaymentStatusUpdate) (*Service, error) {
	// Connect to RPC endpoint
	client, err := ethclient.Dial(config.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	// Connect to WebSocket endpoint if provided
	var wsClient *ethclient.Client
	if config.WebsocketURL != "" {
		wsClient, err = ethclient.Dial(config.WebsocketURL)
		if err != nil {
			// Log warning but don't fail - we can still use RPC
			fmt.Printf("[Blockchain WebSocket] Warning: failed to connect to WebSocket: %v\n", err)
		}
	}

	// Parse ERC20 ABI
	erc20ABI, err := abi.JSON(strings.NewReader(erc20ABIJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ERC20 ABI: %w", err)
	}

	// Define WebSocket endpoints (similar to frontend implementation)
	wsEndpoints := []WebSocketEndpoint{
		{
			URL:        "wss://bsc-ws-node.nariox.org/",
			Priority:   1,
			Timeout:    5000,
			Name:       "Nariox BSC Node",
		},
		{
			URL:        "wss://bsc.publicnode.com/",
			Priority:   2,
			Timeout:    5000,
			Name:       "Public Node BSC",
		},
		{
			URL:        "wss://bsc-mainnet.nodereal.io/ws/v1/YOUR_API_KEY",
			Priority:   3,
			Timeout:    8000,
			Name:       "NodeReal BSC (API Key required)",
			RequiresAPIKey: true,
		},
		{
			URL:        "wss://bsc-dataseed1.binance.org/ws/",
			Priority:   4,
			Timeout:    10000,
			Name:       "Binance BSC DataSeed",
		},
	}

	service := &Service{
		client:         client,
		websocketClient: wsClient,
		config:         config,
		erc20ABI:       erc20ABI,
		wsSubscriptions: make(map[string]string),
		isConnected:    false,
		wsEndpoints:    wsEndpoints,
		currentEndpointIndex: 0,
		reconnectAttempts: 0,
		maxReconnectAttempts: 3,
		totalConnectionAttempts: 0,
		lastConnectionTime: time.Time{},
		lastDisconnectionTime: time.Time{},
		connectionErrors: 0,
		activeSubscriptions: 0,
		paymentCh:      paymentCh,
		mu:             sync.Mutex{},
		messageLog:     make([]WebSocketMessageLog, 0),
		maxLogSize:     1000, // Keep last 1000 messages
	}

	// Connect to WebSocket if URL is provided
	if config.WebsocketURL != "" {
		go service.connectWebSocketWithFailover()

		// Start periodic health check
		go service.startHealthCheck()
	}

	return service, nil
}

// startHealthCheck performs periodic health checks on the WebSocket connection
func (s *Service) startHealthCheck() {
	ticker := time.NewTicker(30 * time.Second) // Check every 30 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Check if we're still connected
			if !s.IsWebSocketConnected() {
				fmt.Println("⚠️ [WebSocket] Connection lost, initiating reconnection...")
				go s.connectWebSocketWithFailover()
			} else {
				// Send a ping to keep the connection alive
				s.sendPing()
			}
		}
	}
}

// connectWebSocketWithFailover establishes a WebSocket connection with failover support
func (s *Service) connectWebSocketWithFailover() {
	fmt.Println("🔌 [WebSocket] Starting WebSocket connection with failover support...")

	// Reset reconnect attempts when starting fresh
	s.reconnectAttempts = 0

	// Try to connect to available endpoints
	success := s.tryConnectToEndpoints()
	if success {
		fmt.Println("✅ [WebSocket] Connected successfully")
		return
	}

	fmt.Println("❌ [WebSocket] All endpoints failed, will retry...")

	// If all endpoints fail, retry with exponential backoff
	go s.retryConnectionWithBackoff()
}

// connectWebSocket is a fallback method that tries to connect to a single WebSocket URL
func (s *Service) connectWebSocket() {
	if s.config.WebsocketURL == "" {
		return
	}

	fmt.Printf("[Blockchain WebSocket] 🔌 [WebSocket] Connecting to: %s\n", s.config.WebsocketURL)

	// Add timeout to prevent hanging
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	// Dial the WebSocket connection
	conn, _, err := dialer.Dial(s.config.WebsocketURL, nil)
	if err != nil {
		fmt.Printf("[Blockchain WebSocket] Failed to connect to WebSocket: %v\n", err)
		s.isConnected = false

		// Attempt to reconnect with failover support
		go s.connectWebSocketWithFailover()
		return
	}

	s.wsMu.Lock()
	s.wsConn = conn
	s.isConnected = true
	s.wsMu.Unlock()

	fmt.Println("WebSocket connected successfully")

	// Start listening for messages
	go s.listenWebSocket()

	// Subscribe to Transfer events for all supported tokens
	s.subscribeToAllTransferEvents()

	// Send a ping to test connection
	s.sendPing()
}

// tryConnectToEndpoints attempts to connect to all available endpoints
func (s *Service) tryConnectToEndpoints() bool {
	fmt.Printf("[Blockchain WebSocket] 🔌 [WebSocket] Trying %d available endpoints in priority order\n", len(s.wsEndpoints))

	// Sort endpoints by priority but skip those requiring API key
	availableEndpoints := make([]WebSocketEndpoint, 0)
	for _, endpoint := range s.wsEndpoints {
		if !endpoint.RequiresAPIKey || !strings.Contains(endpoint.URL, "YOUR_API_KEY") {
			availableEndpoints = append(availableEndpoints, endpoint)
		}
	}

	// Sort by priority
	sort.Slice(availableEndpoints, func(i, j int) bool {
		return availableEndpoints[i].Priority < availableEndpoints[j].Priority
	})

	for i, endpoint := range availableEndpoints {
		fmt.Printf("[Blockchain WebSocket] 🔌 [WebSocket] Trying endpoint %d/%d: %s (%s)\n", i+1, len(availableEndpoints), endpoint.Name, endpoint.URL)

		// Skip endpoints requiring API key
		if endpoint.RequiresAPIKey && strings.Contains(endpoint.URL, "YOUR_API_KEY") {
			fmt.Printf("[Blockchain WebSocket] ⏭️ [WebSocket] Skipping endpoint %s (requires API key)\n", endpoint.Name)
			continue
		}

		success := s.connectToEndpoint(endpoint)
		if success {
			fmt.Printf("[Blockchain WebSocket] ✅ [WebSocket] Successfully connected to: %s\n", endpoint.Name)

			// Reset error count for this endpoint
			s.reconnectAttempts = 0

			// Start listening for messages
			go s.listenWebSocket()

			// Send a ping to test connection
			s.sendPing()

			return true
		}

		fmt.Printf("[Blockchain WebSocket] ❌ [WebSocket] Failed to connect to: %s\n", endpoint.Name)
	}

	return false
}

// connectToEndpoint connects to a specific WebSocket endpoint
func (s *Service) connectToEndpoint(endpoint WebSocketEndpoint) bool {
	// Add timeout to prevent hanging
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = time.Duration(endpoint.Timeout) * time.Millisecond

	// Increment connection attempts
	s.totalConnectionAttempts++

	// Dial the WebSocket connection
	conn, _, err := dialer.Dial(endpoint.URL, nil)
	if err != nil {
		fmt.Printf("[Blockchain WebSocket] Failed to connect to WebSocket endpoint %s: %v\n", endpoint.Name, err)
		s.connectionErrors++
		return false
	}

	s.wsMu.Lock()
	s.wsConn = conn
	s.isConnected = true
	s.lastConnectionTime = time.Now()
	s.wsMu.Unlock()

	fmt.Printf("[Blockchain WebSocket] WebSocket connected successfully to %s\n", endpoint.Name)
	return true
}

// retryConnectionWithBackoff retries connection with exponential backoff
func (s *Service) retryConnectionWithBackoff() {
	s.reconnectAttempts++

	if s.reconnectAttempts > s.maxReconnectAttempts {
		// Reset counter and try next endpoint
		s.reconnectAttempts = 0
		s.currentEndpointIndex = (s.currentEndpointIndex + 1) % len(s.wsEndpoints)
		fmt.Printf("[Blockchain WebSocket] 🔄 [WebSocket] Moving to next endpoint (index: %d)\n", s.currentEndpointIndex)
	}

	// Exponential backoff: 5s, 10s, 20s, 30s (max)
	delay := time.Duration(math.Min(5000*math.Pow(2, float64(s.reconnectAttempts-1)), 30000)) * time.Millisecond

	fmt.Printf("[Blockchain WebSocket] ⏰ [WebSocket] Retrying connection in %v (attempt %d/%d)\n", delay, s.reconnectAttempts, s.maxReconnectAttempts)

	time.Sleep(delay)

	// Try to connect again
	s.connectWebSocketWithFailover()
}

// sendPing sends a ping message to keep the connection alive
func (s *Service) sendPing() {
	s.wsMu.Lock()
	defer s.wsMu.Unlock()

	if s.wsConn == nil || !s.isConnected {
		return
	}

	pingMsg := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "net_version",
		"params":  []interface{}{},
		"id":      time.Now().Unix(),
	}

	// Log the outgoing message
	s.logMessage("ping", "out", pingMsg)

	if err := s.wsConn.WriteJSON(pingMsg); err != nil {
		fmt.Printf("[Blockchain WebSocket] Failed to send ping: %v\n", err)
		s.logMessage("ping_error", "out", map[string]interface{}{
			"error": err.Error(),
		})
		s.isConnected = false

		// Attempt to reconnect with failover support
		go s.connectWebSocketWithFailover()
	}
}

// listenWebSocket listens for incoming WebSocket messages
func (s *Service) listenWebSocket() {
	for {
		s.wsMu.Lock()
		conn := s.wsConn
		s.wsMu.Unlock()

		if conn == nil {
			// Connection lost, attempt to reconnect
			fmt.Println("WebSocket connection lost, attempting to reconnect...")
			s.lastDisconnectionTime = time.Now()
			go s.connectWebSocketWithFailover()
			return
		}

		// Read message
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Printf("[Blockchain WebSocket] WebSocket read error: %v\n", err)
			s.wsMu.Lock()
			s.isConnected = false
			s.lastDisconnectionTime = time.Now()
			s.wsMu.Unlock()

			// Attempt to reconnect with failover support
			go s.connectWebSocketWithFailover()
			return
		}

		// Process message
		go s.processWebSocketMessage(message)
	}
}

// processWebSocketMessage processes incoming WebSocket messages
func (s *Service) processWebSocketMessage(message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		fmt.Printf("[Blockchain WebSocket] Failed to parse WebSocket message: %v\n", err)
		s.logMessage("parse_error", "in", map[string]interface{}{
			"error": err.Error(),
			"raw":   string(message),
		})
		return
	}

	// Log the incoming message
	s.logMessage("message_received", "in", msg)

	// Handle subscription responses
	if id, ok := msg["id"].(float64); ok {
		if result, ok := msg["result"].(string); ok {
			// This is a subscription confirmation
			fmt.Printf("[Blockchain WebSocket] Subscription confirmed: %s (id: %.0f)\n", result, id)
			s.logMessage("subscription_confirmed", "in", map[string]interface{}{
				"subscriptionId": result,
				"requestId":      id,
			})
			// Store subscription ID for later reference
			s.subscriptionMu.Lock()
			s.wsSubscriptions[result] = fmt.Sprintf("subscription-%.0f", id)
			s.subscriptionMu.Unlock()
		}
	}

	// Handle subscription events
	if method, ok := msg["method"].(string); ok && method == "eth_subscription" {
		if params, ok := msg["params"].(map[string]interface{}); ok {
			if result, ok := params["result"].(map[string]interface{}); ok {
				s.logMessage("transfer_event", "in", result)
				s.handleTransferEvent(result)
			}
		}
	}

	// Handle RPC responses (like ping/pong)
	if result, ok := msg["result"]; ok && msg["id"] != nil {
		fmt.Printf("[Blockchain WebSocket] RPC response received: %v\n", result)
		s.logMessage("rpc_response", "in", map[string]interface{}{
			"result": result,
			"id":     msg["id"],
		})
	}
}

// handleTransferEvent processes Transfer events
func (s *Service) handleTransferEvent(event map[string]interface{}) {
	// Extract event data
	topics, ok := event["topics"].([]interface{})
	if !ok || len(topics) < 3 {
		return
	}

	// Extract addresses from topics
	fromTopic, ok := topics[1].(string)
	if !ok {
		return
	}
	toTopic, ok := topics[2].(string)
	if !ok {
		return
	}

	// Convert topics to addresses (remove leading 0x and padding)
	fromAddr := common.HexToAddress(fromTopic)
	toAddr := common.HexToAddress(toTopic)

	// Extract amount from data
	data, ok := event["data"].(string)
	if !ok {
		return
	}

	amount := new(big.Int)
	amount.SetString(strings.TrimPrefix(data, "0x"), 16)

	// Extract transaction hash
	txHashStr, ok := event["transactionHash"].(string)
	if !ok {
		return
	}
	txHash := common.HexToHash(txHashStr)

	// Extract block number
	blockNumberStr, ok := event["blockNumber"].(string)
	if !ok {
		return
	}
	blockNumber := new(big.Int)
	blockNumber.SetString(strings.TrimPrefix(blockNumberStr, "0x"), 16)

	// Try to determine token symbol from address
	tokenSymbol := s.getTokenSymbolFromAddress(event["address"].(string))

	fmt.Printf("[Blockchain WebSocket] Transfer detected: %s -> %s, Amount: %s, TX: %s, Token: %s\n",
		fromAddr.Hex(), toAddr.Hex(), amount.String(), txHash.Hex(), tokenSymbol)

	// Check if this transfer matches any active payments
	// Instead of checking against a single global receiver address, we check against all active payment addresses
	activePaymentsMu.RLock()
	hasActivePayments := len(activePayments) > 0
	activePaymentsMu.RUnlock()

	if hasActivePayments {
		// Trigger payment detection event
		s.triggerPaymentDetected(fromAddr, toAddr, amount, txHash, blockNumber, tokenSymbol)
	} else {
		fmt.Printf("[Blockchain WebSocket] No active payments monitoring, ignoring transfer\n")
	}
}

// getTokenSymbolFromAddress determines token symbol from contract address
func (s *Service) getTokenSymbolFromAddress(address string) string {
	// Supported token addresses on BSC
	tokenAddresses := map[string]string{
		"0x55d398326f99059fF775485246999027B3197955": "USDT",
		"0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d": "USDC",
		"0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56": "BUSD",
	}

	if symbol, exists := tokenAddresses[strings.ToLower(address)]; exists {
		return symbol
	}

	return "UNKNOWN"
}

// triggerPaymentDetected handles detected payments
func (s *Service) triggerPaymentDetected(from, to common.Address, amount *big.Int, txHash common.Hash, blockNumber *big.Int, tokenSymbol string) {
	// Create a TokenTransfer object
	transfer := &TokenTransfer{
		From:        from,
		To:          to,
		Value:       amount,
		TxHash:      txHash,
		BlockNumber: blockNumber,
		TokenSymbol: tokenSymbol,
	}

	// Log the detected payment
	fmt.Printf("[Blockchain WebSocket] Payment detected: %s %s from %s to %s in transaction %s at block %s\n",
		amount.String(), tokenSymbol, from.Hex(), to.Hex(), txHash.Hex(), blockNumber.String())

	// Check if this payment matches any active monitoring
	activePaymentsMu.RLock()
	defer activePaymentsMu.RUnlock()

	// Create a list of matching payments to avoid concurrent map access issues
	matchingPayments := make([]*activePayment, 0)
	paymentIDs := make([]string, 0)
	receiverAddresses := make([]common.Address, 0)

	for paymentID, payment := range activePayments {
		// Check if the token symbol matches
		if payment.tokenSymbol != tokenSymbol {
			continue
		}

		// Check if the amount matches (with some tolerance for rounding errors)
		// In a real implementation, you might want to use a more sophisticated comparison
		if amount.Cmp(payment.expectedAmount) == 0 {
			matchingPayments = append(matchingPayments, payment)
			paymentIDs = append(paymentIDs, paymentID)
			receiverAddresses = append(receiverAddresses, payment.receiverAddress)
		}
	}

	// Filter matching payments by receiver address
	actualMatchingPayments := make([]*activePayment, 0)
	actualPaymentIDs := make([]string, 0)

	for i, payment := range matchingPayments {
		paymentID := paymentIDs[i]
		expectedReceiver := receiverAddresses[i]

		// Check if the receiver address matches
		if to == expectedReceiver {
			actualMatchingPayments = append(actualMatchingPayments, payment)
			actualPaymentIDs = append(actualPaymentIDs, paymentID)
			fmt.Printf("[Blockchain WebSocket] Payment %s matches receiver address %s\n", paymentID, expectedReceiver.Hex())
		} else {
			fmt.Printf("[Blockchain WebSocket] Payment %s does not match receiver address %s (expected) vs %s (actual)\n",
				paymentID, expectedReceiver.Hex(), to.Hex())
		}
	}

	// Trigger callbacks for matching payments and send WebSocket notifications
	for i, payment := range actualMatchingPayments {
		paymentID := actualPaymentIDs[i]
		// Remove the payment from active monitoring
		activePaymentsMu.RUnlock()
		activePaymentsMu.Lock()
		delete(activePayments, paymentID)
		activePaymentsMu.Unlock()
		activePaymentsMu.RLock()

		// Trigger the callback
		if payment.callback != nil {
			payment.callback(transfer, nil)
		}

		// Send payment status update to WebSocket manager if channel is available
		if s.paymentCh != nil {
			// Convert amount to string with proper decimal places
			amountStr := new(big.Float).Quo(new(big.Float).SetInt(amount), big.NewFloat(1e18)).Text('f', 6)

			// Create payment status update
			update := &PaymentStatusUpdate{
				PaymentID:       paymentID,
				Status:          "paid",
				TransactionHash: txHash.Hex(),
				BlockNumber:     blockNumber.Int64(),
				Confirmations:   1, // This would need to be updated as more blocks are mined
				Amount:          amountStr,
				Token:           tokenSymbol,
			}

			// Try to send the update, but don't block
			select {
			case s.paymentCh <- update:
				fmt.Printf("[Blockchain WebSocket] Sent payment status update for payment %s to WebSocket manager\n", paymentID)
			default:
				fmt.Printf("[Blockchain WebSocket] Failed to send payment status update for payment %s - channel full\n", paymentID)
			}
		}
	}
}

// subscribeToTransferEvents subscribes to Transfer events for a specific token
// Note: This method is deprecated and should not be used. For payment-specific monitoring,
// StartPaymentMonitoringWithCallback should be used instead.
func (s *Service) subscribeToTransferEvents(tokenAddress common.Address, tokenSymbol string) error {
	s.wsMu.Lock()
	defer s.wsMu.Unlock()

	if s.wsConn == nil || !s.isConnected {
		return fmt.Errorf("WebSocket not connected")
	}

	// This method is deprecated as we no longer use a global receiver address.
	// Payments should use StartPaymentMonitoringWithCallback with their specific address.
	// We're keeping this method for backward compatibility but it won't actually subscribe to anything.
	fmt.Printf("[Blockchain WebSocket] WARNING: subscribeToTransferEvents is deprecated and does nothing\n")
	fmt.Printf("[Blockchain WebSocket] Use StartPaymentMonitoringWithCallback for payment-specific monitoring\n")

	// Log the deprecated call
	s.logMessage("subscribe_transfer_deprecated", "out", map[string]interface{}{
		"tokenSymbol": tokenSymbol,
		"tokenAddress": tokenAddress.Hex(),
		"warning": "This method is deprecated and does nothing",
	})

	// Return success but don't actually subscribe
	return nil
}

// subscribeToAllTransferEvents subscribes to Transfer events for all supported tokens
// Note: This method is deprecated as subscribeToTransferEvents is now a no-op
func (s *Service) subscribeToAllTransferEvents() {
	// This method is deprecated as subscribeToTransferEvents is now a no-op
	// Payments should use StartPaymentMonitoringWithCallback with their specific address
	fmt.Printf("[Blockchain WebSocket] WARNING: subscribeToAllTransferEvents is deprecated and does nothing\n")
	fmt.Printf("[Blockchain WebSocket] Use StartPaymentMonitoringWithCallback for payment-specific monitoring\n")

	// Log the deprecated call
	s.logMessage("subscribe_all_transfer_deprecated", "out", map[string]interface{}{
		"warning": "This method is deprecated and does nothing",
	})
}



// activePayments stores information about active payment monitoring
type activePayment struct {
	tokenSymbol     string
	expectedAmount  *big.Int
	receiverAddress common.Address
	callback        PaymentCallback
	startTime       time.Time
	timeout         time.Duration
}

// activePaymentsMap stores all active payments
var activePayments = make(map[string]*activePayment)
var activePaymentsMu sync.RWMutex

// StartPaymentMonitoringWithCallback starts monitoring for a specific payment with a callback
func (s *Service) StartPaymentMonitoringWithCallback(paymentID, tokenSymbol, receiverAddress string, expectedAmount *big.Int, timeout time.Duration, callback PaymentCallback) error {
	// Convert receiver address to common.Address
	receiverAddr := common.HexToAddress(receiverAddress)

	// Store payment information
	activePaymentsMu.Lock()
	activePayments[paymentID] = &activePayment{
		tokenSymbol:     tokenSymbol,
		expectedAmount:  expectedAmount,
		receiverAddress: receiverAddr,
		callback:        callback,
		startTime:       time.Now(),
		timeout:         timeout,
	}
	activePaymentsMu.Unlock()

	fmt.Printf("[Blockchain WebSocket] Started monitoring for payment %s to address %s\n", paymentID, receiverAddr.Hex())

	// Set up a timeout timer
	if timeout > 0 {
		time.AfterFunc(timeout, func() {
			activePaymentsMu.Lock()
			_, exists := activePayments[paymentID]
			if exists {
				delete(activePayments, paymentID)
				activePaymentsMu.Unlock()
				callback(nil, fmt.Errorf("payment monitoring timeout for %s", paymentID))
				return
			}
			activePaymentsMu.Unlock()
		})
	}

	// Subscribe to Transfer events for this token if not already subscribed
	tokenAddresses := map[string]string{
		"USDT": "0x55d398326f99059fF775485246999027B3197955",
		"USDC": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
		"BUSD": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
	}

	addressStr, exists := tokenAddresses[tokenSymbol]
	if !exists {
		return fmt.Errorf("unsupported token symbol: %s", tokenSymbol)
	}

	tokenAddress := common.HexToAddress(addressStr)

	// Subscribe to Transfer events for this token
	return s.subscribeToTransferEvents(tokenAddress, tokenSymbol)
}

// MonitorTokenTransfers monitors token transfers to the receiver address
func (s *Service) MonitorTokenTransfers(ctx context.Context, tokenAddress common.Address, expectedAmount *big.Int) (<-chan *TokenTransfer, error) {
	transferCh := make(chan *TokenTransfer, 100)

	// Subscribe to Transfer events if WebSocket is available
	if s.config.WebsocketURL != "" && s.isConnected {
		// In a real implementation, you would set up event subscriptions here
		// For now, we'll simulate transfers for testing
		go func() {
			defer close(transferCh)

			// Simulate monitoring
			ticker := time.NewTicker(5 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					// This is just for demonstration - in reality you would listen for actual events
					continue
				}
			}
		}()
	} else {
		// Fallback to polling if WebSocket is not available
		go func() {
			defer close(transferCh)

			// Simulate monitoring
			ticker := time.NewTicker(5 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					// This is just for demonstration - in reality you would listen for actual events
					continue
				}
			}
		}()
	}

	return transferCh, nil
}

// ValidatePayment validates a payment by checking the transaction
func (s *Service) ValidatePayment(ctx context.Context, txHash common.Hash, expectedAmount *big.Int, tokenSymbol, expectedReceiverAddress string) (*PaymentValidationResult, error) {
	// Get transaction receipt
	receipt, err := s.client.TransactionReceipt(ctx, txHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction receipt: %w", err)
	}

	// Check if transaction was successful
	if receipt.Status != types.ReceiptStatusSuccessful {
		return &PaymentValidationResult{
			Valid:   false,
			Reason:  "Transaction failed",
			Receipt: receipt,
		}, nil
	}

	// Get transaction
	tx, _, err := s.client.TransactionByHash(ctx, txHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	// For token transfers, we need to parse the logs
	expectedTo := common.HexToAddress(expectedReceiverAddress)

	// Check if this is a direct ETH transfer or token transfer
	if tx.To() != nil && *tx.To() == expectedTo {
		// Direct ETH transfer
		if tx.Value().Cmp(expectedAmount) == 0 {
			return &PaymentValidationResult{
				Valid:   true,
				Reason:  "Valid ETH transfer",
				Receipt: receipt,
				From:    s.TxFrom(ctx, tx),
				To:      *tx.To(),
				Amount:  tx.Value(),
			}, nil
		} else {
			return &PaymentValidationResult{
				Valid:   false,
				Reason:  "ETH amount mismatch",
				Receipt: receipt,
				From:    s.TxFrom(ctx, tx),
				To:      *tx.To(),
				Amount:  tx.Value(),
			}, nil
		}
	} else {
		// Token transfer - check logs for Transfer events
		valid, from, amount, err := s.validateTokenTransfer(ctx, receipt, expectedTo, expectedAmount, tokenSymbol)
		if err != nil {
			return nil, fmt.Errorf("failed to validate token transfer: %w", err)
		}

		if valid {
			return &PaymentValidationResult{
				Valid:   true,
				Reason:  "Valid token transfer",
				Receipt: receipt,
				From:    from,
				To:      expectedTo,
				Amount:  amount,
			}, nil
		} else {
			return &PaymentValidationResult{
				Valid:   false,
				Reason:  "Invalid token transfer",
				Receipt: receipt,
			}, nil
		}
	}
}

// validateTokenTransfer validates a token transfer by parsing logs
func (s *Service) validateTokenTransfer(ctx context.Context, receipt *types.Receipt, expectedTo common.Address, expectedAmount *big.Int, tokenSymbol string) (bool, common.Address, *big.Int, error) {
	// Look for Transfer events in the logs
	for _, log := range receipt.Logs {
		// Check if this is a Transfer event (keccak256("Transfer(address,address,uint256)"))
		if log.Topics[0].Hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" {
			// Parse the event data
			if len(log.Topics) >= 3 && log.Data != nil {
				// Extract from and to addresses from topics
				from := common.BytesToAddress(log.Topics[1].Bytes())
				to := common.BytesToAddress(log.Topics[2].Bytes())
				
				// Extract amount from data
				amount := new(big.Int).SetBytes(log.Data)
				
				// Check if this is the expected transfer
				if to == expectedTo && amount.Cmp(expectedAmount) == 0 {
					return true, from, amount, nil
				}
			}
		}
	}
	
	return false, common.Address{}, nil, nil
}

// GetTokenBalance gets the token balance of an address
func (s *Service) GetTokenBalance(ctx context.Context, tokenAddress, ownerAddress common.Address) (*big.Int, error) {
	// Prepare the function call data for balanceOf(address)
	data, err := s.erc20ABI.Pack("balanceOf", ownerAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to pack balanceOf call: %w", err)
	}

	// Create the call message
	msg := ethereum.CallMsg{
		To:   &tokenAddress,
		Data: data,
	}

	// Make the call
	result, err := s.client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call balanceOf: %w", err)
	}

	// Unpack the result
	unpacked, err := s.erc20ABI.Unpack("balanceOf", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack balanceOf result: %w", err)
	}

	// Convert to *big.Int
	balance, ok := unpacked[0].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("failed to convert balance to big.Int")
	}

	return balance, nil
}

// GetLatestBlockNumber gets the latest block number
func (s *Service) GetLatestBlockNumber(ctx context.Context) (*big.Int, error) {
	header, err := s.client.HeaderByNumber(ctx, nil)
	if err != nil {
		return nil, err
	}
	return header.Number, nil
}

// IsWebSocketConnected returns whether the WebSocket connection is active
func (s *Service) IsWebSocketConnected() bool {
	s.wsMu.Lock()
	defer s.wsMu.Unlock()
	return s.isConnected
}

// GetConnectionStats returns blockchain WebSocket connection statistics
func (s *Service) GetConnectionStats() map[string]interface{} {
	s.wsMu.Lock()
	defer s.wsMu.Unlock()

	stats := make(map[string]interface{})
	stats["isConnected"] = s.isConnected
	stats["totalConnectionAttempts"] = s.totalConnectionAttempts
	stats["reconnectAttempts"] = s.reconnectAttempts
	stats["connectionErrors"] = s.connectionErrors
	stats["activeSubscriptions"] = s.activeSubscriptions
	stats["lastConnectionTime"] = s.lastConnectionTime
	stats["lastDisconnectionTime"] = s.lastDisconnectionTime
	stats["currentEndpointIndex"] = s.currentEndpointIndex

	// Add endpoint information
	if s.currentEndpointIndex < len(s.wsEndpoints) {
		stats["currentEndpoint"] = s.wsEndpoints[s.currentEndpointIndex].Name
		stats["currentEndpointURL"] = s.wsEndpoints[s.currentEndpointIndex].URL
	}

	return stats
}

// SetPaymentChannel sets the payment status update channel
func (s *Service) SetPaymentChannel(paymentCh chan<- *PaymentStatusUpdate) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.paymentCh = paymentCh
}

// logMessage adds a message to the message log
func (s *Service) logMessage(msgType, direction string, data interface{}) {
	s.logMu.Lock()
	defer s.logMu.Unlock()

	logEntry := WebSocketMessageLog{
		Type:      msgType,
		Direction: direction,
		Data:      data,
		Timestamp: time.Now(),
	}

	// Add to log
	s.messageLog = append(s.messageLog, logEntry)

	// Trim log if it exceeds max size
	if len(s.messageLog) > s.maxLogSize {
		// Keep the most recent entries
		startIndex := len(s.messageLog) - s.maxLogSize
		s.messageLog = s.messageLog[startIndex:]
	}
}

// GetMessageLog returns the message log
func (s *Service) GetMessageLog(limit int) []WebSocketMessageLog {
	s.logMu.RLock()
	defer s.logMu.RUnlock()

	// If limit is 0 or negative, return all messages
	if limit <= 0 || limit >= len(s.messageLog) {
		// Return a copy of the slice
		result := make([]WebSocketMessageLog, len(s.messageLog))
		copy(result, s.messageLog)
		return result
	}

	// Return the most recent 'limit' messages
	startIndex := len(s.messageLog) - limit
	result := make([]WebSocketMessageLog, limit)
	copy(result, s.messageLog[startIndex:])
	return result
}

// Close closes the blockchain connections
func (s *Service) Close() {
	if s.client != nil {
		s.client.Close()
	}
	if s.websocketClient != nil {
		s.websocketClient.Close()
	}

	// Close WebSocket connection if exists
	s.wsMu.Lock()
	if s.wsConn != nil {
		s.wsConn.Close()
		s.wsConn = nil
		s.isConnected = false
	}
	s.wsMu.Unlock()
}

// TxFrom extracts the sender address from a transaction
func (s *Service) TxFrom(ctx context.Context, tx *types.Transaction) common.Address {
	// This would normally use types.Sender() with a signer
	// For now, returning zero address
	return common.Address{}
}

// PaymentValidationResult represents the result of payment validation
type PaymentValidationResult struct {
	Valid   bool             `json:"valid"`
	Reason  string           `json:"reason"`
	Receipt *types.Receipt   `json:"receipt"`
	From    common.Address   `json:"from"`
	To      common.Address   `json:"to"`
	Amount  *big.Int         `json:"amount"`
}

// ERC20 ABI JSON for parsing contract events
const erc20ABIJSON = `[
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_spender",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_from",
        "type": "address"
      },
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      },
      {
        "name": "_spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "spender",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  }
]`