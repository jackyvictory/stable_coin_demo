/**
 * EVO Payment 支付处理器
 * 处理支付信息生成、存储和状态管理
 */

class PaymentHandler {
    constructor() {
        // 内存中的支付信息存储
        this.payments = new Map();
        
        // 配置信息
        this.config = window.EVO_CONFIG || {};
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化支付处理器
     */
    init() {
        console.log('PaymentHandler 初始化完成');
        
        // 定期清理过期支付
        setInterval(() => {
            this.cleanupExpiredPayments();
        }, 60000); // 每分钟检查一次
    }
    
    /**
     * 生成唯一支付ID
     * @returns {string} 支付ID
     */
    generatePaymentId() {
        // 使用时间戳 + 随机数生成唯一ID
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `evo_${timestamp}_${random}`;
    }
    
    /**
     * 创建支付信息
     * @param {Object} paymentRequest - 支付请求
     * @param {number} paymentRequest.amount - 支付金额 (USD)
     * @param {string} paymentRequest.token - 代币符号
     * @param {string} paymentRequest.userAddress - 用户钱包地址
     * @returns {Object} 支付信息
     */
    createPayment(paymentRequest) {
        const { amount, token, userAddress } = paymentRequest;
        
        // 验证输入参数
        if (!amount || amount <= 0) {
            throw new Error('Invalid payment amount');
        }
        
        if (!token || !this.config.TOKENS || !this.config.TOKENS[token.toUpperCase()]) {
            throw new Error('Unsupported token');
        }
        
        if (!userAddress || !this.isValidAddress(userAddress)) {
            throw new Error('Invalid user address');
        }
        
        // 生成支付ID
        const paymentId = this.generatePaymentId();
        
        // 获取代币配置
        const tokenConfig = this.config.TOKENS[token.toUpperCase()];
        
        // 获取收款地址
        const receiverAddress = this.config.APP_CONFIG?.payment?.receiverAddress;
        if (!receiverAddress) {
            throw new Error('Receiver address not configured');
        }
        
        // 计算过期时间
        const timeout = this.config.APP_CONFIG?.payment?.paymentTimeout || 30 * 60 * 1000;
        const expiresAt = new Date(Date.now() + timeout);
        
        // 创建支付信息对象
        const paymentInfo = {
            paymentId,
            amount: parseFloat(amount),
            tokenSymbol: token.toUpperCase(),
            tokenContract: tokenConfig.contract,
            tokenDecimals: tokenConfig.decimals,
            paymentAddress: receiverAddress,
            userAddress,
            status: this.config.PAYMENT_STATUS?.PENDING || 'pending',
            txHash: null,
            createdAt: new Date(),
            expiresAt,
            metadata: {
                userAgent: navigator.userAgent,
                timestamp: Date.now(),
                network: this.config.APP_CONFIG?.currentNetwork || 'mainnet'
            }
        };
        
        // 存储到内存
        this.payments.set(paymentId, paymentInfo);
        
        console.log(`创建支付: ${paymentId}`, paymentInfo);
        
        return paymentInfo;
    }
    
    /**
     * 获取支付信息
     * @param {string} paymentId - 支付ID
     * @returns {Object|null} 支付信息
     */
    getPaymentInfo(paymentId) {
        const payment = this.payments.get(paymentId);
        
        if (!payment) {
            return null;
        }
        
        // 检查是否过期
        if (new Date() > payment.expiresAt && payment.status === 'pending') {
            this.updatePaymentStatus(paymentId, 'expired');
            return this.payments.get(paymentId);
        }
        
        return payment;
    }
    
    /**
     * 更新支付状态
     * @param {string} paymentId - 支付ID
     * @param {string} status - 新状态
     * @param {Object} additionalData - 额外数据
     */
    updatePaymentStatus(paymentId, status, additionalData = {}) {
        const payment = this.payments.get(paymentId);
        
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // 更新状态
        payment.status = status;
        payment.updatedAt = new Date();
        
        // 添加额外数据
        Object.assign(payment, additionalData);
        
        // 如果是完成状态，记录完成时间
        if (status === 'completed') {
            payment.completedAt = new Date();
        }
        
        console.log(`支付状态更新: ${paymentId} -> ${status}`, additionalData);
        
        // 触发状态变化事件
        this.onPaymentStatusChanged(paymentId, status, payment);
    }
    
    /**
     * 生成支付二维码数据
     * @param {string} paymentId - 支付ID
     * @returns {Object} 二维码数据
     */
    generateQRCodeData(paymentId) {
        const payment = this.getPaymentInfo(paymentId);
        
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        if (payment.status !== 'pending') {
            throw new Error('Payment is not in pending status');
        }
        
        // 构建支付URL (EIP-681 标准)
        const paymentUrl = this.buildPaymentUrl(payment);
        
        // 构建二维码数据
        const qrData = {
            paymentId: payment.paymentId,
            url: paymentUrl,
            displayInfo: {
                amount: `$${payment.amount}`,
                token: payment.tokenSymbol,
                address: this.formatAddress(payment.paymentAddress),
                expiresAt: payment.expiresAt.toLocaleString()
            },
            rawData: {
                amount: payment.amount,
                tokenContract: payment.tokenContract,
                receiverAddress: payment.paymentAddress,
                decimals: payment.tokenDecimals
            }
        };
        
        return qrData;
    }
    
    /**
     * 构建支付URL (EIP-681标准)
     * @param {Object} payment - 支付信息
     * @returns {string} 支付URL
     */
    buildPaymentUrl(payment) {
        const { tokenContract, paymentAddress, amount, tokenDecimals } = payment;
        
        // 将USD金额转换为代币数量 (这里简化处理，实际应该通过价格API获取汇率)
        const tokenAmount = amount; // 假设1:1汇率，实际项目中需要实现价格转换
        
        // 转换为Wei格式
        const amountInWei = this.toWei(tokenAmount.toString(), tokenDecimals);
        
        // 构建EIP-681格式的URL
        // ethereum:<address>@<chainId>?value=<amount>&gas=<gasLimit>&gasPrice=<gasPrice>
        const chainId = this.getCurrentChainId();
        
        if (tokenContract && tokenContract !== '0x0') {
            // ERC-20代币转账
            return `ethereum:${tokenContract}@${chainId}/transfer?address=${paymentAddress}&uint256=${amountInWei}`;
        } else {
            // 原生代币转账
            return `ethereum:${paymentAddress}@${chainId}?value=${amountInWei}`;
        }
    }
    
    /**
     * 获取当前链ID
     * @returns {number} 链ID
     */
    getCurrentChainId() {
        const network = this.config.APP_CONFIG?.currentNetwork || 'mainnet';
        return this.config.NETWORK_CONFIG?.[network]?.chainId || 56;
    }
    
    /**
     * 生成二维码图片
     * @param {string} paymentId - 支付ID
     * @param {HTMLElement} container - 容器元素
     * @param {Object} options - 二维码选项
     * @returns {Promise} 生成Promise
     */
    async generateQRCode(paymentId, container, options = {}) {
        const qrData = this.generateQRCodeData(paymentId);
        
        const defaultOptions = {
            width: this.config.APP_CONFIG?.ui?.qrCodeSize || 256,
            height: this.config.APP_CONFIG?.ui?.qrCodeSize || 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        };
        
        const qrOptions = { ...defaultOptions, ...options };
        
        return new Promise((resolve, reject) => {
            if (typeof QRCode !== 'undefined') {
                // 如果容器是canvas元素
                if (container.tagName === 'CANVAS') {
                    QRCode.toCanvas(container, qrData.url, qrOptions, (error) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(qrData);
                        }
                    });
                } else {
                    // 如果容器是其他元素，创建canvas并添加
                    const canvas = document.createElement('canvas');
                    QRCode.toCanvas(canvas, qrData.url, qrOptions, (error) => {
                        if (error) {
                            reject(error);
                        } else {
                            container.innerHTML = '';
                            container.appendChild(canvas);
                            resolve(qrData);
                        }
                    });
                }
            } else {
                reject(new Error('QRCode library not loaded'));
            }
        });
    }
    
    /**
     * 获取所有支付信息
     * @param {Object} filters - 过滤条件
     * @returns {Array} 支付信息列表
     */
    getAllPayments(filters = {}) {
        let payments = Array.from(this.payments.values());
        
        // 应用过滤条件
        if (filters.status) {
            payments = payments.filter(p => p.status === filters.status);
        }
        
        if (filters.userAddress) {
            payments = payments.filter(p => p.userAddress.toLowerCase() === filters.userAddress.toLowerCase());
        }
        
        if (filters.token) {
            payments = payments.filter(p => p.tokenSymbol === filters.token.toUpperCase());
        }
        
        // 按创建时间排序
        payments.sort((a, b) => b.createdAt - a.createdAt);
        
        return payments;
    }
    
    /**
     * 清理过期支付
     */
    cleanupExpiredPayments() {
        const now = new Date();
        let cleanedCount = 0;
        
        for (const [paymentId, payment] of this.payments.entries()) {
            // 清理超过24小时的已完成或已过期支付
            const isOld = (now - payment.createdAt) > 24 * 60 * 60 * 1000;
            const isFinished = ['completed', 'expired', 'failed'].includes(payment.status);
            
            if (isOld && isFinished) {
                this.payments.delete(paymentId);
                cleanedCount++;
            }
            
            // 标记过期的待处理支付
            if (now > payment.expiresAt && payment.status === 'pending') {
                this.updatePaymentStatus(paymentId, 'expired');
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`清理了 ${cleanedCount} 个过期支付记录`);
        }
    }
    
    /**
     * 支付状态变化回调
     * @param {string} paymentId - 支付ID
     * @param {string} status - 新状态
     * @param {Object} payment - 支付信息
     */
    onPaymentStatusChanged(paymentId, status, payment) {
        // 触发自定义事件
        const event = new CustomEvent('paymentStatusChanged', {
            detail: { paymentId, status, payment }
        });
        
        window.dispatchEvent(event);
        
        // 更新UI (如果有相关元素)
        this.updatePaymentUI(paymentId, status, payment);
    }
    
    /**
     * 更新支付相关UI
     * @param {string} paymentId - 支付ID
     * @param {string} status - 状态
     * @param {Object} payment - 支付信息
     */
    updatePaymentUI(paymentId, status, payment) {
        // 更新状态指示器
        const statusElement = document.getElementById('paymentStatus');
        if (statusElement) {
            statusElement.className = `status-indicator status-${status}`;
            
            const statusText = {
                'pending': '⏳ Waiting for payment...',
                'monitoring': '👀 Monitoring transaction...',
                'confirmed': '✅ Payment confirmed',
                'completed': '🎉 Payment completed!',
                'expired': '⏰ Payment expired',
                'failed': '❌ Payment failed'
            };
            
            statusElement.innerHTML = statusText[status] || `Status: ${status}`;
        }
        
        // 更新支付信息显示
        const paymentInfoElement = document.getElementById('paymentInfo');
        if (paymentInfoElement && status === 'completed') {
            paymentInfoElement.innerHTML = `
                <div class="payment-result">
                    <h3>Payment Successful!</h3>
                    <p><strong>Amount:</strong> $${payment.amount}</p>
                    <p><strong>Token:</strong> ${payment.tokenSymbol}</p>
                    <p><strong>Transaction:</strong> ${payment.txHash || 'N/A'}</p>
                    <p><strong>Time:</strong> ${payment.completedAt?.toLocaleString() || 'N/A'}</p>
                </div>
            `;
        }
    }
    
    /**
     * 工具函数：验证地址格式
     * @param {string} address - 地址
     * @returns {boolean} 是否有效
     */
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    
    /**
     * 工具函数：格式化地址显示
     * @param {string} address - 地址
     * @returns {string} 格式化后的地址
     */
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    
    /**
     * 工具函数：转换为Wei
     * @param {string} amount - 金额
     * @param {number} decimals - 精度
     * @returns {string} Wei格式金额
     */
    toWei(amount, decimals = 18) {
        const factor = Math.pow(10, decimals);
        return (parseFloat(amount) * factor).toString();
    }
    
    /**
     * 工具函数：从Wei转换
     * @param {string} wei - Wei格式金额
     * @param {number} decimals - 精度
     * @returns {string} 可读金额
     */
    fromWei(wei, decimals = 18) {
        const factor = Math.pow(10, decimals);
        return (parseInt(wei) / factor).toString();
    }
    
    /**
     * 获取支付统计信息
     * @returns {Object} 统计信息
     */
    getPaymentStats() {
        const payments = Array.from(this.payments.values());
        
        const stats = {
            total: payments.length,
            pending: payments.filter(p => p.status === 'pending').length,
            completed: payments.filter(p => p.status === 'completed').length,
            expired: payments.filter(p => p.status === 'expired').length,
            failed: payments.filter(p => p.status === 'failed').length,
            totalAmount: payments
                .filter(p => p.status === 'completed')
                .reduce((sum, p) => sum + p.amount, 0)
        };
        
        return stats;
    }
    
    /**
     * 导出支付数据 (用于调试)
     * @returns {Object} 支付数据
     */
    exportPaymentData() {
        const payments = Array.from(this.payments.entries()).map(([id, payment]) => ({
            id,
            ...payment,
            createdAt: payment.createdAt.toISOString(),
            expiresAt: payment.expiresAt.toISOString(),
            updatedAt: payment.updatedAt?.toISOString(),
            completedAt: payment.completedAt?.toISOString()
        }));
        
        return {
            payments,
            stats: this.getPaymentStats(),
            exportedAt: new Date().toISOString()
        };
    }
}

// 创建全局实例
window.PaymentHandler = new PaymentHandler();

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentHandler;
}