// Stable Coin - Payment Handler

// 支付状态枚举
const PaymentStatus = {
    PENDING: 'pending',          // 等待用户选择
    WAITING: 'waiting',          // 等待支付
    MONITORING: 'monitoring',    // 监听中
    CONFIRMED: 'confirmed',      // 已确认
    COMPLETED: 'completed',      // 已完成
    EXPIRED: 'expired',          // 已过期
    FAILED: 'failed'            // 支付失败
};

// 支付处理器类
class PaymentHandler {
    constructor() {
        this.currentPayment = null;
        this.paymentHistory = new Map();
        this.statusChangeCallbacks = new Map();
    }
    
    // 创建支付会话
    createPaymentSession(productInfo) {
        const paymentId = this.generatePaymentId();
        const timestamp = Date.now();
        
        const paymentSession = {
            paymentId: paymentId,
            product: productInfo.key,
            productName: productInfo.name,
            price: productInfo.price,
            currency: 'USD',
            status: PaymentStatus.PENDING,
            createdAt: timestamp,
            updatedAt: timestamp,
            expiresAt: timestamp + (30 * 60 * 1000), // 30分钟后过期
            selectedPayment: null,
            selectedNetwork: null,
            receiverAddress: window.BLOCKCHAIN_CONFIG?.receiverAddress || '0xe27577B0e3920cE35f100f66430de0108cb78a04',
            qrCodeImage: './images/wallet_qr.jpg',
            txHash: null,
            confirmations: 0,
            verificationResult: null,
            errorMessage: null,
            // 页面导航状态
            currentPage: 'product-selection',
            navigationHistory: ['product-selection']
        };
        
        console.log('Created payment session:', paymentSession);
        
        // 保存到当前支付和历史记录
        this.currentPayment = paymentSession;
        this.paymentHistory.set(paymentId, paymentSession);
        
        // 保存到 sessionStorage
        this.saveToStorage(paymentSession);
        
        // 触发状态变化回调
        this.triggerStatusChange(paymentId, PaymentStatus.PENDING, null);
        
        return paymentSession;
    }
    
    // 更新支付会话
    updatePaymentSession(paymentId, updates) {
        let payment = this.getPaymentSession(paymentId);
        if (!payment) {
            console.error(`Payment session ${paymentId} not found`);
            return null;
        }
        
        const oldStatus = payment.status;
        
        // 更新支付信息
        Object.assign(payment, updates, {
            updatedAt: Date.now()
        });
        
        // 更新存储
        this.paymentHistory.set(paymentId, payment);
        if (this.currentPayment && this.currentPayment.paymentId === paymentId) {
            this.currentPayment = payment;
        }
        this.saveToStorage(payment);
        
        console.log(`Updated payment session ${paymentId}:`, updates);
        
        // 如果状态发生变化，触发回调
        if (updates.status && updates.status !== oldStatus) {
            this.triggerStatusChange(paymentId, updates.status, oldStatus);
        }
        
        return payment;
    }
    
    // 获取支付会话
    getPaymentSession(paymentId) {
        if (paymentId) {
            return this.paymentHistory.get(paymentId);
        } else {
            return this.currentPayment;
        }
    }
    
    // 获取当前支付会话
    getCurrentPayment() {
        return this.currentPayment;
    }
    
    // 设置支付方式和网络
    setPaymentMethodAndNetwork(paymentId, paymentMethod, network) {
        const updates = {
            selectedPayment: paymentMethod,
            selectedNetwork: network,
            status: PaymentStatus.WAITING
        };
        
        return this.updatePaymentSession(paymentId, updates);
    }
    
    // 开始支付监听
    startPaymentMonitoring(paymentId) {
        const payment = this.getPaymentSession(paymentId);
        if (!payment) {
            console.error(`Payment session ${paymentId} not found`);
            return false;
        }
        
        if (!payment.selectedPayment || !payment.selectedNetwork) {
            console.error('Payment method and network must be selected before monitoring');
            return false;
        }
        
        // 更新状态为监听中
        this.updatePaymentSession(paymentId, {
            status: PaymentStatus.MONITORING
        });
        
        // 检查区块链监听器是否可用
        if (typeof window.blockchainMonitor === 'undefined') {
            console.error('Blockchain monitor not available for payment monitoring');
            console.log('Available window objects:', Object.keys(window).filter(key => key.includes('blockchain')));
            this.updatePaymentSession(paymentId, {
                status: PaymentStatus.FAILED,
                errorMessage: 'Blockchain monitor not available'
            });
            return false;
        }
        
        // 开始区块链监听
        const success = window.blockchainMonitor.startPaymentMonitoring(paymentId, {
            tokenSymbol: payment.selectedPayment.symbol,
            expectedAmount: payment.price,
            timeout: payment.expiresAt - Date.now(),
            
            onProgress: (data) => this.handleMonitoringProgress(paymentId, data),
            onSuccess: (data) => this.handleMonitoringSuccess(paymentId, data),
            onError: (data) => this.handleMonitoringError(paymentId, data),
            onTimeout: (data) => this.handleMonitoringTimeout(paymentId, data)
        });
        
        if (!success) {
            this.updatePaymentSession(paymentId, {
                status: PaymentStatus.FAILED,
                errorMessage: 'Failed to start blockchain monitoring'
            });
            return false;
        }
        
        console.log(`Started payment monitoring for ${paymentId}`);
        return true;
    }
    
