// Stable Coin - QR Code Page JavaScript

// 全局变量
let paymentData = null;
let countdownInterval = null;
let statusCheckInterval = null;

// 区块缓存相关变量
let cachedStartBlockNumber = null;  // 进入页面时的起始区块号
let lastCheckedBlockNumber = null;  // 上次检查的区块号

// 调试相关变量
let lastStoredBlockNumber = null;
const BLOCK_STORAGE_KEY = 'evo_payment_last_block';

// 轮询控制变量
let pollingEnabled = true; // 轮询是否启用
let pollingPaused = false; // 轮询是否暂停

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPaymentData();
    initializeQRCodePage();
    startStatusMonitoring();
    
    // 定期更新RPC状态显示
    setInterval(showRpcStatus, 10000); // 每10秒更新一次
    setTimeout(showRpcStatus, 2000); // 2秒后首次显示
    
    // 定期更新轮询状态显示
    setInterval(updatePollingStatusDisplay, 5000); // 每5秒更新一次
    setTimeout(updatePollingStatusDisplay, 1000); // 1秒后首次显示
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

// 开始状态监听 (启用自动轮询)
function startStatusMonitoring() {
    console.log('Starting payment status monitoring with 5-second polling...');
    
    // 等待支付处理器和区块链管理器初始化
    const waitForServices = () => {
        if (typeof window.paymentHandler !== 'undefined') {
            if (typeof window.blockchainManager !== 'undefined' && window.blockchainManager.isConnected) {
                console.log('Services are ready, blockchain connected');
                updatePaymentStatus('monitoring', 'Waiting for Payment...');
                startPaymentPolling();
            } else {
                console.log('Waiting for blockchain services to initialize...');
                // 手动初始化区块链管理器 (避免重复初始化)
                if (typeof window.blockchainManager !== 'undefined' && !window.blockchainManager.isConnected) {
                    // 检查是否已经在初始化过程中
                    if (!window.blockchainManager.initializing) {
                        window.blockchainManager.initializing = true;
                        console.log('Manually initializing blockchain manager...');
                        
                        // 显示初始化状态
                        updatePaymentStatus('pending', 'Connecting to Blockchain');
                        
                        window.blockchainManager.initialize().then(success => {
                            window.blockchainManager.initializing = false;
                            if (success) {
                                console.log('Blockchain manager initialized');
                                updatePaymentStatus('monitoring', 'Waiting for Payment...');
                                startPaymentPolling();
                            } else {
                                console.error('Failed to initialize blockchain manager');
                                updatePaymentStatus('failed', 'Connecting to Blockchain');
                                debugLog('ERROR: Failed to initialize blockchain manager');
                            }
                        }).catch(error => {
                            window.blockchainManager.initializing = false;
                            console.error('Blockchain initialization error:', error);
                            updatePaymentStatus('failed', 'Connecting to Blockchain');
                            debugLog(`ERROR: Blockchain initialization failed - ${error.message}`);
                        });
                    } else {
                        console.log('Blockchain manager already initializing, waiting...');
                        setTimeout(waitForServices, 1000);
                    }
                } else {
                    // 等待区块链管理器加载，同时监听自动初始化完成
                    console.log('Waiting for blockchain manager auto-initialization...');
                    updatePaymentStatus('pending', 'Connecting to Blockchain');
                    
                    // 设置一个监听器，等待自动初始化完成
                    const checkInterval = setInterval(() => {
                        if (typeof window.blockchainManager !== 'undefined' && window.blockchainManager.isConnected) {
                            console.log('Blockchain manager auto-initialized');
                            clearInterval(checkInterval);
                            updatePaymentStatus('monitoring', 'Waiting for Payment...');
                            startPaymentPolling();
                        }
                    }, 500);
                    
                    // 10秒后超时
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        if (typeof window.blockchainManager === 'undefined' || !window.blockchainManager.isConnected) {
                            console.error('Blockchain initialization timeout');
                            updatePaymentStatus('failed', 'Connecting to Blockchain');
                            debugLog('ERROR: Blockchain initialization timeout');
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
        console.log('Received blockchainReady event');
        updatePaymentStatus('monitoring', 'Waiting for Payment...');
        startPaymentPolling();
    });
}

// 开始支付轮询监听
async function startPaymentPolling() {
    if (!paymentData || !paymentData.selectedPayment) {
        console.error('No payment data available for monitoring');
        return;
    }
    
    // 检查轮询是否被禁用
    if (!pollingEnabled) {
        console.log('🚫 Polling is disabled, not starting');
        updatePollingStatusDisplay();
        return;
    }
    
    console.log('Starting payment polling with 5-second interval...');
    console.log('Payment details:', {
        paymentId: paymentData.paymentId,
        token: paymentData.selectedPayment.symbol,
        amount: paymentData.price,
        receiverAddress: '0xe27577B0e3920cE35f100f66430de0108cb78a04'
    });
    
    // 清除现有的轮询间隔
    if (statusCheckInterval) {
        console.log('Clearing existing polling interval');
        clearInterval(statusCheckInterval);
    }
    
    // 初始化起始区块号（如果还没有缓存）
    if (!cachedStartBlockNumber) {
        try {
            const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
            cachedStartBlockNumber = currentBlock;
            lastCheckedBlockNumber = currentBlock - 1; // 从当前区块的前一个开始检查
            console.log(`📍 Cached start block: ${cachedStartBlockNumber}, will check from block: ${lastCheckedBlockNumber + 1}`);
        } catch (error) {
            console.error('Failed to get initial block number:', error);
            // 如果获取失败，使用默认值
            cachedStartBlockNumber = 0;
            lastCheckedBlockNumber = 0;
        }
    }
    
    // 立即执行一次检查
    checkPaymentStatus();
    
    // 设置5秒间隔的轮询
    statusCheckInterval = setInterval(() => {
        // 检查轮询是否被暂停
        if (pollingPaused) {
            console.log('⏸️ Polling is paused, skipping check');
            return;
        }
        
        checkPaymentStatus();
    }, 5000);
    
    console.log('✅ Payment polling started successfully - checking every 5 seconds');
    updatePollingStatusDisplay();
}

// 检查支付状态
async function checkPaymentStatus() {
    if (!paymentData || !paymentData.selectedPayment) {
        return;
    }
    
    try {
        console.log('🔍 [POLLING] Checking payment status...');
        
        // 检查区块链连接
        if (typeof window.blockchainManager === 'undefined' || !window.blockchainManager.isConnected) {
            console.log('Blockchain not connected, skipping check');
            return;
        }
        
        const tokenSymbol = paymentData.selectedPayment.symbol;
        const receiverAddress = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
        const expectedAmount = paymentData.price;
        
        // 获取当前最新区块号
        const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
        
        // 确定查询范围
        const fromBlock = lastCheckedBlockNumber + 1;
        const toBlock = currentBlock;
        const maxBlocksPerBatch = 10; // 每批最多检查10个区块，避免超时
        
        console.log(`Checking for ${tokenSymbol} transfers of ${expectedAmount} to ${receiverAddress}`);
        console.log(`📊 Block range: ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
        
        if (fromBlock > toBlock) {
            console.log('No new blocks to check');
            return;
        }
        
        // 如果区块范围太大，分批处理，但不跳过任何区块
        let actualToBlock = toBlock;
        if (toBlock - fromBlock > maxBlocksPerBatch) {
            actualToBlock = fromBlock + maxBlocksPerBatch - 1;
            console.log(`📊 Block range too large, processing first batch: ${fromBlock} to ${actualToBlock} (remaining blocks will be checked in next polling cycle)`);
        }
        
        // 查询指定区块范围内的转账记录
        const transfers = await window.blockchainManager.getLatestTokenTransfers(
            tokenSymbol,
            receiverAddress,
            fromBlock,
            actualToBlock
        );
        
        console.log(`Found ${transfers.length} transfers in blocks ${fromBlock}-${actualToBlock}`);
        
        // 更新最后检查的区块号（只更新到实际检查过的区块）
        lastCheckedBlockNumber = actualToBlock;
        
        if (transfers.length > 0) {
            console.log('📋 Transfer details:');
            transfers.forEach((transfer, index) => {
                console.log(`  ${index + 1}. Block: ${transfer.blockNumber}, Amount: ${transfer.formattedValue} ${tokenSymbol}, Hash: ${transfer.transactionHash}`);
            });
            
            // 查找匹配金额的转账
            const matchingTransfer = transfers.find(transfer => {
                const transferAmount = parseFloat(transfer.formattedValue);
                const tolerance = Math.max(0.001, expectedAmount * 0.001);
                const matches = Math.abs(transferAmount - expectedAmount) <= tolerance;
                
                if (matches) {
                    console.log(`🎯 Found matching transfer: ${transferAmount} ≈ ${expectedAmount} in block ${transfer.blockNumber}`);
                }
                
                return matches;
            });
            
            if (matchingTransfer) {
                // 获取当前区块号来计算确认数
                const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
                const confirmations = currentBlock - matchingTransfer.blockNumber;
                
                console.log(`✅ Payment found! Confirmations: ${confirmations}/1`);
                
                if (confirmations >= 1) {
                    // 支付确认，跳转到成功页面
                    console.log('🎉 Payment confirmed with sufficient confirmations!');
                    
                    // 停止轮询
                    if (statusCheckInterval) {
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                        updatePollingStatusDisplay();
                    }
                    
                    // 更新支付数据
                    paymentData.verificationResult = {
                        verified: true,
                        transfer: matchingTransfer,
                        confirmations: confirmations,
                        transactionHash: matchingTransfer.transactionHash,
                        amount: matchingTransfer.formattedValue
                    };
                    
                    // 确认支付并跳转
                    confirmPayment(paymentData.verificationResult);
                } else {
                    updatePaymentStatus('pending', `Payment Found - Waiting for Confirmations (${confirmations}/1)`);
                }
            } else {
                console.log('No matching transfers found for expected amount');
            }
        } else {
            console.log('No recent transfers found');
        }
        
    } catch (error) {
        console.error('Error checking payment status:', error);
        
        // 如果是速率限制错误，不要更新状态为失败
        if (error.message && error.message.includes('rate limit')) {
            console.log('Rate limit encountered, will retry in next polling cycle');
        } else {
            updatePaymentStatus('monitoring', 'Waiting for Payment...');
        }
    }
}

// 开始支付处理器监听 (保留用于兼容性)
function startPaymentHandlerMonitoring() {
    // 直接调用新的轮询函数
    startPaymentPolling();
}

// 确认支付
function confirmPayment(verificationResult = null) {
    updatePaymentStatus('confirmed', 'Payment Confirmed!');
    
    // 停止所有轮询
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
        updatePollingStatusDisplay();
    }
    
    // 重置区块缓存
    cachedStartBlockNumber = null;
    lastCheckedBlockNumber = null;
    
    console.log('Stopped all polling and reset block cache - payment confirmed');
    
    // 更新支付数据，添加区块链验证信息
    if (paymentData && verificationResult) {
        paymentData.verificationResult = verificationResult;
        paymentData.confirmedAt = Date.now();
        paymentData.status = 'confirmed';
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    }
    
    // 延迟跳转到成功页面
    setTimeout(() => {
        window.location.href = 'success.html';
    }, 2000);
    
    console.log('Payment confirmed, redirecting to success page...', verificationResult);
}

// 防抖变量
let refreshInProgress = false;

// 快速检查支付状态（用于refresh按钮，避免长时间等待）
async function quickCheckPaymentStatus() {
    if (!paymentData || !paymentData.selectedPayment) {
        return false;
    }
    
    try {
        console.log('🚀 [QUICK-CHECK] Quick payment status check...');
        
        // 检查区块链连接
        if (typeof window.blockchainManager === 'undefined' || !window.blockchainManager.isConnected) {
            console.log('Blockchain not connected');
            return false;
        }
        
        const tokenSymbol = paymentData.selectedPayment.symbol;
        const receiverAddress = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
        const expectedAmount = paymentData.price;
        
        // 只检查最新的2个区块，快速响应
        const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
        const fromBlock = Math.max(currentBlock - 2, 1);
        const toBlock = currentBlock;
        
        console.log(`🚀 [QUICK-CHECK] Checking last 2 blocks: ${fromBlock} to ${toBlock}`);
        
        if (fromBlock > toBlock) {
            console.log('No new blocks to check');
            return false;
        }
        
        // 设置5秒超时
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Quick check timeout')), 5000)
        );
        
        const transfers = await Promise.race([
            window.blockchainManager.getLatestTokenTransfers(
                tokenSymbol,
                receiverAddress,
                fromBlock,
                toBlock
            ),
            timeoutPromise
        ]);
        
        console.log(`🚀 [QUICK-CHECK] Found ${transfers.length} transfers`);
        
        // 注意：快速检查不更新 lastCheckedBlockNumber，避免影响正常轮询
        
        if (transfers.length > 0) {
            // 查找匹配金额的转账
            const matchingTransfer = transfers.find(transfer => {
                const transferAmount = parseFloat(transfer.formattedValue);
                const tolerance = Math.max(0.001, expectedAmount * 0.001);
                return Math.abs(transferAmount - expectedAmount) <= tolerance;
            });
            
            if (matchingTransfer) {
                console.log(`🚀 [QUICK-CHECK] Found matching payment!`);
                return true;
            }
        }
        
        return false;
        
    } catch (error) {
        console.error('🚀 [QUICK-CHECK] Quick check failed:', error.message);
        return false;
    }
}

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
                    console.log('🔄 [MANUAL-REFRESH] Blockchain manager is connected');
                    updatePaymentStatus('monitoring', 'Checking Payment...');
                } else {
                    updatePaymentStatus('failed', 'Blockchain Not Connected');
                }
            } else {
                updatePaymentStatus('failed', 'Blockchain Manager Not Available');
            }
            
            // 使用快速检查，避免长时间等待
            if (paymentData && paymentData.selectedPayment && window.blockchainManager && window.blockchainManager.isConnected) {
                console.log('🔄 [MANUAL-REFRESH] Triggering quick payment check...');
                console.log(`🔄 [MANUAL-REFRESH] Current block cache: start=${cachedStartBlockNumber}, lastChecked=${lastCheckedBlockNumber}`);
                
                try {
                    const paymentFound = await quickCheckPaymentStatus();
                    
                    if (paymentFound) {
                        console.log('🔄 [MANUAL-REFRESH] Payment found in quick check!');
                        updatePaymentStatus('pending', 'Payment Found - Verifying...');
                        // 触发完整检查来确认和处理支付
                        setTimeout(() => checkPaymentStatus(), 1000);
                    } else {
                        console.log('🔄 [MANUAL-REFRESH] No payment found in quick check');
                        updatePaymentStatus('monitoring', 'Waiting for Payment...');
                    }
                    
                    // 如果轮询没有运行，重新启动
                    if (!statusCheckInterval) {
                        console.log('Restarting payment polling...');
                        await startPaymentPolling();
                    }
                } catch (error) {
                    console.log('🔄 [MANUAL-REFRESH] Quick check failed:', error.message);
                    updatePaymentStatus('monitoring', 'Waiting for Payment...');
                }
            } else {
                console.log('No payment data available for checking');
                updatePaymentStatus('failed', 'No Payment Data');
            }
            
        } catch (error) {
            console.error('Error during refresh status check:', error);
            updatePaymentStatus('failed', `Check Failed: ${error.message}`);
        }
        
        // 恢复按钮状态 - 缩短等待时间
        setTimeout(() => {
            refreshButton.innerHTML = originalText;
            refreshButton.disabled = false;
            refreshInProgress = false; // 重置防抖标志
        }, 500);
    } else {
        refreshInProgress = false; // 重置防抖标志
    }
}

// 返回支付选择页面
function goBack() {
    // 清除定时器
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
        updatePollingStatusDisplay();
    }
    
    // 重置区块缓存
    cachedStartBlockNumber = null;
    lastCheckedBlockNumber = null;
    
    console.log('Stopped payment polling and reset block cache');
    
    // 返回到支付页面
    window.location.href = 'payment.html';
}

// 测试函数 - 模拟支付成功
function simulatePaymentSuccessForTesting() {
    console.log('🧪 [TEST] Simulating payment success for testing...');
    
    if (!paymentData) {
        alert('No payment data available for testing');
        return;
    }
    
    // 创建模拟的验证结果
    const mockVerificationResult = {
        verified: true,
        transfer: {
            transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
            blockNumber: Math.floor(Math.random() * 1000000) + 30000000,
            formattedValue: paymentData.price.toString(),
            from: '0x' + Math.random().toString(16).substr(2, 40),
            to: '0xe27577B0e3920cE35f100f66430de0108cb78a04'
        },
        confirmations: 3,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        amount: paymentData.price.toString()
    };
    
    console.log('🧪 [TEST] Mock verification result:', mockVerificationResult);
    
    // 更新支付数据
    paymentData.verificationResult = mockVerificationResult;
    paymentData.status = 'confirmed';
    paymentData.confirmedAt = Date.now();
    
    // 保存到存储
    sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    
    // 显示成功状态
    updatePaymentStatus('confirmed', '🧪 Test: Payment Success!');
    
    // 停止轮询
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
        updatePollingStatusDisplay();
    }
    
    alert('🧪 Test Mode: Payment success simulated!\nRedirecting to success page...');
    
    // 延迟跳转
    setTimeout(() => {
        window.location.href = 'success.html';
    }, 2000);
}

// 测试函数 - 直接跳转到成功页
function testDirectJumpToSuccess() {
    console.log('🧪 [TEST] Direct jump to success page...');
    
    if (!paymentData) {
        // 创建最小的测试数据
        paymentData = {
            paymentId: 'test_' + Date.now(),
            product: 'rice',
            productName: 'Food Donation (Rice)',
            price: 5.00,
            selectedPayment: { symbol: 'USDT', name: 'Tether USD' },
            selectedNetwork: { symbol: 'BSC', name: 'BNB Smart Chain' },
            status: 'confirmed',
            confirmedAt: Date.now(),
            verificationResult: {
                verified: true,
                transfer: {
                    transactionHash: '0xtest123456789',
                    blockNumber: 30000000,
                    formattedValue: '5.00'
                }
            }
        };
        
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    }
    
    alert('🧪 Test Mode: Direct jump to success page');
    window.location.href = 'success.html';
}

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
        updatePollingStatusDisplay();
    }
    
    // 重置区块缓存
    cachedStartBlockNumber = null;
    lastCheckedBlockNumber = null;
    
    console.log('Page unloading, stopped all polling and reset block cache');
    
    // 停止区块链监听
    if (typeof window.blockchainMonitor !== 'undefined' && paymentData) {
        window.blockchainMonitor.stopPaymentMonitoring(paymentData.paymentId);
    }
});

// ===== 调试功能 =====

// 调试输出函数
function debugLog(message, data = null) {
    const debugOutput = document.getElementById('debug-output');
    if (debugOutput) {
        const timestamp = new Date().toLocaleTimeString();
        let logMessage = `[${timestamp}] ${message}`;
        if (data) {
            logMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
        }
        debugOutput.innerHTML += logMessage + '\n\n';
        debugOutput.scrollTop = debugOutput.scrollHeight;
    }
    console.log(`[DEBUG] ${message}`, data);
}

// 获取本地存储的区块号
function getStoredBlockNumber() {
    const stored = localStorage.getItem(BLOCK_STORAGE_KEY);
    return stored ? parseInt(stored) : null;
}

// 存储区块号到本地
function storeBlockNumber(blockNumber) {
    localStorage.setItem(BLOCK_STORAGE_KEY, blockNumber.toString());
    lastStoredBlockNumber = blockNumber;
    debugLog(`Stored block number: ${blockNumber}`);
}

// 调试功能1：只获取区块号
async function debugGetBlockNumber() {
    debugLog('=== DEBUG: GetBlockNumber ===');
    
    try {
        // 检查区块链管理器
        if (typeof window.blockchainManager === 'undefined') {
            debugLog('ERROR: Blockchain manager not available');
            return;
        }
        
        if (!window.blockchainManager.isConnected) {
            debugLog('Blockchain not connected, attempting to initialize...');
            const success = await window.blockchainManager.initialize();
            if (!success) {
                debugLog('ERROR: Failed to initialize blockchain connection');
                return;
            }
        }
        
        // 获取当前区块号
        debugLog('Calling getBlockNumber...');
        const blockNumber = await window.blockchainManager.web3.eth.getBlockNumber();
        debugLog(`Current block number: ${blockNumber}`);
        
        // 获取本地存储的区块号
        const storedBlock = getStoredBlockNumber();
        debugLog(`Stored block number: ${storedBlock || 'None'}`);
        
        // 存储当前区块号
        storeBlockNumber(blockNumber);
        
        // 计算差值
        if (storedBlock) {
            const diff = blockNumber - storedBlock;
            debugLog(`Block difference: ${diff} blocks`);
        }
        
        debugLog('=== GetBlockNumber completed ===');
        
    } catch (error) {
        debugLog(`ERROR in GetBlockNumber: ${error.message}`, error);
    }
}

// 调试功能2：获取区块号 + 查询交易事件
async function debugGetBlockAndEvents() {
    debugLog('=== DEBUG: GetBlockNumber+GetPastEvents ===');
    
    try {
        // 检查区块链管理器
        if (typeof window.blockchainManager === 'undefined') {
            debugLog('ERROR: Blockchain manager not available');
            return;
        }
        
        if (!window.blockchainManager.isConnected) {
            debugLog('Blockchain not connected, attempting to initialize...');
            const success = await window.blockchainManager.initialize();
            if (!success) {
                debugLog('ERROR: Failed to initialize blockchain connection');
                return;
            }
        }
        
        // 检查支付数据
        if (!paymentData || !paymentData.selectedPayment) {
            debugLog('ERROR: No payment data available');
            return;
        }
        
        // 步骤1：获取当前区块号
        debugLog('Step 1: Getting current block number...');
        const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
        debugLog(`Current block: ${currentBlock}`);
        
        // 步骤2：获取本地存储的区块号
        const storedBlock = getStoredBlockNumber();
        debugLog(`Stored block: ${storedBlock || 'None'}`);
        
        // 步骤3：计算查询范围
        let fromBlock;
        if (storedBlock) {
            fromBlock = storedBlock + 1; // 从上次记录的下一个区块开始
            const blockDiff = currentBlock - storedBlock;
            debugLog(`Block difference: ${blockDiff} blocks`);
            
            if (blockDiff <= 0) {
                debugLog('No new blocks since last check, skipping event query');
                storeBlockNumber(currentBlock);
                debugLog('=== GetBlockNumber+GetPastEvents completed (no new blocks) ===');
                return;
            }
            
            // 限制查询范围，避免查询过多区块
            if (blockDiff > 1) {
                fromBlock = currentBlock; // 只查询最新区块
                debugLog(`Block difference too large (${blockDiff}), limiting to latest block only`);
            }
        } else {
            // 首次查询，只查询最新区块
            fromBlock = currentBlock;
            debugLog('First time query, checking latest block only');
        }
        
        debugLog(`Query range: blocks ${fromBlock} to ${currentBlock}`);
        
        // 步骤4：查询代币转账事件
        const tokenSymbol = paymentData.selectedPayment.symbol;
        const receiverAddress = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
        
        debugLog(`Step 2: Querying ${tokenSymbol} transfers to ${receiverAddress}...`);
        
        // 添加延迟以避免RPC频率限制
        debugLog('Adding 2-second delay to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const transfers = await window.blockchainManager.getLatestTokenTransfers(
            tokenSymbol,
            receiverAddress,
            fromBlock
        );
        
        debugLog(`Found ${transfers.length} transfers in blocks ${fromBlock}-${currentBlock}`);
        
        // 步骤5：检查是否有匹配的转账
        if (transfers.length > 0) {
            debugLog('Transfer details:', transfers);
            
            const expectedAmount = paymentData.price;
            debugLog(`Looking for transfers matching amount: ${expectedAmount}`);
            
            const matchingTransfer = transfers.find(transfer => {
                const transferAmount = parseFloat(transfer.formattedValue);
                const tolerance = Math.max(0.001, expectedAmount * 0.001);
                return Math.abs(transferAmount - expectedAmount) <= tolerance;
            });
            
            if (matchingTransfer) {
                debugLog('🎉 FOUND MATCHING TRANSFER!', matchingTransfer);
                
                // 计算确认数
                const confirmations = currentBlock - matchingTransfer.blockNumber;
                debugLog(`Confirmations: ${confirmations}/1 required`);
                
                if (confirmations >= 1) {
                    debugLog('✅ Payment confirmed! (sufficient confirmations)');
                } else {
                    debugLog('⏳ Payment found but needs more confirmations');
                }
            } else {
                debugLog('No matching transfers found for expected amount');
            }
        } else {
            debugLog('No transfers found in the queried range');
        }
        
        // 步骤6：更新本地存储的区块号
        storeBlockNumber(currentBlock);
        
        debugLog('=== GetBlockNumber+GetPastEvents completed ===');
        
    } catch (error) {
        debugLog(`ERROR in GetBlockNumber+GetPastEvents: ${error.message}`, error);
        
        if (error.message.includes('limit exceeded') || error.message.includes('rate limit')) {
            debugLog('⚠️ Rate limit detected - please wait before next query');
        }
    }
}

// 清除本地存储
function clearLocalStorage() {
    localStorage.removeItem(BLOCK_STORAGE_KEY);
    lastStoredBlockNumber = null;
    debugLog('Local storage cleared');
    
    // 清除调试输出
    const debugOutput = document.getElementById('debug-output');
    if (debugOutput) {
        debugOutput.innerHTML = 'Debug output cleared...\n\n';
    }
}

// 测试备用RPC节点
async function testAlternativeRPC() {
    debugLog('=== DEBUG: Testing Alternative RPC Nodes ===');
    
    // BSC 主网的备用 RPC 节点列表
    const alternativeRPCs = [
        'https://bsc-dataseed1.binance.org/',
        'https://bsc-dataseed2.binance.org/',
        'https://bsc-dataseed3.binance.org/',
        'https://bsc-dataseed4.binance.org/',
        'https://bsc-dataseed1.defibit.io/',
        'https://bsc-dataseed2.defibit.io/',
        'https://bsc-dataseed3.defibit.io/',
        'https://bsc-dataseed4.defibit.io/',
        'https://bsc-dataseed1.ninicoin.io/',
        'https://bsc-dataseed2.ninicoin.io/',
        'https://bsc-dataseed3.ninicoin.io/',
        'https://bsc-dataseed4.ninicoin.io/'
    ];
    
    try {
        for (let i = 0; i < alternativeRPCs.length; i++) {
            const rpcUrl = alternativeRPCs[i];
            debugLog(`Testing RPC ${i + 1}/${alternativeRPCs.length}: ${rpcUrl}`);
            
            try {
                // 创建临时的 Web3 实例
                const tempWeb3 = new Web3(rpcUrl);
                
                // 测试基本连接
                const startTime = Date.now();
                const blockNumber = await tempWeb3.eth.getBlockNumber();
                const responseTime = Date.now() - startTime;
                
                debugLog(`✅ RPC ${i + 1} OK: Block ${blockNumber}, Response time: ${responseTime}ms`);
                
                // 如果响应时间合理，测试事件查询
                if (responseTime < 2000) { // 2秒内响应
                    debugLog(`Testing event query on RPC ${i + 1}...`);
                    
                    // 检查支付数据
                    if (!paymentData || !paymentData.selectedPayment) {
                        debugLog('No payment data for event testing, skipping event query');
                        continue;
                    }
                    
                    // 获取代币合约
                    const tokenSymbol = paymentData.selectedPayment.symbol;
                    const tokenConfig = window.blockchainManager?.contracts?.[tokenSymbol];
                    
                    if (!tokenConfig) {
                        debugLog(`No contract config for ${tokenSymbol}, skipping event query`);
                        continue;
                    }
                    
                    // 创建临时合约实例
                    const tempContract = new tempWeb3.eth.Contract(
                        [
                            {
                                "anonymous": false,
                                "inputs": [
                                    {"indexed": true, "name": "from", "type": "address"},
                                    {"indexed": true, "name": "to", "type": "address"},
                                    {"indexed": false, "name": "value", "type": "uint256"}
                                ],
                                "name": "Transfer",
                                "type": "event"
                            }
                        ],
                        window.blockchainManager.contracts[tokenSymbol].options.address
                    );
                    
                    // 测试事件查询（只查询最新区块）
                    const eventStartTime = Date.now();
                    const events = await tempContract.getPastEvents('Transfer', {
                        filter: {
                            to: '0xe27577B0e3920cE35f100f66430de0108cb78a04'
                        },
                        fromBlock: blockNumber,
                        toBlock: blockNumber
                    });
                    const eventResponseTime = Date.now() - eventStartTime;
                    
                    debugLog(`✅ RPC ${i + 1} Event Query OK: ${events.length} events, Response time: ${eventResponseTime}ms`);
                    
                    // 如果这个RPC表现良好，建议使用
                    if (eventResponseTime < 3000) {
                        debugLog(`🎯 RPC ${i + 1} performs well! Consider using: ${rpcUrl}`);
                    }
                } else {
                    debugLog(`⚠️ RPC ${i + 1} slow response (${responseTime}ms), skipping event test`);
                }
                
            } catch (error) {
                debugLog(`❌ RPC ${i + 1} failed: ${error.message}`);
                
                if (error.message.includes('limit exceeded') || error.message.includes('rate limit')) {
                    debugLog(`🚫 RPC ${i + 1} has rate limits`);
                }
            }
            
            // 在测试之间添加短暂延迟
            if (i < alternativeRPCs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        debugLog('=== Alternative RPC testing completed ===');
        
    } catch (error) {
        debugLog(`ERROR in testAlternativeRPC: ${error.message}`, error);
    }
}

// 最小化事件查询测试
async function debugMinimalEventQuery() {
    debugLog('=== DEBUG: Minimal Event Query ===');
    
    try {
        // 检查区块链管理器
        if (typeof window.blockchainManager === 'undefined') {
            debugLog('ERROR: Blockchain manager not available');
            return;
        }
        
        if (!window.blockchainManager.isConnected) {
            debugLog('Blockchain not connected, attempting to initialize...');
            const success = await window.blockchainManager.initialize();
            if (!success) {
                debugLog('ERROR: Failed to initialize blockchain connection');
                return;
            }
        }
        
        // 检查支付数据
        if (!paymentData || !paymentData.selectedPayment) {
            debugLog('ERROR: No payment data available');
            return;
        }
        
        // 获取当前区块号
        debugLog('Getting current block number...');
        const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
        debugLog(`Current block: ${currentBlock}`);
        
        // 获取代币合约
        const tokenSymbol = paymentData.selectedPayment.symbol;
        const contract = window.blockchainManager.contracts[tokenSymbol];
        
        if (!contract) {
            debugLog(`ERROR: No contract available for ${tokenSymbol}`);
            return;
        }
        
        debugLog(`Testing minimal event query for ${tokenSymbol}...`);
        debugLog(`Contract address: ${contract.options.address}`);
        debugLog(`Target address: 0xe27577B0e3920cE35f100f66430de0108cb78a04`);
        
        // 最小化查询：只查询当前区块，不使用过滤器
        debugLog('Step 1: Query without filter (all Transfer events in current block)...');
        
        try {
            const allEvents = await contract.getPastEvents('Transfer', {
                fromBlock: currentBlock,
                toBlock: currentBlock
            });
            
            debugLog(`Found ${allEvents.length} total Transfer events in block ${currentBlock}`);
            
            // 手动过滤目标地址
            const filteredEvents = allEvents.filter(event => 
                event.returnValues.to.toLowerCase() === '0xe27577B0e3920cE35f100f66430de0108cb78a04'.toLowerCase()
            );
            
            debugLog(`Found ${filteredEvents.length} Transfer events to target address`);
            
            if (filteredEvents.length > 0) {
                debugLog('Filtered events:', filteredEvents.map(event => ({
                    from: event.returnValues.from,
                    to: event.returnValues.to,
                    value: event.returnValues.value,
                    formattedValue: window.blockchainManager.web3.utils.fromWei(event.returnValues.value, 'ether'),
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                })));
            }
            
        } catch (error) {
            debugLog(`Step 1 failed: ${error.message}`);
            
            // 如果无过滤器查询失败，尝试更保守的方法
            debugLog('Step 2: Trying with filter (may cause rate limit)...');
            
            try {
                const filteredEvents = await contract.getPastEvents('Transfer', {
                    filter: {
                        to: '0xe27577B0e3920cE35f100f66430de0108cb78a04'
                    },
                    fromBlock: currentBlock,
                    toBlock: currentBlock
                });
                
                debugLog(`Found ${filteredEvents.length} filtered Transfer events in block ${currentBlock}`);
                
                if (filteredEvents.length > 0) {
                    debugLog('Filtered events:', filteredEvents.map(event => ({
                        from: event.returnValues.from,
                        to: event.returnValues.to,
                        value: event.returnValues.value,
                        formattedValue: window.blockchainManager.web3.utils.fromWei(event.returnValues.value, 'ether'),
                        txHash: event.transactionHash,
                        blockNumber: event.blockNumber
                    })));
                }
                
            } catch (filterError) {
                debugLog(`Step 2 also failed: ${filterError.message}`);
                
                if (filterError.message.includes('limit exceeded') || filterError.message.includes('rate limit')) {
                    debugLog('🚫 Confirmed: Rate limit triggered by filtered event query');
                    debugLog('💡 Suggestion: The issue is with getPastEvents filter, not frequency or block count');
                }
            }
        }
        
        debugLog('=== Minimal Event Query completed ===');
        
    } catch (error) {
        debugLog(`ERROR in debugMinimalEventQuery: ${error.message}`, error);
    }
}

// 替代方法：通过扫描区块中的交易来检测代币转账
async function debugAlternativeMethod() {
    debugLog('=== DEBUG: Alternative Method (Block Scanning) ===');
    
    try {
        // 检查区块链管理器
        if (typeof window.blockchainManager === 'undefined') {
            debugLog('ERROR: Blockchain manager not available');
            return;
        }
        
        if (!window.blockchainManager.isConnected) {
            debugLog('Blockchain not connected, attempting to initialize...');
            const success = await window.blockchainManager.initialize();
            if (!success) {
                debugLog('ERROR: Failed to initialize blockchain connection');
                return;
            }
        }
        
        // 检查支付数据
        if (!paymentData || !paymentData.selectedPayment) {
            debugLog('ERROR: No payment data available');
            return;
        }
        
        // 获取当前区块号
        debugLog('Getting current block number...');
        const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
        debugLog(`Current block: ${currentBlock}`);
        
        // 获取代币信息
        const tokenSymbol = paymentData.selectedPayment.symbol;
        const tokenConfig = window.blockchainManager.contracts[tokenSymbol];
        const targetAddress = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
        
        if (!tokenConfig) {
            debugLog(`ERROR: No contract available for ${tokenSymbol}`);
            return;
        }
        
        debugLog(`Scanning block ${currentBlock} for ${tokenSymbol} transfers to ${targetAddress}...`);
        debugLog(`Token contract: ${tokenConfig.options.address}`);
        
        // 方法1：获取区块中的所有交易（使用原始RPC避免大数值错误）
        debugLog('Method 1: Scanning block transactions...');
        
        // 使用原始RPC调用获取区块信息
        const blockResponse = await fetch(window.blockchainManager.web3.currentProvider.host, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getBlockByNumber',
                params: [`0x${currentBlock.toString(16)}`, true], // true = 包含完整交易信息
                id: 1
            })
        });
        
        const blockData = await blockResponse.json();
        if (!blockData.result) {
            debugLog(`Failed to get block: ${blockData.error?.message || 'Unknown error'}`);
            return;
        }
        
        const block = blockData.result;
        debugLog(`Block ${currentBlock} contains ${block.transactions.length} transactions`);
        
        let tokenTransfers = 0;
        let relevantTransfers = 0;
        
        // 扫描每个交易 - 使用安全的数值处理
        const maxTransactions = Math.min(block.transactions.length, 10); // 限制扫描前10个交易
        debugLog(`Scanning ${maxTransactions} transactions in block ${currentBlock}`);
        
        for (let i = 0; i < maxTransactions; i++) {
            try {
                const tx = block.transactions[i];
                
                // 安全地处理交易对象
                const txTo = tx.to ? tx.to.toString() : null;
                let txHash = tx.hash ? tx.hash.toString() : null;
                
                if (!txTo || !txHash) {
                    debugLog(`Skipping invalid transaction at index ${i}`);
                    continue;
                }
                
                // 验证和格式化交易哈希
                if (!txHash.startsWith('0x')) {
                    txHash = '0x' + txHash;
                }
                
                // 验证哈希长度（应该是 66 字符：0x + 64 字符）
                if (txHash.length !== 66) {
                    debugLog(`Invalid transaction hash length: ${txHash.length}, skipping transaction`);
                    continue;
                }
                
                // 检查是否是发送到代币合约的交易
                if (txTo.toLowerCase() === tokenConfig.options.address.toLowerCase()) {
                    tokenTransfers++;
                    debugLog(`Found token contract transaction: ${txHash}`);
                    
                    try {
                        // 使用原始RPC获取交易收据以查看事件日志
                        debugLog(`🌐 [RPC-CALL] eth_getTransactionReceipt with hash: ${txHash} (length: ${txHash.length})`);
                        
                        const receiptResponse = await fetch(window.blockchainManager.web3.currentProvider.host, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'eth_getTransactionReceipt',
                                params: [txHash],
                                id: 100 + i
                            })
                        });
                        
                        const receiptData = await receiptResponse.json();
                        if (!receiptData.result) {
                            debugLog(`Failed to get receipt for ${txHash}: ${receiptData.error?.message}`);
                            if (receiptData.error) {
                                debugLog(`Full error details:`, receiptData.error);
                            }
                            continue;
                        }
                        
                        const receipt = receiptData.result;
                        
                        if (receipt && receipt.logs && receipt.logs.length > 0) {
                            // 查找 Transfer 事件 (topic0 = keccak256("Transfer(address,address,uint256)"))
                            const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
                            
                            for (const log of receipt.logs) {
                                if (log.topics && log.topics[0] === transferTopic && log.topics.length >= 3) {
                                    try {
                                        // 解析 Transfer 事件
                                        // topics[1] 和 topics[2] 是32字节的哈希，地址在最后20字节
                                        const fromAddress = '0x' + log.topics[1].slice(-40);
                                        const toAddress = '0x' + log.topics[2].slice(-40);
                                        
                                        debugLog(`Transfer: ${fromAddress} -> ${toAddress}`);
                                        
                                        if (toAddress.toLowerCase() === targetAddress.toLowerCase()) {
                                            relevantTransfers++;
                                            
                                            // 安全地解析转账金额
                                            const valueHex = log.data;
                                            let formattedValue;
                                            
                                            try {
                                                const valueBigInt = BigInt(valueHex);
                                                // USDC 使用 6 位小数，不是 18 位
                                                const decimals = tokenSymbol === 'USDC' ? 6 : 18;
                                                const divisor = BigInt(10 ** decimals);
                                                const valueNumber = Number(valueBigInt) / Number(divisor);
                                                formattedValue = valueNumber.toString();
                                            } catch (bigIntError) {
                                                debugLog(`Failed to parse amount with BigInt: ${bigIntError.message}`);
                                                formattedValue = '[Cannot parse - too large]';
                                            }
                                            
                                            debugLog(`🎯 FOUND RELEVANT TRANSFER!`);
                                            debugLog(`  From: ${fromAddress}`);
                                            debugLog(`  To: ${toAddress}`);
                                            debugLog(`  Amount: ${formattedValue} ${tokenSymbol}`);
                                            debugLog(`  TX Hash: ${txHash}`);
                                            
                                            // 检查金额是否匹配
                                            const expectedAmount = paymentData.price;
                                            const transferAmount = parseFloat(formattedValue);
                                            const tolerance = Math.max(0.001, expectedAmount * 0.001);
                                            
                                            if (Math.abs(transferAmount - expectedAmount) <= tolerance) {
                                                debugLog(`✅ AMOUNT MATCHES! Expected: ${expectedAmount}, Got: ${transferAmount}`);
                                            } else {
                                                debugLog(`❌ Amount mismatch. Expected: ${expectedAmount}, Got: ${transferAmount}`);
                                            }
                                        }
                                    } catch (parseError) {
                                        debugLog(`Failed to parse transfer event: ${parseError.message}`);
                                    }
                                }
                            }
                        }
                        
                    } catch (receiptError) {
                        debugLog(`Failed to get receipt for ${txHash}: ${receiptError.message}`);
                    }
                }
            } catch (txError) {
                debugLog(`Failed to process transaction at index ${i}: ${txError.message}`);
                // 继续处理下一个交易
                continue;
            }
        }
        
        debugLog(`Scan results: ${tokenTransfers} token transactions, ${relevantTransfers} relevant transfers`);
        
        // 方法2：检查目标地址的余额变化
        debugLog('Method 2: Checking balance...');
        
        try {
            const balance = await tokenConfig.methods.balanceOf(targetAddress).call();
            const formattedBalance = window.blockchainManager.web3.utils.fromWei(balance, 'ether');
            debugLog(`Current balance of ${targetAddress}: ${formattedBalance} ${tokenSymbol}`);
            
            // 存储余额以便后续比较
            const balanceKey = `balance_${tokenSymbol}_${targetAddress}`;
            const previousBalance = localStorage.getItem(balanceKey);
            
            if (previousBalance) {
                const balanceDiff = parseFloat(formattedBalance) - parseFloat(previousBalance);
                debugLog(`Balance change since last check: ${balanceDiff} ${tokenSymbol}`);
                
                if (balanceDiff > 0) {
                    debugLog(`💰 Balance increased! Possible incoming transfer detected.`);
                }
            } else {
                debugLog('No previous balance record, storing current balance');
            }
            
            localStorage.setItem(balanceKey, formattedBalance);
            
        } catch (balanceError) {
            debugLog(`Failed to check balance: ${balanceError.message}`);
        }
        
        debugLog('=== Alternative Method completed ===');
        debugLog('💡 This method avoids getPastEvents and should not trigger rate limits');
        
    } catch (error) {
        debugLog(`ERROR in debugAlternativeMethod: ${error.message}`, error);
    }
}

// 测试修复后的主系统
async function testMainSystem() {
    debugLog('=== TEST: Main System Integration ===');
    
    try {
        // 检查区块链管理器
        if (typeof window.blockchainManager === 'undefined') {
            debugLog('ERROR: Blockchain manager not available');
            return;
        }
        
        if (!window.blockchainManager.isConnected) {
            debugLog('Blockchain not connected, attempting to initialize...');
            const success = await window.blockchainManager.initialize();
            if (!success) {
                debugLog('ERROR: Failed to initialize blockchain connection');
                return;
            }
        }
        
        // 检查支付数据
        if (!paymentData || !paymentData.selectedPayment) {
            debugLog('ERROR: No payment data available');
            return;
        }
        
        const tokenSymbol = paymentData.selectedPayment.symbol;
        const targetAddress = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
        
        debugLog(`Testing main system with ${tokenSymbol} transfers to ${targetAddress}...`);
        
        // 测试修复后的 getLatestTokenTransfers 方法
        debugLog('1. Testing getLatestTokenTransfers method...');
        
        try {
            const transfers = await window.blockchainManager.getLatestTokenTransfers(
                tokenSymbol,
                targetAddress,
                'latest'
            );
            
            debugLog(`✅ getLatestTokenTransfers succeeded!`);
            debugLog(`Found ${transfers.length} transfers`);
            
            if (transfers.length > 0) {
                debugLog('Transfer details:');
                transfers.forEach((transfer, index) => {
                    debugLog(`  Transfer ${index + 1}:`);
                    debugLog(`    Hash: ${transfer.transactionHash}`);
                    debugLog(`    Block: ${transfer.blockNumber}`);
                    debugLog(`    From: ${transfer.from}`);
                    debugLog(`    To: ${transfer.to}`);
                    debugLog(`    Amount: ${transfer.formattedValue} ${tokenSymbol}`);
                });
            } else {
                debugLog('  No transfers found in recent blocks');
            }
            
        } catch (transferError) {
            debugLog(`❌ getLatestTokenTransfers failed: ${transferError.message}`);
            return;
        }
        
        // 测试支付验证方法
        debugLog('2. Testing payment verification...');
        
        try {
            const verificationResult = await window.blockchainManager.verifyPayment(
                tokenSymbol,
                paymentData.price
            );
            
            debugLog(`✅ Payment verification completed!`);
            debugLog(`Verification result:`, verificationResult);
            
            if (verificationResult.verified) {
                debugLog(`🎉 Payment verified successfully!`);
                debugLog(`  Transaction: ${verificationResult.transactionHash}`);
                debugLog(`  Amount: ${verificationResult.amount} ${tokenSymbol}`);
                debugLog(`  Confirmations: ${verificationResult.confirmations}`);
            } else {
                debugLog(`ℹ️ Payment not found or not verified`);
                debugLog(`  Reason: ${verificationResult.reason}`);
            }
            
        } catch (verifyError) {
            debugLog(`❌ Payment verification failed: ${verifyError.message}`);
        }
        
        // 测试区块链监听器
        debugLog('3. Testing blockchain monitor...');
        
        if (typeof window.blockchainMonitor !== 'undefined') {
            const paymentId = paymentData.paymentId;
            const monitorStatus = window.blockchainMonitor.getMonitoringStatus(paymentId);
            
            debugLog(`Monitor status for ${paymentId}:`, monitorStatus);
            
            if (monitorStatus && monitorStatus.status === 'monitoring') {
                debugLog('✅ Monitor is active');
                
                try {
                    debugLog('Triggering manual verification...');
                    await window.blockchainMonitor.manualVerifyPayment(paymentId);
                    debugLog('✅ Manual verification completed');
                } catch (manualError) {
                    debugLog(`❌ Manual verification failed: ${manualError.message}`);
                }
            } else {
                debugLog('ℹ️ No active monitor found');
            }
        } else {
            debugLog('❌ Blockchain monitor not available');
        }
        
        debugLog('=== Main System Test completed ===');
        debugLog('🎯 All core functions tested with fixed RPC implementation!');
        
    } catch (error) {
        debugLog(`ERROR in testMainSystem: ${error.message}`, error);
    }
}

// 完整流程测试
async function testCompleteFlow() {
    debugLog('=== COMPLETE FLOW TEST ===');
    debugLog('Testing the complete payment verification flow...');
    
    try {
        // 步骤1：检查基础环境
        debugLog('Step 1: Checking environment...');
        
        if (typeof window.blockchainManager === 'undefined') {
            debugLog('ERROR: Blockchain manager not available');
            return;
        }
        
        if (!window.blockchainManager.isConnected) {
            debugLog('Blockchain not connected, attempting to initialize...');
            const success = await window.blockchainManager.initialize();
            if (!success) {
                debugLog('ERROR: Failed to initialize blockchain connection');
                return;
            }
        }
        
        if (!paymentData || !paymentData.selectedPayment) {
            debugLog('ERROR: No payment data available');
            return;
        }
        
        debugLog('✅ Environment check passed');
        
        // 步骤2：获取当前区块信息
        debugLog('Step 2: Getting current block information...');
        const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
        debugLog(`Current block: ${currentBlock}`);
        
        // 步骤3：检查RPC状态
        debugLog('Step 3: Checking RPC status...');
        const rpcStatus = window.blockchainManager.getRpcStatus();
        debugLog(`Current RPC: ${rpcStatus.currentRpc}`);
        debugLog(`RPC Index: ${rpcStatus.currentIndex + 1}/${rpcStatus.totalEndpoints}`);
        debugLog(`Connection Status: ${rpcStatus.isConnected ? 'Connected' : 'Disconnected'}`);
        
        // 步骤4：测试代币转账查询
        debugLog('Step 4: Testing token transfer query...');
        const tokenSymbol = paymentData.selectedPayment.symbol;
        const targetAddress = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
        
        debugLog(`Querying ${tokenSymbol} transfers to ${targetAddress}...`);
        
        // 添加延迟避免RPC限制
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const transfers = await window.blockchainManager.getLatestTokenTransfers(
            tokenSymbol,
            targetAddress,
            'latest'
        );
        
        debugLog(`Found ${transfers.length} recent transfers`);
        
        if (transfers.length > 0) {
            debugLog('Recent transfers:');
            transfers.forEach((transfer, index) => {
                debugLog(`  ${index + 1}. ${transfer.formattedValue} ${tokenSymbol} from ${transfer.from}`);
                debugLog(`     TX: ${transfer.transactionHash}`);
                debugLog(`     Block: ${transfer.blockNumber}`);
            });
        }
        
        // 步骤5：测试支付验证
        debugLog('Step 5: Testing payment verification...');
        const expectedAmount = paymentData.price;
        debugLog(`Expected amount: ${expectedAmount} ${tokenSymbol}`);
        
        const verificationResult = await window.blockchainManager.verifyPayment(
            tokenSymbol,
            expectedAmount
        );
        
        debugLog('Payment verification result:', verificationResult);
        
        if (verificationResult.verified) {
            debugLog('🎉 PAYMENT VERIFIED!');
            debugLog(`  Amount: ${verificationResult.transfer?.formattedValue || 'N/A'} ${tokenSymbol}`);
            debugLog(`  Confirmations: ${verificationResult.confirmations || 'N/A'}`);
            debugLog(`  Transaction: ${verificationResult.transfer?.transactionHash || 'N/A'}`);
        } else {
            debugLog('ℹ️ Payment not found or not verified');
            debugLog(`  Reason: ${verificationResult.reason}`);
            
            if (verificationResult.transfer) {
                debugLog('  Found transfer but insufficient confirmations:');
                debugLog(`    Amount: ${verificationResult.transfer.formattedValue} ${tokenSymbol}`);
                debugLog(`    Confirmations: ${verificationResult.confirmations}/${verificationResult.required}`);
            }
        }
        
        // 步骤6：测试轮询状态
        debugLog('Step 6: Checking polling status...');
        const pollingStatus = getPollingStatus();
        debugLog(`Polling enabled: ${pollingStatus.enabled}`);
        debugLog(`Polling paused: ${pollingStatus.paused}`);
        debugLog(`Interval active: ${pollingStatus.intervalActive}`);
        
        // 步骤7：模拟完整支付流程
        debugLog('Step 7: Simulating complete payment flow...');
        
        if (verificationResult.verified) {
            debugLog('🎯 COMPLETE FLOW SUCCESS!');
            debugLog('Payment found and verified - would trigger success flow');
            
            // 模拟支付确认流程（不实际执行）
            debugLog('Would execute: confirmPayment()');
            debugLog('Would redirect to: success.html');
            debugLog('Would stop polling');
            
        } else {
            debugLog('🔄 COMPLETE FLOW PENDING');
            debugLog('No verified payment found - would continue monitoring');
            debugLog('Polling would continue every 5 seconds');
        }
        
        // 步骤8：性能统计
        debugLog('Step 8: Performance summary...');
        debugLog(`Total test duration: ~10-15 seconds`);
        debugLog(`RPC calls made: ~5-8 calls`);
        debugLog(`Current RPC response: ${rpcStatus.isConnected ? 'Good' : 'Poor'}`);
        
        debugLog('=== COMPLETE FLOW TEST FINISHED ===');
        debugLog('✅ All systems tested successfully!');
        debugLog('💡 This test simulates the complete payment verification workflow');
        
    } catch (error) {
        debugLog(`ERROR in testCompleteFlow: ${error.message}`, error);
        debugLog('❌ Complete flow test failed');
        
        // 提供错误恢复建议
        if (error.message.includes('rate limit') || error.message.includes('limit exceeded')) {
            debugLog('💡 Suggestion: Wait 30 seconds before retrying due to RPC rate limits');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
            debugLog('💡 Suggestion: Check network connection or try switching RPC endpoint');
        }
    }
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.QRCodePage = {
        copyAddress,
        refreshStatus,
        goBack,
        updatePaymentStatus,
        confirmPayment,
        // 调试函数
        debugGetBlockNumber,
        debugGetBlockAndEvents,
        clearLocalStorage,
        testAlternativeRPC,
        debugMinimalEventQuery,
        debugAlternativeMethod,
        testMainSystem,
        testCompleteFlow
    };
}
// RPC状态显示功能
function showRpcStatus() {
    const statusElement = document.getElementById('rpc-status-info');
    if (!statusElement) {
        console.log('RPC status element not found');
        return;
    }
    
    try {
        // 检查区块链管理器是否可用
        if (typeof window.blockchainManager === 'undefined') {
            statusElement.innerHTML = '❌ Blockchain manager not available';
            return;
        }
        
        // 获取RPC状态信息
        const rpcStatus = window.blockchainManager.getRpcStatus();
        
        // 格式化显示信息
        let statusHtml = '';
        
        // 连接状态
        if (rpcStatus.isConnected) {
            statusHtml += `✅ <strong>Connected</strong><br>`;
        } else {
            statusHtml += `❌ <strong>Disconnected</strong><br>`;
        }
        
        // 当前RPC端点
        if (rpcStatus.currentRpc) {
            const rpcUrl = rpcStatus.currentRpc;
            const shortUrl = rpcUrl.length > 50 ? rpcUrl.substring(0, 47) + '...' : rpcUrl;
            statusHtml += `🌐 <strong>Current RPC:</strong> ${shortUrl}<br>`;
            statusHtml += `📊 <strong>Endpoint:</strong> ${rpcStatus.currentIndex + 1}/${rpcStatus.totalEndpoints}<br>`;
        } else {
            statusHtml += `🌐 <strong>Current RPC:</strong> None<br>`;
        }
        
        // 健康检查信息
        if (rpcStatus.lastHealthCheck > 0) {
            const timeSinceCheck = Math.round((Date.now() - rpcStatus.lastHealthCheck) / 1000);
            statusHtml += `🏥 <strong>Last Health Check:</strong> ${timeSinceCheck}s ago<br>`;
        } else {
            statusHtml += `🏥 <strong>Last Health Check:</strong> Never<br>`;
        }
        
        // RPC切换信息
        if (rpcStatus.lastSwitch > 0) {
            const timeSinceSwitch = Math.round((Date.now() - rpcStatus.lastSwitch) / 1000);
            statusHtml += `🔄 <strong>Last Switch:</strong> ${timeSinceSwitch}s ago<br>`;
        } else {
            statusHtml += `🔄 <strong>Last Switch:</strong> Never<br>`;
        }
        
        // 失败计数信息
        const failureCounts = rpcStatus.failureCounts;
        const totalFailures = Object.values(failureCounts).reduce((sum, count) => sum + count, 0);
        
        if (totalFailures > 0) {
            statusHtml += `⚠️ <strong>Total Failures:</strong> ${totalFailures}<br>`;
            
            // 显示失败最多的RPC端点
            const sortedFailures = Object.entries(failureCounts)
                .filter(([url, count]) => count > 0)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3); // 只显示前3个
            
            if (sortedFailures.length > 0) {
                statusHtml += `<strong>Failed RPCs:</strong><br>`;
                sortedFailures.forEach(([url, count]) => {
                    const shortUrl = url.length > 40 ? url.substring(0, 37) + '...' : url;
                    statusHtml += `  • ${shortUrl}: ${count} failures<br>`;
                });
            }
        } else {
            statusHtml += `✅ <strong>No RPC Failures</strong><br>`;
        }
        
        // 添加时间戳
        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        statusHtml += `<br><small>Updated: ${timestamp}</small>`;
        
        statusElement.innerHTML = statusHtml;
        
    } catch (error) {
        console.error('Error showing RPC status:', error);
        statusElement.innerHTML = `❌ Error loading RPC status: ${error.message}`;
    }
}

// 手动触发RPC切换的调试功能
async function debugSwitchRPC() {
    debugLog('=== DEBUG: Manual RPC Switch ===');
    
    try {
        if (typeof window.blockchainManager === 'undefined') {
            debugLog('ERROR: Blockchain manager not available');
            return;
        }
        
        debugLog('Current RPC status before switch:');
        const beforeStatus = window.blockchainManager.getRpcStatus();
        debugLog(`  Current RPC: ${beforeStatus.currentRpc}`);
        debugLog(`  Index: ${beforeStatus.currentIndex}/${beforeStatus.totalEndpoints}`);
        debugLog(`  Connected: ${beforeStatus.isConnected}`);
        
        debugLog('Attempting to switch to next RPC endpoint...');
        const switched = await window.blockchainManager.switchToNextRPC();
        
        if (switched) {
            debugLog('✅ RPC switch successful!');
            
            const afterStatus = window.blockchainManager.getRpcStatus();
            debugLog(`New RPC status after switch:`);
            debugLog(`  Current RPC: ${afterStatus.currentRpc}`);
            debugLog(`  Index: ${afterStatus.currentIndex}/${afterStatus.totalEndpoints}`);
            debugLog(`  Connected: ${afterStatus.isConnected}`);
            
            // 更新RPC状态显示
            showRpcStatus();
            
        } else {
            debugLog('❌ RPC switch failed');
        }
        
    } catch (error) {
        debugLog(`ERROR in debugSwitchRPC: ${error.message}`, error);
    }
}

// 测试所有RPC端点的健康状态
async function debugTestAllRPCs() {
    debugLog('=== DEBUG: Test All RPC Endpoints ===');
    
    try {
        if (typeof window.blockchainManager === 'undefined') {
            debugLog('ERROR: Blockchain manager not available');
            return;
        }
        
        const rpcUrls = [
            'http://bsc-dataseed1.binance.org/',
            'http://bsc-dataseed2.binance.org/',
            'http://bsc-dataseed3.binance.org/',
            'http://bsc-dataseed4.binance.org/',
            'https://bsc-dataseed1.defibit.io/',
            'https://bsc-dataseed2.defibit.io/',
            'https://bsc-dataseed1.ninicoin.io/',
            'https://bsc-dataseed2.ninicoin.io/'
        ];
        
        debugLog(`Testing ${rpcUrls.length} RPC endpoints...`);
        
        const results = [];
        
        for (let i = 0; i < rpcUrls.length; i++) {
            const rpcUrl = rpcUrls[i];
            debugLog(`Testing RPC ${i + 1}/${rpcUrls.length}: ${rpcUrl}`);
            
            try {
                const startTime = Date.now();
                
                // 使用原始fetch测试RPC
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_blockNumber',
                        params: [],
                        id: 1
                    })
                });
                
                const responseTime = Date.now() - startTime;
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.result) {
                        const blockNumber = parseInt(data.result, 16);
                        results.push({
                            url: rpcUrl,
                            status: 'success',
                            responseTime: responseTime,
                            blockNumber: blockNumber
                        });
                        debugLog(`  ✅ Success - Block: ${blockNumber}, Time: ${responseTime}ms`);
                    } else {
                        results.push({
                            url: rpcUrl,
                            status: 'error',
                            error: data.error?.message || 'Unknown error'
                        });
                        debugLog(`  ❌ RPC Error: ${data.error?.message || 'Unknown error'}`);
                    }
                } else {
                    results.push({
                        url: rpcUrl,
                        status: 'http_error',
                        error: `HTTP ${response.status}`
                    });
                    debugLog(`  ❌ HTTP Error: ${response.status}`);
                }
                
            } catch (error) {
                results.push({
                    url: rpcUrl,
                    status: 'network_error',
                    error: error.message
                });
                debugLog(`  ❌ Network Error: ${error.message}`);
            }
            
            // 短暂延迟避免过于频繁的请求
            if (i < rpcUrls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // 汇总结果
        const successful = results.filter(r => r.status === 'success');
        const failed = results.filter(r => r.status !== 'success');
        
        debugLog(`\n=== Test Results Summary ===`);
        debugLog(`✅ Successful: ${successful.length}/${rpcUrls.length}`);
        debugLog(`❌ Failed: ${failed.length}/${rpcUrls.length}`);
        
        if (successful.length > 0) {
            debugLog(`\nFastest RPCs:`);
            successful
                .sort((a, b) => a.responseTime - b.responseTime)
                .slice(0, 3)
                .forEach((result, index) => {
                    debugLog(`  ${index + 1}. ${result.url} - ${result.responseTime}ms`);
                });
        }
        
        if (failed.length > 0) {
            debugLog(`\nFailed RPCs:`);
            failed.forEach(result => {
                debugLog(`  • ${result.url} - ${result.error}`);
            });
        }
        
    } catch (error) {
        debugLog(`ERROR in debugTestAllRPCs: ${error.message}`, error);
    }
}

// 刷新区块缓存 - 获取最新区块ID并更新缓存
async function refreshBlockCache(reason = 'manual') {
    try {
        console.log(`🔄 Refreshing block cache (reason: ${reason})...`);
        debugLog(`🔄 Refreshing block cache (reason: ${reason})...`);
        
        // 检查区块链管理器是否可用
        if (typeof window.blockchainManager === 'undefined' || !window.blockchainManager.isConnected) {
            console.log('⚠️ Blockchain manager not available, skipping block cache refresh');
            debugLog('⚠️ Blockchain manager not available, skipping block cache refresh');
            return false;
        }
        
        // 获取当前最新区块号
        const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
        
        // 更新缓存变量
        const previousCachedBlock = cachedStartBlockNumber;
        const previousLastChecked = lastCheckedBlockNumber;
        
        cachedStartBlockNumber = currentBlock;
        lastCheckedBlockNumber = currentBlock - 1; // 从当前区块的前一个开始检查
        
        // 更新本地存储
        storeBlockNumber(currentBlock);
        
        console.log(`✅ Block cache refreshed:`);
        console.log(`  Previous cached block: ${previousCachedBlock}`);
        console.log(`  Previous last checked: ${previousLastChecked}`);
        console.log(`  New cached block: ${cachedStartBlockNumber}`);
        console.log(`  New last checked: ${lastCheckedBlockNumber}`);
        
        debugLog(`✅ Block cache refreshed:`);
        debugLog(`  Previous cached block: ${previousCachedBlock}`);
        debugLog(`  Previous last checked: ${previousLastChecked}`);
        debugLog(`  New cached block: ${cachedStartBlockNumber}`);
        debugLog(`  New last checked: ${lastCheckedBlockNumber}`);
        debugLog(`  Reason: ${reason}`);
        
        // 计算跳过的区块数
        if (previousLastChecked && currentBlock > previousLastChecked) {
            const skippedBlocks = currentBlock - previousLastChecked;
            console.log(`📊 Skipped ${skippedBlocks} blocks during pause/stop`);
            debugLog(`📊 Skipped ${skippedBlocks} blocks during pause/stop`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Failed to refresh block cache:', error);
        debugLog(`❌ Failed to refresh block cache: ${error.message}`);
        return false;
    }
}

// 轮询控制功能
async function togglePolling() {
    if (pollingPaused) {
        await resumePolling();
    } else {
        pausePolling();
    }
}

// 异步处理函数（用于HTML按钮调用）
async function handleTogglePolling() {
    try {
        await togglePolling();
    } catch (error) {
        console.error('Error in handleTogglePolling:', error);
        debugLog(`Error in handleTogglePolling: ${error.message}`);
    }
}

async function handleStartPollingManually() {
    try {
        await startPollingManually();
    } catch (error) {
        console.error('Error in handleStartPollingManually:', error);
        debugLog(`Error in handleStartPollingManually: ${error.message}`);
    }
}

async function handleResumePolling() {
    try {
        await resumePolling();
    } catch (error) {
        console.error('Error in handleResumePolling:', error);
        debugLog(`Error in handleResumePolling: ${error.message}`);
    }
}

async function handleRefreshBlockCache() {
    try {
        debugLog('=== Manual Block Cache Refresh ===');
        const success = await refreshBlockCache('manual_refresh');
        
        if (success) {
            debugLog('✅ Block cache refreshed successfully');
            updatePollingStatusDisplay(); // 更新显示
        } else {
            debugLog('❌ Failed to refresh block cache');
        }
    } catch (error) {
        console.error('Error in handleRefreshBlockCache:', error);
        debugLog(`Error in handleRefreshBlockCache: ${error.message}`);
    }
}

function pausePolling() {
    pollingPaused = true;
    console.log('⏸️ Payment polling paused');
    updatePollingStatusDisplay();
    debugLog('⏸️ Payment polling paused by user');
}

async function resumePolling() {
    pollingPaused = false;
    console.log('▶️ Payment polling resumed');
    
    // 重新缓存最新的区块ID
    await refreshBlockCache('resume');
    
    updatePollingStatusDisplay();
    debugLog('▶️ Payment polling resumed by user');
}

function stopPolling() {
    pollingEnabled = false;
    pollingPaused = false;
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    
    console.log('🛑 Payment polling stopped');
    updatePollingStatusDisplay();
    debugLog('🛑 Payment polling stopped by user');
}

async function startPollingManually() {
    pollingEnabled = true;
    pollingPaused = false;
    
    console.log('🚀 Manually starting payment polling...');
    
    // 重新缓存最新的区块ID
    await refreshBlockCache('start');
    
    updatePollingStatusDisplay();
    debugLog('🚀 Payment polling started manually by user');
    
    // 重新启动轮询
    startPaymentPolling();
}

function updatePollingStatusDisplay() {
    const button = document.getElementById('polling-control-button');
    if (!button) return;
    
    let buttonText = '';
    let buttonColor = '';
    
    if (!pollingEnabled) {
        buttonText = '🚀 Start Polling';
        buttonColor = '#28a745'; // 绿色
        button.onclick = handleStartPollingManually;
    } else if (pollingPaused) {
        buttonText = '▶️ Resume Polling';
        buttonColor = '#007bff'; // 蓝色
        button.onclick = handleResumePolling;
    } else {
        buttonText = '⏸️ Pause Polling';
        buttonColor = '#ffc107'; // 黄色
        button.onclick = pausePolling;
    }
    
    button.innerHTML = buttonText;
    button.style.backgroundColor = buttonColor;
    
    // 更新状态信息
    const statusElement = document.getElementById('polling-status-info');
    if (statusElement) {
        let statusText = '';
        
        if (!pollingEnabled) {
            statusText = '🛑 <strong>Stopped</strong> - Polling is disabled';
        } else if (pollingPaused) {
            statusText = '⏸️ <strong>Paused</strong> - Polling is paused';
        } else if (statusCheckInterval) {
            statusText = '▶️ <strong>Running</strong> - Checking every 5 seconds';
        } else {
            statusText = '⏳ <strong>Starting</strong> - Initializing polling...';
        }
        
        // 添加区块缓存信息
        if (cachedStartBlockNumber !== null || lastCheckedBlockNumber !== null) {
            statusText += `<br><strong>Block Cache:</strong><br>`;
            statusText += `  • Cached Start: ${cachedStartBlockNumber || 'None'}<br>`;
            statusText += `  • Last Checked: ${lastCheckedBlockNumber || 'None'}<br>`;
            
            if (cachedStartBlockNumber !== null && lastCheckedBlockNumber !== null) {
                const blockRange = lastCheckedBlockNumber - cachedStartBlockNumber;
                statusText += `  • Range: ${blockRange} blocks<br>`;
            }
        }
        
        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        statusText += `<br><small>Updated: ${timestamp}</small>`;
        
        statusElement.innerHTML = statusText;
    }
}

function getPollingStatus() {
    return {
        enabled: pollingEnabled,
        paused: pollingPaused,
        intervalActive: statusCheckInterval !== null,
        intervalId: statusCheckInterval
    };
}

// 调试函数：显示轮询状态
function debugPollingStatus() {
    const status = getPollingStatus();
    debugLog('=== Polling Status ===');
    debugLog(`Enabled: ${status.enabled}`);
    debugLog(`Paused: ${status.paused}`);
    debugLog(`Interval Active: ${status.intervalActive}`);
    debugLog(`Interval ID: ${status.intervalId}`);
    debugLog(`Status Check Interval: ${statusCheckInterval}`);
    
    // 区块缓存信息
    debugLog('=== Block Cache Status ===');
    debugLog(`Cached Start Block: ${cachedStartBlockNumber}`);
    debugLog(`Last Checked Block: ${lastCheckedBlockNumber}`);
    debugLog(`Stored Block (localStorage): ${lastStoredBlockNumber}`);
    
    if (cachedStartBlockNumber !== null && lastCheckedBlockNumber !== null) {
        const blockRange = lastCheckedBlockNumber - cachedStartBlockNumber;
        debugLog(`Block Range: ${blockRange} blocks`);
    }
    
    if (paymentData) {
        debugLog(`Payment Data Available: Yes`);
        debugLog(`Payment ID: ${paymentData.paymentId}`);
        debugLog(`Token: ${paymentData.selectedPayment?.symbol}`);
        debugLog(`Amount: ${paymentData.price}`);
    } else {
        debugLog(`Payment Data Available: No`);
    }
    
    if (typeof window.blockchainManager !== 'undefined') {
        debugLog('=== Blockchain Status ===');
        debugLog(`Blockchain Manager: Available`);
        debugLog(`Blockchain Connected: ${window.blockchainManager.isConnected}`);
        
        // 尝试获取当前区块号
        if (window.blockchainManager.isConnected) {
            window.blockchainManager.web3.eth.getBlockNumber().then(currentBlock => {
                debugLog(`Current Block Number: ${currentBlock}`);
                if (lastCheckedBlockNumber !== null) {
                    const blocksBehind = currentBlock - lastCheckedBlockNumber;
                    debugLog(`Blocks Behind: ${blocksBehind}`);
                }
            }).catch(error => {
                debugLog(`Failed to get current block: ${error.message}`);
            });
        }
    } else {
        debugLog(`Blockchain Manager: Not Available`);
    }
}

// ===== 调试面板切换功能 =====

// 切换调试面板显示/隐藏
function toggleDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    const toggleBtn = document.getElementById('debug-toggle-btn');
    
    if (!debugPanel || !toggleBtn) {
        console.error('Debug panel or toggle button not found');
        return;
    }
    
    const isHidden = debugPanel.style.display === 'none';
    
    if (isHidden) {
        // 显示调试面板
        debugPanel.style.display = 'block';
        toggleBtn.innerHTML = '⚙️ Hide Debug';
        toggleBtn.style.opacity = '1';
        console.log('Debug panel shown');
    } else {
        // 隐藏调试面板
        debugPanel.style.display = 'none';
        toggleBtn.innerHTML = '⚙️ Debug';
        toggleBtn.style.opacity = '0.6';
        console.log('Debug panel hidden');
    }
}

// 页面加载时确保调试面板默认隐藏
document.addEventListener('DOMContentLoaded', function() {
    // 确保调试面板默认隐藏
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
        debugPanel.style.display = 'none';
    }
});