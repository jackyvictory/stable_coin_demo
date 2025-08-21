// EVO Payment - Blockchain Integration

// 区块链配置
const BLOCKCHAIN_CONFIG = {
    // BNB Smart Chain 主网配置
    network: {
        name: 'BNB Smart Chain',
        chainId: 56,
        rpcUrl: 'https://bsc-dataseed1.binance.org/',
        blockExplorer: 'https://bscscan.com',
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        }
    },
    
    // 固定收款地址
    receiverAddress: '0xe27577B0e3920cE35f100f66430de0108cb78a04',
    
    // 支持的代币合约地址 (BSC 主网)
    tokens: {
        USDT: {
            symbol: 'USDT',
            name: 'Tether USD',
            contract: '0x55d398326f99059fF775485246999027B3197955',
            decimals: 18,
            icon: 'usdt-icon.png'
        },
        USDC: {
            symbol: 'USDC',
            name: 'USD Coin',
            contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            decimals: 18,
            icon: 'usdc-icon.png'
        },
        'USDC.e': {
            symbol: 'USDC.e',
            name: 'USDC.e(Bridged)',
            contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 使用相同的USDC合约
            decimals: 18,
            icon: 'usdc-icon.png'
        },
        BUSD: {
            symbol: 'BUSD',
            name: 'Binance USD',
            contract: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            decimals: 18,
            icon: 'busd-icon.png'
        },
        TUSD: {
            symbol: 'TUSD',
            name: 'TrueUSD',
            contract: '0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9',
            decimals: 18,
            icon: 'tusd-icon.png'
        }
    },
    
    // 监听配置
    monitoring: {
        pollingInterval: 5000, // 5秒轮询一次 (模拟手动刷新)
        confirmations: 3, // 需要3个确认
        timeout: 30 * 60 * 1000, // 30分钟超时
        maxConcurrentChecks: 1, // 最大并发检查数
        retryDelay: 120000, // 遇到限制时等待2分钟再重试
        maxRetries: 3 // 最大重试次数
    }
};

// ERC-20 代币标准 ABI (简化版，只包含需要的方法)
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
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
];

// 区块链连接管理器
class BlockchainManager {
    constructor() {
        this.web3 = null;
        this.isConnected = false;
        this.initializing = false;
        this.contracts = {};
        this.lastBlockNumber = 0;
        this.lastBlockCheckTime = 0;
        this.blockCheckCooldown = 3000; // 3秒内不重复检查区块号
        this.lastTransferQueryTime = 0; // 最后一次转账查询时间
        this.lastAnyRpcCallTime = 0; // 最后一次任何RPC调用的时间
    }
    
    // 智能延迟：根据上次RPC调用时间动态调整延迟
    async smartDelayBeforeTransferQuery() {
        const now = Date.now();
        const timeSinceLastQuery = now - this.lastTransferQueryTime;
        const minInterval = 2000; // 最小间隔2秒
        
        console.log(`🕐 [SMART-DELAY] Checking delay: now=${now}, lastQuery=${this.lastTransferQueryTime}, timeSince=${timeSinceLastQuery}ms`);
        
        if (this.lastTransferQueryTime === 0) {
            console.log(`🕐 [SMART-DELAY] First transfer query, no delay needed`);
        } else if (timeSinceLastQuery < minInterval) {
            const delayNeeded = minInterval - timeSinceLastQuery;
            console.log(`🕐 [SMART-DELAY] Last transfer query was ${timeSinceLastQuery}ms ago, delaying ${delayNeeded}ms to avoid rate limit`);
            await new Promise(resolve => setTimeout(resolve, delayNeeded));
            console.log(`🕐 [SMART-DELAY] Delay completed`);
        } else {
            console.log(`🕐 [SMART-DELAY] Last transfer query was ${timeSinceLastQuery}ms ago, no delay needed`);
        }
    }
    
