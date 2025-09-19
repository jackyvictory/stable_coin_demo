package api

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"payment-backend/internal/config"
	"payment-backend/internal/models"
	"payment-backend/internal/service"
	"payment-backend/internal/api/websocket"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers
type Handler struct {
	paymentService *service.PaymentService
	wsManager      *websocket.Manager
	config         *config.Config
}

// NewHandler creates a new handler
func NewHandler(paymentService *service.PaymentService, wsManager *websocket.Manager, config *config.Config) *Handler {
	return &Handler{
		paymentService: paymentService,
		wsManager:      wsManager,
		config:         config,
	}
}

// CreatePaymentSession creates a new payment session
// @Summary Create a new payment session
// @Description Creates a new payment session for a product purchase
// @Tags payments
// @Accept json
// @Produce json
// @Param request body CreatePaymentRequest true "Payment creation request"
// @Success 201 {object} PaymentSessionResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/payments [post]
func (h *Handler) CreatePaymentSession(c *gin.Context) {
	var req CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Invalid request data",
			Details: err.Error(),
		})
		return
	}

	// Validate required fields
	if req.ProductID == "" || req.ProductName == "" || req.Amount <= 0 || 
	   req.Currency == "" || req.TokenSymbol == "" || req.NetworkID == "" || 
	   req.ReceiverAddress == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Missing required fields",
			Details: "productId, productName, amount, currency, tokenSymbol, networkId, and receiverAddress are required",
		})
		return
	}

	// Create payment session
	session, err := h.paymentService.CreatePaymentSession(c.Request.Context(), &service.CreatePaymentRequest{
		ProductID:       req.ProductID,
		ProductName:     req.ProductName,
		Amount:          req.Amount,
		Currency:        req.Currency,
		TokenSymbol:     req.TokenSymbol,
		NetworkID:       req.NetworkID,
		ReceiverAddress: req.ReceiverAddress,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to create payment session",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, toPaymentSessionResponse(session))
}

// GetPaymentSession retrieves a payment session
// @Summary Get payment session status
// @Description Retrieve the current status of a payment session
// @Tags payments
// @Produce json
// @Param paymentId path string true "Payment ID"
// @Success 200 {object} PaymentSessionResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/payments/{paymentId} [get]
func (h *Handler) GetPaymentSession(c *gin.Context) {
	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Payment ID is required",
		})
		return
	}

	session, err := h.paymentService.GetPaymentSession(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    http.StatusNotFound,
			Message: "Payment session not found",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, toPaymentSessionResponse(session))
}

// ProcessPayment processes a payment by validating the transaction
// @Summary Process payment
// @Description Process a payment by validating the transaction hash
// @Tags payments
// @Accept json
// @Produce json
// @Param paymentId path string true "Payment ID"
// @Param request body ProcessPaymentRequest true "Transaction hash"
// @Success 200 {object} PaymentSessionResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/payments/{paymentId}/process [post]
func (h *Handler) ProcessPayment(c *gin.Context) {
	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Payment ID is required",
		})
		return
	}

	var req ProcessPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Invalid request data",
			Details: err.Error(),
		})
		return
	}

	if req.TransactionHash == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Transaction hash is required",
		})
		return
	}

	// Process payment
	err := h.paymentService.ProcessPayment(c.Request.Context(), paymentID, req.TransactionHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to process payment",
			Details: err.Error(),
		})
		return
	}

	// Get updated payment session
	session, err := h.paymentService.GetPaymentSession(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    http.StatusNotFound,
			Message: "Payment session not found",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, toPaymentSessionResponse(session))
}

// GetTokens retrieves all supported tokens
// @Summary Get supported tokens
// @Description Retrieve a list of supported tokens
// @Tags tokens
// @Produce json
// @Success 200 {object} TokensResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/tokens [get]
func (h *Handler) GetTokens(c *gin.Context) {
	tokens, err := h.paymentService.GetAllTokens(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to retrieve tokens",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, TokensResponse{
		Tokens: toTokensResponse(tokens),
	})
}

