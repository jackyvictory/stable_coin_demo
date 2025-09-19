package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"payment-backend/internal/api"
	"payment-backend/internal/api/websocket"
	"payment-backend/internal/blockchain"
	"payment-backend/internal/config"
	"payment-backend/internal/repository"
	"payment-backend/internal/service"

	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Ensure data directory exists
	dataDir := filepath.Dir(cfg.DBPath)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	// Initialize database
	db, err := sql.Open("sqlite3", cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := runMigrations(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize repository
	repo := repository.NewRepository(db)

	// Get network configuration from database to get WebSocket URL
	var websocketURL *string
	err = db.QueryRow("SELECT websocket_url FROM networks WHERE id = 'BSC' AND enabled = TRUE").Scan(&websocketURL)
	if err != nil {
		log.Printf("Warning: failed to get WebSocket URL from database: %v", err)
	}

		// Initialize blockchain service
	bcConfig := blockchain.Config{
		RPCURL:          cfg.BlockchainRPC,
		WebsocketURL:    "", // Will be set from database
		ChainID:         56, // BSC chain ID
		ReceiverAddress: cfg.ReceiverAddress,
	}

	// Set WebSocket URL if available
	if websocketURL != nil {
		bcConfig.WebsocketURL = *websocketURL
	}

	// Create a temporary channel for blockchain service initialization
	tempPaymentCh := make(chan *blockchain.PaymentStatusUpdate, 100)

	bcService, err := blockchain.NewService(bcConfig, tempPaymentCh)
	if err != nil {
		log.Fatalf("Failed to initialize blockchain service: %v", err)
	}
	defer bcService.Close()

	// Initialize payment service
	paymentConfig := service.PaymentConfig{
		ReceiverAddress: cfg.ReceiverAddress,
		PaymentTimeout:  cfg.PaymentTimeout,
	}

	paymentService := service.NewPaymentService(repo, bcService, paymentConfig)

	// Initialize WebSocket manager
	wsManager := websocket.NewManager(paymentService)

	// Initialize handlers
	handler := api.NewHandler(paymentService, wsManager, cfg)

	// Update blockchain service with the real payment channel
	bcService.SetPaymentChannel(wsManager.GetPaymentChannel())

	// Initialize Gin router
	router := gin.Default()

	// Setup routes
	setupRoutes(router, handler, wsManager)

	// Start payment status listener
	go wsManager.StartPaymentStatusListener()

	// Start server
	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	log.Printf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// setupRoutes sets up the API routes
func setupRoutes(router *gin.Engine, handler *api.Handler, wsManager *websocket.Manager) {
	// Root endpoint - redirect to health check
	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Payment API is running",
		})
	})

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Payment API is running",
		})
	})

	// WebSocket endpoint
	router.GET("/ws/payments/:paymentId", wsManager.HandleConnection)

	// Debug endpoint (only available in debug mode)
	router.POST("/debug/payments/:paymentId/simulate-success", handler.DebugSimulatePayment)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		payments := v1.Group("/payments")
		{
			payments.POST("", handler.CreatePaymentSession)
			payments.GET("/:paymentId", handler.GetPaymentSession)
			payments.POST("/:paymentId/process", handler.ProcessPayment)
		}

		tokens := v1.Group("/tokens")
		{
			tokens.GET("", handler.GetTokens)
		}

		networks := v1.Group("/networks")
		{
			networks.GET("", handler.GetNetworks)
		}

		stats := v1.Group("/stats")
		{
			stats.GET("/payments", handler.GetPaymentStats)
			stats.GET("/monitoring", handler.GetMonitoringStats)
			stats.GET("/system", handler.GetSystemStats)
		}
	}
}

// runMigrations runs the database migrations
func runMigrations(db *sql.DB) error {
	// Create tables if they don't exist
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS payment_sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			payment_id TEXT UNIQUE NOT NULL,
			product_id TEXT NOT NULL,
			product_name TEXT NOT NULL,
			amount REAL NOT NULL,
			currency TEXT NOT NULL,
			token_symbol TEXT NOT NULL,
			network_id TEXT NOT NULL,
			receiver_address TEXT NOT NULL,
			sender_address TEXT,
			status TEXT NOT NULL,
			qr_code_data TEXT,
			transaction_hash TEXT,
			block_number INTEGER,
			confirmed_at DATETIME,
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE INDEX IF NOT EXISTS idx_payment_sessions_payment_id ON payment_sessions(payment_id)`,
		`CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status)`,
		`CREATE INDEX IF NOT EXISTS idx_payment_sessions_expires_at ON payment_sessions(expires_at)`,

		`CREATE TABLE IF NOT EXISTS tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			symbol TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			contract_address TEXT NOT NULL,
			decimals INTEGER NOT NULL,
			network_id TEXT NOT NULL,
			enabled BOOLEAN DEFAULT TRUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol)`,
		`CREATE INDEX IF NOT EXISTS idx_tokens_network_id ON tokens(network_id)`,

		`CREATE TABLE IF NOT EXISTS networks (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			chain_id INTEGER NOT NULL,
			rpc_url TEXT NOT NULL,
			websocket_url TEXT,
			block_explorer TEXT,
			enabled BOOLEAN DEFAULT TRUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Insert default network configuration
		`INSERT OR IGNORE INTO networks (id, name, chain_id, rpc_url, websocket_url, block_explorer) VALUES
		('BSC', 'BNB Smart Chain', 56, 'https://bsc-dataseed1.binance.org/', 'wss://speedy-nodes-nyc.moralis.io/YOUR_API_KEY/bsc/mainnet/ws', 'https://bscscan.com')`,

		// Insert default token configurations
		`INSERT OR IGNORE INTO tokens (symbol, name, contract_address, decimals, network_id) VALUES 
		('USDT', 'Tether USD', '0x55d398326f99059fF775485246999027B3197955', 18, 'BSC'),
		('USDC', 'USD Coin', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, 'BSC'),
		('BUSD', 'Binance USD', '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', 18, 'BSC')`,
	}

	for _, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return fmt.Errorf("failed to run migration: %w", err)
		}
	}

	return nil
}