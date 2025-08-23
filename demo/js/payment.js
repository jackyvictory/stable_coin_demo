// Stable Coin - Payment Page JavaScript (WebSocket Version)

// 全局变量
let selectedPayment = null;
let selectedNetwork = null;
let paymentData = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPaymentData();
    initializeDropdowns();
    updateContinueButton();
});

// 加载支付数据
function loadPaymentData() {
    // 优先从支付处理器获取数据
    if (typeof window.paymentHandler !== 'undefined') {
        const currentPayment = window.paymentHandler.getCurrentPayment();
        if (currentPayment) {
            paymentData = currentPayment;
            displayPaymentInfo();
            return;
        }
    }
    
    // 回退到 sessionStorage
    const data = sessionStorage.getItem('paymentData');
    if (data) {
        paymentData = JSON.parse(data);
        displayPaymentInfo();
    } else {
        // 如果没有支付数据，重定向到首页
        alert('No payment data found. Redirecting to homepage.');
        window.location.href = 'index.html';
    }
}

// 显示支付信息
function displayPaymentInfo() {
    if (!paymentData) return;
    
    const itemElement = document.getElementById('selected-item');
    const amountElement = document.getElementById('selected-amount');
    const payIdElement = document.getElementById('payment-id');
    const expirationElement = document.getElementById('expiration-time');
    
    if (itemElement && amountElement && payIdElement && expirationElement) {
        // 获取产品信息
        const productInfo = getProductInfo(paymentData.product);
        const itemName = productInfo ? productInfo.description : `Food Donation (${paymentData.product})`;
        
        itemElement.textContent = itemName;
        amountElement.textContent = `$${paymentData.price.toFixed(2)}`;
        
        // 显示 PayID
        payIdElement.textContent = paymentData.paymentId;
        
        // 计算并显示过期时间
        let expirationTime;
        if (paymentData.expiresAt) {
            // 使用支付处理器的过期时间
            expirationTime = new Date(paymentData.expiresAt);
        } else if (paymentData.timestamp) {
            // 回退到传统的时间戳计算
            expirationTime = new Date(paymentData.timestamp + 30 * 60 * 1000);
        } else {
            // 默认30分钟后过期
            expirationTime = new Date(Date.now() + 30 * 60 * 1000);
        }
        
        const timeString = formatExpirationTime(expirationTime);
        expirationElement.textContent = timeString;
        
        // 开始倒计时
        startExpirationCountdown(expirationTime, expirationElement);
    }
}

