<template>
  <div class="qrcode-main-container">
    <!-- QR Code Container -->
    <div class="qrcode-container">
      <div class="qrcode-card">
        <!-- Payment Status -->
        <div class="payment-status">
          <div class="status-indicator" id="status-indicator">
            <div class="status-dot" :class="statusClass"></div>
            <span class="status-text" id="status-text">{{ statusText }}</span>
          </div>
        </div>

        <!-- Payment Info Section -->
        <div class="payment-info-section">
          <h2 class="payment-title">Scan QR Code to Pay</h2>
          <div class="payment-details">
            <div class="payment-item">
              <span class="payment-label">Item:</span>
              <span class="payment-value" id="qr-selected-item">{{ productName }}</span>
            </div>
            <div class="payment-item">
              <span class="payment-label">Amount:</span>
              <span class="payment-value" id="qr-selected-amount">${{ amount.toFixed(2) }}</span>
            </div>
            <div class="payment-item">
              <span class="payment-label">Payment Method:</span>
              <span class="payment-value" id="qr-payment-method">{{ tokenSymbol }}</span>
            </div>
            <div class="payment-item">
              <span class="payment-label">Network:</span>
              <span class="payment-value" id="qr-network">{{ networkName }}</span>
            </div>
            <div class="payment-item">
              <span class="payment-label">PayID:</span>
              <span class="payment-value" id="qr-payment-id">{{ paymentId }}</span>
            </div>
            <div class="payment-item">
              <span class="payment-label">Time Remaining:</span>
              <span class="payment-value" id="qr-expiration-time">{{ timerText }}</span>
            </div>
          </div>
        </div>

        <!-- QR Code Section -->
        <div class="qrcode-section">
          <div class="qrcode-image-container">
            <img src="/src/assets/wallet_qr.jpg" alt="Payment QR Code" class="qrcode-image">
          </div>

          <!-- Wallet Address -->
          <div class="wallet-address-section">
            <label class="address-label">Wallet Address:</label>
            <div class="address-container">
              <input type="text" class="address-input" id="wallet-address"
                     :value="receiverAddress" readonly>
              <button class="copy-button" id="copy-address-btn" @click="copyAddress">
                <span class="copy-text">{{ copyButtonText }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Payment Instructions -->
        <div class="payment-instructions">
          <h3 class="instructions-title">Payment Instructions</h3>
          <ol class="instructions-list">
            <li>Open your crypto wallet app</li>
            <li>Scan the QR code above or copy the wallet address</li>
            <li>Send the exact amount shown above</li>
            <li>Make sure to select the correct network ({{ networkName }})</li>
            <li>Wait for transaction confirmation</li>
          </ol>

          <div class="warning-message">
            <strong>Important:</strong> Please send the exact amount to the correct address on {{ networkName }} network.
            Sending incorrect amounts or using wrong networks may result in loss of funds.
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button class="back-button" @click="goBack">
            ← Back to Payment Selection
          </button>
          <button class="refresh-button" @click="refreshStatus">
            🔄 Refresh Status
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QrPaymentPage',
  data() {
    return {
      paymentId: '',
      productName: '',
      amount: 0,
      tokenSymbol: '',
      networkName: '',
      receiverAddress: '',
      paymentStatus: 'connecting',
      expiryTime: null,
      timerText: 'Loading...',
      copyButtonText: 'Copy',
      websocket: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      reconnectDelay: 3000
    }
  },
  computed: {
    statusText() {
      switch (this.paymentStatus) {
        case 'connecting':
          return 'Connecting to blockchain'
        case 'waiting':
          return 'Waiting for payment'
        case 'pending':
          return 'Payment detected, waiting for confirmation...'
        case 'paid':
          return 'Payment confirmed!'
        case 'expired':
          return 'Payment expired'
        case 'failed':
          return 'Payment failed'
        default:
          return 'Unknown status'
      }
    },
    statusClass() {
      switch (this.paymentStatus) {
        case 'connecting':
          return 'connecting'
        case 'waiting':
          return 'waiting'
        case 'pending':
          return 'waiting'
        case 'paid':
          return 'confirmed'
        case 'expired':
        case 'failed':
          return 'failed'
        default:
          return 'connecting'
      }
    }
  },
  mounted() {
    // Get URL parameters from Vue Router
    this.paymentId = this.$route.query.paymentId

    if (!this.paymentId) {
      alert('Invalid payment session')
      this.$router.push('/')
      return
    }

    this.init()
  },
  beforeUnmount() {
    // Clean up WebSocket connection
    if (this.websocket) {
      this.websocket.close()
    }
  },
  methods: {
    async init() {
      // Load payment session data and start timer
      await this.loadPaymentSession()
      this.startTimer()

      // Establish WebSocket connection
      this.connectWebSocket()
    },
    async loadPaymentSession() {
      try {
        const response = await fetch(`/api/v1/payments/${this.paymentId}`)
        const session = await response.json()

        if (response.ok) {
          this.updatePaymentSession(session)
        } else {
          alert('Payment session not found')
          this.$router.push('/')
        }
      } catch (error) {
        console.error('Error loading payment session:', error)
        alert('Error loading payment session')
        this.$router.push('/')
      }
    },
    updatePaymentSession(session) {
      this.productName = session.productName
      this.amount = session.amount
      this.tokenSymbol = session.tokenSymbol
      this.networkName = session.networkId === 'BSC' ? 'BNB Smart Chain' : session.networkId
      this.receiverAddress = session.receiverAddress
      this.paymentStatus = session.status === 'created' ? 'waiting' : session.status

      // Parse expiration time and handle potential timezone issues
      // Ensure we're working with UTC time to avoid timezone discrepancies
      this.expiryTime = new Date(session.expiresAt)

      // If the time string doesn't contain timezone info, treat it as UTC
      if (session.expiresAt && session.expiresAt.indexOf('Z') === -1 &&
          session.expiresAt.indexOf('+') === -1 && session.expiresAt.indexOf('-') === -1) {
        this.expiryTime = new Date(session.expiresAt + 'Z')
      }

      // If parsing still fails, log the error
      if (isNaN(this.expiryTime.getTime())) {
        console.error('Failed to parse expiration time:', session.expiresAt)
        // Set a default expiration time (30 minutes from now)
        const now = new Date()
        this.expiryTime = new Date(now.getTime() + 30 * 60 * 1000)
      }

      // Check if the parsed time is in the past (which indicates a timezone issue)
      const now = new Date()
      // Use UTC time for comparison to avoid timezone issues
      const nowUTC = new Date(now.getTime() + now.getTimezoneOffset() * 60000)
      if (this.expiryTime < nowUTC) {
        // If expiration time is in the past, set it to 30 minutes from now
        this.expiryTime = new Date(nowUTC.getTime() + 30 * 60 * 1000)
        console.warn('Expiration time appears to be in the past, using default 30 minutes from now')
      }

      // If payment is already paid, redirect to success page
      if (session.status === 'paid') {
        setTimeout(() => {
          this.$router.push({
            path: '/success',
            query: {
              paymentId: this.paymentId
            }
          })
        }, 3000)
      }
    },

    startTimer() {
      this.updateTimer()
      setInterval(this.updateTimer, 1000)
    },

    updateTimer() {
      if (!this.expiryTime) return

      const now = new Date()
      // Use UTC time for comparison to avoid timezone issues
      const nowUTC = new Date(now.getTime() + now.getTimezoneOffset() * 60000)
      const diff = this.expiryTime - nowUTC

      if (diff <= 0) {
        this.timerText = 'Payment expired'
        return
      }

      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      if (hours > 0) {
        this.timerText = `${hours}h ${minutes}m ${seconds}s`
      } else if (minutes > 0) {
        this.timerText = `${minutes}m ${seconds}s`
      } else {
        this.timerText = `${seconds}s`
      }
    },
    connectWebSocket() {
      // Try to connect to WebSocket for real-time updates
      try {
        this.paymentStatus = 'connecting'
        // Use relative path for WebSocket connection to work in both development and production
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        this.websocket = new WebSocket(`${protocol}//${host}/ws/payments/${this.paymentId}`)

        this.websocket.onopen = () => {
          console.log('WebSocket connected')
          this.paymentStatus = 'waiting'
          // Reset reconnect attempts on successful connection
          this.reconnectAttempts = 0
        }

        this.websocket.onmessage = (event) => {
          const message = JSON.parse(event.data)

          // Handle payment status update messages
          if (message.type === 'payment_status_update') {
            this.paymentStatus = message.data.status
            if (message.data.status === 'paid') {
              setTimeout(() => {
                this.$router.push({
                  path: '/success',
                  query: {
                    paymentId: this.paymentId
                  }
                })
              }, 3000)
            }
          }

          // Handle ping messages and send pong response
          if (message.type === 'ping') {
            console.log('Received ping, sending pong')
            const pongMessage = {
              type: 'pong',
              paymentId: this.paymentId,
              timestamp: new Date().toISOString()
            }
            this.websocket.send(JSON.stringify(pongMessage))
          }
        }

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error)
          console.error('WebSocket error details:', {
            readyState: this.websocket.readyState,
            url: this.websocket.url
          })
          this.paymentStatus = 'failed'
          // No fallback to polling as requested
        }

        this.websocket.onclose = (event) => {
          console.log('WebSocket disconnected', event)
          console.log('Close code:', event.code)
          console.log('Close reason:', event.reason)
          console.log('Was clean:', event.wasClean)

          // Attempt to reconnect if not exceeding max attempts
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
            this.paymentStatus = 'connecting'

            // Delay before reconnecting
            setTimeout(() => {
              this.connectWebSocket()
            }, this.reconnectDelay)
          } else {
            console.log('Max reconnect attempts reached. Connection failed.')
            this.paymentStatus = 'failed'
          }
        }
      } catch (error) {
        console.error('Error connecting to WebSocket:', error)
        this.paymentStatus = 'failed'

        // Attempt to reconnect if not exceeding max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

          // Delay before reconnecting
          setTimeout(() => {
            this.connectWebSocket()
          }, this.reconnectDelay)
        }
      }
    },
    copyAddress() {
      navigator.clipboard.writeText(this.receiverAddress).then(() => {
        this.copyButtonText = 'Copied!'
        setTimeout(() => {
          this.copyButtonText = 'Copy'
        }, 2000)
      })
    },
    goBack() {
      this.$router.push('/payment')
    },
    async refreshStatus() {
      // Make a single GET call instead of starting polling
      await this.loadPaymentSession()
    }
  }
}
</script>

