// Stable Coin - Success Page JavaScript

// Global variables
let paymentData = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPaymentData();
    displaySuccessInfo();
});

// 加载支付数据
function loadPaymentData() {
    const data = sessionStorage.getItem('paymentData');
    if (data) {
        paymentData = JSON.parse(data);
        console.log('Payment data loaded:', paymentData);
    } else {
        // 如果没有支付数据，显示默认信息
        console.log('No payment data found, showing default success message');
        paymentData = {
            product: 'unknown',
            price: 0,
            paymentId: 'N/A',
            selectedPayment: { symbol: 'N/A', name: 'N/A' },
            selectedNetwork: { symbol: 'N/A', name: 'N/A' },
            timestamp: Date.now(),
            confirmedAt: Date.now() // 添加确认时间作为备用
        };
    }
}

// 显示成功信息
function displaySuccessInfo() {
    if (!paymentData) return;
    
    const itemElement = document.getElementById('success-item');
    const amountElement = document.getElementById('success-amount');
    const paymentMethodElement = document.getElementById('success-payment-method');
    const networkElement = document.getElementById('success-network');
    const payIdElement = document.getElementById('success-payment-id');
    const timestampElement = document.getElementById('success-timestamp');
    
    if (itemElement && amountElement && paymentMethodElement && networkElement && payIdElement && timestampElement) {
        // 获取产品信息
        const productInfo = getProductInfo(paymentData.product);
        const itemName = productInfo ? productInfo.description : `Food Donation (${paymentData.product})`;
        
        itemElement.textContent = itemName;
        amountElement.textContent = `$${paymentData.price.toFixed(2)}`;
        
        // 显示选择的支付方式和网络
        if (paymentData.selectedPayment) {
            // 如果symbol和name相同，只显示一个，否则显示 "symbol - name"
            if (paymentData.selectedPayment.symbol === paymentData.selectedPayment.name) {
                paymentMethodElement.textContent = paymentData.selectedPayment.symbol;
            } else {
                paymentMethodElement.textContent = `${paymentData.selectedPayment.symbol} - ${paymentData.selectedPayment.name}`;
            }
        } else {
            paymentMethodElement.textContent = 'N/A';
        }
        
        if (paymentData.selectedNetwork) {
            // 如果symbol和name相同，只显示一个，否则显示 "symbol - name"
            if (paymentData.selectedNetwork.symbol === paymentData.selectedNetwork.name) {
                networkElement.textContent = paymentData.selectedNetwork.symbol;
            } else {
                networkElement.textContent = `${paymentData.selectedNetwork.symbol} - ${paymentData.selectedNetwork.name}`;
            }
        } else {
            networkElement.textContent = 'N/A';
        }
        
        // 显示 PayID
        payIdElement.textContent = paymentData.paymentId;
        
        // 显示交易时间
        let transactionTime;
        if (paymentData.confirmedAt) {
            // 使用确认时间
            transactionTime = new Date(paymentData.confirmedAt);
        } else if (paymentData.timestamp) {
            // 回退到创建时间
            transactionTime = new Date(paymentData.timestamp);
        } else {
            // 默认使用当前时间
            transactionTime = new Date();
        }
        
        // 检查日期是否有效
        if (isNaN(transactionTime.getTime())) {
            console.error('Invalid transaction time:', paymentData);
            timestampElement.textContent = 'Invalid Date';
        } else {
            timestampElement.textContent = formatTimestamp(transactionTime);
        }
    }
}

// 获取产品信息
function getProductInfo(productKey) {
    const products = {
        peanut: { description: 'Food Donation (Peanut)' },
        rice: { description: 'Food Donation (Rice)' },
        bread: { description: 'Food Donation (Bread)' },
        milk: { description: 'Food Donation (Milk)' },
        fruit: { description: 'Food Donation (Fruit)' }
    };
    return products[productKey] || null;
}

// 格式化时间戳
function formatTimestamp(date) {
    // 检查输入是否为有效日期
    if (!date || isNaN(date.getTime())) {
        console.error('Invalid date provided to formatTimestamp:', date);
        return 'Invalid Date';
    }
    
    try {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return 'Invalid Date';
    }
}

// 开始新的支付
function startNewPayment() {
    // 清除支付处理器数据
    if (typeof window.paymentHandler !== 'undefined') {
        window.paymentHandler.clearStorage();
    }
    
    // 清除当前支付数据
    sessionStorage.removeItem('paymentData');
    
    // 跳转到首页
    window.location.href = 'index.html';
}

// 返回首页
function goHome() {
    // 清除支付处理器数据
    if (typeof window.paymentHandler !== 'undefined') {
        window.paymentHandler.clearStorage();
    }
    
    // 清除当前支付数据
    sessionStorage.removeItem('paymentData');
    
    // 跳转到首页
    window.location.href = 'index.html';
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.SuccessPage = {
        startNewPayment,
        goHome,
        displaySuccessInfo
    };
}