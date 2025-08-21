// EVO Payment - Main JavaScript

// 全局变量
let selectedProduct = null;
let selectedPrice = 0.25; // 默认选择 Peanut

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
        selectedPrice = 0.25;
        updateProductItemStyles();
    }
    
    // 为每个单选按钮添加事件监听器
    radioInputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.checked) {
                selectedProduct = this.value;
                selectedPrice = parseFloat(this.dataset.price);
                updateProductItemStyles();
                updatePaymentButton();
                
                console.log('Selected product:', selectedProduct, 'Price:', selectedPrice);
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
        payButton.textContent = `Pay With EVO Payment - $${selectedPrice.toFixed(2)}`;
        payButton.disabled = false;
    } else {
        payButton.textContent = 'Pay With EVO Payment';
        payButton.disabled = true;
    }
}

// 处理支付按钮点击
function proceedToPayment() {
    if (!selectedProduct || !selectedPrice) {
        alert('Please select a product first.');
        return;
    }
    
    // 等待支付处理器初始化
    const waitForPaymentHandler = () => {
        if (typeof window.paymentHandler !== 'undefined') {
            // 获取产品信息
            const productInfo = getProductInfo(selectedProduct);
            if (!productInfo) {
                alert('Invalid product selected.');
                return;
            }
            
            // 创建支付会话
            const paymentSession = window.paymentHandler.createPaymentSession({
                key: selectedProduct,
                name: productInfo.name,
                price: selectedPrice
            });
            
            console.log('Created payment session:', paymentSession);
            
            // 导航到收银台页面
            window.paymentHandler.navigateToPage('payment-selection', paymentSession.paymentId);
        } else {
            console.log('Waiting for payment handler to initialize...');
            setTimeout(waitForPaymentHandler, 100);
        }
    };
    
    waitForPaymentHandler();
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
        price: 0.25,
        description: 'Food Donation (Peanut)'
    },
    rice: {
        name: 'Rice',
        emoji: '🍚',
        price: 0.50,
        description: 'Food Donation (Rice)'
    },
    bread: {
        name: 'Bread',
        emoji: '🍞',
        price: 1.00,
        description: 'Food Donation (Bread)'
    },
    milk: {
        name: 'Milk',
        emoji: '🥛',
        price: 2.00,
        description: 'Food Donation (Milk)'
    },
    fruit: {
        name: 'Fruit',
        emoji: '🍎',
        price: 3.00,
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