<style scoped>
/* Stable Coin - QR Code Page Styles */

/* Chakra UI CSS Variables */
:root {
  --chakra-colors-primary: #2328da;
  --chakra-colors-primaryHover: #0F288E;
  --chakra-colors-primaryBg: #d6e0ef;
  --chakra-colors-fontBlack: #1a1f36;
  --chakra-colors-grey-550: #697386;
  --chakra-colors-grey-90: #f4d8a9;
  --chakra-colors-grey-500: #9ca3af;
  --chakra-colors-white: #FFFFFF;
  --chakra-colors-gray-800: #1A202C;
  --chakra-colors-gray-200: #E2E8F0;
  --chakra-colors-gray-100: #f7fafc;
  --chakra-fonts-body: 'Roboto', Arial, Helvetica, sans-serif;
  --chakra-fontSizes-md: 1rem;
  --chakra-fontSizes-lg: 1.125rem;
  --chakra-fontSizes-xl: 1.25rem;
  --chakra-fontSizes-2xl: 1.5rem;
  --chakra-fontWeights-medium: 500;
  --chakra-fontWeights-bold: 700;
  --chakra-space-1: 0.25rem;
  --chakra-space-2: 0.5rem;
  --chakra-space-3: 0.75rem;
  --chakra-space-4: 1rem;
  --chakra-radii-xl: 0.75rem;
  --chakra-radii-lg: 0.5rem;
  --chakra-radii-full: 9999px;
  --chakra-shadows-md: 0 8px 16px 0 rgba(0, 0, 0, 0.08);
  --chakra-shadows-lg: 0 12px 24px 0 rgba(0, 0, 0, 0.12);
}

