/**
 * EVO Payment 区块链交易监听器
 * 实现轮询方式监听交易状态和支付验证
 */

class BlockchainMonitor {
    constructor() {
        // 监听状态
        this.isMonitoring = false;
        this.monitoringIntervals = new Map();
        this.activePayments = new Map();
        
        // 配置
        this.config = window.EVO_CONFIG || {};
        this.pollingInterval = this.config.APP_CONFIG?.payment?.pollingInterval || 5000;
        this.requiredConfirmations = this.config.APP_CONFIG?.payment?.confirmations || 3;
        
        // 依赖组件
        this.blockchainConnector = window.BlockchainConnector;
        this.paymentHandler = window.PaymentHandler;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化监听器
     */
    init() {
        console.log('BlockchainMonitor 初始化...');
        
        // 检查依赖
        if (!this.blockchainConnector) {
            console.error('❌ BlockchainConnector 未找到');
            return;
        }
        
        if (!this.paymentHandler) {
            console.error('❌ PaymentHandler 未找到');
            return;
        }
        
        // 监听支付状态变化
        window.addEventListener('paymentStatusChanged', (event) => {
            this.handlePaymentStatusChanged(event.detail);
        });
        
        console.log('✅ BlockchainMonitor 初始化完成');
    }
    
    /**
     * 开始监听支付
     * @param {string} paymentId - 支付ID
     * @param {Object} options - 监听选项
     */
    async startMonitoring(paymentId, options = {}) {
        try {
            // 获取支付信息
            const payment = this.paymentHandler.getPaymentInfo(paymentId);
            if (!payment) {
                throw new Error('支付信息不存在');
            }
            
            if (payment.status !== 'pending') {
                throw new Error('只能监听待处理状态的支付');
            }
            
            // 检查是否已在监听
            if (this.monitoringIntervals.has(paymentId)) {
                console.log(`⚠️ 支付 ${paymentId} 已在监听中`);
                return;
            }
            
            // 更新支付状态为监听中
            this.paymentHandler.updatePaymentStatus(paymentId, 'monitoring');
            
            // 保存监听配置
            const monitoringConfig = {
                paymentId,
                paymentAddress: payment.paymentAddress,
                expectedAmount: payment.amount,
                tokenSymbol: payment.tokenSymbol,
                tokenContract: payment.tokenContract,
                tokenDecimals: payment.tokenDecimals,
                startTime: Date.now(),
                expiresAt: payment.expiresAt,
                lastCheckedBlock: options.fromBlock || 'latest',
                ...options
            };
            
            this.activePayments.set(paymentId, monitoringConfig);
            
            // 开始轮询
            const intervalId = setInterval(async () => {
                await this.checkPaymentTransaction(paymentId);
            }, this.pollingInterval);
            
            this.monitoringIntervals.set(paymentId, intervalId);
            
            console.log(`🔍 开始监听支付: ${paymentId}`);
            console.log(`   - 代币: ${payment.tokenSymbol}`);
            console.log(`   - 金额: $${payment.amount}`);
            console.log(`   - 地址: ${payment.paymentAddress}`);
            
            // 触发监听开始事件
            this.onMonitoringStarted(paymentId, monitoringConfig);
            
        } catch (error) {
            console.error(`❌ 开始监听失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 停止监听支付
     * @param {string} paymentId - 支付ID
     */
    stopMonitoring(paymentId) {
        try {
            // 清除轮询间隔
            const intervalId = this.monitoringIntervals.get(paymentId);
            if (intervalId) {
                clearInterval(intervalId);
                this.monitoringIntervals.delete(paymentId);
            }
            
            // 移除监听配置
            this.activePayments.delete(paymentId);
            
            console.log(`⏹️ 停止监听支付: ${paymentId}`);
            
            // 触发监听停止事件
            this.onMonitoringStopped(paymentId);
            
        } catch (error) {
            console.error(`❌ 停止监听失败: ${error.message}`);
        }
    }
    
    /**
     * 检查支付交易
     * @param {string} paymentId - 支付ID
     */
    async checkPaymentTransaction(paymentId) {
        try {
            const config = this.activePayments.get(paymentId);
            if (!config) {
                console.log(`⚠️ 监听配置不存在: ${paymentId}`);
                return;
            }
            
            // 检查是否过期
            if (new Date() > config.expiresAt) {
                console.log(`⏰ 支付已过期: ${paymentId}`);
                this.handlePaymentExpired(paymentId);
                return;
            }
            
            // 查询交易
            const transactions = await this.queryRecentTransactions(config);
            
            if (transactions.length > 0) {
                console.log(`🔍 发现 ${transactions.length} 个相关交易`);
                
                // 验证交易
                for (const tx of transactions) {
                    const isValid = await this.validateTransaction(tx, config);
                    if (isValid) {
                        console.log(`✅ 找到有效支付交易: ${tx.hash}`);
                        await this.handlePaymentFound(paymentId, tx);
                        return;
                    }
                }
            }
            
            // 更新最后检查的区块
            const currentBlock = await this.blockchainConnector.web3.eth.getBlockNumber();
            config.lastCheckedBlock = currentBlock;
            
        } catch (error) {
            console.error(`❌ 检查支付交易失败 (${paymentId}):`, error.message);
            
            // 如果是网络错误，不停止监听，只记录错误
            if (this.isNetworkError(error)) {
                console.log(`🔄 网络错误，继续监听: ${paymentId}`);
            } else {
                // 其他错误，停止监听并标记失败
                this.handlePaymentError(paymentId, error);
            }
        }
    }
    
    /**
     * 查询最近的交易
     * @param {Object} config - 监听配置
     * @returns {Array} 交易列表
     */
    async queryRecentTransactions(config) {
        try {
            const { paymentAddress, tokenContract, lastCheckedBlock } = config;
            
            // 获取当前区块号
            const currentBlock = await this.blockchainConnector.web3.eth.getBlockNumber();
            const fromBlock = typeof lastCheckedBlock === 'number' ? lastCheckedBlock + 1 : currentBlock - 10;
            
            let transactions = [];
            
            if (tokenContract && tokenContract !== '0x0') {
                // ERC-20 代币转账
                transactions = await this.queryTokenTransfers(
                    tokenContract,
                    paymentAddress,
                    fromBlock,
                    currentBlock
                );
            } else {
                // 原生代币转账 (BNB)
                transactions = await this.queryNativeTransfers(
                    paymentAddress,
                    fromBlock,
                    currentBlock
                );
            }
            
            return transactions;
            
        } catch (error) {
            console.error('查询最近交易失败:', error);
            return [];
        }
    }
    
    /**
     * 查询代币转账
     * @param {string} tokenContract - 代币合约地址
     * @param {string} toAddress - 接收地址
     * @param {number} fromBlock - 起始区块
     * @param {number} toBlock - 结束区块
     * @returns {Array} 转账记录
     */
    async queryTokenTransfers(tokenContract, toAddress, fromBlock, toBlock) {
        try {
            const contract = this.blockchainConnector.getTokenContract(
                this.getTokenSymbolByContract(tokenContract)
            );
            
            // 查询 Transfer 事件
            const events = await contract.getPastEvents('Transfer', {
                filter: { to: toAddress },
                fromBlock: Math.max(0, fromBlock),
                toBlock: toBlock
            });
            
            // 转换为统一格式
            return events.map(event => ({
                hash: event.transactionHash,
                blockNumber: event.blockNumber,
                from: event.returnValues.from,
                to: event.returnValues.to,
                value: event.returnValues.value,
                tokenContract: tokenContract,
                type: 'token_transfer'
            }));
            
        } catch (error) {
            console.error('查询代币转账失败:', error);
            return [];
        }
    }
    
    /**
     * 查询原生代币转账
     * @param {string} toAddress - 接收地址
     * @param {number} fromBlock - 起始区块
     * @param {number} toBlock - 结束区块
     * @returns {Array} 转账记录
     */
    async queryNativeTransfers(toAddress, fromBlock, toBlock) {
        try {
            // 注意：查询原生代币转账比较复杂，需要遍历区块
            // 这里提供一个简化的实现
            const transactions = [];
            
            // 限制查询范围以避免性能问题
            const maxBlocks = 100;
            const actualFromBlock = Math.max(fromBlock, toBlock - maxBlocks);
            
            for (let blockNum = actualFromBlock; blockNum <= toBlock; blockNum++) {
                try {
                    const block = await this.blockchainConnector.web3.eth.getBlock(blockNum, true);
                    
                    if (block && block.transactions) {
                        for (const tx of block.transactions) {
                            if (tx.to && tx.to.toLowerCase() === toAddress.toLowerCase() && tx.value !== '0') {
                                transactions.push({
                                    hash: tx.hash,
                                    blockNumber: tx.blockNumber,
                                    from: tx.from,
                                    to: tx.to,
                                    value: tx.value,
                                    tokenContract: null,
                                    type: 'native_transfer'
                                });
                            }
                        }
                    }
                } catch (blockError) {
                    console.error(`查询区块 ${blockNum} 失败:`, blockError.message);
                }
            }
            
            return transactions;
            
        } catch (error) {
            console.error('查询原生代币转账失败:', error);
            return [];
        }
    }
    
    /**
     * 验证交易
     * @param {Object} transaction - 交易信息
     * @param {Object} config - 监听配置
     * @returns {boolean} 是否有效
     */
    async validateTransaction(transaction, config) {
        try {
            const { expectedAmount, tokenDecimals, paymentAddress, tokenContract } = config;
            
            // 验证接收地址
            if (transaction.to.toLowerCase() !== paymentAddress.toLowerCase()) {
                console.log(`❌ 地址不匹配: ${transaction.to} != ${paymentAddress}`);
                return false;
            }
            
            // 验证代币合约
            if (tokenContract && transaction.tokenContract) {
                if (transaction.tokenContract.toLowerCase() !== tokenContract.toLowerCase()) {
                    console.log(`❌ 代币合约不匹配`);
                    return false;
                }
            }
            
            // 验证金额
            const receivedAmount = this.parseTransactionAmount(transaction.value, tokenDecimals);
            const expectedAmountNum = parseFloat(expectedAmount);
            
            // 允许一定的误差范围 (0.1%)
            const tolerance = expectedAmountNum * 0.001;
            const amountDiff = Math.abs(receivedAmount - expectedAmountNum);
            
            if (amountDiff > tolerance) {
                console.log(`❌ 金额不匹配: 收到 ${receivedAmount}, 期望 ${expectedAmountNum}`);
                return false;
            }
            
            // 验证确认数
            const confirmations = await this.blockchainConnector.getConfirmations(transaction.blockNumber);
            if (confirmations < this.requiredConfirmations) {
                console.log(`⏳ 确认数不足: ${confirmations}/${this.requiredConfirmations}`);
                return false;
            }
            
            console.log(`✅ 交易验证通过:`);
            console.log(`   - 哈希: ${transaction.hash}`);
            console.log(`   - 金额: ${receivedAmount}`);
            console.log(`   - 确认数: ${confirmations}`);
            
            return true;
            
        } catch (error) {
            console.error('验证交易失败:', error);
            return false;
        }
    }
    
    /**
     * 解析交易金额
     * @param {string} value - 原始金额值
     * @param {number} decimals - 代币精度
     * @returns {number} 解析后的金额
     */
    parseTransactionAmount(value, decimals) {
        try {
            // 将 Wei 转换为可读金额
            const amount = this.blockchainConnector.fromWei(value, decimals);
            return parseFloat(amount);
        } catch (error) {
            console.error('解析交易金额失败:', error);
            return 0;
        }
    }
    
    /**
     * 根据合约地址获取代币符号
     * @param {string} contractAddress - 合约地址
     * @returns {string} 代币符号
     */
    getTokenSymbolByContract(contractAddress) {
        const tokens = this.config.TOKENS || {};
        
        for (const [symbol, config] of Object.entries(tokens)) {
            if (config.contract.toLowerCase() === contractAddress.toLowerCase()) {
                return symbol;
            }
        }
        
        return 'UNKNOWN';
    }
    
    /**
     * 处理找到支付
     * @param {string} paymentId - 支付ID
     * @param {Object} transaction - 交易信息
     */
    async handlePaymentFound(paymentId, transaction) {
        try {
            // 停止监听
            this.stopMonitoring(paymentId);
            
            // 更新支付状态
            this.paymentHandler.updatePaymentStatus(paymentId, 'confirmed', {
                txHash: transaction.hash,
                blockNumber: transaction.blockNumber,
                confirmedAt: new Date()
            });
            
            // 等待更多确认后标记为完成
            setTimeout(async () => {
                try {
                    const confirmations = await this.blockchainConnector.getConfirmations(transaction.blockNumber);
                    if (confirmations >= this.requiredConfirmations) {
                        this.paymentHandler.updatePaymentStatus(paymentId, 'completed', {
                            finalConfirmations: confirmations
                        });
                        
                        console.log(`🎉 支付完成: ${paymentId}`);
                        this.onPaymentCompleted(paymentId, transaction);
                    }
                } catch (error) {
                    console.error('检查最终确认失败:', error);
                }
            }, 30000); // 30秒后检查最终确认
            
            // 触发支付找到事件
            this.onPaymentFound(paymentId, transaction);
            
        } catch (error) {
            console.error('处理找到支付失败:', error);
        }
    }
    
    /**
     * 处理支付过期
     * @param {string} paymentId - 支付ID
     */
    handlePaymentExpired(paymentId) {
        try {
            // 停止监听
            this.stopMonitoring(paymentId);
            
            // 更新支付状态
            this.paymentHandler.updatePaymentStatus(paymentId, 'expired');
            
            console.log(`⏰ 支付已过期: ${paymentId}`);
            
            // 触发支付过期事件
            this.onPaymentExpired(paymentId);
            
        } catch (error) {
            console.error('处理支付过期失败:', error);
        }
    }
    
    /**
     * 处理支付错误
     * @param {string} paymentId - 支付ID
     * @param {Error} error - 错误信息
     */
    handlePaymentError(paymentId, error) {
        try {
            // 停止监听
            this.stopMonitoring(paymentId);
            
            // 更新支付状态
            this.paymentHandler.updatePaymentStatus(paymentId, 'failed', {
                error: error.message,
                failedAt: new Date()
            });
            
            console.log(`❌ 支付监听失败: ${paymentId} - ${error.message}`);
            
            // 触发支付错误事件
            this.onPaymentError(paymentId, error);
            
        } catch (updateError) {
            console.error('处理支付错误失败:', updateError);
        }
    }
    
    /**
     * 处理支付状态变化
     * @param {Object} detail - 事件详情
     */
    handlePaymentStatusChanged(detail) {
        const { paymentId, status } = detail;
        
        // 如果支付状态变为非监听状态，停止监听
        if (['completed', 'expired', 'failed'].includes(status)) {
            if (this.monitoringIntervals.has(paymentId)) {
                this.stopMonitoring(paymentId);
            }
        }
    }
    
    /**
     * 判断是否为网络错误
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否为网络错误
     */
    isNetworkError(error) {
        const networkErrorMessages = [
            'network error',
            'connection failed',
            'timeout',
            'fetch failed',
            'rpc error'
        ];
        
        const errorMessage = error.message.toLowerCase();
        return networkErrorMessages.some(msg => errorMessage.includes(msg));
    }
    
    /**
     * 获取监听统计信息
     * @returns {Object} 统计信息
     */
    getMonitoringStats() {
        return {
            activeMonitoring: this.activePayments.size,
            totalIntervals: this.monitoringIntervals.size,
            activePayments: Array.from(this.activePayments.keys()),
            pollingInterval: this.pollingInterval,
            requiredConfirmations: this.requiredConfirmations
        };
    }
    
    /**
     * 停止所有监听
     */
    stopAllMonitoring() {
        console.log('🛑 停止所有支付监听');
        
        // 停止所有监听
        for (const paymentId of this.activePayments.keys()) {
            this.stopMonitoring(paymentId);
        }
        
        console.log('✅ 所有监听已停止');
    }
    
    // 事件回调方法
    
    /**
     * 监听开始回调
     * @param {string} paymentId - 支付ID
     * @param {Object} config - 监听配置
     */
    onMonitoringStarted(paymentId, config) {
        const event = new CustomEvent('monitoringStarted', {
            detail: { paymentId, config }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 监听停止回调
     * @param {string} paymentId - 支付ID
     */
    onMonitoringStopped(paymentId) {
        const event = new CustomEvent('monitoringStopped', {
            detail: { paymentId }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 支付找到回调
     * @param {string} paymentId - 支付ID
     * @param {Object} transaction - 交易信息
     */
    onPaymentFound(paymentId, transaction) {
        const event = new CustomEvent('paymentFound', {
            detail: { paymentId, transaction }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 支付完成回调
     * @param {string} paymentId - 支付ID
     * @param {Object} transaction - 交易信息
     */
    onPaymentCompleted(paymentId, transaction) {
        const event = new CustomEvent('paymentCompleted', {
            detail: { paymentId, transaction }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 支付过期回调
     * @param {string} paymentId - 支付ID
     */
    onPaymentExpired(paymentId) {
        const event = new CustomEvent('paymentExpired', {
            detail: { paymentId }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 支付错误回调
     * @param {string} paymentId - 支付ID
     * @param {Error} error - 错误信息
     */
    onPaymentError(paymentId, error) {
        const event = new CustomEvent('paymentError', {
            detail: { paymentId, error }
        });
        window.dispatchEvent(event);
    }
}

// 创建全局实例
window.BlockchainMonitor = new BlockchainMonitor();

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockchainMonitor;
}