// EVO Payment - QR Code Page JavaScript

// 全局变量
let paymentData = null;
let countdownInterval = null;
let statusCheckInterval = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPaymentData();
    initializeQRCodePage();
    startStatusMonitoring();
});

// 监听区块链准备就绪事件
window.addEventListener('blockchainReady', function(event) {
    console.log('Received blockchainReady event, starting monitoring...');
    if (paymentData) {
        updatePaymentStatus('monitoring', 'Blockchain Connected');
        startPaymentHandlerMonitoring();
    }
});

// 加载支付数据
function loadPaymentData() {
    // 优先从支付处理器获取数据
    if (typeof window.paymentHandler !== 'undefined') {
        const currentPayment = window.paymentHandler.getCurrentPayment();
        if (currentPayment) {
            paymentData = currentPayment;
            displayPaymentInfo();
            startExpirationCountdown();
            return;
        }
    }
    
    // 回退到 sessionStorage
    const data = sessionStorage.getItem('paymentData');
    if (data) {
        paymentData = JSON.parse(data);
        displayPaymentInfo();
        startExpirationCountdown();
    } else {
        // 如果没有支付数据，重定向到首页
        alert('No payment data found. Redirecting to homepage.');
        window.location.href = 'index.html';
    }
}

// 显示支付信息
function displayPaymentInfo() {
    if (!paymentData) return;
    
    const itemElement = document.getElementById('qr-selected-item');
    const amountElement = document.getElementById('qr-selected-amount');
    const paymentMethodElement = document.getElementById('qr-payment-method');
    const networkElement = document.getElementById('qr-network');
    const payIdElement = document.getElementById('qr-payment-id');
    const expirationElement = document.getElementById('qr-expiration-time');
    
    if (itemElement && amountElement && paymentMethodElement && networkElement && payIdElement && expirationElement) {
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
            paymentMethodElement.textContent = 'Not selected';
        }
        
        if (paymentData.selectedNetwork) {
            // 如果symbol和name相同，只显示一个，否则显示 "symbol - name"
            if (paymentData.selectedNetwork.symbol === paymentData.selectedNetwork.name) {
                networkElement.textContent = paymentData.selectedNetwork.symbol;
            } else {
                networkElement.textContent = `${paymentData.selectedNetwork.symbol} - ${paymentData.selectedNetwork.name}`;
            }
        } else {
            networkElement.textContent = 'Not selected';
        }
        
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
function startExpirationCountdown() {
    if (!paymentData) return;
    
    // 计算过期时间
    let expirationTime;
    console.log('Payment data for time calculation:', {
        expiresAt: paymentData.expiresAt,
        timestamp: paymentData.timestamp,
        createdAt: paymentData.createdAt
    });
    
    if (paymentData.expiresAt) {
        // 使用支付处理器的过期时间
        expirationTime = new Date(paymentData.expiresAt);
        console.log('Using expiresAt:', paymentData.expiresAt, 'Date:', expirationTime);
    } else if (paymentData.timestamp) {
        // 回退到传统的时间戳计算
        expirationTime = new Date(paymentData.timestamp + 30 * 60 * 1000);
        console.log('Using timestamp:', paymentData.timestamp, 'Date:', expirationTime);
    } else {
        // 默认30分钟后过期
        expirationTime = new Date(Date.now() + 30 * 60 * 1000);
        console.log('Using default time, Date:', expirationTime);
    }
    
    const expirationElement = document.getElementById('qr-expiration-time');
    
    const updateCountdown = () => {
        let timeString;
        
        // 优先使用支付处理器的时间格式化
        if (typeof window.paymentHandler !== 'undefined' && paymentData.paymentId) {
            timeString = window.paymentHandler.formatRemainingTime(paymentData.paymentId);
        } else {
            // 回退到本地时间格式化
            timeString = formatExpirationTime(expirationTime);
        }
        
        if (expirationElement) {
            expirationElement.textContent = timeString;
        }
        
        if (timeString === 'Expired') {
            if (expirationElement) {
                expirationElement.style.color = '#ef4444';
            }
            updatePaymentStatus('expired', 'Payment Expired');
            clearInterval(countdownInterval);
            // 可以在这里添加过期处理逻辑
        }
    };
    
    // 立即更新一次
    updateCountdown();
    
    // 每秒更新
    countdownInterval = setInterval(updateCountdown, 1000);
}

// 初始化二维码页面
function initializeQRCodePage() {
    // 设置钱包地址
    const walletAddressInput = document.getElementById('wallet-address');
    if (walletAddressInput) {
        walletAddressInput.value = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
    }
    
    // 初始化状态
    updatePaymentStatus('waiting', 'Waiting for Payment');
    
    console.log('QR Code page initialized');
}

// 复制钱包地址
function copyAddress() {
    const walletAddressInput = document.getElementById('wallet-address');
    const copyButton = document.getElementById('copy-address-btn');
    
    if (walletAddressInput && copyButton) {
        // 选择并复制文本
        walletAddressInput.select();
        walletAddressInput.setSelectionRange(0, 99999); // 对移动设备
        
        try {
            document.execCommand('copy');
            
            // 更新按钮状态
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '<span class="copy-text">Copied!</span>';
            copyButton.classList.add('copied');
            
            // 2秒后恢复原状
            setTimeout(() => {
                copyButton.innerHTML = originalText;
                copyButton.classList.remove('copied');
            }, 2000);
            
            console.log('Address copied to clipboard');
        } catch (err) {
            console.error('Failed to copy address:', err);
            alert('Failed to copy address. Please copy manually.');
        }
    }
}

// 更新支付状态
function updatePaymentStatus(status, message) {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const statusDot = statusIndicator ? statusIndicator.querySelector('.status-dot') : null;
    
    if (statusText) {
        statusText.textContent = message;
    }
    
    if (statusDot) {
        // 移除所有状态类
        statusDot.classList.remove('confirmed', 'failed');
        
        // 根据状态添加相应的类
        switch (status) {
            case 'confirmed':
                statusDot.classList.add('confirmed');
                break;
            case 'failed':
            case 'expired':
                statusDot.classList.add('failed');
                break;
            default:
                // 默认是等待状态，保持动画
                break;
        }
    }
    
    // 更新支付数据中的状态
    if (paymentData) {
        paymentData.status = status;
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    }
    
    console.log('Payment status updated:', status, message);
}

// 开始状态监听
function startStatusMonitoring() {
    console.log('Starting payment status monitoring...');
    
    // 等待支付处理器和区块链管理器初始化
    const waitForServices = () => {
        if (typeof window.paymentHandler !== 'undefined') {
            if (typeof window.blockchainManager !== 'undefined' && window.blockchainManager.isConnected) {
                console.log('Services are ready, starting monitoring...');
                startPaymentHandlerMonitoring();
            } else {
                console.log('Waiting for blockchain services to initialize...');
                // 手动初始化区块链管理器 (避免重复初始化)
                if (typeof window.blockchainManager !== 'undefined' && !window.blockchainManager.isConnected) {
                    // 检查是否已经在初始化过程中
                    if (!window.blockchainManager.initializing) {
                        window.blockchainManager.initializing = true;
                        console.log('Manually initializing blockchain manager...');
                        
                        // 显示初始化状态
                        updatePaymentStatus('pending', 'Initializing Blockchain...');
                        
                        window.blockchainManager.initialize().then(success => {
                            window.blockchainManager.initializing = false;
                            if (success) {
                                console.log('Blockchain manager initialized, starting monitoring...');
                                updatePaymentStatus('monitoring', 'Blockchain Connected');
                                startPaymentHandlerMonitoring();
                            } else {
                                console.error('Failed to initialize blockchain manager');
                                updatePaymentStatus('failed', 'Blockchain Connection Failed - Click Refresh to Retry');
                            }
                        }).catch(error => {
                            window.blockchainManager.initializing = false;
                            console.error('Blockchain initialization error:', error);
                            updatePaymentStatus('failed', 'Blockchain Connection Failed - Click Refresh to Retry');
                        });
                    } else {
                        console.log('Blockchain manager already initializing, waiting...');
                        setTimeout(waitForServices, 1000);
                    }
                } else {
                    // 等待区块链管理器加载，同时监听自动初始化完成
                    console.log('Waiting for blockchain manager auto-initialization...');
                    updatePaymentStatus('pending', 'Waiting for Blockchain...');
                    
                    // 设置一个监听器，等待自动初始化完成
                    const checkInterval = setInterval(() => {
                        if (typeof window.blockchainManager !== 'undefined' && window.blockchainManager.isConnected) {
                            console.log('Blockchain manager auto-initialized, starting monitoring...');
                            clearInterval(checkInterval);
                            updatePaymentStatus('monitoring', 'Blockchain Connected');
                            startPaymentHandlerMonitoring();
                        }
                    }, 500);
                    
                    // 10秒后超时
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        if (typeof window.blockchainManager === 'undefined' || !window.blockchainManager.isConnected) {
                            console.error('Blockchain initialization timeout');
                            updatePaymentStatus('failed', 'Blockchain Connection Timeout - Click Refresh to Retry');
                        }
                    }, 10000);
                }
            }
        } else {
            console.log('Waiting for payment handler to initialize...');
            setTimeout(waitForServices, 1000);
        }
    };
    
    waitForServices();
    
    // 监听区块链准备就绪事件
    window.addEventListener('blockchainReady', (event) => {
        console.log('Received blockchainReady event, starting monitoring...');
        if (!checkAndStartMonitoring()) {
            // 如果还没有启动监听，现在启动
            startPaymentHandlerMonitoring();
        }
    });
    
    // 辅助函数：检查并启动监听
    function checkAndStartMonitoring() {
        if (typeof window.paymentHandler !== 'undefined' && 
            typeof window.blockchainManager !== 'undefined' && 
            window.blockchainManager.isConnected) {
            
            // 检查是否已经有活跃的监听器
            if (paymentData && typeof window.blockchainMonitor !== 'undefined') {
                const monitorStatus = window.blockchainMonitor.getMonitoringStatus(paymentData.paymentId);
                if (monitorStatus) {
                    console.log('Monitor already active, skipping restart');
                    return true;
                }
            }
            
            console.log('Starting payment monitoring...');
            startPaymentHandlerMonitoring();
            return true;
        }
        return false;
    }
}

