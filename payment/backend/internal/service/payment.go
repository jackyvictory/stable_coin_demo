package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"payment-backend/internal/blockchain"
	"payment-backend/internal/models"
	"payment-backend/internal/repository"
)

// PaymentService provides payment-related business logic
type PaymentService struct {
	repo         *repository.Repository
	bcService    BlockchainService
	config       PaymentConfig
}

// BlockchainService interface for blockchain operations
type BlockchainService interface {
	MonitorTokenTransfers(ctx context.Context, tokenAddress common.Address, expectedAmount *big.Int) (<-chan *blockchain.TokenTransfer, error)
	ValidatePayment(ctx context.Context, txHash common.Hash, expectedAmount *big.Int, tokenSymbol, receiverAddress string) (*blockchain.PaymentValidationResult, error)
	GetTokenBalance(ctx context.Context, tokenAddress, ownerAddress common.Address) (*big.Int, error)
	GetLatestBlockNumber(ctx context.Context) (*big.Int, error)
	StartPaymentMonitoringWithCallback(paymentID, tokenSymbol, receiverAddress string, expectedAmount *big.Int, timeout time.Duration, callback blockchain.PaymentCallback) error
	GetConnectionStats() map[string]interface{}
	GetMessageLog(limit int) []blockchain.WebSocketMessageLog
	Close()
}

// PaymentConfig holds payment configuration
type PaymentConfig struct {
	ReceiverAddress string
	PaymentTimeout  time.Duration
}

// NewPaymentService creates a new payment service
func NewPaymentService(repo *repository.Repository, bcService BlockchainService, config PaymentConfig) *PaymentService {
	return &PaymentService{
		repo:      repo,
		bcService: bcService,
		config:    config,
	}
}

// CreatePaymentSession creates a new payment session
func (s *PaymentService) CreatePaymentSession(ctx context.Context, req *CreatePaymentRequest) (*models.PaymentSession, error) {
	// Generate unique payment ID
	paymentID, err := generatePaymentID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate payment ID: %w", err)
	}

	// Calculate expiration time using UTC to avoid timezone issues
	expiresAt := time.Now().UTC().Add(s.config.PaymentTimeout)

	// Generate QR code data (simplified)
	qrCodeData := fmt.Sprintf("%s?amount=%f&token=%s", req.ReceiverAddress, req.Amount, req.TokenSymbol)

	// Create payment session
	session := &models.PaymentSession{
		PaymentID:       paymentID,
		ProductID:       req.ProductID,
		ProductName:     req.ProductName,
		Amount:          req.Amount,
		Currency:        req.Currency,
		TokenSymbol:     req.TokenSymbol,
		NetworkID:       req.NetworkID,
		ReceiverAddress: req.ReceiverAddress,
		Status:          models.PaymentCreated,
		QRCodeData:      &qrCodeData,
		ExpiresAt:       expiresAt,
	}

	// Save to database
	if err := s.repo.CreatePaymentSession(session); err != nil {
		return nil, fmt.Errorf("failed to create payment session: %w", err)
	}

	// Start monitoring for payment (in a real implementation, this would be done asynchronously)
	go s.monitorPayment(context.Background(), session)

	return session, nil
}

// GetPaymentSession retrieves a payment session by ID
func (s *PaymentService) GetPaymentSession(ctx context.Context, paymentID string) (*models.PaymentSession, error) {
	session, err := s.repo.GetPaymentSessionByPaymentID(paymentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get payment session: %w", err)
	}
	if session == nil {
		return nil, fmt.Errorf("payment session not found")
	}
	return session, nil
}

// GetAllTokens retrieves all supported tokens
func (s *PaymentService) GetAllTokens(ctx context.Context) ([]*models.Token, error) {
	tokens, err := s.repo.GetAllTokens()
	if err != nil {
		return nil, fmt.Errorf("failed to get tokens: %w", err)
	}
	return tokens, nil
}

// GetAllNetworks retrieves all supported networks
func (s *PaymentService) GetAllNetworks(ctx context.Context) ([]*models.Network, error) {
	networks, err := s.repo.GetAllNetworks()
	if err != nil {
		return nil, fmt.Errorf("failed to get networks: %w", err)
	}
	return networks, nil
}

