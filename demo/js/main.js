// Stable Coin - Main JavaScript

// 全局变量
let selectedProduct = null;
let selectedPrice = 1.00; // 默认选择 Peanut

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeProductSelection();
    updatePaymentButton();
});

// 初始化商品选择功能
function initializeProductSelection() {
    const radioInputs = document.querySelectorAll('input[name="product-selection"]');
    const productItems = document.querySelectorAll('.product-item');
    
    // 设置默认选择
    const defaultProduct = document.querySelector('input[value="peanut"]');
    if (defaultProduct) {
        defaultProduct.checked = true;
        selectedProduct = 'peanut';
        selectedPrice = parseFloat(defaultProduct.dataset.price) || 1.00;
        updateProductItemStyles();
        console.log('🥜 Default product selected:', selectedProduct, 'Price:', selectedPrice);
    }
    
    // 为每个单选按钮添加事件监听器
    radioInputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.checked) {
                selectedProduct = this.value;
                selectedPrice = parseFloat(this.dataset.price);
                updateProductItemStyles();
                updatePaymentButton();
                
                console.log('✅ Product selection changed:', selectedProduct, 'Price:', selectedPrice);
                console.log('📊 Data attribute price:', this.dataset.price);
            }
        });
    });
    
    // 为产品项添加点击事件
    productItems.forEach(item => {
        item.addEventListener('click', function() {
            const radio = this.querySelector('input[type="radio"]');
            if (radio && !radio.checked) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }
        });
    });
}

// 更新产品项的视觉样式
function updateProductItemStyles() {
    const productItems = document.querySelectorAll('.product-item');
    
    productItems.forEach(item => {
        const radio = item.querySelector('input[type="radio"]');
        if (radio && radio.checked) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// 更新支付按钮
function updatePaymentButton() {
    const payButton = document.getElementById('pay-button');
    if (payButton && selectedProduct && selectedPrice) {
        payButton.textContent = `Pay With Stable Coin - $${selectedPrice.toFixed(2)}`;
        payButton.disabled = false;
    } else {
        payButton.textContent = 'Pay With Stable Coin';
        payButton.disabled = true;
    }
}

// 处理支付按钮点击 (WebSocket 版本)
function proceedToPayment() {
    if (!selectedProduct || !selectedPrice) {
        alert('Please select a product first.');
        return;
    }
    
    console.log('🔌 Starting WebSocket payment flow...');
    console.log('🔍 Selected product:', selectedProduct, 'Selected price:', selectedPrice);
    
    // 获取产品信息
    const productInfo = getProductInfo(selectedProduct);
    if (!productInfo) {
        alert('Invalid product selected.');
        return;
    }
    
    console.log('📦 Product info:', productInfo);
    
    // 创建支付数据 (简化版，直接跳转)
    const paymentData = {
        paymentId: generatePaymentId(),
        product: selectedProduct,
        productName: productInfo.name,
        price: selectedPrice, // 使用实际选中的价格，而不是产品配置中的价格
        currency: 'USD',
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + (30 * 60 * 1000), // 30分钟后过期
        timestamp: Date.now(),
        monitoringMode: 'websocket' // 标记为 WebSocket 版本
    };
    
    // 保存到 sessionStorage
    sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    
    console.log('💾 Created WebSocket payment session:', paymentData);
    console.log('💰 Final price in payment data:', paymentData.price);
    
    // 直接跳转到支付页面
    window.location.href = 'payment.html';
}

// 生成支付 ID
function generatePaymentId() {
    return 'pay_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 获取选中的产品信息
function getSelectedProduct() {
    return {
        product: selectedProduct,
        price: selectedPrice,
        currency: 'USD'
    };
}

// 产品数据配置
const PRODUCTS = {
    peanut: {
        name: 'Peanut',
        emoji: '🥜',
        price: 1.00,
        description: 'Food Donation (Peanut)'
    },
    rice: {
        name: 'Rice',
        emoji: '🍚',
        price: 5.00,
        description: 'Food Donation (Rice)'
    },
    bread: {
        name: 'Bread',
        emoji: '🍞',
        price: 10.00,
        description: 'Food Donation (Bread)'
    },
    milk: {
        name: 'Milk',
        emoji: '🥛',
        price: 20.00,
        description: 'Food Donation (Milk)'
    },
    fruit: {
        name: 'Fruit',
        emoji: '🍎',
        price: 30.00,
        description: 'Food Donation (Fruit)'
    }
};

// 获取产品详细信息
function getProductInfo(productKey) {
    return PRODUCTS[productKey] || null;
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.EvoPayment = {
        getSelectedProduct,
        getProductInfo,
        proceedToPayment,
        PRODUCTS
    };
}