/* Reset and Base Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  font-family: system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--chakra-fonts-body);
  color: var(--chakra-colors-gray-800);
  background: var(--chakra-colors-white);
  line-height: 1.5;
  margin: 0;
  min-height: 100vh;
}

/* Main Container */
.qrcode-main-container {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #f4d8a9 0%, #e0b885 50%, #cc9966 100%);
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.qrcode-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  padding: 2rem var(--chakra-space-4);
  flex: 1;
}

.qrcode-card {
  background-color: var(--chakra-colors-white);
  border-radius: var(--chakra-radii-xl);
  padding: 2rem;
  box-shadow: 0 20px 40px rgba(212, 165, 116, 0.15);
  border: 2px solid rgba(212, 165, 116, 0.2);
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Payment Status */
.payment-status {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background-color: #f7fafc;
  border-radius: var(--chakra-radii-xl);
  border: 2px solid #e2e8f0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #fbbf24;
  animation: pulse 2s infinite;
}

.status-dot.connecting {
  background-color: #fbbf24;
  animation: pulse 2s infinite;
}

.status-dot.waiting {
  background-color: #10b981;
  animation: none;
}

.status-dot.confirmed {
  background-color: #10b981;
  animation: none;
}

.status-dot.failed {
  background-color: #ef4444;
  animation: none;
}

.status-text {
  font-weight: var(--chakra-fontWeights-bold);
  color: var(--chakra-colors-fontBlack);
  font-size: var(--chakra-fontSizes-lg);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Payment Info Section */
.payment-info-section {
  text-align: center;
  border-bottom: 1px solid var(--chakra-colors-gray-200);
  padding-bottom: 1.5rem;
}

.payment-title {
  font-size: var(--chakra-fontSizes-xl);
  font-weight: var(--chakra-fontWeights-bold);
  color: var(--chakra-colors-fontBlack);
  margin-bottom: 1rem;
}

.payment-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.payment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-label {
  font-weight: var(--chakra-fontWeights-medium);
  color: var(--chakra-colors-grey-550);
}

.payment-value {
  font-weight: var(--chakra-fontWeights-bold);
  color: var(--chakra-colors-fontBlack);
}

/* QR Code Section */
.qrcode-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.qrcode-image-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background-color: var(--chakra-colors-white);
  border: 2px solid var(--chakra-colors-gray-200);
  border-radius: var(--chakra-radii-xl);
  box-shadow: var(--chakra-shadows-md);
}

.qrcode-image {
  width: 200px;
  height: 200px;
  object-fit: contain;
  border-radius: 8px;
}

/* Wallet Address Section */
.wallet-address-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.address-label {
  font-size: var(--chakra-fontSizes-md);
  font-weight: var(--chakra-fontWeights-medium);
  color: var(--chakra-colors-fontBlack);
}

.address-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.address-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid var(--chakra-colors-gray-200);
  border-radius: var(--chakra-radii-xl);
  background-color: #f7fafc;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: var(--chakra-colors-fontBlack);
  cursor: text;
}