// GetPaymentStats retrieves payment statistics
func (s *PaymentService) GetPaymentStats(ctx context.Context) (*models.PaymentStats, error) {
	// This is a simplified implementation
	// In a real implementation, you would query the database for statistics
	return &models.PaymentStats{
		TotalPayments:       0,
		SuccessfulPayments:  0,
		FailedPayments:      0,
		SuccessRate:         0.0,
		PaymentsByToken:     make(map[string]int),
		PaymentsByPeriod:    make(map[string]int),
		AverageProcessingTime: 0.0,
		FailureReasons:      make(map[string]int),
	}, nil
}

// GetMonitoringStats retrieves monitoring statistics
func (s *PaymentService) GetMonitoringStats(ctx context.Context) (*models.MonitoringStats, error) {
	// This is a simplified implementation
	// In a real implementation, you would gather monitoring statistics
	return &models.MonitoringStats{
		WebsocketConnections: map[string]int{
			"active":   0,
			"healthy":  0,
			"degraded": 0,
		},
		BlockchainMonitoring: map[string]interface{}{
			"average_latency":        0,
			"last_block_processed":   0,
			"blocks_behind":          0,
			"events_detected":        0,
		},
		ValidationPerformance: map[string]interface{}{
			"average_validation_time": 0.0,
			"validation_success_rate": 0.0,
		},
	}, nil
}

// GetSystemStats retrieves system health statistics
func (s *PaymentService) GetSystemStats(ctx context.Context) (*models.SystemStats, error) {
	// This is a simplified implementation
	// In a real implementation, you would gather system statistics
	return &models.SystemStats{
		Uptime:             0,
		CPUUsage:           0.0,
		MemoryUsage:        0.0,
		DiskUsage:          0.0,
		APIResponseTime:    0,
		ErrorRate:          0.0,
		DatabaseHealth:     "unknown",
		BlockchainConnection: "unknown",
	}, nil
}

// UpdatePaymentStatus updates the status of a payment session
func (s *PaymentService) UpdatePaymentStatus(ctx context.Context, paymentID string, status models.PaymentStatus,
	senderAddress *string, transactionHash *string, blockNumber *int64, confirmedAt *time.Time) error {

	if err := s.repo.UpdatePaymentSessionStatus(paymentID, status, senderAddress, transactionHash, blockNumber, confirmedAt); err != nil {
		return fmt.Errorf("failed to update payment status: %w", err)
	}
	return nil
}

// GetBlockchainConnectionStats retrieves blockchain connection statistics
func (s *PaymentService) GetBlockchainConnectionStats() map[string]interface{} {
	// Check if the blockchain service has the GetConnectionStats method
	if bcServiceWithStats, ok := s.bcService.(interface {
		GetConnectionStats() map[string]interface{}
	}); ok {
		return bcServiceWithStats.GetConnectionStats()
	}

	// Return empty stats if method not available
	return make(map[string]interface{})
}

// GetBlockchainMessageLog retrieves blockchain WebSocket message logs
func (s *PaymentService) GetBlockchainMessageLog(limit int) []blockchain.WebSocketMessageLog {
	// Check if the blockchain service has the GetMessageLog method
	if bcServiceWithLogs, ok := s.bcService.(interface {
		GetMessageLog(limit int) []blockchain.WebSocketMessageLog
	}); ok {
		return bcServiceWithLogs.GetMessageLog(limit)
	}

	// Return empty log if method not available
	return make([]blockchain.WebSocketMessageLog, 0)
}