    // 确保RPC调用间隔
    async ensureRpcCallInterval() {
        const now = Date.now();
        const timeSinceLastRpc = now - this.lastAnyRpcCallTime;
        const minInterval = 12000; // 12秒间隔
        
        console.log(`🕐 [RPC-INTERVAL] Checking RPC interval: last=${this.lastAnyRpcCallTime}, now=${now}, since=${timeSinceLastRpc}ms`);
        
        if (this.lastAnyRpcCallTime === 0) {
            console.log(`🕐 [RPC-INTERVAL] First RPC call, no delay needed`);
        } else if (timeSinceLastRpc < minInterval) {
            const delayNeeded = minInterval - timeSinceLastRpc;
            console.log(`🕐 [RPC-INTERVAL] Last RPC was ${timeSinceLastRpc}ms ago, delaying ${delayNeeded}ms (min interval: ${minInterval}ms)`);
            await new Promise(resolve => setTimeout(resolve, delayNeeded));
            console.log(`🕐 [RPC-INTERVAL] Delay completed`);
        } else {
            console.log(`🕐 [RPC-INTERVAL] Last RPC was ${timeSinceLastRpc}ms ago, no delay needed`);
        }
    }
    
    // 初始化区块链连接
    async initialize() {
        // 防止重复初始化
        if (this.initializing) {
            console.log('Blockchain initialization already in progress...');
            return false;
        }
        
        if (this.isConnected) {
            console.log('Blockchain already connected');
            return true;
        }
        
        this.initializing = true;
        
        try {
            console.log('Initializing blockchain connection...');
            
            // 检查 Web3 是否已加载
            if (typeof Web3 === 'undefined') {
                throw new Error('Web3 library not loaded');
            }
            
            // 创建 Web3 实例
            this.web3 = new Web3(BLOCKCHAIN_CONFIG.network.rpcUrl);
            
            // 测试连接
            const blockNumber = await this.web3.eth.getBlockNumber();
            this.lastBlockNumber = blockNumber;
            this.lastBlockCheckTime = Date.now();
            this.isConnected = true;
            
            console.log('Blockchain connected successfully. Current block:', blockNumber);
            
            // 初始化代币合约
            this.initializeContracts();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize blockchain connection:', error);
            this.isConnected = false;
            return false;
        } finally {
            this.initializing = false;
        }
    }
    
    // 初始化代币合约
    initializeContracts() {
        try {
            for (const [symbol, tokenConfig] of Object.entries(BLOCKCHAIN_CONFIG.tokens)) {
                this.contracts[symbol] = new this.web3.eth.Contract(
                    ERC20_ABI,
                    tokenConfig.contract
                );
                console.log(`Initialized contract for ${symbol}:`, tokenConfig.contract);
            }
        } catch (error) {
            console.error('Failed to initialize contracts:', error);
        }
    }
    
    // 检查连接状态
    async checkConnection(skipBlockNumberUpdate = false) {
        try {
            if (!this.web3) {
                return false;
            }
            
            // 如果跳过区块号更新，只检查连接状态
            if (skipBlockNumberUpdate) {
                return this.isConnected;
            }
            
            // 检查是否在冷却期内
            const now = Date.now();
            if (now - this.lastBlockCheckTime < this.blockCheckCooldown) {
                console.log('Block check in cooldown, using cached result');
                return this.isConnected;
            }
            
            console.log(`🌐 [RPC-CALL] checkConnection() calling getBlockNumber...`);
            this.lastAnyRpcCallTime = Date.now();
            const blockNumber = await this.web3.eth.getBlockNumber();
            console.log(`🌐 [RPC-CALL] checkConnection() got block number: ${blockNumber}`);
            this.lastBlockNumber = blockNumber;
            this.lastBlockCheckTime = now;
            this.isConnected = true;
            return true;
            
        } catch (error) {
            console.error('Connection check failed:', error);
            this.isConnected = false;
            return false;
        }
    }
    