.address-input:focus {
  outline: none;
  border-color: var(--chakra-colors-primary);
  box-shadow: 0 0 0 1px var(--chakra-colors-primary);
}

.copy-button {
  background: var(--chakra-colors-primary);
  color: var(--chakra-colors-white);
  border: none;
  border-radius: var(--chakra-radii-xl);
  padding: 0.75rem 1.5rem;
  font-size: var(--chakra-fontSizes-md);
  font-weight: var(--chakra-fontWeights-bold);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.copy-button:hover {
  background: var(--chakra-colors-primaryHover);
  transform: translateY(-1px);
}

.copy-button:active {
  transform: translateY(0);
}

.copy-button.copied {
  background: #10b981;
}

/* Payment Instructions */
.payment-instructions {
  background-color: #f7fafc;
  border-radius: var(--chakra-radii-xl);
  padding: 1.5rem;
  border: 1px solid var(--chakra-colors-gray-200);
}

.instructions-title {
  font-size: var(--chakra-fontSizes-lg);
  font-weight: var(--chakra-fontWeights-bold);
  color: var(--chakra-colors-fontBlack);
  margin-bottom: 1rem;
}

.instructions-list {
  list-style: decimal;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.instructions-list li {
  margin-bottom: 0.5rem;
  color: var(--chakra-colors-fontBlack);
  line-height: 1.5;
}

.warning-message {
  background-color: #fef3cd;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 1rem;
  color: #92400e;
  font-size: 0.875rem;
  line-height: 1.5;
}

.warning-message strong {
  color: #78350f;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-top: 1rem;
}

.back-button,
.refresh-button {
  flex: 1;
  padding: 1rem;
  border: none;
  border-radius: var(--chakra-radii-xl);
  font-size: var(--chakra-fontSizes-md);
  font-weight: var(--chakra-fontWeights-bold);
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-button {
  background: #6b7280;
  color: var(--chakra-colors-white);
}

.back-button:hover {
  background: #4b5563;
  transform: translateY(-1px);
}

.refresh-button {
  background: var(--chakra-colors-primary);
  color: var(--chakra-colors-white);
}

.refresh-button:hover {
  background: var(--chakra-colors-primaryHover);
  transform: translateY(-1px);
}

/* Responsive Design */
@media screen and (max-width: 768px) {
  .qrcode-card {
    margin: 1rem;
    padding: 1.5rem;
  }

  .payment-title {
    font-size: var(--chakra-fontSizes-lg);
  }

  .qrcode-image {
    width: 180px;
    height: 180px;
  }

  .address-container {
    flex-direction: column;
    gap: 0.75rem;
  }

  .address-input {
    font-size: 0.75rem;
  }

  .copy-button {
    width: 100%;
  }

  .action-buttons {
    flex-direction: column;
  }
}

@media screen and (max-width: 480px) {
  .qrcode-card {
    padding: 1rem;
  }

  .qrcode-image {
    width: 160px;
    height: 160px;
  }

  .payment-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .payment-label {
    font-size: 0.875rem;
  }

  .payment-value {
    font-size: 0.875rem;
  }
}

/* Loading Animation */
.loading {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--chakra-colors-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Success Animation */
.success-checkmark {
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #10b981;
  position: relative;
}

.success-checkmark::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 14px;
}
</style>