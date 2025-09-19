<template>
  <div class="monitoring-container">
    <div class="monitoring-header">
      <h1>WebSocket Status Monitoring</h1>
      <p>Real-time monitoring of WebSocket connections and blockchain status</p>
    </div>

    <div class="status-grid">
      <!-- Frontend WebSocket Status -->
      <div class="status-card">
        <div class="card-header">
          <h2>Frontend WebSocket</h2>
          <div class="status-indicator" :class="frontendWsStatus"></div>
        </div>
        <div class="card-content">
          <div class="status-item">
            <span class="label">Connection Status:</span>
            <span class="value" :class="frontendWsStatus">{{ frontendWsData.isConnected ? 'Connected' : 'Disconnected' }}</span>
          </div>
          <div class="status-item">
            <span class="label">Total Connections:</span>
            <span class="value">{{ frontendWsData.totalConnections || 0 }}</span>
          </div>
          <div class="status-item">
            <span class="label">Active Connections:</span>
            <span class="value">{{ frontendWsData.activeConnections || 0 }}</span>
          </div>
          <div class="status-item">
            <span class="label">Connection Errors:</span>
            <span class="value">{{ frontendWsData.connectionErrors || 0 }}</span>
          </div>
          <div class="status-item">
            <span class="label">Last Connection:</span>
            <span class="value">{{ frontendWsData.lastConnectionTime ? formatTime(frontendWsData.lastConnectionTime) : 'N/A' }}</span>
          </div>
          <div class="status-item">
            <span class="label">Last Disconnection:</span>
            <span class="value">{{ frontendWsData.lastDisconnectionTime ? formatTime(frontendWsData.lastDisconnectionTime) : 'N/A' }}</span>
          </div>
        </div>
      </div>

      <!-- Blockchain WebSocket Status -->
      <div class="status-card">
        <div class="card-header">
          <h2>Blockchain WebSocket</h2>
          <div class="status-indicator" :class="blockchainWsStatus"></div>
        </div>
        <div class="card-content">
          <div class="status-item">
            <span class="label">Connection Status:</span>
            <span class="value" :class="blockchainWsStatus">{{ blockchainWsData.isConnected ? 'Connected' : 'Disconnected' }}</span>
          </div>
          <div class="status-item">
            <span class="label">Current Endpoint:</span>
            <span class="value">{{ blockchainWsData.currentEndpoint || 'N/A' }}</span>
          </div>
          <div class="status-item">
            <span class="label">Total Attempts:</span>
            <span class="value">{{ blockchainWsData.totalConnectionAttempts || 0 }}</span>
          </div>
          <div class="status-item">
            <span class="label">Reconnect Attempts:</span>
            <span class="value">{{ blockchainWsData.reconnectAttempts || 0 }}</span>
          </div>
          <div class="status-item">
            <span class="label">Active Subscriptions:</span>
            <span class="value">{{ blockchainWsData.activeSubscriptions || 0 }}</span>
          </div>
          <div class="status-item">
            <span class="label">Last Connection:</span>
            <span class="value">{{ blockchainWsData.lastConnectionTime ? formatTime(blockchainWsData.lastConnectionTime) : 'N/A' }}</span>
          </div>
          <div class="status-item">
            <span class="label">Last Disconnection:</span>
            <span class="value">{{ blockchainWsData.lastDisconnectionTime ? formatTime(blockchainWsData.lastDisconnectionTime) : 'N/A' }}</span>
          </div>
        </div>
      </div>

      <!-- System Statistics -->
      <div class="status-card full-width">
        <div class="card-header">
          <h2>System Statistics</h2>
        </div>
        <div class="card-content">
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ systemStats.totalPayments || 0 }}</div>
              <div class="stat-label">Total Payments</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ systemStats.successfulPayments || 0 }}</div>
              <div class="stat-label">Successful Payments</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ systemStats.failedPayments || 0 }}</div>
              <div class="stat-label">Failed Payments</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ systemStats.successRate ? systemStats.successRate.toFixed(2) + '%' : '0%' }}</div>
              <div class="stat-label">Success Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Frontend WebSocket Messages -->
    <div class="status-card full-width">
      <div class="card-header">
        <h2>Frontend WebSocket Messages</h2>
      </div>
      <div class="card-content">
        <div class="messages-container">
          <div v-for="(message, index) in frontendMessages" :key="index" class="message-item" :class="[message.source, message.direction]">
            <div class="message-header">
              <span class="message-source">{{ message.source }}</span>
              <span class="message-type">{{ message.type }}</span>
              <span class="message-payment" v-if="message.paymentId">Payment: {{ message.paymentId }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-direction" :class="message.direction">
              {{ message.direction === 'in' ? '← IN' : 'OUT →' }}
            </div>
            <div class="message-data" v-if="message.data">
              <pre>{{ JSON.stringify(message.data, null, 2) }}</pre>
            </div>
          </div>
          <div v-if="frontendMessages.length === 0" class="no-messages">
            No frontend messages yet
          </div>
        </div>
      </div>
    </div>

    <!-- Blockchain WebSocket Messages -->
    <div class="status-card full-width">
      <div class="card-header">
        <h2>Blockchain WebSocket Messages</h2>
      </div>
      <div class="card-content">
        <div class="messages-container">
          <div v-for="(message, index) in blockchainMessages" :key="index" class="message-item" :class="[message.source, message.direction]">
            <div class="message-header">
              <span class="message-source">{{ message.source }}</span>
              <span class="message-type">{{ message.type }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-direction" :class="message.direction">
              {{ message.direction === 'in' ? '← IN' : 'OUT →' }}
            </div>
            <div class="message-data" v-if="message.data">
              <pre>{{ JSON.stringify(message.data, null, 2) }}</pre>
            </div>
          </div>
          <div v-if="blockchainMessages.length === 0" class="no-messages">
            No blockchain messages yet
          </div>
        </div>
      </div>
    </div>

    <div class="refresh-section">
      <button @click="refreshData" class="refresh-button">
        {{ isRefreshing ? 'Refreshing...' : 'Refresh Data' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WebSocketStatusMonitor',
  data() {
    return {
      frontendWsData: {},
      blockchainWsData: {},
      systemStats: {},
      websocketMessages: [],
      frontendMessages: [],
      blockchainMessages: [],
      isRefreshing: false,
      refreshInterval: null
    }
  },
  computed: {
    frontendWsStatus() {
      return this.frontendWsData.isConnected ? 'connected' : 'disconnected'
    },
    blockchainWsStatus() {
      return this.blockchainWsData.isConnected ? 'connected' : 'disconnected'
    }
  },
  mounted() {
    this.fetchData()
    // Refresh data every 10 seconds
    this.refreshInterval = setInterval(this.fetchData, 10000)
  },
  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }
  },
  methods: {
    async fetchData() {
      this.isRefreshing = true

      try {
        // Fetch WebSocket stats
        const wsResponse = await fetch('/api/v1/stats/websocket')
        const wsData = await wsResponse.json()

        if (wsResponse.ok) {
          // Enhance frontend data with connection status
          this.frontendWsData = {
            ...wsData.frontend,
            isConnected: (wsData.frontend?.activeConnections || 0) > 0
          } || {}

          // Enhance blockchain data with connection status
          this.blockchainWsData = {
            ...wsData.blockchain,
            isConnected: wsData.blockchain?.isConnected || false
          } || {}
        }

        // Fetch payment stats
        const paymentResponse = await fetch('/api/v1/stats/payments')
        const paymentData = await paymentResponse.json()

        if (paymentResponse.ok) {
          this.systemStats = paymentData
        }

        // Fetch WebSocket messages
        const messagesResponse = await fetch('/api/v1/stats/websocket/messages?limit=100')
        const messagesData = await messagesResponse.json()

        if (messagesResponse.ok) {
          this.websocketMessages = messagesData.messages || []

          // Separate frontend and blockchain messages
          this.frontendMessages = this.websocketMessages
            .filter(msg => msg.source === 'frontend')
            .slice(0, 50) // Limit to 50 messages

          this.blockchainMessages = this.websocketMessages
            .filter(msg => msg.source === 'blockchain')
            .slice(0, 50) // Limit to 50 messages
        }
      } catch (error) {
        console.error('Error fetching monitoring data:', error)
      } finally {
        this.isRefreshing = false
      }
    },

    async refreshData() {
      await this.fetchData()
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString()
    }
  }
}
</script>

<style scoped>
.monitoring-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Arial', sans-serif;
}