    // 获取代币余额
    async getTokenBalance(tokenSymbol, address) {
        try {
            if (!this.isConnected || !this.contracts[tokenSymbol]) {
                throw new Error(`Contract not available for ${tokenSymbol}`);
            }
            
            const contract = this.contracts[tokenSymbol];
            const balance = await contract.methods.balanceOf(address).call();
            const decimals = BLOCKCHAIN_CONFIG.tokens[tokenSymbol].decimals;
            
            // 转换为可读格式
            const balanceInTokens = this.web3.utils.fromWei(balance, 'ether');
            
            return {
                raw: balance,
                formatted: balanceInTokens,
                decimals: decimals
            };
        } catch (error) {
            console.error(`Failed to get balance for ${tokenSymbol}:`, error);
            return null;
        }
    }
    
    // 获取交易详情
    async getTransaction(txHash) {
        try {
            if (!this.isConnected) {
                throw new Error('Blockchain not connected');
            }
            
            const transaction = await this.web3.eth.getTransaction(txHash);
            const receipt = await this.web3.eth.getTransactionReceipt(txHash);
            
            return {
                transaction,
                receipt,
                confirmations: this.lastBlockNumber - receipt.blockNumber
            };
        } catch (error) {
            console.error('Failed to get transaction:', error);
            return null;
        }
    }
    
    // 获取最新的代币转账交易
    async getLatestTokenTransfers(tokenSymbol, toAddress, fromBlock = 'latest') {
        try {
            if (!this.isConnected || !this.contracts[tokenSymbol]) {
                throw new Error(`Contract not available for ${tokenSymbol}`);
            }
            
            const contract = this.contracts[tokenSymbol];
            
            // 计算查询范围 - 使用极小的区块范围以减少RPC负载
            let queryFromBlock;
            if (fromBlock === 'latest') {
                // 只查询最近5个区块，进一步减少负载
                queryFromBlock = Math.max(1, this.lastBlockNumber - 5);
            } else {
                queryFromBlock = fromBlock;
            }
            
            console.log(`🌐 [RPC-CALL] Getting token transfers for ${tokenSymbol} from block ${queryFromBlock} to latest...`);
            
            // 记录RPC调用时间
            const queryStartTime = Date.now();
            this.lastTransferQueryTime = queryStartTime;
            this.lastAnyRpcCallTime = queryStartTime;
            console.log(`🌐 [RPC-CALL] Transfer query started at ${queryStartTime}`);
            
            // 获取 Transfer 事件
            const events = await contract.getPastEvents('Transfer', {
                filter: {
                    to: toAddress
                },
                fromBlock: queryFromBlock,
                toBlock: 'latest'
            });
            
            console.log(`🌐 [RPC-CALL] Found ${events.length} transfer events for ${tokenSymbol} in blocks ${queryFromBlock}-${this.lastBlockNumber}`);
            
            return events.map(event => ({
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber,
                from: event.returnValues.from,
                to: event.returnValues.to,
                value: event.returnValues.value,
                formattedValue: this.web3.utils.fromWei(event.returnValues.value, 'ether')
            }));
            
        } catch (error) {
            console.error(`Failed to get token transfers for ${tokenSymbol}:`, error);
            
            // 如果是限制错误，抛出特殊错误以便上层处理
            if (error.message && (error.message.includes('limit exceeded') || error.message.includes('rate limit'))) {
                console.log(`🚫 Rate limit detected in getLatestTokenTransfers, throwing RATE_LIMIT_EXCEEDED`);
                throw new Error('RATE_LIMIT_EXCEEDED');
            }
            
            return [];
        }
    }
    