    // 处理监听进度
    handleMonitoringProgress(paymentId, data) {
        console.log(`Payment ${paymentId} monitoring progress:`, data);
        
        const updates = {
            status: PaymentStatus.MONITORING
        };
        
        if (data.transaction) {
            updates.txHash = data.transaction.transactionHash;
        }
        
        if (data.confirmations !== undefined) {
            updates.confirmations = data.confirmations;
        }
        
        this.updatePaymentSession(paymentId, updates);
    }
    
    // 处理监听成功
    handleMonitoringSuccess(paymentId, data) {
        console.log(`Payment ${paymentId} confirmed:`, data);
        
        const updates = {
            status: PaymentStatus.CONFIRMED,
            txHash: data.transaction?.transactionHash,
            confirmations: data.confirmations,
            verificationResult: data.verificationResult,
            confirmedAt: Date.now()
        };
        
        this.updatePaymentSession(paymentId, updates);
        
        // 延迟标记为完成并跳转
        setTimeout(() => {
            this.completePayment(paymentId);
        }, 2000);
    }
    
    // 处理监听错误
    handleMonitoringError(paymentId, data) {
        console.error(`Payment ${paymentId} monitoring error:`, data);
        
        this.updatePaymentSession(paymentId, {
            status: PaymentStatus.FAILED,
            errorMessage: data.error
        });
    }
    
    // 处理监听超时
    handleMonitoringTimeout(paymentId, data) {
        console.log(`Payment ${paymentId} monitoring timeout:`, data);
        
        this.updatePaymentSession(paymentId, {
            status: PaymentStatus.EXPIRED,
            expiredAt: Date.now()
        });
    }
    
    // 完成支付
    completePayment(paymentId) {
        const payment = this.updatePaymentSession(paymentId, {
            status: PaymentStatus.COMPLETED,
            completedAt: Date.now()
        });
        
        if (payment) {
            console.log(`Payment ${paymentId} completed successfully`);
            
            // 导航到成功页面
            this.navigateToPage('success');
        }
        
        return payment;
    }
    
    // 取消支付
    cancelPayment(paymentId, reason = 'User cancelled') {
        const payment = this.updatePaymentSession(paymentId, {
            status: PaymentStatus.FAILED,
            errorMessage: reason,
            cancelledAt: Date.now()
        });
        
        // 停止区块链监听
        if (typeof window.blockchainMonitor !== 'undefined') {
            window.blockchainMonitor.stopPaymentMonitoring(paymentId);
        }
        
        console.log(`Payment ${paymentId} cancelled: ${reason}`);
        return payment;
    }
    
    // 页面导航管理
    navigateToPage(pageName, paymentId = null) {
        const payment = paymentId ? this.getPaymentSession(paymentId) : this.currentPayment;
        
        if (payment) {
            // 更新导航历史
            payment.navigationHistory.push(pageName);
            payment.currentPage = pageName;
            this.updatePaymentSession(payment.paymentId, {
                currentPage: pageName,
                navigationHistory: payment.navigationHistory
            });
        }
        
        // 执行页面跳转
        const pageUrls = {
            'product-selection': 'index.html',
            'payment-selection': 'payment.html',
            'qr-code': 'qrcode.html',
            'success': 'success.html'
        };
        
        const url = pageUrls[pageName];
        if (url && typeof window !== 'undefined') {
            console.log(`Navigating to ${pageName} (${url})`);
            window.location.href = url;
        } else {
            console.error(`Unknown page: ${pageName}`);
        }
    }
    
    // 获取导航历史
    getNavigationHistory(paymentId = null) {
        const payment = paymentId ? this.getPaymentSession(paymentId) : this.currentPayment;
        return payment ? payment.navigationHistory : [];
    }
    
