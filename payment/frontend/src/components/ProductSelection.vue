<template>
  <div class="main-container">
    <!-- Product Selection Container -->
    <div class="product-container">
      <!-- Product Grid -->
      <div class="product-grid" role="radiogroup">
        <!-- Peanut Product -->
        <div class="product-item" v-for="product in products" :key="product.id"
             :data-product="product.id" :data-price="product.price.toFixed(2)"
             :class="{ selected: selectedProduct && selectedProduct.id === product.id }"
             @click="selectProduct(product)">
          <div class="radio-container">
            <input class="radio-input" :id="'product-' + product.id" type="radio"
                   name="product-selection" :value="product.id" :data-price="product.price.toFixed(2)"
                   :checked="selectedProduct && selectedProduct.id === product.id">
            <span class="radio-control"></span>
            <label class="product-label" :for="'product-' + product.id">
              <div class="product-content">
                <span class="product-emoji">{{ product.emoji }}</span>
                <span class="product-price">${{ product.price.toFixed(2) }}</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Donation and Payment Section -->
      <div class="donation-payment-section">
        <div class="avatar-container">
          <img alt="avatar" src="/src/assets/avatar_circular.png" class="avatar-image">
        </div>
        <div class="donation-payment-card">
          <div class="donation-text">
            <p class="donation-message">The payment you make donates food to the Stable Coin team.</p>
          </div>
          <button class="payment-button" id="pay-button" @click="proceedToPayment"
                  :disabled="!selectedProduct">
            🔌 Pay With Stable Coin
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProductSelection',
  data() {
    return {
      selectedProduct: null,
      products: [
        {
          id: 'peanut',
          name: 'Peanuts',
          price: 1.00,
          emoji: '🥜'
        },
        {
          id: 'rice',
          name: 'Rice',
          price: 5.00,
          emoji: '🍚'
        },
        {
          id: 'bread',
          name: 'Bread',
          price: 10.00,
          emoji: '🍞'
        },
        {
          id: 'milk',
          name: 'Milk',
          price: 20.00,
          emoji: '🥛'
        },
        {
          id: 'fruit',
          name: 'Fruit',
          price: 30.00,
          emoji: '🍎'
        }
      ]
    }
  },
  methods: {
    selectProduct(product) {
      this.selectedProduct = product;
    },
    proceedToPayment() {
      if (this.selectedProduct) {
        // Navigate to payment page with product details using Vue Router
        this.$router.push({
          path: '/payment',
          query: {
            productId: this.selectedProduct.id,
            productName: this.selectedProduct.name,
            amount: this.selectedProduct.price
          }
        });
      }
    }
  },
  mounted() {
    // Select the first product by default
    if (this.products.length > 0) {
      this.selectProduct(this.products[0]);
    }
  }
}
</script>

<style>
/* Stable Coin - Main Styles */

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
.main-container {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f4d8a9;
  background-image: url('/src/assets/donation_bg.png');
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  padding-bottom: 200px;
}

.main-container > * + * {
  margin-top: 0.5rem;
}

/* Donation and Payment Section */
.donation-payment-section {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  padding: var(--chakra-space-4);
  margin-top: var(--chakra-space-4);
  gap: 0;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}

.avatar-container {
  flex-shrink: 0;
  position: relative;
}

.avatar-image {
  width: 150px;
  height: 150px;
  object-fit: cover;
}