.monitoring-header {
  text-align: center;
  margin-bottom: 30px;
}

.monitoring-header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.monitoring-header p {
  color: #7f8c8d;
  font-size: 16px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.status-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  transition: transform 0.2s ease;
}

.status-card:hover {
  transform: translateY(-2px);
}

.status-card.full-width {
  grid-column: 1 / -1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.card-header h2 {
  color: #2c3e50;
  margin: 0;
  font-size: 20px;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-indicator.connected {
  background-color: #27ae60;
}

.status-indicator.disconnected {
  background-color: #e74c3c;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-item {
  display: flex;
  justify-content: space-between;
}

.label {
  color: #7f8c8d;
  font-weight: 500;
}

.value {
  color: #2c3e50;
  font-weight: 600;
}

.value.connected {
  color: #27ae60;
}

.value.disconnected {
  color: #e74c3c;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-item {
  text-align: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 5px;
}

.stat-label {
  color: #7f8c8d;
  font-size: 14px;
}

.refresh-section {
  text-align: center;
}

.refresh-button {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.refresh-button:hover {
  background: #2980b9;
}

.refresh-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .monitoring-container {
    padding: 10px;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* WebSocket Messages Styles */
.messages-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 10px;
}

.message-item {
  padding: 12px;
  margin-bottom: 10px;
  border-radius: 6px;
  background-color: #f8f9fa;
  border-left: 4px solid #3498db;
}

.message-item.frontend {
  border-left-color: #3498db;
}

.message-item.blockchain {
  border-left-color: #9b59b6;
}

.message-item.in {
  border-left-color: #27ae60;
}

.message-item.out {
  border-left-color: #e74c3c;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 10px;
}

.message-source {
  font-weight: bold;
  color: #34495e;
  text-transform: uppercase;
  font-size: 12px;
  background-color: #ecf0f1;
  padding: 2px 6px;
  border-radius: 4px;
}

.message-item.frontend .message-source {
  background-color: #3498db;
  color: white;
}

.message-item.blockchain .message-source {
  background-color: #9b59b6;
  color: white;
}

.message-type {
  font-weight: bold;
  color: #2c3e50;
}

.message-payment {
  font-size: 14px;
  color: #7f8c8d;
}

.message-time {
  font-size: 12px;
  color: #95a5a6;
}

.message-direction {
  font-weight: bold;
  margin-bottom: 8px;
}

.message-direction.in {
  color: #27ae60;
}

.message-direction.out {
  color: #e74c3c;
}

.message-data pre {
  background-color: #2c3e50;
  color: #ecf0f1;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  margin: 0;
}

.no-messages {
  text-align: center;
  color: #7f8c8d;
  padding: 20px;
  font-style: italic;
}
</style>