// 格式化过期时间
function formatExpirationTime(date) {
    if (!date || isNaN(date.getTime())) {
        console.error('Invalid date provided to formatExpirationTime:', date);
        return 'Invalid Time';
    }
    
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff <= 0) {
        return 'Expired';
    }
    
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // 检查计算结果是否有效
    if (isNaN(minutes) || isNaN(seconds)) {
        console.error('Invalid time calculation:', { diff, minutes, seconds, date, now });
        return 'Invalid Time';
    }
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 开始过期倒计时
function startExpirationCountdown(expirationTime, element) {
    const updateCountdown = () => {
        const timeString = formatExpirationTime(expirationTime);
        element.textContent = timeString;
        
        if (timeString === 'Expired') {
            element.style.color = 'var(--chakra-colors-red-500)';
            clearInterval(countdownInterval);
            // 可以在这里添加过期处理逻辑
        }
    };
    
    // 立即更新一次
    updateCountdown();
    
    // 每秒更新
    const countdownInterval = setInterval(updateCountdown, 1000);
    
    // 保存 interval ID 以便后续清理
    window.expirationCountdown = countdownInterval;
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

// 初始化下拉框
function initializeDropdowns() {
    // 点击外部关闭下拉框
    document.addEventListener('click', function(event) {
        const paymentDropdown = document.getElementById('payment-menu');
        const networkDropdown = document.getElementById('network-menu');
        const paymentButton = document.getElementById('payment-dropdown');
        const networkButton = document.getElementById('network-dropdown');
        
        if (!paymentButton.contains(event.target)) {
            closeDropdown('payment');
        }
        
        if (!networkButton.contains(event.target)) {
            closeDropdown('network');
        }
    });
}

// 切换支付方式下拉框
function togglePaymentDropdown() {
    const menu = document.getElementById('payment-menu');
    const button = document.getElementById('payment-dropdown');
    
    if (menu.classList.contains('show')) {
        closeDropdown('payment');
    } else {
        closeDropdown('network'); // 关闭其他下拉框
        openDropdown('payment');
    }
}

// 切换网络下拉框
function toggleNetworkDropdown() {
    const menu = document.getElementById('network-menu');
    const button = document.getElementById('network-dropdown');
    
    if (menu.classList.contains('show')) {
        closeDropdown('network');
    } else {
        closeDropdown('payment'); // 关闭其他下拉框
        openDropdown('network');
    }
}

// 打开下拉框
function openDropdown(type) {
    const menu = document.getElementById(`${type}-menu`);
    const button = document.getElementById(`${type}-dropdown`);
    
    menu.classList.add('show');
    button.classList.add('active');
}

// 关闭下拉框
function closeDropdown(type) {
    const menu = document.getElementById(`${type}-menu`);
    const button = document.getElementById(`${type}-dropdown`);
    
    menu.classList.remove('show');
    button.classList.remove('active');
}

// 选择支付方式
function selectPayment(symbol, name) {
    selectedPayment = { symbol, name };
    
    const selectedText = document.getElementById('payment-selected');
    // 如果symbol和name相同，只显示一个，否则显示 "symbol - name"
    if (symbol === name) {
        selectedText.textContent = symbol;
    } else {
        selectedText.textContent = `${symbol} - ${name}`;
    }
    selectedText.classList.remove('placeholder');
    
    closeDropdown('payment');
    updateContinueButton();
    
    console.log('Selected payment:', selectedPayment);
}

// 选择网络
function selectNetwork(symbol, name) {
    // 只允许选择可用的网络（目前只有 BSC）
    if (symbol !== 'BSC') {
        return; // 不允许选择不可用的网络
    }
    
    selectedNetwork = { symbol, name };
    
    const selectedText = document.getElementById('network-selected');
    selectedText.textContent = `${symbol} - ${name}`;
    selectedText.classList.remove('placeholder');
    
    closeDropdown('network');
    updateContinueButton();
    
    console.log('Selected network:', selectedNetwork);
}

// 更新继续按钮状态
function updateContinueButton() {
    const continueBtn = document.getElementById('continue-btn');
    
    if (selectedPayment && selectedNetwork) {
        continueBtn.disabled = false;
        continueBtn.textContent = 'Continue to Payment';
    } else {
        continueBtn.disabled = true;
        continueBtn.textContent = 'Select payment method and network';
    }
}

// 进入二维码页面 (WebSocket 版本)
function proceedToQRCode() {
    if (!selectedPayment || !selectedNetwork || !paymentData) {
        alert('Please select both payment method and network.');
        return;
    }
    
    // 使用支付处理器更新支付方式和网络
    if (typeof window.paymentHandler !== 'undefined') {
        const updatedPayment = window.paymentHandler.setPaymentMethodAndNetwork(
            paymentData.paymentId,
            selectedPayment,
            selectedNetwork
        );
        
        if (updatedPayment) {
            console.log('Updated payment with method and network:', updatedPayment);
            
            // 导航到二维码页面
            window.location.href = 'qrcode.html';
        } else {
            alert('Failed to update payment information.');
        }
    } else {
        // 回退到传统方式，但跳转到 WebSocket 版本
        const updatedPaymentData = {
            ...paymentData,
            selectedPayment: selectedPayment,
            selectedNetwork: selectedNetwork,
            timestamp: Date.now()
        };
        
        sessionStorage.setItem('paymentData', JSON.stringify(updatedPaymentData));
        console.log('Proceeding to QR code with:', updatedPaymentData);
        window.location.href = 'qrcode.html';
    }
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.PaymentPageWS = {
        selectPayment,
        selectNetwork,
        togglePaymentDropdown,
        toggleNetworkDropdown,
        proceedToQRCode
    };
}