    // 验证支付
    async verifyPayment(tokenSymbol, expectedAmount, txHash = null) {
        try {
            const receiverAddress = BLOCKCHAIN_CONFIG.receiverAddress;
            
            if (txHash) {
                // 验证特定交易
                const txDetails = await this.getTransaction(txHash);
                if (!txDetails) {
                    return { verified: false, reason: 'Transaction not found' };
                }
                
                // 检查交易是否成功
                if (!txDetails.receipt.status) {
                    return { verified: false, reason: 'Transaction failed' };
                }
                
                // 检查确认数
                if (txDetails.confirmations < BLOCKCHAIN_CONFIG.monitoring.confirmations) {
                    return { 
                        verified: false, 
                        reason: 'Insufficient confirmations',
                        confirmations: txDetails.confirmations,
                        required: BLOCKCHAIN_CONFIG.monitoring.confirmations
                    };
                }
                
                return { verified: true, transaction: txDetails };
            } else {
                // 查询最新的转账记录
                const transfers = await this.getLatestTokenTransfers(tokenSymbol, receiverAddress);
                
                // 查找匹配金额的转账
                const matchingTransfer = transfers.find(transfer => {
                    const transferAmount = parseFloat(transfer.formattedValue);
                    const expected = parseFloat(expectedAmount);
                    return Math.abs(transferAmount - expected) < 0.001; // 允许小数点误差
                });
                
                if (matchingTransfer) {
                    // 验证确认数
                    const confirmations = this.lastBlockNumber - matchingTransfer.blockNumber;
                    if (confirmations >= BLOCKCHAIN_CONFIG.monitoring.confirmations) {
                        return { 
                            verified: true, 
                            transfer: matchingTransfer,
                            confirmations: confirmations
                        };
                    } else {
                        return { 
                            verified: false, 
                            reason: 'Insufficient confirmations',
                            confirmations: confirmations,
                            required: BLOCKCHAIN_CONFIG.monitoring.confirmations,
                            transfer: matchingTransfer
                        };
                    }
                }
                
                return { verified: false, reason: 'No matching payment found' };
            }
        } catch (error) {
            console.error('Payment verification failed:', error);
            return { verified: false, reason: 'Verification error', error: error.message };
        }
    }
    
    // 获取网络信息
    getNetworkInfo() {
        return BLOCKCHAIN_CONFIG.network;
    }
    
    // 获取支持的代币列表
    getSupportedTokens() {
        return BLOCKCHAIN_CONFIG.tokens;
    }
    
    // 获取收款地址
    getReceiverAddress() {
        return BLOCKCHAIN_CONFIG.receiverAddress;
    }
}

// 区块链交易监听器
class BlockchainMonitor {
    constructor(blockchainManager) {
        this.blockchainManager = blockchainManager;
        this.activeMonitors = new Map(); // 存储活跃的监听器
        this.eventCallbacks = new Map(); // 存储事件回调
    }
    
