/**
 * EVO Payment 错误处理器
 * 统一处理系统错误和用户提示
 */

class ErrorHandler {
    constructor() {
        // 错误类型定义
        this.errorTypes = {
            NETWORK_ERROR: 'network_error',
            PAYMENT_ERROR: 'payment_error', 
            WALLET_ERROR: 'wallet_error',
            TIMEOUT_ERROR: 'timeout_error',
            VALIDATION_ERROR: 'validation_error',
            BLOCKCHAIN_ERROR: 'blockchain_error',
            SYSTEM_ERROR: 'system_error'
        };
        
        // 错误消息映射
        this.errorMessages = {
            // 网络错误
            'network_error': 'Network connection failed. Please check your internet connection.',
            'connection_timeout': 'Connection timeout. Please try again.',
            'server_unavailable': 'Service temporarily unavailable. Please try again later.',
            'rpc_error': 'Blockchain network error. Please try again.',
            
            // 钱包错误
            'wallet_not_found': 'No Web3 wallet detected. Please install MetaMask.',
            'wallet_locked': 'Wallet is locked. Please unlock your wallet.',
            'wallet_rejected': 'Transaction rejected by user.',
            'insufficient_funds': 'Insufficient funds for transaction.',
            'wrong_network': 'Please switch to BNB Smart Chain network.',
            
            // 支付错误
            'payment_expired': 'Payment has expired. Please create a new payment.',
            'payment_failed': 'Payment processing failed. Please try again.',
            'invalid_amount': 'Invalid payment amount. Please enter a valid amount.',
            'invalid_address': 'Invalid wallet address format.',
            'payment_not_found': 'Payment not found or already processed.',
            
            // 验证错误
            'validation_failed': 'Input validation failed. Please check your data.',
            'amount_too_small': 'Amount is too small. Minimum amount is $0.01.',
            'amount_too_large': 'Amount is too large. Maximum amount is $10,000.',
            'unsupported_token': 'Selected token is not supported.',
            
            // 区块链错误
            'transaction_failed': 'Transaction failed on blockchain.',
            'insufficient_confirmations': 'Waiting for more confirmations.',
            'gas_estimation_failed': 'Failed to estimate gas fees.',
            'contract_error': 'Smart contract interaction failed.',
            
            // 系统错误
            'unknown_error': 'An unexpected error occurred. Please try again.',
            'initialization_failed': 'System initialization failed.',
            'configuration_error': 'System configuration error.'
        };
        
        // 错误统计
        this.errorStats = {
            total: 0,
            byType: {},
            recent: []
        };
        
        // 配置
        this.config = window.EVO_CONFIG || {};
        this.maxRecentErrors = 50;
        this.autoHideDelay = 5000;
        
        // UI 元素
        this.notificationContainer = null;
        this.loadingOverlay = null;
        
        // 初始化
        this.init();
    }   
 
    /**
     * 初始化错误处理器
     */
    init() {
        console.log('ErrorHandler 初始化...');
        
        // 创建通知容器
        this.createNotificationContainer();
        
        // 创建加载遮罩
        this.createLoadingOverlay();
        
        // 设置全局错误处理
        this.setupGlobalErrorHandling();
        
        // 监听系统事件
        this.setupEventListeners();
        
        console.log('✅ ErrorHandler 初始化完成');
    }
    
    /**
     * 创建通知容器
     */
    createNotificationContainer() {
        if (document.getElementById('evo-notifications')) return;
        
        const container = document.createElement('div');
        container.id = 'evo-notifications';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            pointer-events: none;
        `;
        
        document.body.appendChild(container);
        this.notificationContainer = container;
    }
    
    /**
     * 创建加载遮罩
     */
    createLoadingOverlay() {
        if (document.getElementById('evo-loading')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'evo-loading';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
        `;
        
        overlay.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            ">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <div id="loading-message" style="
                    font-size: 16px;
                    color: #333;
                    font-weight: 500;
                ">Loading...</div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(overlay);
        this.loadingOverlay = overlay;
    }
    
