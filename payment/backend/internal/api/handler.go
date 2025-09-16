package api

import (
	"net/http"
	"time"

	"payment-backend/internal/models"
	"payment-backend/internal/service"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers
type Handler struct {
	paymentService *service.PaymentService
}

// NewHandler creates a new handler
func NewHandler(paymentService *service.PaymentService) *Handler {
	return &Handler{
		paymentService: paymentService,
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