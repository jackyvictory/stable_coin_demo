package models

// PaymentStats represents payment statistics
type PaymentStats struct {
	TotalPayments       int            `json:"total_payments"`
	SuccessfulPayments  int            `json:"successful_payments"`
	FailedPayments      int            `json:"failed_payments"`
	SuccessRate         float64        `json:"success_rate"`
	PaymentsByToken     map[string]int `json:"payments_by_token"`
	PaymentsByPeriod    map[string]int `json:"payments_by_period"`
	AverageProcessingTime float64      `json:"average_processing_time"`
	FailureReasons      map[string]int `json:"failure_reasons"`
}

// MonitoringStats represents monitoring statistics
type MonitoringStats struct {
	WebsocketConnections  map[string]int     `json:"websocket_connections"`
	BlockchainMonitoring  map[string]interface{} `json:"blockchain_monitoring"`
	ValidationPerformance map[string]interface{} `json:"validation_performance"`
}

// SystemStats represents system statistics
type SystemStats struct {
	Uptime             int     `json:"uptime"`
	CPUUsage           float64 `json:"cpu_usage"`
	MemoryUsage        float64 `json:"memory_usage"`
	DiskUsage          float64 `json:"disk_usage"`
	APIResponseTime    int     `json:"api_response_time"`
	ErrorRate          float64 `json:"error_rate"`
	DatabaseHealth     string  `json:"database_health"`
	BlockchainConnection string `json:"blockchain_connection"`
}