    // 开始监听支付
    startPaymentMonitoring(paymentId, config) {
        const {
            tokenSymbol,
            expectedAmount,
            receiverAddress = BLOCKCHAIN_CONFIG.receiverAddress,
            timeout = BLOCKCHAIN_CONFIG.monitoring.timeout,
            onProgress = null,
            onSuccess = null,
            onError = null,
            onTimeout = null
        } = config;
        
        console.log(`Starting payment monitoring for ${paymentId}:`, {
            tokenSymbol,
            expectedAmount,
            receiverAddress,
            timeout
        });
        
        // 检查是否已经在监听
        if (this.activeMonitors.has(paymentId)) {
            console.warn(`Payment ${paymentId} is already being monitored`);
            return false;
        }
        
        // 创建监听器配置
        const monitorConfig = {
            paymentId,
            tokenSymbol,
            expectedAmount,
            receiverAddress,
            startTime: Date.now(),
            timeout,
            lastCheckedBlock: this.blockchainManager.lastBlockNumber - 3, // 从最近3个区块开始检查
            confirmations: 0,
            requiredConfirmations: BLOCKCHAIN_CONFIG.monitoring.confirmations,
            status: 'monitoring',
            foundTransaction: null
        };
        
        // 存储回调函数
        this.eventCallbacks.set(paymentId, {
            onProgress,
            onSuccess,
            onError,
            onTimeout
        });
        
        // 开始轮询
        const intervalId = setInterval(async () => {
            const monitor = this.activeMonitors.get(paymentId);
            if (!monitor) return;
            
            // 如果监听器被暂停，跳过这次检查
            if (monitor.paused) {
                const pausedDuration = Date.now() - (monitor.pausedAt || 0);
                console.log(`⏸️ Monitor for ${paymentId} is paused (${Math.round(pausedDuration/1000)}s), skipping check`);
                return;
            }
            
            console.log(`🔍 Checking payment status for ${paymentId} (interval check)`);
            try {
                await this.checkPaymentStatus(paymentId);
                console.log(`✅ Payment status check completed for ${paymentId}`);
            } catch (error) {
                console.error(`❌ Error checking payment status for ${paymentId}:`, error);
                
                // 如果是速率限制错误，暂停监听器一段时间
                if (error.message === 'RATE_LIMIT_EXCEEDED') {
                    console.log(`🚫 Rate limit exceeded for ${paymentId}, pausing monitor for ${BLOCKCHAIN_CONFIG.monitoring.retryDelay}ms`);
                    
                    // 标记监听器为暂停状态
                    monitor.paused = true;
                    monitor.pausedAt = Date.now();
                    
                    // 延迟后恢复监听器
                    setTimeout(() => {
                        const currentMonitor = this.activeMonitors.get(paymentId);
                        if (currentMonitor) {
                            currentMonitor.paused = false;
                            delete currentMonitor.pausedAt;
                            console.log(`✅ Resuming monitor for ${paymentId} after rate limit pause`);
                        }
                    }, BLOCKCHAIN_CONFIG.monitoring.retryDelay);
                } else {
                    // 其他错误，触发错误回调
                    this.triggerCallback(paymentId, 'onError', {
                        error: error.message,
                        paymentId: paymentId
                    });
                }
            }
        }, BLOCKCHAIN_CONFIG.monitoring.pollingInterval);
        
        monitorConfig.intervalId = intervalId;
        this.activeMonitors.set(paymentId, monitorConfig);
        
        // 设置超时
        const timeoutId = setTimeout(() => {
            this.handleTimeout(paymentId);
        }, timeout);
        
        monitorConfig.timeoutId = timeoutId;
        
        return true;
    }
    
    // 检查支付状态 - 完全模拟手动刷新行为
    async checkPaymentStatus(paymentId) {
        const monitor = this.activeMonitors.get(paymentId);
        if (!monitor) {
            console.warn(`Monitor for payment ${paymentId} not found`);
            return;
        }
        
        try {
            // 完全模拟手动刷新：调用手动验证方法
            console.log(`🔍 [AUTO-POLL] Simulating manual refresh for payment ${paymentId}`);
            
            // 调用手动验证，这会包含交易检测
            await this.manualVerifyPayment(paymentId);
            
        } catch (error) {
            console.error(`Error checking payment status for ${paymentId}:`, error);
            
            // 如果是速率限制错误，重新抛出让上层处理
            if (error.message === 'RATE_LIMIT_EXCEEDED') {
                console.log(`Rate limit error caught in checkPaymentStatus, re-throwing to upper level`);
                throw error;
            }
            
            // 其他错误触发错误回调
            this.triggerCallback(paymentId, 'onError', {
                error: error.message,
                paymentId: paymentId
            });
        }
    }
    
