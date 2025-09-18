package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds the application configuration
type Config struct {
	ServerPort      int
	DBPath          string
	JWTSecret       string
	BlockchainRPC   string
	ReceiverAddress string
	PaymentTimeout  time.Duration
	DebugMode       bool
}

// Load loads configuration from environment variables
func Load() *Config {
	cfg := &Config{
		ServerPort:      getEnvInt("SERVER_PORT", 8080),
		DBPath:          getEnv("DB_PATH", "./data/payment.db"),
		JWTSecret:       getEnv("JWT_SECRET", "payment_secret_key"),
		BlockchainRPC:   getEnv("BLOCKCHAIN_RPC", "https://bsc-dataseed1.binance.org/"),
		ReceiverAddress: getEnv("RECEIVER_ADDRESS", "0xe27577B0e3920cE35f100f66430de0108cb78a04"),
		PaymentTimeout:  time.Duration(getEnvInt("PAYMENT_TIMEOUT", 30)) * time.Minute,
		DebugMode:       getEnv("DEBUG_MODE", "false") == "true",
	}

	return cfg
}

// getEnv returns the value of the environment variable or a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt returns the integer value of the environment variable or a default value
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvDuration returns the duration value of the environment variable or a default value
func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}