// monitorPayment monitors a payment session for completion
func (s *PaymentService) monitorPayment(ctx context.Context, session *models.PaymentSession) {
	// Try to start WebSocket monitoring for this payment
	if bcServiceWithWebSocket, ok := s.bcService.(interface {
		StartPaymentMonitoringWithCallback(paymentID, tokenSymbol, receiverAddress string, expectedAmount *big.Int, timeout time.Duration, callback blockchain.PaymentCallback) error
	}); ok {
		// Convert amount to wei for monitoring
		amountWei := new(big.Int)
		amountWei.SetString(fmt.Sprintf("%.0f", session.Amount*1e18), 10)

		// Start monitoring with callback to update payment status
		callback := func(transfer *blockchain.TokenTransfer, err error) {
			if err != nil {
				fmt.Printf("Payment monitoring error for %s: %v\n", session.PaymentID, err)
				// Update payment status to failed
				s.UpdatePaymentStatus(ctx, session.PaymentID, models.PaymentFailed, nil, nil, nil, nil)
				return
			}

			// Update payment status to paid
			senderAddr := transfer.From.Hex()
			txHashStr := transfer.TxHash.Hex()
			blockNum := transfer.BlockNumber.Int64()
			confirmedAt := time.Now()

			err = s.UpdatePaymentStatus(ctx, session.PaymentID, models.PaymentPaid, &senderAddr, &txHashStr, &blockNum, &confirmedAt)
			if err != nil {
				fmt.Printf("Failed to update payment status for %s: %v\n", session.PaymentID, err)
			} else {
				fmt.Printf("Successfully updated payment status for %s to paid\n", session.PaymentID)
			}
		}

		// Start monitoring with 30 minute timeout
		timeout := 30 * time.Minute
		if err := bcServiceWithWebSocket.StartPaymentMonitoringWithCallback(session.PaymentID, session.TokenSymbol, session.ReceiverAddress, amountWei, timeout, callback); err != nil {
			fmt.Printf("Failed to start WebSocket monitoring for payment %s: %v\n", session.PaymentID, err)
		} else {
			fmt.Printf("Started WebSocket monitoring for payment %s to address %s\n", session.PaymentID, session.ReceiverAddress)
		}
	} else {
		// Fallback to simulated monitoring
		fmt.Printf("Started monitoring payment %s (simulated)\n", session.PaymentID)
	}
}


// CreatePaymentRequest represents the request to create a payment session
type CreatePaymentRequest struct {
	ProductID       string  `json:"productId"`
	ProductName     string  `json:"productName"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	TokenSymbol     string  `json:"tokenSymbol"`
	NetworkID       string  `json:"networkId"`
	ReceiverAddress string  `json:"receiverAddress"`
}

// ValidatePaymentIfNeeded validates a payment against the blockchain if it's in a pending state
func (s *PaymentService) ValidatePaymentIfNeeded(ctx context.Context, session *models.PaymentSession) (*models.PaymentSession, error) {
	// Only validate payments that are created or pending
	if session.Status != models.PaymentCreated && session.Status != models.PaymentPending {
		return session, nil
	}

	// If we already have a transaction hash, validate it
	if session.TransactionHash != nil && *session.TransactionHash != "" {
		hash := common.HexToHash(*session.TransactionHash)

		// Convert amount to wei for validation
		amountWei := new(big.Int)
		amountWei.SetString(fmt.Sprintf("%.0f", session.Amount*1e18), 10)

		// Validate payment with the session's receiver address
		result, err := s.bcService.ValidatePayment(ctx, hash, amountWei, session.TokenSymbol, session.ReceiverAddress)
		if err != nil {
			return session, fmt.Errorf("failed to validate payment: %w", err)
		}

		// Update session based on validation result
		var newStatus models.PaymentStatus
		var senderAddr *string
		var blockNum *int64
		var confirmedAt *time.Time

		if result.Valid {
			newStatus = models.PaymentPaid
			sender := result.From.Hex()
			senderAddr = &sender
			blockNum = new(int64)
			*blockNum = result.Receipt.BlockNumber.Int64()
			// Use current time as confirmed time since we don't have it in the result
			now := time.Now()
			confirmedAt = &now
		} else {
			newStatus = models.PaymentFailed
		}

		// Update payment status in database
		err = s.UpdatePaymentStatus(ctx, session.PaymentID, newStatus, senderAddr, session.TransactionHash, blockNum, confirmedAt)
		if err != nil {
			return session, fmt.Errorf("failed to update payment status: %w", err)
		}

		// Get updated session
		updatedSession, err := s.GetPaymentSession(ctx, session.PaymentID)
		if err != nil {
			return session, fmt.Errorf("failed to get updated payment session: %w", err)
		}

		return updatedSession, nil
	}

	// If no transaction hash, return original session
	return session, nil
}

// generatePaymentID generates a unique payment ID
func generatePaymentID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "pay_" + hex.EncodeToString(bytes)[:16], nil
}