    // 查找匹配的转账
    findMatchingTransfer(transfers, expectedAmount) {
        const expectedAmountNum = parseFloat(expectedAmount);
        
        for (const transfer of transfers) {
            const transferAmount = parseFloat(transfer.formattedValue);
            
            // 允许小数点误差 (0.1%)
            const tolerance = Math.max(0.001, expectedAmountNum * 0.001);
            
            if (Math.abs(transferAmount - expectedAmountNum) <= tolerance) {
                console.log(`Found matching transfer: ${transferAmount} ≈ ${expectedAmountNum}`);
                return transfer;
            }
        }
        
        return null;
    }
    
    // 处理超时
    handleTimeout(paymentId) {
        const monitor = this.activeMonitors.get(paymentId);
        if (!monitor) {
            return;
        }
        
        console.log(`Payment ${paymentId} timed out`);
        monitor.status = 'timeout';
        
        this.triggerCallback(paymentId, 'onTimeout', {
            paymentId: paymentId,
            elapsedTime: Date.now() - monitor.startTime
        });
        
        this.stopPaymentMonitoring(paymentId);
    }
    
    // 停止支付监听
    stopPaymentMonitoring(paymentId) {
        const monitor = this.activeMonitors.get(paymentId);
        if (!monitor) {
            console.warn(`No active monitor found for payment ${paymentId}`);
            return false;
        }
        
        console.log(`Stopping payment monitoring for ${paymentId}`);
        
        // 清除定时器
        if (monitor.intervalId) {
            clearInterval(monitor.intervalId);
        }
        
        if (monitor.timeoutId) {
            clearTimeout(monitor.timeoutId);
        }
        
        // 移除监听器和回调
        this.activeMonitors.delete(paymentId);
        this.eventCallbacks.delete(paymentId);
        
        return true;
    }
    
    // 触发回调函数
    triggerCallback(paymentId, callbackName, data) {
        const callbacks = this.eventCallbacks.get(paymentId);
        if (callbacks && callbacks[callbackName]) {
            try {
                callbacks[callbackName](data);
            } catch (error) {
                console.error(`Error in ${callbackName} callback for payment ${paymentId}:`, error);
            }
        }
    }
    
    // 获取监听状态
    getMonitoringStatus(paymentId) {
        const monitor = this.activeMonitors.get(paymentId);
        if (!monitor) {
            return null;
        }
        
        return {
            paymentId: monitor.paymentId,
            status: monitor.status,
            tokenSymbol: monitor.tokenSymbol,
            expectedAmount: monitor.expectedAmount,
            confirmations: monitor.confirmations,
            requiredConfirmations: monitor.requiredConfirmations,
            elapsedTime: Date.now() - monitor.startTime,
            foundTransaction: monitor.foundTransaction
        };
    }
    
    // 获取所有活跃的监听器
    getActiveMonitors() {
        const result = {};
        for (const [paymentId, monitor] of this.activeMonitors) {
            result[paymentId] = this.getMonitoringStatus(paymentId);
        }
        return result;
    }
    
    // 停止所有监听器
    stopAllMonitoring() {
        console.log('Stopping all payment monitoring...');
        
        for (const paymentId of this.activeMonitors.keys()) {
            this.stopPaymentMonitoring(paymentId);
        }
        
        console.log('All payment monitoring stopped');
    }
    