// 开始支付处理器监听
function startPaymentHandlerMonitoring() {
    if (!paymentData || !paymentData.selectedPayment) {
        console.error('No payment data available for monitoring');
        return;
    }
    
    const paymentId = paymentData.paymentId;
    
    console.log(`Starting payment handler monitoring for ${paymentId}`);
    console.log('Available blockchain objects:', {
        blockchainManager: typeof window.blockchainManager,
        blockchainMonitor: typeof window.blockchainMonitor,
        paymentHandler: typeof window.paymentHandler
    });
    
    // 使用支付处理器开始监听
    const success = window.paymentHandler.startPaymentMonitoring(paymentId);
    
    if (success) {
        console.log('Payment monitoring started successfully');
        
        // 注册状态变化回调
        window.paymentHandler.onStatusChange(paymentId, (newStatus, oldStatus, payment) => {
            console.log(`Payment status changed: ${oldStatus} -> ${newStatus}`, payment);
            
            // 更新UI状态
            switch (newStatus) {
                case window.PaymentStatus.MONITORING:
                    updatePaymentStatus('monitoring', 'Monitoring Payment...');
                    break;
                case window.PaymentStatus.CONFIRMED:
                    updatePaymentStatus('confirmed', 'Payment Confirmed!');
                    break;
                case window.PaymentStatus.COMPLETED:
                    // 支付完成，跳转到成功页面
                    confirmPayment(payment.verificationResult);
                    break;
                case window.PaymentStatus.FAILED:
                    updatePaymentStatus('failed', payment.errorMessage || 'Payment Failed');
                    break;
                case window.PaymentStatus.EXPIRED:
                    updatePaymentStatus('expired', 'Payment Expired');
                    break;
            }
        });
    } else {
        console.error('Failed to start payment monitoring');
        updatePaymentStatus('failed', 'Monitoring Failed');
    }
}