    /**
     * 设置全局错误处理
     */
    setupGlobalErrorHandling() {
        // 捕获未处理的 Promise 错误
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的 Promise 错误:', event.reason);
            this.handleError(event.reason, this.errorTypes.SYSTEM_ERROR);
            event.preventDefault();
        });
        
        // 捕获全局 JavaScript 错误
        window.addEventListener('error', (event) => {
            console.error('全局 JavaScript 错误:', event.error);
            this.handleError(event.error, this.errorTypes.SYSTEM_ERROR);
        });
        
        // 捕获资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                console.error('资源加载错误:', event.target.src || event.target.href);
                this.showNotification('Failed to load resource', 'error');
            }
        }, true);
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听网络状态
        window.addEventListener('online', () => {
            this.showNotification('Network connection restored', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.showNotification('Network connection lost', 'warning');
        });
        
        // 监听区块链连接事件
        window.addEventListener('blockchainConnectionChanged', (event) => {
            const { isConnected } = event.detail;
            if (!isConnected) {
                this.handleWalletDisconnected();
            }
        });
        
        // 监听支付错误事件
        window.addEventListener('paymentError', (event) => {
            const { error } = event.detail;
            this.handlePaymentError(error);
        });
        
        // 监听支付过期事件
        window.addEventListener('paymentExpired', (event) => {
            this.handlePaymentExpired();
        });
    }    

    /**
     * 处理错误
     * @param {Error|string} error - 错误对象或消息
     * @param {string} type - 错误类型
     * @param {Object} context - 错误上下文
     */
    handleError(error, type = this.errorTypes.SYSTEM_ERROR, context = {}) {
        try {
            // 标准化错误对象
            const errorObj = this.normalizeError(error, type, context);
            
            // 记录错误统计
            this.recordError(errorObj);
            
            // 获取用户友好的错误消息
            const userMessage = this.getUserFriendlyMessage(errorObj);
            
            // 显示错误通知
            this.showNotification(userMessage, 'error');
            
            // 记录到控制台
            console.error('ErrorHandler:', errorObj);
            
            // 触发错误事件
            this.dispatchErrorEvent(errorObj);
            
            // 执行错误恢复策略
            this.executeRecoveryStrategy(errorObj);
            
        } catch (handlingError) {
            console.error('错误处理器本身出错:', handlingError);
            this.showNotification('System error occurred', 'error');
        }
    }
    
    /**
     * 标准化错误对象
     * @param {Error|string} error - 原始错误
     * @param {string} type - 错误类型
     * @param {Object} context - 上下文信息
     * @returns {Object} 标准化的错误对象
     */
    normalizeError(error, type, context) {
        const timestamp = new Date();
        
        if (error instanceof Error) {
            return {
                type,
                message: error.message,
                stack: error.stack,
                name: error.name,
                context,
                timestamp,
                userAgent: navigator.userAgent,
                url: window.location.href
            };
        } else if (typeof error === 'string') {
            return {
                type,
                message: error,
                context,
                timestamp,
                userAgent: navigator.userAgent,
                url: window.location.href
            };
        } else {
            return {
                type,
                message: 'Unknown error occurred',
                originalError: error,
                context,
                timestamp,
                userAgent: navigator.userAgent,
                url: window.location.href
            };
        }
    }
    
    /**
     * 记录错误统计
     * @param {Object} errorObj - 错误对象
     */
    recordError(errorObj) {
        // 增加总数
        this.errorStats.total++;
        
        // 按类型统计
        if (!this.errorStats.byType[errorObj.type]) {
            this.errorStats.byType[errorObj.type] = 0;
        }
        this.errorStats.byType[errorObj.type]++;
        
        // 记录最近错误
        this.errorStats.recent.unshift(errorObj);
        if (this.errorStats.recent.length > this.maxRecentErrors) {
            this.errorStats.recent = this.errorStats.recent.slice(0, this.maxRecentErrors);
        }
    }
    
    /**
     * 获取用户友好的错误消息
     * @param {Object} errorObj - 错误对象
     * @returns {string} 用户友好的消息
     */
    getUserFriendlyMessage(errorObj) {
        const { type, message } = errorObj;
        
        // 尝试从预定义消息中匹配
        for (const [key, friendlyMessage] of Object.entries(this.errorMessages)) {
            if (message.toLowerCase().includes(key.replace('_', ' ')) || 
                message.toLowerCase().includes(key)) {
                return friendlyMessage;
            }
        }
        
        // 根据错误类型返回通用消息
        switch (type) {
            case this.errorTypes.NETWORK_ERROR:
                return this.errorMessages.network_error;
            case this.errorTypes.WALLET_ERROR:
                return this.errorMessages.wallet_not_found;
            case this.errorTypes.PAYMENT_ERROR:
                return this.errorMessages.payment_failed;
            case this.errorTypes.VALIDATION_ERROR:
                return this.errorMessages.validation_failed;
            case this.errorTypes.BLOCKCHAIN_ERROR:
                return this.errorMessages.transaction_failed;
            case this.errorTypes.TIMEOUT_ERROR:
                return this.errorMessages.connection_timeout;
            default:
                return this.errorMessages.unknown_error;
        }
    }
    
    /**
     * 显示通知
     * @param {string} message - 消息内容
     * @param {string} type - 通知类型 (success, error, warning, info)
     * @param {number} duration - 显示时长 (毫秒)
     */
    showNotification(message, type = 'info', duration = this.autoHideDelay) {
        if (!this.notificationContainer) return;
        
        const notification = document.createElement('div');
        const notificationId = 'notification-' + Date.now();
        notification.id = notificationId;
        
        // 设置样式
        const colors = {
            success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724', icon: '✅' },
            error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24', icon: '❌' },
            warning: { bg: '#fff3cd', border: '#ffeaa7', text: '#856404', icon: '⚠️' },
            info: { bg: '#cce5ff', border: '#b3d9ff', text: '#004085', icon: 'ℹ️' }
        };
        
        const color = colors[type] || colors.info;
        
        notification.style.cssText = `
            background: ${color.bg};
            border: 1px solid ${color.border};
            color: ${color.text};
            padding: 15px 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            font-size: 14px;
            line-height: 1.4;
            pointer-events: auto;
            cursor: pointer;
            transition: all 0.3s ease;
            transform: translateX(100%);
            opacity: 0;
            max-width: 100%;
            word-wrap: break-word;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <span style="font-size: 16px; flex-shrink: 0;">${color.icon}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 500; margin-bottom: 2px;">${this.getNotificationTitle(type)}</div>
                    <div>${message}</div>
                </div>
                <button style="
                    background: none;
                    border: none;
                    color: ${color.text};
                    cursor: pointer;
                    font-size: 18px;
                    line-height: 1;
                    padding: 0;
                    margin-left: 10px;
                    opacity: 0.7;
                " onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // 添加到容器
        this.notificationContainer.appendChild(notification);
        
        // 动画显示
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        });
        
        // 点击关闭
        notification.addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => {
                this.hideNotification(notification);
            }, duration);
        }
        
        return notificationId;
    }
    
    /**
     * 隐藏通知
     * @param {HTMLElement} notification - 通知元素
     */
    hideNotification(notification) {
        if (!notification || !notification.parentElement) return;
        
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }
    
    /**
     * 获取通知标题
     * @param {string} type - 通知类型
     * @returns {string} 标题
     */
    getNotificationTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || 'Notification';
    }    

    /**
     * 显示加载状态
     * @param {string} message - 加载消息
     */
    showLoading(message = 'Loading...') {
        if (!this.loadingOverlay) return;
        
        const messageElement = this.loadingOverlay.querySelector('#loading-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        this.loadingOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        console.log(`⏳ ${message}`);
    }
    
    /**
     * 隐藏加载状态
     */
    hideLoading() {
        if (!this.loadingOverlay) return;
        
        this.loadingOverlay.style.display = 'none';
        document.body.style.overflow = '';
        
        console.log('✅ Loading complete');
    }
    
    /**
     * 显示网络状态
     */
    showNetworkStatus() {
        const isOnline = navigator.onLine;
        const message = isOnline ? 'Network connection is active' : 'No network connection';
        const type = isOnline ? 'success' : 'error';
        
        this.showNotification(message, type, 3000);
    }
    
    /**
     * 触发错误事件
     * @param {Object} errorObj - 错误对象
     */
    dispatchErrorEvent(errorObj) {
        const event = new CustomEvent('systemError', {
            detail: errorObj
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 执行错误恢复策略
     * @param {Object} errorObj - 错误对象
     */
    executeRecoveryStrategy(errorObj) {
        const { type, message } = errorObj;
        
        switch (type) {
            case this.errorTypes.NETWORK_ERROR:
                this.handleNetworkError(errorObj);
                break;
            case this.errorTypes.WALLET_ERROR:
                this.handleWalletError(errorObj);
                break;
            case this.errorTypes.PAYMENT_ERROR:
                this.handlePaymentError(errorObj);
                break;
            case this.errorTypes.TIMEOUT_ERROR:
                this.handleTimeoutError(errorObj);
                break;
            default:
                // 通用错误处理
                break;
        }
    }
    
    /**
     * 处理网络错误
     * @param {Object} errorObj - 错误对象
     */
    handleNetworkError(errorObj) {
        // 检查网络状态
        if (!navigator.onLine) {
            this.showNotification('Please check your internet connection', 'warning');
            return;
        }
        
        // 建议重试
        this.showRetryOption('Network error occurred. Would you like to retry?');
    }
    
    /**
     * 处理钱包错误
     * @param {Object} errorObj - 错误对象
     */
    handleWalletError(errorObj) {
        const { message } = errorObj;
        
        if (message.includes('not found') || message.includes('install')) {
            // 钱包未安装
            this.showWalletInstallGuide();
        } else if (message.includes('rejected')) {
            // 用户拒绝
            this.showNotification('Transaction was cancelled by user', 'info');
        } else if (message.includes('network')) {
            // 网络错误
            this.showNetworkSwitchGuide();
        }
    }
    
    /**
     * 处理支付错误
     * @param {Object} errorObj - 错误对象
     */
    handlePaymentError(errorObj) {
        const { message } = errorObj;
        
        if (message.includes('expired')) {
            this.handlePaymentExpired();
        } else if (message.includes('insufficient')) {
            this.showNotification('Insufficient funds. Please check your balance.', 'error');
        } else {
            this.showRetryOption('Payment failed. Would you like to try again?');
        }
    }
    
    /**
     * 处理支付过期
     */
    handlePaymentExpired() {
        this.showNotification('Payment has expired. Please create a new payment.', 'warning');
        
        // 自动重置支付流程
        setTimeout(() => {
            if (window.PaymentUI) {
                window.PaymentUI.resetPaymentFlow();
            }
        }, 3000);
    }
    
    /**
     * 处理钱包断开连接
     */
    handleWalletDisconnected() {
        this.showNotification('Wallet disconnected. Please reconnect to continue.', 'warning');
        
        // 重置到首页
        if (window.PaymentUI) {
            window.PaymentUI.showStep('home');
        }
    }
    
    /**
     * 处理超时错误
     * @param {Object} errorObj - 错误对象
     */
    handleTimeoutError(errorObj) {
        this.showRetryOption('Request timed out. Would you like to retry?');
    }
    
    /**
     * 显示重试选项
     * @param {string} message - 消息
     */
    showRetryOption(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            pointer-events: auto;
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">${message}</div>
            <div style="display: flex; gap: 10px;">
                <button onclick="location.reload()" style="
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Retry</button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
            </div>
        `;
        
        if (this.notificationContainer) {
            this.notificationContainer.appendChild(notification);
        }
    }
    
    /**
     * 显示钱包安装指南
     */
    showWalletInstallGuide() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: #cce5ff;
            border: 1px solid #b3d9ff;
            color: #004085;
            padding: 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            pointer-events: auto;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: 500; margin-bottom: 10px;">🦊 MetaMask Required</div>
            <div style="margin-bottom: 15px;">
                To use EVO Payment, you need to install MetaMask wallet extension.
            </div>
            <div style="display: flex; gap: 10px;">
                <a href="https://metamask.io/download/" target="_blank" style="
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    display: inline-block;
                ">Install MetaMask</a>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Close</button>
            </div>
        `;
        
        if (this.notificationContainer) {
            this.notificationContainer.appendChild(notification);
        }
    }
    
    /**
     * 显示网络切换指南
     */
    showNetworkSwitchGuide() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            pointer-events: auto;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: 500; margin-bottom: 10px;">🌐 Network Switch Required</div>
            <div style="margin-bottom: 15px;">
                Please switch to BNB Smart Chain network in your wallet to continue.
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="this.switchToBSC()" style="
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Switch Network</button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Close</button>
            </div>
        `;
        
        // 添加网络切换功能
        notification.switchToBSC = async () => {
            try {
                if (window.BlockchainConnector) {
                    await window.BlockchainConnector.switchNetwork('mainnet');
                    notification.remove();
                }
            } catch (error) {
                console.error('网络切换失败:', error);
            }
        };
        
        if (this.notificationContainer) {
            this.notificationContainer.appendChild(notification);
        }
    }
    
    /**
     * 获取错误统计
     * @returns {Object} 错误统计信息
     */
    getErrorStats() {
        return {
            ...this.errorStats,
            recentErrors: this.errorStats.recent.slice(0, 10) // 只返回最近10个错误
        };
    }
    
    /**
     * 清除错误统计
     */
    clearErrorStats() {
        this.errorStats = {
            total: 0,
            byType: {},
            recent: []
        };
        console.log('错误统计已清除');
    }
    
    /**
     * 导出错误日志
     * @returns {string} JSON格式的错误日志
     */
    exportErrorLog() {
        const logData = {
            stats: this.errorStats,
            exportedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        return JSON.stringify(logData, null, 2);
    }
}

// 创建全局实例
window.ErrorHandler = new ErrorHandler();

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}