    // 返回上一页
    goBack(paymentId = null) {
        const payment = paymentId ? this.getPaymentSession(paymentId) : this.currentPayment;
        
        if (payment && payment.navigationHistory.length > 1) {
            // 移除当前页面
            payment.navigationHistory.pop();
            // 获取上一页
            const previousPage = payment.navigationHistory[payment.navigationHistory.length - 1];
            
            this.navigateToPage(previousPage, payment.paymentId);
        } else {
            // 默认返回首页
            this.navigateToPage('product-selection');
        }
    }
    
    // 检查支付是否过期
    isPaymentExpired(paymentId = null) {
        const payment = paymentId ? this.getPaymentSession(paymentId) : this.currentPayment;
        
        if (!payment) {
            return true;
        }
        
        return Date.now() > payment.expiresAt;
    }
    
    // 获取支付剩余时间
    getRemainingTime(paymentId = null) {
        const payment = paymentId ? this.getPaymentSession(paymentId) : this.currentPayment;
        
        if (!payment) {
            return 0;
        }
        
        const remaining = payment.expiresAt - Date.now();
        return Math.max(0, remaining);
    }
    
    // 格式化剩余时间
    formatRemainingTime(paymentId = null) {
        const remaining = this.getRemainingTime(paymentId);
        
        if (remaining <= 0) {
            return 'Expired';
        }
        
        const minutes = Math.floor(remaining / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // 注册状态变化回调
    onStatusChange(paymentId, callback) {
        if (!this.statusChangeCallbacks.has(paymentId)) {
            this.statusChangeCallbacks.set(paymentId, []);
        }
        this.statusChangeCallbacks.get(paymentId).push(callback);
    }
    
    // 触发状态变化回调
    triggerStatusChange(paymentId, newStatus, oldStatus) {
        const callbacks = this.statusChangeCallbacks.get(paymentId);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(newStatus, oldStatus, this.getPaymentSession(paymentId));
                } catch (error) {
                    console.error('Error in status change callback:', error);
                }
            });
        }
        
        // 触发全局事件
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            const event = new CustomEvent('paymentStatusChanged', {
                detail: {
                    paymentId: paymentId,
                    newStatus: newStatus,
                    oldStatus: oldStatus,
                    payment: this.getPaymentSession(paymentId)
                }
            });
            window.dispatchEvent(event);
        }
    }
    
    // 生成支付ID
    generatePaymentId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `pay_${timestamp}_${random}`;
    }
    
    // 保存到存储
    saveToStorage(payment) {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('paymentData', JSON.stringify(payment));
            sessionStorage.setItem('currentPaymentId', payment.paymentId);
        }
    }
    
    // 从存储加载
    loadFromStorage() {
        if (typeof sessionStorage !== 'undefined') {
            const paymentData = sessionStorage.getItem('paymentData');
            const currentPaymentId = sessionStorage.getItem('currentPaymentId');
            
            if (paymentData) {
                try {
                    const payment = JSON.parse(paymentData);
                    this.currentPayment = payment;
                    this.paymentHistory.set(payment.paymentId, payment);
                    
                    console.log('Loaded payment from storage:', payment);
                    return payment;
                } catch (error) {
                    console.error('Error loading payment from storage:', error);
                }
            }
        }
        
        return null;
    }
    
    // 清理存储
    clearStorage() {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('paymentData');
            sessionStorage.removeItem('currentPaymentId');
        }
    }
    
    // 获取支付统计
    getPaymentStats() {
        const stats = {
            total: this.paymentHistory.size,
            pending: 0,
            waiting: 0,
            monitoring: 0,
            confirmed: 0,
            completed: 0,
            expired: 0,
            failed: 0
        };
        
        for (const payment of this.paymentHistory.values()) {
            stats[payment.status] = (stats[payment.status] || 0) + 1;
        }
        
        return stats;
    }
    
    // 清理过期支付
    cleanupExpiredPayments() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [paymentId, payment] of this.paymentHistory) {
            if (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.WAITING) {
                if (now > payment.expiresAt) {
                    this.updatePaymentSession(paymentId, {
                        status: PaymentStatus.EXPIRED,
                        expiredAt: now
                    });
                    cleanedCount++;
                }
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} expired payments`);
        }
        
        return cleanedCount;
    }
}

// 创建全局支付处理器实例
const paymentHandler = new PaymentHandler();

// 导出到全局
if (typeof window !== 'undefined') {
    window.PaymentStatus = PaymentStatus;
    window.PaymentHandler = PaymentHandler;
    window.paymentHandler = paymentHandler;
    
    // 页面加载时尝试恢复支付状态
    document.addEventListener('DOMContentLoaded', () => {
        paymentHandler.loadFromStorage();
        paymentHandler.cleanupExpiredPayments();
    });
    
    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
        // 停止所有监听
        if (typeof window.blockchainMonitor !== 'undefined') {
            window.blockchainMonitor.stopAllMonitoring();
        }
    });
}