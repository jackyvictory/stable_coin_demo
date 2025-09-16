package models

import (
	"time"
)

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentCreated PaymentStatus = "created"
	PaymentPending PaymentStatus = "pending"
	PaymentPaid    PaymentStatus = "paid"
	PaymentExpired PaymentStatus = "expired"
	PaymentFailed  PaymentStatus = "failed"
)

// PaymentSession represents a payment session
type PaymentSession struct {
	ID             int64         `json:"id" db:"id"`
	PaymentID      string        `json:"paymentId" db:"payment_id"`
	ProductID      string        `json:"productId" db:"product_id"`
	ProductName    string        `json:"productName" db:"product_name"`
	Amount         float64       `json:"amount" db:"amount"`
	Currency       string        `json:"currency" db:"currency"`
	TokenSymbol    string        `json:"tokenSymbol" db:"token_symbol"`
	NetworkID      string        `json:"networkId" db:"network_id"`
	ReceiverAddress string       `json:"receiverAddress" db:"receiver_address"`
	SenderAddress  *string       `json:"senderAddress,omitempty" db:"sender_address"`
	Status         PaymentStatus `json:"status" db:"status"`
	QRCodeData     *string       `json:"qrCodeData,omitempty" db:"qr_code_data"`
	TransactionHash *string      `json:"transactionHash,omitempty" db:"transaction_hash"`
	BlockNumber    *int64        `json:"blockNumber,omitempty" db:"block_number"`
	ConfirmedAt    *time.Time    `json:"confirmedAt,omitempty" db:"confirmed_at"`
	ExpiresAt      time.Time     `json:"expiresAt" db:"expires_at"`
	CreatedAt      time.Time     `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time     `json:"updatedAt" db:"updated_at"`
}

// Token represents a supported token
type Token struct {
	ID             int64     `json:"id" db:"id"`
	Symbol         string    `json:"symbol" db:"symbol"`
	Name           string    `json:"name" db:"name"`
	ContractAddress string   `json:"contractAddress" db:"contract_address"`
	Decimals       int       `json:"decimals" db:"decimals"`
	NetworkID      string    `json:"networkId" db:"network_id"`
	Enabled        bool      `json:"enabled" db:"enabled"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time `json:"updatedAt" db:"updated_at"`
}

// Network represents a supported blockchain network
type Network struct {
	ID            string    `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	ChainID       int64     `json:"chainId" db:"chain_id"`
	RPCURL        string    `json:"rpcUrl" db:"rpc_url"`
	WebsocketURL  *string   `json:"websocketUrl,omitempty" db:"websocket_url"`
	BlockExplorer *string   `json:"blockExplorer,omitempty" db:"block_explorer"`
	Enabled       bool      `json:"enabled" db:"enabled"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
}