// GetNetworks retrieves all supported networks
// @Summary Get supported networks
// @Description Retrieve a list of supported networks
// @Tags networks
// @Produce json
// @Success 200 {object} NetworksResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/networks [get]
func (h *Handler) GetNetworks(c *gin.Context) {
	networks, err := h.paymentService.GetAllNetworks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to retrieve networks",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, NetworksResponse{
		Networks: toNetworksResponse(networks),
	})
}

// GetPaymentStats retrieves payment statistics
// @Summary Get payment statistics
// @Description Retrieve payment statistics and analytics
// @Tags statistics
// @Produce json
// @Success 200 {object} PaymentStatsResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stats/payments [get]
func (h *Handler) GetPaymentStats(c *gin.Context) {
	stats, err := h.paymentService.GetPaymentStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to retrieve payment statistics",
			Details: err.Error(),
		})
		return
	}

	// Convert models.PaymentStats to PaymentStatsResponse
	response := PaymentStatsResponse{
		TotalPayments:       stats.TotalPayments,
		SuccessfulPayments:  stats.SuccessfulPayments,
		FailedPayments:      stats.FailedPayments,
		SuccessRate:         stats.SuccessRate,
		PaymentsByToken:     stats.PaymentsByToken,
		PaymentsByPeriod:    stats.PaymentsByPeriod,
		AverageProcessingTime: stats.AverageProcessingTime,
		FailureReasons:      stats.FailureReasons,
	}

	c.JSON(http.StatusOK, response)
}

// GetMonitoringStats retrieves monitoring statistics
// @Summary Get monitoring performance statistics
// @Description Retrieve blockchain monitoring and performance statistics
// @Tags statistics
// @Produce json
// @Success 200 {object} MonitoringStatsResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stats/monitoring [get]
func (h *Handler) GetMonitoringStats(c *gin.Context) {
	stats, err := h.paymentService.GetMonitoringStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to retrieve monitoring statistics",
			Details: err.Error(),
		})
		return
	}

	// Get WebSocket connection stats
	wsStats := h.wsManager.GetConnectionStats()

	// Convert WebSocket stats to the expected format
	wsConnections := make(map[string]int)
	wsConnections["total"] = int(wsStats["totalConnections"].(int64))
	wsConnections["active"] = int(wsStats["activeConnections"].(int64))
	wsConnections["errors"] = int(wsStats["connectionErrors"].(int64))

	// Get blockchain connection stats
	blockchainStats := h.paymentService.GetBlockchainConnectionStats()

	// Convert models.MonitoringStats to MonitoringStatsResponse
	response := MonitoringStatsResponse{
		WebsocketConnections:  wsConnections,
		BlockchainMonitoring:  blockchainStats,
		ValidationPerformance: stats.ValidationPerformance,
	}

	c.JSON(http.StatusOK, response)
}

// GetSystemStats retrieves system health statistics
// @Summary Get system health statistics
// @Description Retrieve system health and performance statistics
// @Tags statistics
// @Produce json
// @Success 200 {object} SystemStatsResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stats/system [get]
func (h *Handler) GetSystemStats(c *gin.Context) {
	stats, err := h.paymentService.GetSystemStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to retrieve system statistics",
			Details: err.Error(),
		})
		return
	}

	// Convert models.SystemStats to SystemStatsResponse
	response := SystemStatsResponse{
		Uptime:             stats.Uptime,
		CPUUsage:           stats.CPUUsage,
		MemoryUsage:        stats.MemoryUsage,
		DiskUsage:          stats.DiskUsage,
		APIResponseTime:    stats.APIResponseTime,
		ErrorRate:          stats.ErrorRate,
		DatabaseHealth:     stats.DatabaseHealth,
		BlockchainConnection: stats.BlockchainConnection,
	}

	c.JSON(http.StatusOK, response)
}

