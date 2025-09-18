<template>
  <div class="success-main-container">
    <!-- Success Container -->
    <div class="success-container">
      <div class="success-card">
        <!-- Success Icon -->
        <div class="success-icon">
          <div class="checkmark-circle">
            <div class="checkmark">✓</div>
          </div>
        </div>

        <!-- Success Message -->
        <div class="success-message">
          <h1 class="success-title">Payment Successful!</h1>
          <p class="success-subtitle">Thank you for your donation. Your payment has been confirmed.</p>
        </div>

        <!-- Payment Summary -->
        <div class="payment-summary">
          <h3 class="summary-title">Payment Details</h3>
          <div class="summary-details">
            <div class="summary-item">
              <span class="summary-label">Item:</span>
              <span class="summary-value" id="success-item">{{ productName }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Amount:</span>
              <span class="summary-value" id="success-amount">${{ amount.toFixed(2) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Payment Method:</span>
              <span class="summary-value" id="success-payment-method">{{ tokenSymbol }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Network:</span>
              <span class="summary-value" id="success-network">{{ networkName }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">PayID:</span>
              <span class="summary-value" id="success-payment-id">{{ paymentId }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Transaction Time:</span>
              <span class="summary-value" id="success-timestamp">{{ confirmedAtFormatted }}</span>
            </div>
          </div>
        </div>

        <!-- Blockchain Info Section -->
        <div class="blockchain-info">
          <div class="blockchain-header" @click="toggleBlockchainInfo">
            <h3 class="blockchain-title">Blockchain Info</h3>
            <button class="blockchain-toggle-btn" id="blockchain-toggle-btn" :class="{ expanded: blockchainExpanded }">
              <span class="toggle-icon">▼</span>
            </button>
          </div>
          <div class="blockchain-details" id="blockchain-details" :style="{ display: blockchainExpanded ? 'block' : 'none' }">
            <div class="blockchain-item">
              <span class="blockchain-label">Blockchain Name:</span>
              <span class="blockchain-value network" id="blockchain-name">{{ networkName }}</span>
            </div>
            <div class="blockchain-item">
              <span class="blockchain-label">Transaction Hash:</span>
              <span class="blockchain-value hash" id="blockchain-tx-hash">{{ transactionHash }}</span>
            </div>
            <div class="blockchain-item">
              <span class="blockchain-label">Block Number:</span>
              <span class="blockchain-value" id="blockchain-block-number">{{ blockNumber }}</span>
            </div>
            <div class="blockchain-item">
              <span class="blockchain-label">From Address:</span>
              <span class="blockchain-value address" id="blockchain-from-addr">{{ senderAddress }}</span>
            </div>
            <div class="blockchain-item">
              <span class="blockchain-label">To Address:</span>
              <span class="blockchain-value address" id="blockchain-to-addr">{{ receiverAddress }}</span>
            </div>
            <div class="blockchain-item">
              <span class="blockchain-label">Contract Address:</span>
              <span class="blockchain-value address" id="blockchain-contract-addr">{{ contractAddress }}</span>
            </div>
            <div class="blockchain-item">
              <span class="blockchain-label">Amount & Currency:</span>
              <span class="blockchain-value amount" id="blockchain-amount">{{ amount }} {{ tokenSymbol }}</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="success-actions">
          <button class="new-payment-button" @click="startNewPayment">
            Make Another Donation
          </button>
          <button class="home-button" @click="goHome">
            Return to Homepage
          </button>
        </div>

        <!-- Additional Info -->
        <div class="additional-info">
          <p class="info-text">
            Your donation helps provide food to those in need.
            You will receive a confirmation email shortly.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaymentSuccess',
  data() {
    return {
      paymentId: '',
      productName: '',
      amount: 0,
      tokenSymbol: '',
      networkName: '',
      transactionHash: '',
      senderAddress: '',
      blockNumber: '',
      confirmedAt: '',
      receiverAddress: '',
      contractAddress: '',
      blockchainExpanded: false
    }
  },
  computed: {
    confirmedAtFormatted() {
      return this.confirmedAt ? new Date(this.confirmedAt).toLocaleString() : '-'
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

    this.loadPaymentSession()
  },
  methods: {
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
      this.transactionHash = session.transactionHash || '-'
      this.senderAddress = session.senderAddress || '-'
      this.blockNumber = session.blockNumber || '-'
      this.confirmedAt = session.confirmedAt || ''
      this.receiverAddress = session.receiverAddress
      this.paymentId = session.paymentId
      // Set contract address based on token symbol
      this.contractAddress = this.getContractAddress(session.tokenSymbol, session.networkId)
    },
    getContractAddress(tokenSymbol, networkId) {
      const contracts = {
        'BSC': {
          'USDT': '0x55d398326f99059fF775485246999027B3197955',
          'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          'BUSD': '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
        }
      }
      return contracts[networkId]?.[tokenSymbol] || '-'
    },
    toggleBlockchainInfo() {
      this.blockchainExpanded = !this.blockchainExpanded
    },
    startNewPayment() {
      this.$router.push('/')
    },
    goHome() {
      this.$router.push('/')
    }
  }
}
</script>

<style scoped>
/* Stable Coin - Success Page Styles */

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
.success-main-container {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #f4d8a9 0%, #e0b885 50%, #cc9966 100%);
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.success-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 2rem var(--chakra-space-4);
  flex: 1;
}

.success-card {
  background-color: var(--chakra-colors-white);
  border-radius: var(--chakra-radii-xl);
  padding: 3rem 2rem;
  box-shadow: 0 20px 40px rgba(212, 165, 116, 0.15);
  border: 2px solid rgba(212, 165, 116, 0.2);
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  text-align: center;
}

/* Success Icon */
.success-icon {
  display: flex;
  justify-content: center;
  align-items: center;
}

.checkmark-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 8px 32px rgba(168, 85, 247, 0.3);
  animation: successPulse 0.6s ease-out;
}

.checkmark {
  color: white;
  font-size: 2.5rem;
  font-weight: bold;
  animation: checkmarkAppear 0.8s ease-out 0.2s both;
}

@keyframes successPulse {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes checkmarkAppear {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Success Message */
.success-message {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.success-title {
  font-size: 2rem;
  font-weight: var(--chakra-fontWeights-bold);
  color: var(--chakra-colors-fontBlack);
  margin: 0;
}

.success-subtitle {
  font-size: var(--chakra-fontSizes-lg);
  color: var(--chakra-colors-grey-550);
  margin: 0;
  line-height: 1.5;
}

/* Payment Summary */
.payment-summary {
  width: 100%;
  background-color: #f7fafc;
  border-radius: var(--chakra-radii-xl);
  padding: 1.5rem;
  border: 1px solid var(--chakra-colors-gray-200);
}

.summary-title {
  font-size: var(--chakra-fontSizes-lg);
  font-weight: var(--chakra-fontWeights-bold);
  color: var(--chakra-colors-fontBlack);
  margin-bottom: 1rem;
  text-align: center;
}

.summary-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-label {
  font-weight: var(--chakra-fontWeights-medium);
  color: var(--chakra-colors-grey-550);
}

.summary-value {
  font-weight: var(--chakra-fontWeights-bold);
  color: var(--chakra-colors-fontBlack);
  text-align: right;
}

/* Blockchain Info Section Styles - 与 Payment Details 保持一致但底色稍有区别 */
.blockchain-info {
  width: 100%;
  margin-top: 20px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: var(--chakra-radii-xl);
  overflow: hidden;
}

.blockchain-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #e9ecef;
  border-bottom: 1px solid #dee2e6;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.blockchain-header:hover {
  background-color: #e2e6ea;
}

.blockchain-title {
  margin: 0;
  color: #495057;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
}

.blockchain-title::before {
  content: '🔗';
  font-size: 18px;
}

.blockchain-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.blockchain-toggle-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.toggle-icon {
  font-size: 14px;
  color: #6c757d;
  transition: transform 0.3s ease;
}

.blockchain-toggle-btn.expanded .toggle-icon {
  transform: rotate(180deg);
}

.blockchain-details {
  padding: 0;
  transition: all 0.3s ease;
}

.blockchain-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e9ecef;
  transition: background-color 0.2s ease;
}

.blockchain-item:last-child {
  border-bottom: none;
}

.blockchain-item:hover {
  background-color: #f1f3f4;
}

.blockchain-label {
  font-size: 14px;
  color: #6c757d;
  font-weight: 500;
  min-width: 140px;
  flex-shrink: 0;
}

.blockchain-value {
  font-size: 14px;
  color: #495057;
  font-family: 'Courier New', monospace;
  text-align: right;
  word-break: break-all;
  max-width: 250px;
  line-height: 1.4;
}

/* Special styling for hash values */
.blockchain-value.hash {
  color: #007bff;
  font-weight: 500;
}

/* Special styling for addresses */
.blockchain-value.address {
  color: #28a745;
  font-weight: 500;
}

/* Special styling for amounts */
.blockchain-value.amount {
  color: #dc3545;
  font-weight: bold;
}

/* Special styling for blockchain name */
.blockchain-value.network {
  color: #6f42c1;
  font-weight: bold;
  font-family: inherit;
}

/* Action Buttons */
.success-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.new-payment-button,
.home-button {
  padding: 1rem 2rem;
  border: none;
  border-radius: var(--chakra-radii-xl);
  font-size: var(--chakra-fontSizes-lg);
  font-weight: var(--chakra-fontWeights-bold);
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.new-payment-button {
  background: var(--chakra-colors-primary);
  color: var(--chakra-colors-white);
}

.new-payment-button:hover {
  background: var(--chakra-colors-primaryHover);
  transform: translateY(-2px);
}

.home-button {
  background: transparent;
  color: var(--chakra-colors-primary);
  border: 2px solid var(--chakra-colors-primary);
}

.home-button:hover {
  background: var(--chakra-colors-primary);
  color: var(--chakra-colors-white);
  transform: translateY(-2px);
}

/* Additional Info */
.additional-info {
  width: 100%;
  padding: 1rem;
  background-color: #f0f9ff;
  border-radius: var(--chakra-radii-xl);
  border: 1px solid #bae6fd;
}

.info-text {
  color: #0369a1;
  font-size: var(--chakra-fontSizes-md);
  line-height: 1.5;
  margin: 0;
}

/* Responsive Design */
@media screen and (max-width: 768px) {
  .success-card {
    margin: 1rem;
    padding: 2rem 1.5rem;
  }

  .success-title {
    font-size: 1.75rem;
  }

  .success-subtitle {
    font-size: var(--chakra-fontSizes-md);
  }

  .checkmark-circle {
    width: 60px;
    height: 60px;
  }

  .checkmark {
    font-size: 2rem;
  }
}

@media screen and (max-width: 480px) {
  .success-card {
    padding: 1.5rem 1rem;
  }

  .success-title {
    font-size: 1.5rem;
  }

  .summary-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .summary-label {
    font-size: 0.875rem;
  }

  .summary-value {
    font-size: 0.875rem;
    text-align: left;
  }

  /* Responsive design for blockchain info */
  @media (max-width: 600px) {
    .blockchain-header {
      padding: 12px 15px;
    }

    .blockchain-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
      padding: 12px 15px;
    }

    .blockchain-label {
      min-width: auto;
    }

    .blockchain-value {
      text-align: left;
      max-width: 100%;
    }
  }
}

/* Loading Animation */
.loading {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid var(--chakra-colors-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>