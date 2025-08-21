// EVO Payment - Payment Monitoring Example

// 支付监听示例类
class PaymentMonitorExample {
    constructor() {
        this.activePayments = new Map();
    }
    
    // 创建支付监听
    createPaymentMonitor(paymentData) {
        const paymentId = paymentData.paymentId;
        const tokenSymbol = paymentData.selectedPayment.symbol;
        const expectedAmount = paymentData.price;
        
        console.log(`Creating payment monitor for ${paymentId}:`, {
            tokenSymbol,
            expectedAmount,
            receiverAddress: window.BLOCKCHAIN_CONFIG.receiverAddress
        });
        
        // 存储支付数据
        this.activePayments.set(paymentId, {
            ...paymentData,
            status: 'monitoring',
            startTime: Date.now()
        });
        
        // 开始监听
        const success = window.blockchainMonitor.startPaymentMonitoring(paymentId, {
            tokenSymbol: tokenSymbol,
            expectedAmount: expectedAmount,
            timeout: 30 * 60 * 1000, // 30分钟
            
            onProgress: (data) => this.handleProgress(paymentId, data),
            onSuccess: (data) => this.handleSuccess(paymentId, data),
            onError: (data) => this.handleError(paymentId, data),
            onTimeout: (data) => this.handleTimeout(paymentId, data)
        });
        
        if (success) {
            console.log(`Payment monitoring started for ${paymentId}`);
            return true;
        } else {
            console.error(`Failed to start monitoring for ${paymentId}`);
            this.activePayments.delete(paymentId);
            return false;
        }
    }
    
    // 处理监听进度
    handleProgress(paymentId, data) {
        console.log(`Payment ${paymentId} progress:`, data);
        
        const payment = this.activePayments.get(paymentId);
        if (payment) {
            payment.status = data.status;
            payment.lastUpdate = Date.now();
            
            if (data.transaction) {
                payment.foundTransaction = data.transaction;
            }
            
            if (data.confirmations !== undefined) {
                payment.confirmations = data.confirmations;
                payment.requiredConfirmations = data.required;
            }
            
            // 触发UI更新事件
            this.triggerUIUpdate(paymentId, {
                type: 'progress',
                status: data.status,
                confirmations: data.confirmations,
                required: data.required
            });
        }
    }
    
    // 处理支付成功
    handleSuccess(paymentId, data) {
        console.log(`Payment ${paymentId} confirmed:`, data);
        
        const payment = this.activePayments.get(paymentId);
        if (payment) {
            payment.status = 'confirmed';
            payment.confirmedAt = Date.now();
            payment.verificationResult = data.verificationResult;
            payment.finalTransaction = data.transaction;
            
            // 触发成功事件
            this.triggerUIUpdate(paymentId, {
                type: 'success',
                transaction: data.transaction,
                verificationResult: data.verificationResult
            });
            
            // 可以在这里添加成功后的处理逻辑
            this.onPaymentConfirmed(paymentId, payment);
        }
    }
    
    // 处理监听错误
    handleError(paymentId, data) {
        console.error(`Payment ${paymentId} error:`, data);
        
        const payment = this.activePayments.get(paymentId);
        if (payment) {
            payment.status = 'error';
            payment.error = data.error;
            payment.errorTime = Date.now();
            
            // 触发错误事件
            this.triggerUIUpdate(paymentId, {
                type: 'error',
                error: data.error
            });
        }
    }
    
    // 处理监听超时
    handleTimeout(paymentId, data) {
        console.log(`Payment ${paymentId} timeout:`, data);
        
        const payment = this.activePayments.get(paymentId);
        if (payment) {
            payment.status = 'timeout';
            payment.timeoutAt = Date.now();
            payment.elapsedTime = data.elapsedTime;
            
            // 触发超时事件
            this.triggerUIUpdate(paymentId, {
                type: 'timeout',
                elapsedTime: data.elapsedTime
            });
            
            // 清理支付数据
            this.activePayments.delete(paymentId);
        }
    }
    
