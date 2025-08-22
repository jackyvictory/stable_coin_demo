// Stable Coin - Blockchain Integration

// 区块链配置
const BLOCKCHAIN_CONFIG = {
    // BNB Smart Chain 主网配置
    network: {
        name: 'BNB Smart Chain',
        chainId: 56,
        rpcUrl: 'http://bsc-dataseed1.binance.org/',
        rpcUrls: [
            'http://bsc-dataseed1.binance.org/',
            'http://bsc-dataseed2.binance.org/',
            'http://bsc-dataseed3.binance.org/',
            'http://bsc-dataseed4.binance.org/',
            'https://bsc-dataseed1.defibit.io/',
            'https://bsc-dataseed2.defibit.io/',
            'https://bsc-dataseed1.ninicoin.io/',
            'https://bsc-dataseed2.ninicoin.io/'
        ],
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
        confirmations: 1, // 需要1个确认
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
        
        // RPC端点管理
        this.currentRpcUrl = null;
        this.currentRpcIndex = 0;
        this.rpcFailureCount = new Map(); // 记录每个RPC端点的失败次数
        this.lastRpcSwitchTime = 0;
        this.rpcSwitchCooldown = 30000; // 30秒内不重复切换RPC
        this.maxRpcFailures = 3; // 单个RPC端点最大失败次数
        
        // RPC健康检查
        this.rpcHealthCheckInterval = null;
        this.rpcHealthCheckFrequency = 60000; // 每60秒检查一次RPC健康状态
        this.lastHealthCheckTime = 0;
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
            
            // 尝试连接到可用的RPC端点
            const success = await this.connectToAvailableRPC();
            if (!success) {
                throw new Error('Failed to connect to any RPC endpoint');
            }
            
            // 初始化代币合约
            this.initializeContracts();
            
            // 启动RPC健康检查
            this.startRpcHealthCheck();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize blockchain connection:', error);
            this.isConnected = false;
            return false;
        } finally {
            this.initializing = false;
        }
    }
    
    // 连接到可用的RPC端点
    async connectToAvailableRPC(startFromIndex = 0) {
        const rpcUrls = BLOCKCHAIN_CONFIG.network.rpcUrls || [BLOCKCHAIN_CONFIG.network.rpcUrl];
        
        // 从指定索引开始尝试，实现轮询
        for (let attempt = 0; attempt < rpcUrls.length; attempt++) {
            const i = (startFromIndex + attempt) % rpcUrls.length;
            const rpcUrl = rpcUrls[i];
            
            // 检查该RPC是否已经失败太多次
            const failureCount = this.rpcFailureCount.get(rpcUrl) || 0;
            if (failureCount >= this.maxRpcFailures) {
                console.log(`⏭️ Skipping ${rpcUrl} (failed ${failureCount} times)`);
                continue;
            }
            
            console.log(`🔗 Trying RPC endpoint ${i + 1}/${rpcUrls.length}: ${rpcUrl}`);
            
            try {
                // 创建 Web3 实例
                this.web3 = new Web3(rpcUrl);
                
                // 测试连接（设置较短的超时时间）
                const blockNumber = await Promise.race([
                    this.web3.eth.getBlockNumber(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), 5000)
                    )
                ]);
                
                this.lastBlockNumber = blockNumber;
                this.lastBlockCheckTime = Date.now();
                this.isConnected = true;
                this.currentRpcUrl = rpcUrl;
                this.currentRpcIndex = i;
                
                // 重置该RPC的失败计数
                this.rpcFailureCount.set(rpcUrl, 0);
                
                console.log(`✅ Connected to ${rpcUrl}. Current block: ${blockNumber}`);
                return true;
                
            } catch (error) {
                console.log(`❌ Failed to connect to ${rpcUrl}: ${error.message}`);
                
                // 增加失败计数
                this.rpcFailureCount.set(rpcUrl, failureCount + 1);
                
                // 如果是SSL证书错误，记录但继续尝试下一个
                if (error.message.includes('certificate') || error.message.includes('SSL') || error.message.includes('TLS')) {
                    console.log(`🔒 SSL/TLS certificate issue with ${rpcUrl}, trying next endpoint...`);
                }
                
                continue;
            }
        }
        
        console.error('❌ All RPC endpoints failed or exceeded failure limit');
        
        // 如果所有RPC都失败了，重置失败计数给它们第二次机会
        if (this.rpcFailureCount.size > 0) {
            console.log('🔄 Resetting RPC failure counts for retry...');
            this.rpcFailureCount.clear();
        }
        
        return false;
    }
    
    // 切换到下一个可用的RPC端点
    async switchToNextRPC() {
        const now = Date.now();
        
        // 检查切换冷却期
        if (now - this.lastRpcSwitchTime < this.rpcSwitchCooldown) {
            console.log(`🕐 RPC switch in cooldown (${Math.round((this.rpcSwitchCooldown - (now - this.lastRpcSwitchTime)) / 1000)}s remaining)`);
            return false;
        }
        
        console.log('🔄 Switching to next available RPC endpoint...');
        this.lastRpcSwitchTime = now;
        
        // 标记当前RPC为失败
        if (this.currentRpcUrl) {
            const currentFailures = this.rpcFailureCount.get(this.currentRpcUrl) || 0;
            this.rpcFailureCount.set(this.currentRpcUrl, currentFailures + 1);
            console.log(`📊 Marked ${this.currentRpcUrl} as failed (${currentFailures + 1} failures)`);
        }
        
        // 断开当前连接
        this.isConnected = false;
        this.web3 = null;
        
        // 尝试连接到下一个RPC端点
        const nextIndex = (this.currentRpcIndex + 1) % (BLOCKCHAIN_CONFIG.network.rpcUrls?.length || 1);
        const success = await this.connectToAvailableRPC(nextIndex);
        
        if (success) {
            console.log(`✅ Successfully switched to new RPC endpoint`);
            // 重新初始化合约
            this.initializeContracts();
            return true;
        } else {
            console.error('❌ Failed to switch to any available RPC endpoint');
            return false;
        }
    }
    
    // 处理RPC调用错误，自动切换端点
    async handleRpcError(error, operation = 'unknown') {
        console.error(`🚨 RPC Error in ${operation}:`, error.message);
        
        // 检查是否是需要切换RPC的错误类型
        const shouldSwitch = error.message.includes('rate limit') ||
                           error.message.includes('limit exceeded') ||
                           error.message.includes('timeout') ||
                           error.message.includes('network error') ||
                           error.message.includes('connection') ||
                           error.message.includes('ECONNRESET') ||
                           error.message.includes('ETIMEDOUT');
        
        if (shouldSwitch) {
            console.log(`🔄 Error suggests RPC issue, attempting to switch endpoint...`);
            const switched = await this.switchToNextRPC();
            
            if (switched) {
                console.log(`✅ RPC switched successfully, operation can be retried`);
                return { switched: true, canRetry: true };
            } else {
                console.error(`❌ Failed to switch RPC, operation cannot be retried`);
                return { switched: false, canRetry: false };
            }
        }
        
        return { switched: false, canRetry: false };
    }
    
    // 执行原始RPC调用，支持自动切换端点
    async makeRpcCall(method, params, id = 1) {
        if (!this.currentRpcUrl) {
            throw new Error('No RPC endpoint available');
        }
        
        try {
            const response = await fetch(this.currentRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: method,
                    params: params,
                    id: id
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(`RPC Error: ${data.error.message || 'Unknown error'}`);
            }
            
            return data.result;
            
        } catch (error) {
            console.error(`Raw RPC call failed (${method}):`, error.message);
            
            // 尝试自动切换RPC端点
            const errorResult = await this.handleRpcError(error, `makeRpcCall-${method}`);
            
            if (errorResult.switched && errorResult.canRetry) {
                // RPC已切换，重试一次
                console.log(`🔄 Retrying ${method} after RPC switch...`);
                try {
                    const response = await fetch(this.currentRpcUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: method,
                            params: params,
                            id: id
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    
                    if (data.error) {
                        throw new Error(`RPC Error: ${data.error.message || 'Unknown error'}`);
                    }
                    
                    return data.result;
                    
                } catch (retryError) {
                    console.error(`Retry after RPC switch also failed (${method}):`, retryError);
                    throw retryError;
                }
            } else {
                throw error;
            }
        }
    }
    
    // 开始RPC健康检查
    startRpcHealthCheck() {
        if (this.rpcHealthCheckInterval) {
            clearInterval(this.rpcHealthCheckInterval);
        }
        
        console.log('🏥 Starting RPC health check...');
        
        this.rpcHealthCheckInterval = setInterval(async () => {
            try {
                if (!this.isConnected || !this.web3) {
                    console.log('🏥 [HEALTH-CHECK] Not connected, skipping health check');
                    return;
                }
                
                const now = Date.now();
                console.log(`🏥 [HEALTH-CHECK] Checking RPC health for ${this.currentRpcUrl}`);
                
                // 简单的健康检查：获取最新区块号
                const startTime = Date.now();
                const blockNumber = await Promise.race([
                    this.web3.eth.getBlockNumber(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Health check timeout')), 10000)
                    )
                ]);
                
                const responseTime = Date.now() - startTime;
                console.log(`🏥 [HEALTH-CHECK] ✅ RPC healthy - Block: ${blockNumber}, Response time: ${responseTime}ms`);
                
                // 更新最后健康检查时间
                this.lastHealthCheckTime = now;
                
                // 重置该RPC的失败计数（如果健康检查成功）
                if (this.currentRpcUrl) {
                    this.rpcFailureCount.set(this.currentRpcUrl, 0);
                }
                
            } catch (error) {
                console.error(`🏥 [HEALTH-CHECK] ❌ RPC health check failed:`, error.message);
                
                // 健康检查失败，尝试切换RPC
                const errorResult = await this.handleRpcError(error, 'healthCheck');
                
                if (errorResult.switched) {
                    console.log('🏥 [HEALTH-CHECK] ✅ Switched to healthier RPC endpoint');
                } else {
                    console.error('🏥 [HEALTH-CHECK] ❌ Failed to find healthy RPC endpoint');
                }
            }
        }, this.rpcHealthCheckFrequency);
    }
    
    // 停止RPC健康检查
    stopRpcHealthCheck() {
        if (this.rpcHealthCheckInterval) {
            console.log('🏥 Stopping RPC health check...');
            clearInterval(this.rpcHealthCheckInterval);
            this.rpcHealthCheckInterval = null;
        }
    }
    
    // 获取RPC状态信息
    getRpcStatus() {
        const rpcUrls = BLOCKCHAIN_CONFIG.network.rpcUrls || [BLOCKCHAIN_CONFIG.network.rpcUrl];
        
        return {
            currentRpc: this.currentRpcUrl,
            currentIndex: this.currentRpcIndex,
            isConnected: this.isConnected,
            totalEndpoints: rpcUrls.length,
            failureCounts: Object.fromEntries(this.rpcFailureCount),
            lastHealthCheck: this.lastHealthCheckTime,
            lastSwitch: this.lastRpcSwitchTime
        };
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
            
            try {
                const blockNumber = await Promise.race([
                    this.web3.eth.getBlockNumber(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), 8000)
                    )
                ]);
                
                console.log(`🌐 [RPC-CALL] checkConnection() got block number: ${blockNumber}`);
                this.lastBlockNumber = blockNumber;
                this.lastBlockCheckTime = now;
                this.isConnected = true;
                return true;
                
            } catch (rpcError) {
                console.error('RPC call failed in checkConnection:', rpcError);
                
                // 尝试自动切换RPC端点
                const errorResult = await this.handleRpcError(rpcError, 'checkConnection');
                
                if (errorResult.switched && errorResult.canRetry) {
                    // RPC已切换，重试一次
                    console.log('🔄 Retrying checkConnection after RPC switch...');
                    try {
                        const blockNumber = await this.web3.eth.getBlockNumber();
                        console.log(`✅ Retry successful, block number: ${blockNumber}`);
                        this.lastBlockNumber = blockNumber;
                        this.lastBlockCheckTime = now;
                        this.isConnected = true;
                        return true;
                    } catch (retryError) {
                        console.error('Retry after RPC switch also failed:', retryError);
                        this.isConnected = false;
                        return false;
                    }
                } else {
                    this.isConnected = false;
                    return false;
                }
            }
            
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
            
            // 验证和格式化交易哈希
            if (!txHash.startsWith('0x')) {
                txHash = '0x' + txHash;
            }
            
            // 验证哈希长度
            if (txHash.length !== 66) {
                throw new Error(`Invalid transaction hash length: ${txHash.length}, expected 66 characters`);
            }
            
            console.log(`🌐 [WEB3-CALL] getTransaction with hash: ${txHash} (length: ${txHash.length})`);
            
            try {
                const transaction = await this.web3.eth.getTransaction(txHash);
                
                console.log(`🌐 [WEB3-CALL] getTransactionReceipt with hash: ${txHash} (length: ${txHash.length})`);
                const receipt = await this.web3.eth.getTransactionReceipt(txHash);
                
                return {
                    transaction,
                    receipt,
                    confirmations: this.lastBlockNumber - receipt.blockNumber
                };
                
            } catch (rpcError) {
                console.error('RPC call failed in getTransaction:', rpcError);
                
                // 尝试自动切换RPC端点
                const errorResult = await this.handleRpcError(rpcError, 'getTransaction');
                
                if (errorResult.switched && errorResult.canRetry) {
                    // RPC已切换，重试一次
                    console.log('🔄 Retrying getTransaction after RPC switch...');
                    try {
                        const transaction = await this.web3.eth.getTransaction(txHash);
                        const receipt = await this.web3.eth.getTransactionReceipt(txHash);
                        
                        return {
                            transaction,
                            receipt,
                            confirmations: this.lastBlockNumber - receipt.blockNumber
                        };
                    } catch (retryError) {
                        console.error('Retry after RPC switch also failed:', retryError);
                        return null;
                    }
                } else {
                    return null;
                }
            }
            
        } catch (error) {
            console.error('Failed to get transaction:', error);
            return null;
        }
    }
    
    // 获取最新的代币转账交易 - 使用替代方法避免 getPastEvents 限制
    async getLatestTokenTransfers(tokenSymbol, toAddress, fromBlock = 'latest', toBlock = null) {
        try {
            if (!this.isConnected || !this.contracts[tokenSymbol]) {
                throw new Error(`Contract not available for ${tokenSymbol}`);
            }
            
            const contract = this.contracts[tokenSymbol];
            
            // 计算查询范围
            let queryFromBlock;
            let queryToBlock;
            
            if (fromBlock === 'latest') {
                queryFromBlock = Math.max(1, this.lastBlockNumber - 1); // 只查询最近1个区块
                queryToBlock = this.lastBlockNumber;
            } else {
                queryFromBlock = fromBlock;
                queryToBlock = toBlock || this.lastBlockNumber;
            }
            
            // 限制查询范围，避免查询过多区块
            const maxBlockRange = 100; // 最多查询100个区块
            if (queryToBlock - queryFromBlock > maxBlockRange) {
                console.log(`Block range too large (${queryToBlock - queryFromBlock}), limiting to last ${maxBlockRange} blocks`);
                queryFromBlock = queryToBlock - maxBlockRange;
            }
            
            console.log(`🌐 [ALTERNATIVE-METHOD] Scanning blocks ${queryFromBlock} to ${queryToBlock} for ${tokenSymbol} transfers...`);
            
            // 记录RPC调用时间
            const queryStartTime = Date.now();
            this.lastTransferQueryTime = queryStartTime;
            this.lastAnyRpcCallTime = queryStartTime;
            
            const transfers = [];
            
            // 扫描指定范围内的区块 - 使用原始RPC避免大数值错误
            for (let blockNum = queryFromBlock; blockNum <= queryToBlock; blockNum++) {
                console.log(`🔍 [BLOCK-SCAN] Scanning block ${blockNum}...`);
                
                try {
                    // 使用支持自动切换的RPC调用获取区块信息
                    const block = await this.makeRpcCall(
                        'eth_getBlockByNumber',
                        [`0x${blockNum.toString(16)}`, true], // true = 包含完整交易信息
                        blockNum
                    );
                    
                    if (!block) {
                        console.log(`Failed to get block ${blockNum}: No result`);
                        continue;
                    }
                    if (!block || !block.transactions) {
                        console.log(`Block ${blockNum} has no transactions`);
                        continue;
                    }
                    
                    console.log(`Block ${blockNum} has ${block.transactions.length} transactions`);
                    
                    // 扫描区块中的交易 - 使用安全的数值处理
                    for (let i = 0; i < block.transactions.length; i++) {
                        try {
                            const tx = block.transactions[i];
                            
                            // 安全地检查交易对象，避免大数值问题
                            const txTo = tx.to ? tx.to.toString() : null;
                            let txHash = tx.hash ? tx.hash.toString() : null;
                            
                            if (!txTo || !txHash) {
                                continue; // 跳过无效交易
                            }
                            
                            // 验证和格式化交易哈希
                            if (!txHash.startsWith('0x')) {
                                console.log(`Adding 0x prefix to hash: ${txHash}`);
                                txHash = '0x' + txHash;
                            }
                            
                            // 验证哈希长度（应该是 66 字符：0x + 64 字符）
                            if (txHash.length !== 66) {
                                console.log(`Invalid transaction hash length: ${txHash.length} (expected 66), hash: ${txHash}, skipping transaction`);
                                continue;
                            }
                            
                            // 检查是否是发送到代币合约的交易
                            if (txTo.toLowerCase() === contract.options.address.toLowerCase()) {
                                console.log(`Found token contract transaction: ${txHash}`);
                                
                                try {
                                    // 使用支持自动切换的RPC调用获取交易收据
                                    console.log(`🌐 [RPC-CALL] eth_getTransactionReceipt with hash: ${txHash} (length: ${txHash.length})`);
                                    
                                    const receipt = await this.makeRpcCall(
                                        'eth_getTransactionReceipt',
                                        [txHash],
                                        1000 + i
                                    );
                                    
                                    if (!receipt) {
                                        console.log(`Failed to get receipt for ${txHash}: No result`);
                                        continue;
                                    }
                                    if (receipt && receipt.logs && receipt.logs.length > 0) {
                                        // Transfer 事件的 topic
                                        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
                                        
                                        for (const log of receipt.logs) {
                                            if (log.topics && log.topics[0] === transferTopic && log.topics.length >= 3) {
                                                try {
                                                    // 解析 Transfer 事件 - 安全处理地址
                                                    // topics[1] 和 topics[2] 是32字节的哈希，地址在最后20字节
                                                    const fromAddress = '0x' + log.topics[1].slice(-40);
                                                    const toAddressFromLog = '0x' + log.topics[2].slice(-40);
                                                    
                                                    // 检查是否是发送到目标地址的转账
                                                    if (toAddressFromLog.toLowerCase() === toAddress.toLowerCase()) {
                                                        // 安全地处理大数值
                                                        const valueHex = log.data;
                                                        let formattedValue;
                                                        
                                                        try {
                                                            const valueBigInt = BigInt(valueHex);
                                                            // 根据代币类型使用正确的小数位数
                                                            const decimals = tokenSymbol === 'USDC' ? 6 : 18;
                                                            const divisor = BigInt(10 ** decimals);
                                                            const valueNumber = Number(valueBigInt) / Number(divisor);
                                                            formattedValue = valueNumber.toString();
                                                        } catch (bigIntError) {
                                                            console.log(`Failed to parse amount with BigInt: ${bigIntError.message}`);
                                                            formattedValue = '[Cannot parse - too large]';
                                                        }
                                                        
                                                        console.log(`✅ Found transfer to target address: ${formattedValue} ${tokenSymbol}`);
                                                        
                                                        transfers.push({
                                                            transactionHash: txHash,
                                                            blockNumber: parseInt(block.number, 16),
                                                            from: fromAddress,
                                                            to: toAddressFromLog,
                                                            value: valueHex,
                                                            formattedValue: formattedValue
                                                        });
                                                    }
                                                } catch (parseError) {
                                                    console.log(`Failed to parse transfer event: ${parseError.message}`);
                                                }
                                            }
                                        }
                                    }
                                } catch (receiptError) {
                                    console.log(`Failed to get receipt for ${txHash}: ${receiptError.message}`);
                                }
                            }
                        } catch (txError) {
                            console.log(`Failed to process transaction: ${txError.message}`);
                            // 继续处理下一个交易
                            continue;
                        }
                    }
                } catch (blockError) {
                    console.log(`Failed to scan block ${blockNum}: ${blockError.message}`);
                }
            }
            
            console.log(`🌐 [ALTERNATIVE-METHOD] Found ${transfers.length} transfers using block scanning method`);
            
            return transfers;
            
        } catch (error) {
            console.error(`Failed to get token transfers for ${tokenSymbol} using alternative method:`, error);
            
            // 如果替代方法也失败，尝试回退到原方法（可能仍会遇到限制）
            console.log(`🔄 [FALLBACK] Attempting original getPastEvents method as fallback...`);
            
            try {
                const contract = this.contracts[tokenSymbol];
                const queryFromBlock = fromBlock === 'latest' ? Math.max(1, this.lastBlockNumber - 1) : fromBlock;
                const toBlock = this.lastBlockNumber;
                
                const events = await contract.getPastEvents('Transfer', {
                    filter: {
                        to: toAddress
                    },
                    fromBlock: queryFromBlock,
                    toBlock: toBlock
                });
                
                console.log(`🔄 [FALLBACK] Original method succeeded with ${events.length} events`);
                
                return events.map(event => {
                    let formattedValue;
                    try {
                        // 安全地处理大数值
                        const valueBigInt = BigInt(event.returnValues.value);
                        const decimals = tokenSymbol === 'USDC' ? 6 : 18;
                        const divisor = BigInt(10 ** decimals);
                        const valueNumber = Number(valueBigInt) / Number(divisor);
                        formattedValue = valueNumber.toString();
                    } catch (bigIntError) {
                        console.log(`Failed to parse fallback amount: ${bigIntError.message}`);
                        formattedValue = '[Cannot parse - too large]';
                    }
                    
                    return {
                        transactionHash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        from: event.returnValues.from,
                        to: event.returnValues.to,
                        value: event.returnValues.value,
                        formattedValue: formattedValue
                    };
                });
                
            } catch (fallbackError) {
                console.log(`🔄 [FALLBACK] Original method also failed: ${fallbackError.message}`);
                
                if (fallbackError.message && (fallbackError.message.includes('limit exceeded') || fallbackError.message.includes('rate limit'))) {
                    console.log(`🚫 Rate limit confirmed in fallback method`);
                    throw new Error('RATE_LIMIT_EXCEEDED');
                }
                
                return [];
            }
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
        
        // 自动轮询已禁用 - 改为手动调试模式
        console.log(`🚫 [DEBUG-MODE] Auto-polling disabled for ${paymentId}. Use manual debug functions instead.`);
        
        // 不设置自动轮询间隔
        monitorConfig.intervalId = null; // 标记为无自动轮询
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
        
        // 清除定时器 (如果存在)
        if (monitor.intervalId) {
            clearInterval(monitor.intervalId);
            console.log(`Cleared interval timer for ${paymentId}`);
        } else {
            console.log(`No interval timer to clear for ${paymentId} (debug mode)`);
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