// GetWebSocketStats retrieves WebSocket connection statistics
// @Summary Get WebSocket connection statistics
// @Description Retrieve WebSocket connection statistics for both frontend and blockchain
// @Tags statistics
// @Produce json
// @Success 200 {object} WebSocketStatsResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stats/websocket [get]
func (h *Handler) GetWebSocketStats(c *gin.Context) {
	// Get frontend WebSocket connection stats from WebSocket manager
	frontendStats := h.wsManager.GetConnectionStats()

	// Get blockchain WebSocket connection stats from payment service
	blockchainStats := h.paymentService.GetBlockchainConnectionStats()

	// Create response
	response := WebSocketStatsResponse{
		Frontend:   frontendStats,
		Blockchain: blockchainStats,
	}

	c.JSON(http.StatusOK, response)
}

// GetWebSocketMessages retrieves WebSocket message logs
// @Summary Get WebSocket message logs
// @Description Retrieve recent WebSocket message logs from both frontend and blockchain
// @Tags statistics
// @Produce json
// @Param limit query int false "Number of messages to retrieve (default: 50, max: 1000)"
// @Success 200 {object} WebSocketMessagesResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stats/websocket/messages [get]
func (h *Handler) GetWebSocketMessages(c *gin.Context) {
	// Get limit parameter, default to 50, max 1000
	limit := 50
	if limitParam := c.Query("limit"); limitParam != "" {
		if parsedLimit, err := strconv.Atoi(limitParam); err == nil {
			if parsedLimit > 0 && parsedLimit <= 1000 {
				limit = parsedLimit
			}
		}
	}

	// Get message logs from WebSocket manager (frontend messages)
	frontendMessages := h.wsManager.GetMessageLog(limit)

	// Get message logs from blockchain service (blockchain messages)
	blockchainMessages := h.paymentService.GetBlockchainMessageLog(limit)

	// Combine and sort messages by timestamp (newest first)
	allMessages := make([]interface{}, 0, len(frontendMessages)+len(blockchainMessages))

	// Add frontend messages with source identifier
	for _, msg := range frontendMessages {
		enrichedMsg := map[string]interface{}{
			"source":      "frontend",
			"type":        msg.Type,
			"paymentId":   msg.PaymentID,
			"direction":   msg.Direction,
			"data":        msg.Data,
			"timestamp":   msg.Timestamp,
		}
		allMessages = append(allMessages, enrichedMsg)
	}

	// Add blockchain messages with source identifier
	for _, msg := range blockchainMessages {
		enrichedMsg := map[string]interface{}{
			"source":    "blockchain",
			"type":      msg.Type,
			"direction": msg.Direction,
			"data":      msg.Data,
			"timestamp": msg.Timestamp,
		}
		allMessages = append(allMessages, enrichedMsg)
	}

	// Sort messages by timestamp (newest first)
	sort.Slice(allMessages, func(i, j int) bool {
		msgI := allMessages[i].(map[string]interface{})
		msgJ := allMessages[j].(map[string]interface{})
		timeI := msgI["timestamp"].(time.Time)
		timeJ := msgJ["timestamp"].(time.Time)
		return timeI.After(timeJ)
	})

	// Limit to requested number of messages
	if len(allMessages) > limit && limit > 0 {
		allMessages = allMessages[:limit]
	}

	// Create response
	response := WebSocketMessagesResponse{
		Messages: allMessages,
		Count:    len(allMessages),
	}

	c.JSON(http.StatusOK, response)
}