    // 支付确认后的处理
    onPaymentConfirmed(paymentId, payment) {
        console.log(`Processing confirmed payment ${paymentId}:`, payment);
        
        // 更新sessionStorage
        if (typeof sessionStorage !== 'undefined') {
            const updatedPaymentData = {
                ...payment,
                status: 'confirmed',
                confirmedAt: payment.confirmedAt
            };
            sessionStorage.setItem('paymentData', JSON.stringify(updatedPaymentData));
        }
        
        // 发送确认通知 (如果需要)
        this.sendConfirmationNotification(paymentId, payment);
        
        // 延迟跳转到成功页面
        setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.location.href = 'success.html';
            }
        }, 2000);
    }
    
    // 发送确认通知
    sendConfirmationNotification(paymentId, payment) {
        // 这里可以实现发送邮件、webhook等通知逻辑
        console.log(`Sending confirmation notification for payment ${paymentId}`);
        
        // 示例：发送到后端API
        // fetch('/api/payment/confirm', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         paymentId: paymentId,
        //         transaction: payment.finalTransaction,
        //         verificationResult: payment.verificationResult
        //     })
        // });
    }
    
    // 触发UI更新
    triggerUIUpdate(paymentId, eventData) {
        // 触发自定义事件，供UI组件监听
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            const event = new CustomEvent('paymentStatusUpdate', {
                detail: {
                    paymentId: paymentId,
                    ...eventData
                }
            });
            window.dispatchEvent(event);
        }
        
        // 直接调用全局更新函数 (如果存在)
        if (typeof window !== 'undefined' && typeof window.updatePaymentStatus === 'function') {
            switch (eventData.type) {
                case 'progress':
                    if (eventData.status === 'found') {
                        window.updatePaymentStatus('monitoring', 'Payment Found - Confirming...');
                    } else if (eventData.status === 'confirming') {
                        window.updatePaymentStatus('monitoring', `Confirming... (${eventData.confirmations}/${eventData.required})`);
                    }
                    break;
                case 'success':
                    window.updatePaymentStatus('confirmed', 'Payment Confirmed!');
                    break;
                case 'error':
                    window.updatePaymentStatus('failed', `Error: ${eventData.error}`);
                    break;
                case 'timeout':
                    window.updatePaymentStatus('expired', 'Payment Expired');
                    break;
            }
        }
    }
    
    // 手动检查支付状态
    async manualCheckPayment(paymentId) {
        try {
            const result = await window.blockchainMonitor.manualVerifyPayment(paymentId);
            console.log(`Manual check result for ${paymentId}:`, result);
            return result;
        } catch (error) {
            console.error(`Manual check failed for ${paymentId}:`, error);
            throw error;
        }
    }
    
    // 停止支付监听
    stopPaymentMonitor(paymentId) {
        const success = window.blockchainMonitor.stopPaymentMonitoring(paymentId);
        if (success) {
            this.activePayments.delete(paymentId);
            console.log(`Payment monitoring stopped for ${paymentId}`);
        }
        return success;
    }
    
    // 获取支付状态
    getPaymentStatus(paymentId) {
        const payment = this.activePayments.get(paymentId);
        const monitorStatus = window.blockchainMonitor.getMonitoringStatus(paymentId);
        
        return {
            payment: payment,
            monitor: monitorStatus
        };
    }
    
    // 获取所有活跃支付
    getAllActivePayments() {
        const result = {};
        for (const [paymentId, payment] of this.activePayments) {
            result[paymentId] = this.getPaymentStatus(paymentId);
        }
        return result;
    }
    
    // 清理所有监听
    cleanup() {
        console.log('Cleaning up payment monitors...');
        
        for (const paymentId of this.activePayments.keys()) {
            this.stopPaymentMonitor(paymentId);
        }
        
        this.activePayments.clear();
        console.log('Payment monitor cleanup completed');
    }
}

// 创建全局实例
const paymentMonitorExample = new PaymentMonitorExample();

// 导出到全局
if (typeof window !== 'undefined') {
    window.PaymentMonitorExample = PaymentMonitorExample;
    window.paymentMonitorExample = paymentMonitorExample;
    
    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
        paymentMonitorExample.cleanup();
    });
}