.donation-payment-card {
  background-color: #d6e0ef;
  border-radius: var(--chakra-radii-xl);
  padding: 1.5rem 2rem;
  box-shadow: var(--chakra-shadows-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  min-width: 750px;
  max-width: 900px;
  width: auto;
}

.donation-text {
  width: 100%;
  text-align: center;
}

.donation-message {
  color: #694536;
  margin: 0;
  font-size: 18px;
  font-weight: var(--chakra-fontWeights-bold);
  line-height: 1.5;
  white-space: nowrap;
}

@media screen and (min-width: 640px) {
  .donation-message {
    font-size: 20px;
  }
}

@media screen and (max-width: 768px) {
  .donation-payment-section {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .avatar-image {
    width: 120px;
    height: 120px;
  }

  .donation-payment-card {
    min-width: 320px;
    max-width: 90vw;
    padding: 1rem 1.5rem;
  }

  .donation-message {
    font-size: 16px;
    white-space: normal;
  }
}

@media screen and (max-width: 480px) {
  .donation-payment-card {
    min-width: 280px;
    padding: 1rem;
  }

  .donation-message {
    font-size: 14px;
  }
}

/* Product Selection Container */
.product-container {
  display: flex;
  align-items: center;
  flex-direction: column;
  width: 100%;
  min-width: 370px;
  margin-top: auto;
}

.product-container > * + * {
  margin-top: 0.5rem;
}

@media screen and (min-width: 96em) {
  .product-container {
    width: 100%;
  }
}

@media screen and (min-width: 640px) {
  .product-container {
    width: 750px;
  }
}

@media screen and (max-width: 640px) {
  .product-grid {
    flex-direction: column;
    align-items: center;
  }

  .product-item {
    width: 90%;
    max-width: 300px;
  }
}

/* Product Grid */
.product-grid {
  width: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-evenly;
}

@media screen and (min-width: 96em) {
  .product-grid {
    width: 100%;
    flex-wrap: wrap;
  }
}

@media screen and (min-width: 640px) {
  .product-grid {
    width: 600px;
    flex-wrap: nowrap;
  }
}

@media screen and (max-width: 640px) {
  .product-grid {
    flex-direction: column;
    align-items: center;
  }

  .product-item {
    width: 90%;
    max-width: 300px;
  }
}

/* Product Item */
.product-item {
  display: flex;
  align-items: center;
  flex-direction: row;
  border-radius: var(--chakra-radii-xl);
  border-color: #dbb3a2;
  background-color: #ffd8c2;
  border-width: 1px;
  border-style: solid;
  padding-left: var(--chakra-space-3);
  padding-right: var(--chakra-space-3);
  padding-top: var(--chakra-space-2);
  padding-bottom: var(--chakra-space-2);
  margin-bottom: var(--chakra-space-3);
  margin-left: var(--chakra-space-2);
  margin-right: var(--chakra-space-2);
  cursor: pointer;
  transition: all 0.2s ease;
}

.product-item:hover {
  background-color: #ffcdb2;
  transform: translateY(-2px);
}

.product-item.selected {
  background-color: #ffb89a;
  border-color: #b38b7a;
}

.product-item > * + * {
  margin-left: 0.5rem;
}

/* Radio Button */
.radio-container {
  display: flex;
  align-items: stretch;
  vertical-align: top;
  cursor: pointer;
  position: relative;
  width: 100%;
}

.radio-input {
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 1px;
  width: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  position: absolute;
}

.radio-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  transition: box-shadow 0.2s;
  border: 2px solid;
  border-radius: var(--chakra-radii-full);
  border-color: var(--chakra-colors-grey-550);
  color: var(--chakra-colors-white);
  align-self: center;
}

.radio-input:checked + .radio-control {
  background: #b38b7a;
  border-color: #b38b7a;
  color: var(--chakra-colors-white);
}

.radio-input:checked + .radio-control::before {
  content: "";
  display: inline-block;
  position: relative;
  width: 30%;
  height: 30%;
  border-radius: 50%;
  background: currentColor;
}

.radio-control:hover {
  background: #694536;
  border-color: #694536;
}

/* Product Label */
.product-label {
  user-select: none;
  margin-left: 0.5rem;
  display: flex;
  width: 100%;
  font-size: var(--chakra-fontSizes-md);
}

.product-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-direction: row;
  width: 100%;
}

.product-content > * + * {
  margin-left: 0.5rem;
}

.product-emoji {
  color: var(--chakra-colors-fontBlack);
  font-size: 22px;
  font-weight: var(--chakra-fontWeights-medium);
}

.product-price {
  color: var(--chakra-colors-fontBlack);
  display: inline-flex;
  font-size: 20px;
  font-weight: var(--chakra-fontWeights-bold);
}

/* Payment Button */
.payment-button {
  background: var(--chakra-colors-primary);
  color: var(--chakra-colors-white);
  border: none;
  border-radius: var(--chakra-radii-xl);
  padding: 1rem 2rem;
  font-size: var(--chakra-fontSizes-lg);
  font-weight: var(--chakra-fontWeights-bold);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--chakra-shadows-md);
  width: 100%;
  margin: 0;
}

.payment-button:hover:not(:disabled) {
  background: var(--chakra-colors-primaryHover);
  transform: translateY(-2px);
  box-shadow: 0 12px 20px 0 rgba(0, 0, 0, 0.12);
}

.payment-button:active {
  transform: translateY(0);
}

.payment-button:disabled {
  background: var(--chakra-colors-grey-500);
  cursor: not-allowed;
  transform: none;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/*
.product-item {
  animation: fadeIn 0.5s ease-out;
}

.product-item:nth-child(1) { animation-delay: 0.1s; }
.product-item:nth-child(2) { animation-delay: 0.2s; }
.product-item:nth-child(3) { animation-delay: 0.3s; }
.product-item:nth-child(4) { animation-delay: 0.4s; }
.product-item:nth-child(5) { animation-delay: 0.5s; }
*/

/* Responsive Design */
@media screen and (max-width: 640px) {
  .product-grid {
    flex-direction: column;
    align-items: center;
  }

  .product-item {
    width: 90%;
    max-width: 300px;
  }
}
</style>