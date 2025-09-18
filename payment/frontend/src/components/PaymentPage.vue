<template>
  <div class="payment-main-container">
    <!-- Payment Form Container -->
    <div class="payment-form-container">
      <div class="payment-form-card">
        <!-- Payment Info -->
        <div class="payment-info">
          <h2 class="payment-title">Complete Your Payment</h2>
          <div class="payment-details">
            <div class="payment-item">
              <span class="payment-label">Item:</span>
              <span class="payment-value" id="selected-item">{{ productName }}</span>
            </div>
            <div class="payment-item">
              <span class="payment-label">Amount:</span>
              <span class="payment-value" id="selected-amount">${{ amount.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Payment Method Selection -->
        <div class="payment-section">
          <label class="section-label">Select Payment</label>
          <div class="dropdown-container">
            <button class="dropdown-button" id="payment-dropdown"
                    :class="{ active: paymentMenuOpen }"
                    @click="togglePaymentDropdown">
              <span class="dropdown-text" :class="{ placeholder: !selectedToken }" id="payment-selected">
                {{ selectedToken ? selectedToken.fullName : 'Choose payment method' }}
              </span>
              <span class="dropdown-arrow">▼</span>
            </button>
            <div class="dropdown-menu" id="payment-menu" :class="{ show: paymentMenuOpen }">
              <div class="dropdown-item" v-for="token in availableTokens" :key="token.symbol"
                   @click="selectPayment(token.symbol, token.fullName)">
                <span class="token-icon">{{ token.icon }}</span>
                <span class="token-name">{{ token.fullName }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Network Selection -->
        <div class="payment-section">
          <label class="section-label">Select Network</label>
          <div class="dropdown-container">
            <button class="dropdown-button" id="network-dropdown"
                    :class="{ active: networkMenuOpen }"
                    @click="toggleNetworkDropdown">
              <span class="dropdown-text" :class="{ placeholder: !selectedNetwork }" id="network-selected">
                {{ selectedNetwork ? selectedNetwork.name : 'Choose network' }}
              </span>
              <span class="dropdown-arrow">▼</span>
            </button>
            <div class="dropdown-menu" id="network-menu" :class="{ show: networkMenuOpen }">
              <div class="dropdown-item available"
                   v-for="network in availableNetworks" :key="network.id"
                   :class="{ unavailable: !network.enabled }"
                   @click="selectNetwork(network.id, network.name)">
                <div class="network-info">
                  <span class="network-main">{{ network.shortName }}</span>
                  <span class="network-sub">{{ network.name }}</span>
                </div>
                <div class="network-details">
                  <span class="confirmation-time">confirmation time ~{{ network.confirmationTime }}</span>
                  <span class="network-fee">fee {{ network.fee }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Continue Button -->
        <button class="continue-button" id="continue-btn"
                :disabled="!selectedToken || !selectedNetwork || isProcessing"
                @click="createPayment">
          {{ isProcessing ? 'Processing...' : 'Continue to Payment' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaymentPage',
  data() {
    return {
      productId: '',
      productName: '',
      amount: 0,
      selectedToken: null,
      selectedNetwork: null,
      paymentMenuOpen: false,
      networkMenuOpen: false,
      isProcessing: false,
      availableTokens: [
        { symbol: 'USDC', fullName: 'USDC', icon: '$' },
        { symbol: 'USDC.e', fullName: 'USDC.e(Bridged)', icon: '$' },
        { symbol: 'USDT', fullName: 'USDT', icon: '₮' },
        { symbol: 'BUSD', fullName: 'BUSD', icon: 'B' },
        { symbol: 'TUSD', fullName: 'TUSD', icon: 'T' }
      ],
      availableNetworks: [
        {
          id: 'BSC',
          name: 'BNB Smart Chain',
          shortName: 'BSC',
          enabled: true,
          confirmationTime: '20s',
          fee: '0.159625 USDC ( = $ 0.16 )'
        },
        {
          id: 'MATIC',
          name: 'Polygon',
          shortName: 'Matic',
          enabled: false,
          confirmationTime: '30s',
          fee: '0.001489 USDC ( = $ 0.10 )'
        },
        {
          id: 'ETH',
          name: 'Ethereum',
          shortName: 'ETH',
          enabled: false,
          confirmationTime: '15m',
          fee: 'N/A'
        },
        {
          id: 'SOL',
          name: 'Solana',
          shortName: 'SOL',
          enabled: false,
          confirmationTime: '10s',
          fee: 'N/A'
        }
      ]
    }
  },
  mounted() {
    // Get URL parameters from Vue Router
    this.productId = this.$route.query.productId;
    this.productName = this.$route.query.productName;
    this.amount = parseFloat(this.$route.query.amount) || 0;

    // Close dropdowns when clicking outside
    document.addEventListener('click', this.handleOutsideClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleOutsideClick);
  },
  methods: {
    togglePaymentDropdown() {
      this.paymentMenuOpen = !this.paymentMenuOpen;
      if (this.paymentMenuOpen) {
        this.networkMenuOpen = false;
      }
    },
    toggleNetworkDropdown() {
      this.networkMenuOpen = !this.networkMenuOpen;
      if (this.networkMenuOpen) {
        this.paymentMenuOpen = false;
      }
    },
    handleOutsideClick(event) {
      const paymentDropdown = document.getElementById('payment-dropdown');
      const networkDropdown = document.getElementById('network-dropdown');

      if (paymentDropdown && !paymentDropdown.contains(event.target)) {
        this.paymentMenuOpen = false;
      }

      if (networkDropdown && !networkDropdown.contains(event.target)) {
        this.networkMenuOpen = false;
      }
    },
    selectPayment(symbol, fullName) {
      this.selectedToken = { symbol, fullName };
      this.paymentMenuOpen = false;
    },
    selectNetwork(id, name) {
      // Only allow selection of enabled networks
      const network = this.availableNetworks.find(n => n.id === id);
      if (network && network.enabled) {
        this.selectedNetwork = { id, name };
        this.networkMenuOpen = false;
      }
    },
    async createPayment() {
      if (!this.selectedToken || !this.selectedNetwork) {
        alert('Please select both token and network');
        return;
      }

      this.isProcessing = true;

      const paymentData = {
        productId: this.productId,
        productName: this.productName,
        amount: this.amount,
        currency: 'USD',
        tokenSymbol: this.selectedToken.symbol,
        networkId: this.selectedNetwork.id,
        receiverAddress: '0xe27577B0e3920cE35f100f66430de0108cb78a04'
      };

      try {
        const response = await fetch('/api/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (response.ok) {
          // Set paymentId and expirationTime
          this.paymentId = result.paymentId;
          // Format expiration time to a readable format
          if (result.expiresAt) {
            const expiryDate = new Date(result.expiresAt);
            this.expirationTime = expiryDate.toLocaleString();
          }

          // Navigate to QR code page using Vue Router
          this.$router.push({
            path: '/qrcode',
            query: {
              paymentId: result.paymentId
            }
          });
        } else {
          alert(`Error: ${result.message}`);
        }
      } catch (error) {
        alert(`Error: ${error.message}`);
      } finally {
        this.isProcessing = false;
      }
    }
  }
}
</script>

<style scoped>
/* Stable Coin - Payment Page Styles */

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
.payment-main-container {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #f4d8a9 0%, #e0b885 50%, #cc9966 100%);
  padding-top: 2rem;
}

.payment-form-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  padding: 2rem var(--chakra-space-4);
  flex: 1;
}

.payment-form-card {
  background-color: var(--chakra-colors-white);
  border-radius: var(--chakra-radii-xl);
  padding: 2rem;
  box-shadow: 0 20px 40px rgba(212, 165, 116, 0.15);
  border: 2px solid rgba(212, 165, 116, 0.2);
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Payment Info */
.payment-info {
  text-align: center;
  border-bottom: 1px solid var(--chakra-colors-gray-200);
  padding-bottom: 1.5rem;
}

.payment-title {
  font-size: var(--chakra-fontSizes-2xl);
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

/* Payment Sections */
.payment-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: var(--chakra-fontSizes-lg);
  font-weight: var(--chakra-fontWeights-medium);
  color: var(--chakra-colors-fontBlack);
}

/* Dropdown Styles */
.dropdown-container {
  position: relative;
}

.dropdown-button {
  width: 100%;
  padding: 1rem;
  border: 2px solid var(--chakra-colors-gray-200);
  border-radius: var(--chakra-radii-lg);
  background-color: var(--chakra-colors-white);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: var(--chakra-fontSizes-md);
}

.dropdown-button:hover {
  border-color: var(--chakra-colors-primary);
}

.dropdown-button.active {
  border-color: var(--chakra-colors-primary);
  box-shadow: 0 0 0 1px var(--chakra-colors-primary);
}

.dropdown-text {
  color: var(--chakra-colors-fontBlack);
  font-weight: var(--chakra-fontWeights-medium);
}

.dropdown-text.placeholder {
  color: var(--chakra-colors-grey-550);
}

.dropdown-arrow {
  color: var(--chakra-colors-grey-550);
  transition: transform 0.2s ease;
}

.dropdown-button.active .dropdown-arrow {
  transform: rotate(180deg);
}

/* Dropdown Menu */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--chakra-colors-white);
  border: 2px solid var(--chakra-colors-primary);
  border-radius: var(--chakra-radii-lg);
  box-shadow: var(--chakra-shadows-lg);
  z-index: 1000;
  display: none;
  margin-top: 0.25rem;
}

.dropdown-menu.show {
  display: block;
  animation: fadeInDown 0.2s ease;
}

.dropdown-item {
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid var(--chakra-colors-gray-100);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item.available:hover {
  background-color: var(--chakra-colors-primaryBg);
  cursor: pointer;
}

.dropdown-item.unavailable {
  opacity: 0.6;
  cursor: not-allowed;
}

.dropdown-item.unavailable:hover {
  background-color: transparent;
}

.token-icon,
.network-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--chakra-colors-primary);
  color: var(--chakra-colors-white);
  border-radius: var(--chakra-radii-full);
  font-weight: var(--chakra-fontWeights-bold);
  font-size: 14px;
}

.token-name,
.network-name {
  font-weight: var(--chakra-fontWeights-medium);
  color: var(--chakra-colors-fontBlack);
}

/* Network dropdown specific styles */
.network-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.network-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: right;
  font-size: 0.875rem;
}

.network-main {
  font-weight: var(--chakra-fontWeights-bold);
  color: var(--chakra-colors-fontBlack);
  font-size: 1.125rem;
}

.network-sub {
  font-weight: var(--chakra-fontWeights-normal);
  color: var(--chakra-colors-grey-550);
  font-size: 0.875rem;
}

.confirmation-time {
  color: var(--chakra-colors-grey-550);
}

.network-fee {
  color: var(--chakra-colors-fontBlack);
  font-weight: var(--chakra-fontWeights-medium);
}

.unavailable-badge {
  background-color: #ff6b6b;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: var(--chakra-fontWeights-bold);
  margin-left: 0.5rem;
}

/* Adjust dropdown item layout for network items */
#network-menu .dropdown-item {
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
}

/* Continue Button */
.continue-button {
  background: var(--chakra-colors-primary);
  color: var(--chakra-colors-white);
  border: none;
  border-radius: var(--chakra-radii-lg);
  padding: 1rem 2rem;
  font-size: var(--chakra-fontSizes-lg);
  font-weight: var(--chakra-fontWeights-bold);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 1rem;
}

.continue-button:hover:not(:disabled) {
  background: var(--chakra-colors-primaryHover);
  transform: translateY(-2px);
}

.continue-button:disabled {
  background: var(--chakra-colors-grey-500);
  cursor: not-allowed;
  transform: none;
}

/* Animations */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive Design */
@media screen and (max-width: 768px) {
  .payment-form-card {
    margin: 1rem;
    padding: 1.5rem;
  }

  .payment-title {
    font-size: var(--chakra-fontSizes-xl);
  }
}

/* Close dropdown when clicking outside */
.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  display: none;
}

.dropdown-overlay.show {
  display: block;
}
</style>