    // 手动验证支付 - 包含交易检测
    async manualVerifyPayment(paymentId) {
        const monitor = this.activeMonitors.get(paymentId);
        if (!monitor) {
            throw new Error(`No active monitor found for payment ${paymentId}`);
        }
        
        console.log(`🔄 [MANUAL-VERIFY] Manually verifying payment ${paymentId}...`);
        
        // 检查监控器是否因速率限制被暂停
        if (monitor.paused) {
            const pausedDuration = Date.now() - (monitor.pausedAt || 0);
            console.log(`🚫 [MANUAL-VERIFY] Monitor is paused due to rate limit (${Math.round(pausedDuration/1000)}s ago), skipping manual verification`);
            throw new Error('Monitor is paused due to rate limit, please wait');
        }
        
        try {
            // 先更新区块号
            console.log(`🔄 [MANUAL-VERIFY] Checking connection and updating block number...`);
            const isConnected = await this.blockchainManager.checkConnection(false);
            if (!isConnected) {
                throw new Error('Blockchain connection lost');
            }
            
            const currentBlock = this.blockchainManager.lastBlockNumber;
            console.log(`🔄 [MANUAL-VERIFY] Current block: ${currentBlock}, Last checked: ${monitor.lastCheckedBlock}`);
            
            // 如果区块号没有更新，跳过交易查询
            if (currentBlock <= monitor.lastCheckedBlock) {
                console.log(`🔄 [MANUAL-VERIFY] No new blocks since last check (${currentBlock} <= ${monitor.lastCheckedBlock}), skipping transaction query`);
                
                // 仍然检查已找到交易的确认数
                this.checkTransactionConfirmations(paymentId, currentBlock);
                
                return this.getMonitoringStatus(paymentId);
            }
            
            // 如果还没有找到交易，进行一次交易检测
            if (!monitor.foundTransaction) {
                console.log(`🔄 [MANUAL-VERIFY] New blocks detected (${monitor.lastCheckedBlock + 1} to ${currentBlock}), will check for transfers after delay...`);
                
                // 智能延迟：确保与任何RPC调用有足够间隔
                await this.blockchainManager.ensureRpcCallInterval();
                console.log(`🕐 [FIXED-DELAY] Delay completed, proceeding with transfer query`);
                
                console.log(`🔄 [MANUAL-VERIFY] Smart delay completed, now checking for transfers...`);
                
                // 查询最新的转账记录 - 限制查询范围为最多3个区块
                const fromBlock = Math.max(monitor.lastCheckedBlock + 1, currentBlock - 2); // 最多查询3个区块
                console.log(`🔄 [MANUAL-VERIFY] Querying transfers from block ${fromBlock} to ${currentBlock} (max 3 blocks)`);
                
                const transfers = await this.blockchainManager.getLatestTokenTransfers(
                    monitor.tokenSymbol,
                    monitor.receiverAddress,
                    fromBlock
                );
                
                console.log(`🔄 [MANUAL-VERIFY] Found ${transfers.length} transfers`);
                
                // 查找匹配的转账
                const matchingTransfer = this.findMatchingTransfer(transfers, monitor.expectedAmount);
                
                if (matchingTransfer) {
                    console.log(`🔄 [MANUAL-VERIFY] Found matching transfer:`, matchingTransfer);
                    monitor.foundTransaction = matchingTransfer;
                    monitor.status = 'confirming';
                    
                    // 触发进度回调
                    this.triggerCallback(paymentId, 'onProgress', {
                        status: 'found',
                        transaction: matchingTransfer,
                        confirmations: 0,
                        required: monitor.requiredConfirmations
                    });
                }
            }
            
            // 更新最后检查的区块号
            monitor.lastCheckedBlock = currentBlock;
            
            // 统一处理交易确认数检查
            this.checkTransactionConfirmations(paymentId, currentBlock);
            
            // 返回当前状态
            return this.getMonitoringStatus(paymentId);
        } catch (error) {
            console.error(`🔄 [MANUAL-VERIFY] Manual verification failed for payment ${paymentId}:`, error);
            throw error;
        }
    }
    
