package repository

import (
	"database/sql"
	"time"

	"payment-backend/internal/models"

	_ "github.com/mattn/go-sqlite3"
)

// Repository provides database operations
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new repository instance
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// CreatePaymentSession creates a new payment session
func (r *Repository) CreatePaymentSession(session *models.PaymentSession) error {
	query := `
		INSERT INTO payment_sessions (
			payment_id, product_id, product_name, amount, currency, 
			token_symbol, network_id, receiver_address, status, 
			qr_code_data, expires_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	now := time.Now()
	session.CreatedAt = now
	session.UpdatedAt = now

	result, err := r.db.Exec(
		query,
		session.PaymentID,
		session.ProductID,
		session.ProductName,
		session.Amount,
		session.Currency,
		session.TokenSymbol,
		session.NetworkID,
		session.ReceiverAddress,
		session.Status,
		session.QRCodeData,
		session.ExpiresAt,
		session.CreatedAt,
		session.UpdatedAt,
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	session.ID = id

	return nil
}

// GetPaymentSessionByPaymentID retrieves a payment session by payment ID
func (r *Repository) GetPaymentSessionByPaymentID(paymentID string) (*models.PaymentSession, error) {
	query := `
		SELECT id, payment_id, product_id, product_name, amount, currency,
		       token_symbol, network_id, receiver_address, sender_address,
		       status, qr_code_data, transaction_hash, block_number,
		       confirmed_at, expires_at, created_at, updated_at
		FROM payment_sessions
		WHERE payment_id = ?
	`

	session := &models.PaymentSession{}
	err := r.db.QueryRow(query, paymentID).Scan(
		&session.ID,
		&session.PaymentID,
		&session.ProductID,
		&session.ProductName,
		&session.Amount,
		&session.Currency,
		&session.TokenSymbol,
		&session.NetworkID,
		&session.ReceiverAddress,
		&session.SenderAddress,
		&session.Status,
		&session.QRCodeData,
		&session.TransactionHash,
		&session.BlockNumber,
		&session.ConfirmedAt,
		&session.ExpiresAt,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return session, nil
}

// UpdatePaymentSessionStatus updates the status of a payment session
func (r *Repository) UpdatePaymentSessionStatus(paymentID string, status models.PaymentStatus, 
	senderAddress *string, transactionHash *string, blockNumber *int64, confirmedAt *time.Time) error {
	
	query := `
		UPDATE payment_sessions 
		SET status = ?, sender_address = ?, transaction_hash = ?, 
		    block_number = ?, confirmed_at = ?, updated_at = ?
		WHERE payment_id = ?
	`

	_, err := r.db.Exec(
		query,
		status,
		senderAddress,
		transactionHash,
		blockNumber,
		confirmedAt,
		time.Now(),
		paymentID,
	)
	return err
}

// GetAllTokens retrieves all tokens
func (r *Repository) GetAllTokens() ([]*models.Token, error) {
	query := `
		SELECT id, symbol, name, contract_address, decimals, network_id, enabled, created_at, updated_at
		FROM tokens
		WHERE enabled = TRUE
		ORDER BY symbol
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []*models.Token
	for rows.Next() {
		token := &models.Token{}
		err := rows.Scan(
			&token.ID,
			&token.Symbol,
			&token.Name,
			&token.ContractAddress,
			&token.Decimals,
			&token.NetworkID,
			&token.Enabled,
			&token.CreatedAt,
			&token.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tokens = append(tokens, token)
	}

	return tokens, nil
}

// GetAllNetworks retrieves all networks
func (r *Repository) GetAllNetworks() ([]*models.Network, error) {
	query := `
		SELECT id, name, chain_id, rpc_url, websocket_url, block_explorer, enabled, created_at, updated_at
		FROM networks
		WHERE enabled = TRUE
		ORDER BY id
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var networks []*models.Network
	for rows.Next() {
		network := &models.Network{}
		err := rows.Scan(
			&network.ID,
			&network.Name,
			&network.ChainID,
			&network.RPCURL,
			&network.WebsocketURL,
			&network.BlockExplorer,
			&network.Enabled,
			&network.CreatedAt,
			&network.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		networks = append(networks, network)
	}

	return networks, nil
}