// CreatePaymentRequest represents the request body for creating a payment session
type CreatePaymentRequest struct {
	ProductID       string  `json:"productId"`
	ProductName     string  `json:"productName"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	TokenSymbol     string  `json:"tokenSymbol"`
	NetworkID       string  `json:"networkId"`
	ReceiverAddress string  `json:"receiverAddress"`
}

// ProcessPaymentRequest represents the request body for processing a payment
type ProcessPaymentRequest struct {
	TransactionHash string `json:"transactionHash"`
}

// PaymentSessionResponse represents the response for a payment session
type PaymentSessionResponse struct {
	PaymentID       string     `json:"paymentId"`
	ProductID       string     `json:"productId"`
	ProductName     string     `json:"productName"`
	Amount          float64    `json:"amount"`
	Currency        string     `json:"currency"`
	TokenSymbol     string     `json:"tokenSymbol"`
	NetworkID       string     `json:"networkId"`
	ReceiverAddress string     `json:"receiverAddress"`
	SenderAddress   *string    `json:"senderAddress,omitempty"`
	Status          string     `json:"status"`
	QRCodeData      *string    `json:"qrCodeData,omitempty"`
	TransactionHash *string    `json:"transactionHash,omitempty"`
	BlockNumber     *int64     `json:"blockNumber,omitempty"`
	ConfirmedAt     *time.Time `json:"confirmedAt,omitempty"`
	ExpiresAt       time.Time  `json:"expiresAt"`
	CreatedAt       time.Time  `json:"createdAt"`
}

// TokensResponse represents the response for tokens
type TokensResponse struct {
	Tokens []*TokenResponse `json:"tokens"`
}

// TokenResponse represents a token in the response
type TokenResponse struct {
	Symbol          string `json:"symbol"`
	Name            string `json:"name"`
	ContractAddress string `json:"contractAddress"`
	Decimals        int    `json:"decimals"`
	NetworkID       string `json:"networkId"`
	Enabled         bool   `json:"enabled"`
}

// NetworksResponse represents the response for networks
type NetworksResponse struct {
	Networks []*NetworkResponse `json:"networks"`
}

// PaymentStatsResponse represents the response for payment statistics
type PaymentStatsResponse struct {
	TotalPayments       int                `json:"total_payments"`
	SuccessfulPayments  int                `json:"successful_payments"`
	FailedPayments      int                `json:"failed_payments"`
	SuccessRate         float64            `json:"success_rate"`
	PaymentsByToken     map[string]int     `json:"payments_by_token"`
	PaymentsByPeriod    map[string]int     `json:"payments_by_period"`
	AverageProcessingTime float64          `json:"average_processing_time"`
	FailureReasons      map[string]int     `json:"failure_reasons"`
}

// MonitoringStatsResponse represents the response for monitoring statistics
type MonitoringStatsResponse struct {
	WebsocketConnections   map[string]int `json:"websocket_connections"`
	BlockchainMonitoring   map[string]any `json:"blockchain_monitoring"`
	ValidationPerformance  map[string]any `json:"validation_performance"`
}

// SystemStatsResponse represents the response for system statistics
type SystemStatsResponse struct {
	Uptime             int     `json:"uptime"`
	CPUUsage           float64 `json:"cpu_usage"`
	MemoryUsage        float64 `json:"memory_usage"`
	DiskUsage          float64 `json:"disk_usage"`
	APIResponseTime    int     `json:"api_response_time"`
	ErrorRate          float64 `json:"error_rate"`
	DatabaseHealth     string  `json:"database_health"`
	BlockchainConnection string `json:"blockchain_connection"`
}

// WebSocketStatsResponse represents the response for WebSocket statistics
type WebSocketStatsResponse struct {
	Frontend   map[string]interface{} `json:"frontend"`
	Blockchain map[string]interface{} `json:"blockchain"`
}

// WebSocketMessagesResponse represents the response for WebSocket message logs
type WebSocketMessagesResponse struct {
	Messages []interface{} `json:"messages"`
	Count    int           `json:"count"`
}

// HealthResponse represents the response for health check
type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// NetworkResponse represents a network in the response
type NetworkResponse struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	ChainID       int64   `json:"chainId"`
	RPCURL        string  `json:"rpcUrl"`
	WebsocketURL  *string `json:"websocketUrl,omitempty"`
	BlockExplorer *string `json:"blockExplorer,omitempty"`
	Enabled       bool    `json:"enabled"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// toPaymentSessionResponse converts a models.PaymentSession to PaymentSessionResponse
func toPaymentSessionResponse(session *models.PaymentSession) PaymentSessionResponse {
	return PaymentSessionResponse{
		PaymentID:       session.PaymentID,
		ProductID:       session.ProductID,
		ProductName:     session.ProductName,
		Amount:          session.Amount,
		Currency:        session.Currency,
		TokenSymbol:     session.TokenSymbol,
		NetworkID:       session.NetworkID,
		ReceiverAddress: session.ReceiverAddress,
		SenderAddress:   session.SenderAddress,
		Status:          string(session.Status),
		QRCodeData:      session.QRCodeData,
		TransactionHash: session.TransactionHash,
		BlockNumber:     session.BlockNumber,
		ConfirmedAt:     session.ConfirmedAt,
		ExpiresAt:       session.ExpiresAt,
		CreatedAt:       session.CreatedAt,
	}
}

// toTokensResponse converts []*models.Token to []*TokenResponse
func toTokensResponse(tokens []*models.Token) []*TokenResponse {
	response := make([]*TokenResponse, len(tokens))
	for i, token := range tokens {
		response[i] = &TokenResponse{
			Symbol:          token.Symbol,
			Name:            token.Name,
			ContractAddress: token.ContractAddress,
			Decimals:        token.Decimals,
			NetworkID:       token.NetworkID,
			Enabled:         token.Enabled,
		}
	}
	return response
}

// toNetworksResponse converts []*models.Network to []*NetworkResponse
func toNetworksResponse(networks []*models.Network) []*NetworkResponse {
	response := make([]*NetworkResponse, len(networks))
	for i, network := range networks {
		response[i] = &NetworkResponse{
			ID:            network.ID,
			Name:          network.Name,
			ChainID:       network.ChainID,
			RPCURL:        network.RPCURL,
			WebsocketURL:  network.WebsocketURL,
			BlockExplorer: network.BlockExplorer,
			Enabled:       network.Enabled,
		}
	}
	return response
}

// DebugSimulatePayment simulates a payment success for testing purposes
// @Summary Simulate payment success (Debug only)
// @Description Sends a payment success message via WebSocket for testing
// @Tags debug
// @Accept json
// @Produce json
// @Param paymentId path string true "Payment ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /debug/payments/{paymentId}/simulate-success [post]
func (h *Handler) DebugSimulatePayment(c *gin.Context) {
	// Only allow in debug mode
	if !h.config.DebugMode {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Code:    http.StatusForbidden,
			Message: "Debug endpoints are not available in production",
		})
		return
	}

	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Payment ID is required",
		})
		return
	}

	// Verify payment exists
	payment, err := h.paymentService.GetPaymentSession(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    http.StatusNotFound,
			Message: "Payment not found",
			Details: err.Error(),
		})
		return
	}

	// Update payment status to paid in database
	now := time.Now()
	senderAddress := "0x1234567890abcdef1234567890abcdef12345678"
	transactionHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	blockNumber := int64(12345678)

	err = h.paymentService.UpdatePaymentStatus(c.Request.Context(), paymentID, models.PaymentPaid, &senderAddress, &transactionHash, &blockNumber, &now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to update payment status",
			Details: err.Error(),
		})
		return
	}

	// Send payment success message via WebSocket
	h.wsManager.PushPaymentStatusUpdate(
		paymentID,
		"paid",
		transactionHash,
		blockNumber,
		12,
		fmt.Sprintf("%.6f", payment.Amount),
		payment.TokenSymbol,
	)

	c.JSON(http.StatusOK, gin.H{
		"message":   "Payment success simulated",
		"paymentId": paymentID,
	})
}