    // 检查交易确认数的辅助方法
    checkTransactionConfirmations(paymentId, currentBlock) {
        const monitor = this.activeMonitors.get(paymentId);
        if (!monitor || !monitor.foundTransaction) {
            return;
        }
        
        const confirmations = currentBlock - monitor.foundTransaction.blockNumber;
        monitor.confirmations = confirmations;
        
        console.log(`🔄 [CONFIRM-CHECK] Payment ${paymentId} confirmations: ${confirmations}/${monitor.requiredConfirmations}`);
        
        if (confirmations >= monitor.requiredConfirmations) {
            // 支付确认完成
            console.log(`🔄 [CONFIRM-CHECK] Payment ${paymentId} confirmed!`);
            monitor.status = 'confirmed';
            
            this.triggerCallback(paymentId, 'onSuccess', {
                status: 'confirmed',
                transaction: monitor.foundTransaction,
                confirmations: confirmations,
                verificationResult: {
                    verified: true,
                    transaction: monitor.foundTransaction,
                    confirmations: confirmations
                }
            });
            
            // 停止监听
            this.stopPaymentMonitoring(paymentId);
        } else {
            // 更新确认进度
            this.triggerCallback(paymentId, 'onProgress', {
                status: 'confirming',
                transaction: monitor.foundTransaction,
                confirmations: confirmations,
                required: monitor.requiredConfirmations
            });
        }
    }
}

// 创建全局区块链管理器实例
const blockchainManager = new BlockchainManager();
const blockchainMonitor = new BlockchainMonitor(blockchainManager);

// 导出配置和管理器
if (typeof window !== 'undefined') {
    window.BLOCKCHAIN_CONFIG = BLOCKCHAIN_CONFIG;
    window.BlockchainManager = BlockchainManager;
    window.BlockchainMonitor = BlockchainMonitor;
    window.blockchainManager = blockchainManager;
    window.blockchainMonitor = blockchainMonitor;
}

// 自动初始化 (只在需要的页面)
if (typeof window !== 'undefined') {
    // 检查当前页面是否需要区块链功能
    const needsBlockchain = () => {
        const currentPage = window.location.pathname;
        // 只在二维码页面和测试页面自动初始化
        return currentPage.includes('qrcode.html') || 
               currentPage.includes('test-blockchain.html') ||
               currentPage.includes('success.html');
    };
    
    // 延迟初始化，确保页面加载完成
    setTimeout(() => {
        console.log('Checking blockchain auto-initialization conditions:', {
            currentPage: window.location.pathname,
            needsBlockchain: needsBlockchain(),
            web3Available: typeof Web3 !== 'undefined',
            isConnected: blockchainManager.isConnected,
            initializing: blockchainManager.initializing
        });
        
        if (needsBlockchain() && typeof Web3 !== 'undefined' && !blockchainManager.isConnected && !blockchainManager.initializing) {
            console.log('🚀 Auto-initializing blockchain for page:', window.location.pathname);
            blockchainManager.initialize().then(success => {
                if (success) {
                    console.log('✅ Blockchain manager auto-initialized successfully');
                    // 触发全局事件，通知其他组件区块链已准备就绪
                    window.dispatchEvent(new CustomEvent('blockchainReady', {
                        detail: { blockchainManager }
                    }));
                } else {
                    console.error('❌ Failed to auto-initialize blockchain manager');
                    
                    // 如果自动初始化失败，再次尝试
                    setTimeout(() => {
                        if (!blockchainManager.isConnected && !blockchainManager.initializing) {
                            console.log('🔄 Retrying blockchain initialization...');
                            blockchainManager.initialize().then(retrySuccess => {
                                if (retrySuccess) {
                                    console.log('✅ Blockchain manager initialized on retry');
                                    window.dispatchEvent(new CustomEvent('blockchainReady', {
                                        detail: { blockchainManager }
                                    }));
                                } else {
                                    console.error('❌ Blockchain initialization failed after retry');
                                }
                            });
                        }
                    }, 3000);
                }
            }).catch(error => {
                console.error('❌ Auto-initialization error:', error);
            });
        } else {
            console.log('⏭️ Skipping blockchain auto-initialization for page:', window.location.pathname, {
                needsBlockchain: needsBlockchain(),
                web3Available: typeof Web3 !== 'undefined',
                isConnected: blockchainManager.isConnected,
                initializing: blockchainManager.initializing
            });
        }
    }, 2000); // 增加延迟，确保页面完全加载
}