// 确认支付
function confirmPayment(verificationResult = null) {
    updatePaymentStatus('confirmed', 'Payment Confirmed!');
    
    // 更新支付数据，添加区块链验证信息
    if (paymentData && verificationResult) {
        paymentData.verificationResult = verificationResult;
        paymentData.confirmedAt = Date.now();
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    }
    
    // 清除定时器
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // 延迟跳转到成功页面
    setTimeout(() => {
        window.location.href = 'success.html';
    }, 2000);
    
    console.log('Payment confirmed, redirecting to success page...', verificationResult);
}

// 防抖变量
let refreshInProgress = false;

// 刷新状态
async function refreshStatus() {
    // 防止重复调用
    if (refreshInProgress) {
        console.log('Refresh already in progress, skipping...');
        return;
    }
    
    refreshInProgress = true;
    const refreshButton = document.querySelector('.refresh-button');
    
    if (refreshButton) {
        // 显示加载状态
        const originalText = refreshButton.innerHTML;
        refreshButton.innerHTML = '<div class="loading"></div> Checking...';
        refreshButton.disabled = true;
        
        try {
            console.log('=== REFRESH STATUS CHECK ===');
            
            // 检查区块链管理器状态（不进行RPC调用，避免重复）
            if (typeof window.blockchainManager !== 'undefined') {
                console.log('Blockchain manager status:', {
                    isConnected: window.blockchainManager.isConnected,
                    initializing: window.blockchainManager.initializing
                });
                
                if (window.blockchainManager.isConnected) {
                    console.log('🔄 [MANUAL-REFRESH] Blockchain manager is connected, will check via manualVerifyPayment');
                    updatePaymentStatus('monitoring', 'Connection OK');
                } else {
                    updatePaymentStatus('failed', 'Blockchain Not Connected');
                }
            } else {
                updatePaymentStatus('failed', 'Blockchain Manager Not Available');
            }
            
            // 检查监听器状态并触发一次交易检测
            if (typeof window.blockchainMonitor !== 'undefined' && paymentData) {
                const paymentId = paymentData.paymentId;
                const monitorStatus = window.blockchainMonitor.getMonitoringStatus(paymentId);
                console.log('Monitor status for', paymentId, ':', monitorStatus);
                
                if (monitorStatus) {
                    updatePaymentStatus('monitoring', `Monitor Active - ${monitorStatus.status}`);
                    
                    // 手动刷新时也触发一次交易检测
                    console.log('🔄 [MANUAL-REFRESH] Triggering manual payment verification...');
                    try {
                        await window.blockchainMonitor.manualVerifyPayment(paymentId);
                        console.log('🔄 [MANUAL-REFRESH] Manual verification completed');
                    } catch (error) {
                        console.log('🔄 [MANUAL-REFRESH] Manual verification failed:', error.message);
                        // 不要因为验证失败而中断刷新流程
                    }
                } else {
                    console.log('No active monitor found, attempting to restart...');
                    updatePaymentStatus('monitoring', 'Restarting Monitor...');
                    // 尝试重新启动监听
                    startPaymentHandlerMonitoring();
                }
            } else {
                console.log('Blockchain monitor not available or no payment data');
                updatePaymentStatus('failed', 'Monitor Not Available');
            }
            
        } catch (error) {
            console.error('Error during refresh status check:', error);
            updatePaymentStatus('failed', `Check Failed: ${error.message}`);
        }
        
        // 恢复按钮状态
        setTimeout(() => {
            refreshButton.innerHTML = originalText;
            refreshButton.disabled = false;
            refreshInProgress = false; // 重置防抖标志
        }, 1000);
    } else {
        refreshInProgress = false; // 重置防抖标志
    }
}

// 返回支付选择页面
function goBack() {
    // 清除定时器
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // 返回到支付页面
    window.location.href = 'payment.html';
}

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // 停止区块链监听
    if (typeof window.blockchainMonitor !== 'undefined' && paymentData) {
        window.blockchainMonitor.stopPaymentMonitoring(paymentData.paymentId);
    }
});

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.QRCodePage = {
        copyAddress,
        refreshStatus,
        goBack,
        updatePaymentStatus,
        confirmPayment
    };
}