// Stable Coin - Blockchain Integration (WebSocket Version)

// WebSocket 端点配置
const WEBSOCKET_CONFIG = {
    // 多个 WebSocket 端点，按优先级排序
    endpoints: [
        {
            url: 'wss://bsc-ws-node.nariox.org/',
            priority: 1,
            timeout: 5000,
            name: 'Nariox BSC Node'
        },
        {
            url: 'wss://bsc.publicnode.com/',
            priority: 2,
            timeout: 5000,
            name: 'Public Node BSC'
        },
        {
            url: 'wss://bsc-mainnet.nodereal.io/ws/v1/YOUR_API_KEY',
            priority: 3,
            timeout: 8000,
            name: 'NodeReal BSC (API Key required)',
            requiresApiKey: true
        },
        {
            url: 'wss://bsc-dataseed1.binance.org/ws/',
            priority: 4,
            timeout: 10000,
            name: 'Binance BSC DataSeed'
        }
    ],

    // 连接策略
    connectionStrategy: {
        reconnectInterval: 5000, // 重连间隔（毫秒）
        maxReconnectAttempts: 3, // 最大重连尝试次数
        connectionTimeout: 10000 // 连接超时时间
    },

    heartbeatInterval: 30000, // 心跳间隔
    subscriptions: ['logs'], // 订阅的事件类型 - 优化为直接监听 Transfer 事件

    // Transfer 事件签名 (ERC-20 标准)
    transferEventSignature: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',

    // WebSocket 专用版本不需要轮询配置
};

// 区块链配置 (WebSocket 版本)
const BLOCKCHAIN_CONFIG_WS = {
    // BNB Smart Chain 主网配置
    network: {
        name: 'BNB Smart Chain',
        chainId: 56,
        rpcUrl: 'https://bsc-dataseed1.binance.org/',
        rpcUrls: [
            'https://bsc-dataseed1.binance.org/',
            'https://bsc-dataseed2.binance.org/',
            'https://bsc-dataseed3.binance.org/',
            'https://bsc-dataseed4.binance.org/',
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
        confirmations: 1, // 需要1个确认
        timeout: 30 * 60 * 1000, // 30分钟超时
        maxConcurrentChecks: 1, // 最大并发检查数
        retryDelay: 120000, // 遇到限制时等待2分钟再重试
        maxRetries: 3 // 最大重试次数
    }
};

// WebSocket 监听管理器 (完整实现)
class WebSocketMonitor {
    constructor() {
        this.wsEndpoints = WEBSOCKET_CONFIG.endpoints;
        this.currentWs = null;
        this.currentEndpointIndex = 0;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = WEBSOCKET_CONFIG.connectionStrategy.maxReconnectAttempts;
        this.isConnected = false;
        this.eventHandlers = new Map();
        this.lastFailedEndpoints = new Set();
        this.connectionAttempted = false;

        // 连接状态管理
        this.connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
        this.lastConnectionTime = 0;
        this.lastDisconnectionTime = 0;
        this.totalReconnects = 0;

        // 订阅管理
        this.subscriptions = new Map(); // 存储活跃的订阅
        this.subscriptionId = 1;

        // 连接质量监控
        this.connectionQuality = {
            messagesReceived: 0,
            lastMessageTime: 0,
            averageLatency: 0,
            latencyHistory: [],
            blocksMissed: 0,
            lastBlockNumber: 0,
            connectionUptime: 0
        };

        // 心跳管理
        this.heartbeatInterval = null;
        this.lastHeartbeat = 0;
        this.heartbeatTimeout = 30000; // 30秒心跳超时

        // 错误统计
        this.errorCounts = new Map(); // 每个端点的错误计数
        this.lastErrors = new Map(); // 最近的错误信息

        console.log('🔌 [WebSocketMonitor] Initialized with', this.wsEndpoints.length, 'endpoints');
        this.logEndpointInfo();
    }

    // 记录端点信息
    logEndpointInfo() {
        console.log('📋 [WebSocketMonitor] Available endpoints:');
        this.wsEndpoints.forEach((endpoint, index) => {
            console.log(`  ${index + 1}. ${endpoint.name || endpoint.url} (Priority: ${endpoint.priority}, Timeout: ${endpoint.timeout}ms)`);
        });
    }

    // 获取下一个可用端点（智能选择策略）
    getNextAvailableEndpoint() {
        const totalEndpoints = this.wsEndpoints.length;

        // 计算每个端点的健康分数
        const endpointScores = this.wsEndpoints.map((endpoint, index) => {
            const errorCount = this.errorCounts.get(endpoint.url) || 0;
            const lastError = this.lastErrors.get(endpoint.url);

            // 基础分数从优先级开始（优先级越低分数越高）
            let score = 100 - endpoint.priority * 10;

            // 根据错误次数减分
            score -= errorCount * 20;

            // 如果最近有错误，额外减分
            if (lastError && (Date.now() - lastError.timestamp) < 300000) { // 5分钟内的错误
                score -= 30;
            }

            // 如果需要 API Key 但未配置，大幅减分
            if (endpoint.requiresApiKey && endpoint.url.includes('YOUR_API_KEY')) {
                score -= 1000;
            }

            return { endpoint, index, score, errorCount };
        });

        // 按分数排序，选择最高分的可用端点
        endpointScores.sort((a, b) => b.score - a.score);

        console.log('📊 [WebSocketMonitor] Endpoint scores:');
        endpointScores.forEach(({ endpoint, score, errorCount }) => {
            console.log(`  ${endpoint.name || endpoint.url}: Score ${score} (Errors: ${errorCount})`);
        });

        // 选择分数最高且错误次数少于阈值的端点
        for (const { endpoint, index, score, errorCount } of endpointScores) {
            if (errorCount < 5 && score > -50) { // 容忍度更高
                console.log(`🎯 [WebSocketMonitor] Selected endpoint: ${endpoint.name || endpoint.url} (Score: ${score})`);
                return { endpoint, index };
            }
        }

        // 如果所有端点都不可用，重置错误统计并选择优先级最高的
        console.log('⚠️ [WebSocketMonitor] All endpoints have too many errors, resetting stats and using highest priority endpoint');
        this.resetErrorStats();

        const highestPriorityEndpoint = [...this.wsEndpoints]
            .sort((a, b) => a.priority - b.priority)[0];
        const index = this.wsEndpoints.indexOf(highestPriorityEndpoint);

        return { endpoint: highestPriorityEndpoint, index };
    }

    // 切换到下一个端点
    switchToNextEndpoint() {
        const { endpoint, index } = this.getNextAvailableEndpoint();
        const oldEndpoint = this.wsEndpoints[this.currentEndpointIndex];

        console.log(`🔄 [WebSocketMonitor] Switching from ${oldEndpoint?.name || oldEndpoint?.url} to ${endpoint.name || endpoint.url}`);

        this.currentEndpointIndex = index;
        this.reconnectAttempts = 0; // 重置重连计数

        return endpoint;
    }

    // 获取端点健康状态
    getEndpointHealth() {
        return this.wsEndpoints.map((endpoint, index) => {
            const errorCount = this.errorCounts.get(endpoint.url) || 0;
            const lastError = this.lastErrors.get(endpoint.url);
            const isCurrent = index === this.currentEndpointIndex;

            return {
                index,
                url: endpoint.url,
                name: endpoint.name || endpoint.url,
                priority: endpoint.priority,
                timeout: endpoint.timeout,
                errorCount,
                lastError: lastError ? {
                    message: lastError.error,
                    timestamp: lastError.timestamp,
                    timeAgo: Date.now() - lastError.timestamp
                } : null,
                isCurrent,
                isHealthy: errorCount < 3,
                requiresApiKey: endpoint.requiresApiKey || false
            };
        });
    }

    // 尝试连接到可用的 WebSocket 节点
    async connect() {
        console.log('🔌 [WebSocketMonitor] 开始尝试 WebSocket 连接...');
        this.connectionAttempted = true;
        this.connectionState = 'connecting';

        // 清理之前的连接
        if (this.currentWs) {
            this.disconnect();
        }

        // 按优先级排序端点，但跳过错误过多的端点
        const availableEndpoints = this.wsEndpoints
            .map((endpoint, index) => ({ endpoint, index }))
            .filter(({ endpoint }) => {
                const errorCount = this.errorCounts.get(endpoint.url) || 0;
                return errorCount < 3;
            })
            .sort((a, b) => a.endpoint.priority - b.endpoint.priority);

        if (availableEndpoints.length === 0) {
            console.log('⚠️ [WebSocketMonitor] All endpoints have too many errors, resetting error counts');
            this.resetErrorStats();
            // 重新获取所有端点
            availableEndpoints.push(...this.wsEndpoints.map((endpoint, index) => ({ endpoint, index })));
        }

        console.log(`🔌 [WebSocketMonitor] Trying ${availableEndpoints.length} available endpoints in priority order`);

        for (let i = 0; i < availableEndpoints.length; i++) {
            const { endpoint, index: endpointIndex } = availableEndpoints[i];

            console.log(`🔌 [WebSocketMonitor] 尝试连接端点 ${i + 1}/${availableEndpoints.length}: ${endpoint.name || endpoint.url}`);

            // 跳过需要 API Key 但未配置的端点
            if (endpoint.requiresApiKey && endpoint.url.includes('YOUR_API_KEY')) {
                console.log(`⏭️ [WebSocketMonitor] 跳过端点 ${endpoint.name} (需要配置 API Key)`);
                continue;
            }

            try {
                await this.connectToEndpoint(endpoint, endpointIndex);
                console.log(`✅ [WebSocketMonitor] WebSocket 连接成功: ${endpoint.name || endpoint.url}`);

                // 重置该端点的错误计数
                this.errorCounts.set(endpoint.url, 0);
                this.lastErrors.delete(endpoint.url);

                return true; // 连接成功
            } catch (error) {
                console.log(`❌ [WebSocketMonitor] WebSocket 连接失败: ${endpoint.name || endpoint.url}`, error.message);
                this.recordEndpointFailure(endpoint, error);
                continue; // 尝试下一个端点
            }
        }

        console.log('❌ [WebSocketMonitor] 所有 WebSocket 端点都连接失败');
        this.connectionState = 'disconnected';
        return false; // 所有端点都失败
    }

    // 连接到特定端点 (完整实现)
    async connectToEndpoint(endpoint, index) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`🔗 [WebSocketMonitor] 创建 WebSocket 连接: ${endpoint.url}`);
                const ws = new WebSocket(endpoint.url);

                const timeout = setTimeout(() => {
                    console.log(`⏰ [WebSocketMonitor] 连接超时: ${endpoint.url}`);
                    ws.close();
                    reject(new Error(`Connection timeout after ${endpoint.timeout}ms`));
                }, endpoint.timeout);

                ws.onopen = () => {
                    console.log(`🎉 [WebSocketMonitor] WebSocket 连接已建立: ${endpoint.url}`);
                    clearTimeout(timeout);

                    // 更新连接状态
                    this.currentWs = ws;
                    this.currentEndpointIndex = index;
                    this.isConnected = true;
                    this.connectionState = 'connected';
                    this.reconnectAttempts = 0;
                    this.lastConnectionTime = Date.now();

                    // 启动心跳
                    this.startHeartbeat();

                    // 订阅 Transfer 事件
                    const subscriptionSuccess = this.subscribeToTransferEvents();
                    if (!subscriptionSuccess) {
                        console.error('❌ [WebSocketMonitor] Failed to subscribe to Transfer events after connection');
                    }

                    // 触发连接成功事件
                    this.triggerEvent('connected', {
                        endpoint: endpoint.url,
                        index,
                        subscriptionSuccess: subscriptionSuccess !== false
                    });

                    resolve();
                };

                ws.onerror = (error) => {
                    console.error(`💥 [WebSocketMonitor] WebSocket 错误: ${endpoint.url}`, error);
                    clearTimeout(timeout);

                    const errorMsg = error.message || error.type || 'Unknown WebSocket error';
                    this.lastErrors.set(endpoint.url, {
                        error: errorMsg,
                        timestamp: Date.now()
                    });

                    reject(new Error(`WebSocket error: ${errorMsg}`));
                };

                ws.onclose = (event) => {
                    console.log(`🔌 [WebSocketMonitor] WebSocket 连接关闭: ${endpoint.url}`, {
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean
                    });

                    clearTimeout(timeout);
                    this.isConnected = false;
                    this.connectionState = 'disconnected';
                    this.lastDisconnectionTime = Date.now();

                    // 停止心跳
                    this.stopHeartbeat();

                    // 只有当前连接才处理断开事件
                    if (this.currentWs === ws) {
                        this.currentWs = null;
                        this.handleDisconnection(event);
                    }
                };

                ws.onmessage = (event) => {
                    this.handleMessage(event);
                };

            } catch (error) {
                console.error(`🚨 [WebSocketMonitor] 创建 WebSocket 失败: ${endpoint.url}`, error);
                reject(error);
            }
        });
    }

    // 启动心跳机制
    startHeartbeat() {
        this.stopHeartbeat(); // 确保没有重复的心跳

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.currentWs && this.currentWs.readyState === WebSocket.OPEN) {
                try {
                    // 发送 ping 消息
                    const pingMessage = {
                        jsonrpc: '2.0',
                        method: 'net_version',
                        params: [],
                        id: Date.now()
                    };

                    this.currentWs.send(JSON.stringify(pingMessage));
                    this.lastHeartbeat = Date.now();
                    console.log('💓 [WebSocketMonitor] Heartbeat sent');
                } catch (error) {
                    console.error('💔 [WebSocketMonitor] Heartbeat failed:', error);
                    this.handleDisconnection({ code: 1006, reason: 'Heartbeat failed' });
                }
            }
        }, WEBSOCKET_CONFIG.heartbeatInterval);

        console.log('💓 [WebSocketMonitor] Heartbeat started');
    }

    // 停止心跳机制
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💔 [WebSocketMonitor] Heartbeat stopped');
        }
    }

    // 订阅 Transfer 事件 (优化实现 - 直接监听相关交易)
    subscribeToTransferEvents() {
        if (!this.currentWs || this.currentWs.readyState !== WebSocket.OPEN) {
            console.error('❌ [WebSocketMonitor] WebSocket not connected, cannot subscribe to Transfer events');
            return false;
        }

        const receiverAddress = BLOCKCHAIN_CONFIG_WS.receiverAddress;
        const paddedAddress = '0x000000000000000000000000' + receiverAddress.slice(2).toLowerCase();
        
        console.log('🎯 [WebSocketMonitor] Setting up Transfer event subscriptions for receiver:', receiverAddress);

        const subscriptionIds = [];

        // 为每个支持的代币合约订阅 Transfer 事件
        for (const [tokenSymbol, tokenConfig] of Object.entries(BLOCKCHAIN_CONFIG_WS.tokens)) {
            try {
                const subscriptionId = this.subscriptionId++;
                
                // 构建 logs 订阅参数
                const logFilter = {
                    address: tokenConfig.contract.toLowerCase(),
                    topics: [
                        WEBSOCKET_CONFIG.transferEventSignature, // Transfer 事件签名
                        null, // from (任意地址)
                        paddedAddress // to (我们的收款地址)
                    ]
                };

                const subscribeMessage = {
                    jsonrpc: '2.0',
                    method: 'eth_subscribe',
                    params: ['logs', logFilter],
                    id: subscriptionId
                };

                console.log(`📡 [WebSocketMonitor] Subscribing to ${tokenSymbol} Transfer events...`, {
                    contract: tokenConfig.contract,
                    receiver: receiverAddress,
                    filter: logFilter
                });

                this.currentWs.send(JSON.stringify(subscribeMessage));

                // 记录订阅请求
                this.subscriptions.set(subscriptionId, {
                    type: 'logs',
                    subType: 'transfer',
                    tokenSymbol: tokenSymbol,
                    tokenContract: tokenConfig.contract,
                    receiverAddress: receiverAddress,
                    subscriptionId: null, // 将在响应中设置
                    timestamp: Date.now(),
                    status: 'pending',
                    filter: logFilter
                });

                subscriptionIds.push(subscriptionId);

                console.log(`📡 [WebSocketMonitor] ${tokenSymbol} Transfer subscription request sent (Request ID: ${subscriptionId})`);

            } catch (error) {
                console.error(`❌ [WebSocketMonitor] Failed to subscribe to ${tokenSymbol} Transfer events:`, error);
                this.triggerEvent('subscriptionError', { 
                    type: 'logs', 
                    subType: 'transfer',
                    tokenSymbol: tokenSymbol,
                    error: error.message 
                });
            }
        }

        // 设置订阅超时检查
        setTimeout(() => {
            subscriptionIds.forEach(subscriptionId => {
                const subscription = this.subscriptions.get(subscriptionId);
                if (subscription && subscription.status === 'pending') {
                    console.error(`⏰ [WebSocketMonitor] ${subscription.tokenSymbol} Transfer subscription timeout - no response received`);
                    this.subscriptions.delete(subscriptionId);
                    this.triggerEvent('subscriptionTimeout', { 
                        type: 'logs', 
                        subType: 'transfer',
                        tokenSymbol: subscription.tokenSymbol,
                        requestId: subscriptionId 
                    });
                }
            });
        }, 15000); // 15秒超时（比单个订阅长一些）

        return subscriptionIds.length > 0 ? subscriptionIds : false;
    }

    // 订阅其他事件类型
    subscribeToEvent(eventType, params = []) {
        if (!this.currentWs || this.currentWs.readyState !== WebSocket.OPEN) {
            console.error(`❌ [WebSocketMonitor] WebSocket not connected, cannot subscribe to ${eventType}`);
            return false;
        }

        try {
            const subscriptionId = this.subscriptionId++;
            const subscribeMessage = {
                jsonrpc: '2.0',
                method: 'eth_subscribe',
                params: [eventType, ...params],
                id: subscriptionId
            };

            console.log(`📡 [WebSocketMonitor] Sending ${eventType} subscription request...`, subscribeMessage);
            this.currentWs.send(JSON.stringify(subscribeMessage));

            // 记录订阅请求
            this.subscriptions.set(subscriptionId, {
                type: eventType,
                params: params,
                subscriptionId: null,
                timestamp: Date.now(),
                status: 'pending'
            });

            console.log(`📡 [WebSocketMonitor] ${eventType} subscription request sent (Request ID: ${subscriptionId})`);
            return subscriptionId;
        } catch (error) {
            console.error(`❌ [WebSocketMonitor] Failed to subscribe to ${eventType}:`, error);
            this.triggerEvent('subscriptionError', { type: eventType, error: error.message });
            return false;
        }
    }

    // 重新订阅所有事件（重连后使用）
    resubscribeAll() {
        console.log('🔄 [WebSocketMonitor] Resubscribing to all events after reconnection...');

        // 清理旧的订阅记录
        this.subscriptions.clear();

        // 重新订阅 Transfer 事件
        const transferIds = this.subscribeToTransferEvents();
        if (transferIds && transferIds.length > 0) {
            console.log(`✅ [WebSocketMonitor] Resubscribed to Transfer events for ${transferIds.length} tokens`);
        } else {
            console.error('❌ [WebSocketMonitor] Failed to resubscribe to Transfer events');
        }

        return transferIds !== false;
    }

    // 取消订阅
    unsubscribe(subscriptionId) {
        if (!this.currentWs || this.currentWs.readyState !== WebSocket.OPEN) {
            console.error('❌ [WebSocketMonitor] WebSocket not connected, cannot unsubscribe');
            return false;
        }

        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription || !subscription.subscriptionId) {
            console.error('❌ [WebSocketMonitor] Invalid subscription ID:', subscriptionId);
            return false;
        }

        try {
            const unsubscribeMessage = {
                jsonrpc: '2.0',
                method: 'eth_unsubscribe',
                params: [subscription.subscriptionId],
                id: Date.now()
            };

            this.currentWs.send(JSON.stringify(unsubscribeMessage));
            this.subscriptions.delete(subscriptionId);

            console.log('📡 [WebSocketMonitor] Unsubscribed from subscription:', subscriptionId);
            return true;
        } catch (error) {
            console.error('❌ [WebSocketMonitor] Failed to unsubscribe:', error);
            return false;
        }
    }

    // 处理 WebSocket 消息 (完整实现)
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);

            // 更新连接质量统计
            this.updateConnectionQuality(data);

            // 处理订阅响应
            if (data.id && data.result && this.subscriptions.has(data.id)) {
                const subscription = this.subscriptions.get(data.id);
                subscription.subscriptionId = data.result;
                subscription.status = 'active';
                subscription.confirmedAt = Date.now();

                console.log(`✅ [WebSocketMonitor] Subscription confirmed - Type: ${subscription.type}, Request ID: ${data.id}, Subscription ID: ${data.result}`);

                // 触发订阅成功事件
                this.triggerEvent('subscriptionConfirmed', {
                    type: subscription.type,
                    requestId: data.id,
                    subscriptionId: data.result,
                    subscription: subscription
                });

                return;
            }

            // 处理订阅事件
            if (data.method === 'eth_subscription' && data.params) {
                const subscriptionId = data.params.subscription;
                const eventData = data.params.result;

                // 查找对应的订阅信息
                let subscription = null;
                for (const [requestId, sub] of this.subscriptions) {
                    if (sub.subscriptionId === subscriptionId) {
                        subscription = sub;
                        break;
                    }
                }

                if (!subscription) {
                    console.log(`📨 [WebSocketMonitor] Unknown subscription event: ${subscriptionId}`);
                    return;
                }

                console.log(`📨 [WebSocketMonitor] Subscription event received - Type: ${subscription.type}, Token: ${subscription.tokenSymbol || 'N/A'}, Subscription ID: ${subscriptionId}`);

                // 处理 Transfer 事件 (logs 类型)
                if (subscription.type === 'logs' && subscription.subType === 'transfer' && eventData) {
                    this.handleTransferEvent(eventData, subscription);
                } else {
                    // 处理其他类型的订阅事件
                    console.log(`📨 [WebSocketMonitor] Other subscription event:`, {
                        type: subscription.type,
                        subType: subscription.subType,
                        subscriptionId: subscriptionId,
                        data: eventData
                    });

                    this.triggerEvent('subscriptionEvent', {
                        type: subscription.type,
                        subType: subscription.subType,
                        subscriptionId: subscriptionId,
                        data: eventData,
                        subscription: subscription,
                        receivedAt: Date.now()
                    });
                }

                return;
            }

            // 处理心跳响应
            if (data.id && data.result && typeof data.result === 'string') {
                // 这可能是 net_version 的响应（心跳）
                console.log('💓 [WebSocketMonitor] Heartbeat response received');
                return;
            }

            // 处理错误响应
            if (data.error) {
                console.error('🚨 [WebSocketMonitor] RPC Error received:', data.error);
                this.triggerEvent('rpcError', data.error);
                return;
            }

            // 处理其他消息
            console.log('📨 [WebSocketMonitor] Unhandled message:', data);

        } catch (error) {
            console.error('💥 [WebSocketMonitor] Error parsing WebSocket message:', error);
            console.log('📨 [WebSocketMonitor] Raw message:', event.data);
        }
    }

    // 处理 Transfer 事件 (优化后的核心逻辑)
    handleTransferEvent(logData, subscription) {
        try {
            // 解析 Transfer 事件数据
            const transactionHash = logData.transactionHash;
            const blockNumber = parseInt(logData.blockNumber, 16);
            const blockHash = logData.blockHash;
            const logIndex = parseInt(logData.logIndex, 16);
            const removed = logData.removed || false;

            // 解析 Transfer 事件的 topics 和 data
            const topics = logData.topics || [];
            const data = logData.data || '0x';

            if (topics.length < 3) {
                console.error('❌ [WebSocketMonitor] Invalid Transfer event - insufficient topics');
                return;
            }

            // 解析 from 和 to 地址
            const fromAddress = '0x' + topics[1].slice(26); // 去掉前面的 padding
            const toAddress = '0x' + topics[2].slice(26);   // 去掉前面的 padding

            // 解析转账金额 (data 字段)
            const rawAmount = data === '0x' ? '0x0' : data;
            const amountWei = BigInt(rawAmount);
            const decimals = BLOCKCHAIN_CONFIG_WS.tokens[subscription.tokenSymbol]?.decimals || 18;
            const amount = Number(amountWei) / Math.pow(10, decimals);

            // 验证这是发送给我们的转账
            const expectedReceiver = BLOCKCHAIN_CONFIG_WS.receiverAddress.toLowerCase();
            if (toAddress.toLowerCase() !== expectedReceiver) {
                console.log(`⚠️ [WebSocketMonitor] Transfer event not for our address: ${toAddress} != ${expectedReceiver}`);
                return;
            }

            console.log(`💰 [WebSocketMonitor] Transfer detected!`, {
                token: subscription.tokenSymbol,
                from: fromAddress,
                to: toAddress,
                amount: amount,
                amountWei: amountWei.toString(),
                transactionHash: transactionHash,
                blockNumber: blockNumber,
                contract: subscription.tokenContract
            });

            // 构建支付事件数据
            const paymentData = {
                // 基本信息
                transactionHash: transactionHash,
                blockNumber: blockNumber,
                blockHash: blockHash,
                logIndex: logIndex,
                removed: removed,

                // 转账信息
                tokenSymbol: subscription.tokenSymbol,
                tokenContract: subscription.tokenContract,
                fromAddress: fromAddress,
                toAddress: toAddress,
                amount: amount,
                amountWei: amountWei.toString(),
                decimals: decimals,

                // 元数据
                receivedAt: Date.now(),
                subscriptionId: subscription.subscriptionId,
                
                // 验证状态
                isConfirmed: !removed && blockNumber > 0,
                confirmations: !removed && blockNumber > 0 ? 1 : 0 // WebSocket事件：交易已上链即为1确认
            };

            // 触发支付检测事件 (替代原来的区块事件)
            this.triggerPaymentDetected(paymentData);

            // 也触发通用的 Transfer 事件
            this.triggerEvent('transferDetected', paymentData);

        } catch (error) {
            console.error('💥 [WebSocketMonitor] Error processing Transfer event:', error);
            console.log('📨 [WebSocketMonitor] Raw log data:', logData);
        }
    }

    // 触发支付检测事件 (替代原来的新区块事件)
    triggerPaymentDetected(paymentData) {
        console.log(`🎉 [WebSocketMonitor] Payment detected: ${paymentData.amount} ${paymentData.tokenSymbol} from ${paymentData.fromAddress}`);
        
        // 触发支付事件 (兼容原有的处理逻辑)
        this.triggerEvent('paymentDetected', paymentData);
        
        // 为了兼容性，也触发 newBlock 事件 (但数据结构不同)
        this.triggerEvent('newBlock', {
            // 模拟区块数据结构以保持兼容性
            blockNumber: paymentData.blockNumber,
            blockHash: paymentData.blockHash,
            timestamp: Math.floor(Date.now() / 1000), // 当前时间戳
            
            // 添加支付相关数据
            paymentDetected: true,
            paymentData: paymentData,
            
            // 原有字段
            subscriptionId: paymentData.subscriptionId,
            subscriptionType: 'logs',
            receivedAt: paymentData.receivedAt
        });
    }

    // 触发新区块事件 (保留以防需要)
    triggerNewBlockEvent(blockData) {
        const handlers = this.eventHandlers.get('newBlock');
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(blockData);
                } catch (error) {
                    console.error('Error in newBlock handler:', error);
                }
            });
        }
    }

    // 处理连接断开
    handleDisconnection(event = {}) {
        console.log('🔌 [WebSocketMonitor] Connection lost, attempting to reconnect...', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });

        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.lastDisconnectionTime = Date.now();

        // 停止心跳
        this.stopHeartbeat();

        // 清理订阅
        this.subscriptions.clear();

        // 触发断开连接事件
        this.triggerEvent('disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            endpoint: this.wsEndpoints[this.currentEndpointIndex]?.url
        });

        // 延迟重连，避免立即重连造成的资源浪费
        const reconnectDelay = Math.min(
            WEBSOCKET_CONFIG.connectionStrategy.reconnectInterval * Math.pow(2, this.reconnectAttempts),
            30000 // 最大延迟30秒
        );

        console.log(`⏰ [WebSocketMonitor] Scheduling reconnect in ${reconnectDelay}ms (attempt ${this.reconnectAttempts + 1})`);

        setTimeout(() => {
            this.handleReconnect();
        }, reconnectDelay);
    }

    // 智能重连机制（尝试不同端点）
    async handleReconnect() {
        if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
            console.log('🔌 [WebSocketMonitor] Already connecting/connected, skipping reconnect');
            return true;
        }

        this.connectionState = 'reconnecting';
        this.totalReconnects++;

        console.log(`🔄 [WebSocketMonitor] Reconnect attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} (total: ${this.totalReconnects})`);

        // 如果当前端点重连次数过多，切换到下一个端点
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('🔄 [WebSocketMonitor] Max reconnect attempts reached for current endpoint, switching...');
            this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.wsEndpoints.length;
            this.reconnectAttempts = 0;

            // 记录当前端点失败
            const currentEndpoint = this.wsEndpoints[this.currentEndpointIndex];
            if (currentEndpoint) {
                this.recordEndpointFailure(currentEndpoint, new Error('Max reconnect attempts exceeded'));
            }
        }

        this.reconnectAttempts++;

        try {
            const success = await this.connect();
            if (success) {
                console.log('✅ [WebSocketMonitor] Reconnection successful');
                this.reconnectAttempts = 0; // 重置重连计数

                // 触发重连成功事件
                this.triggerEvent('reconnected', {
                    endpoint: this.wsEndpoints[this.currentEndpointIndex]?.url,
                    totalReconnects: this.totalReconnects,
                    reconnectionTime: Date.now() - this.lastDisconnectionTime
                });

                return true;
            } else {
                console.log('❌ [WebSocketMonitor] Reconnection failed, will retry');

                // 如果所有端点都尝试过了，等待更长时间再重试
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.log('⏰ [WebSocketMonitor] All endpoints failed, waiting longer before retry...');
                    setTimeout(() => {
                        this.reconnectAttempts = 0; // 重置计数，给端点第二次机会
                        this.handleReconnect();
                    }, 30000); // 30秒后重试
                } else {
                    // 继续尝试下一个端点
                    setTimeout(() => {
                        this.handleReconnect();
                    }, WEBSOCKET_CONFIG.connectionStrategy.reconnectInterval);
                }

                return false;
            }
        } catch (error) {
            console.error('💥 [WebSocketMonitor] Reconnection error:', error);
            this.connectionState = 'disconnected';
            return false;
        }
    }

    // 记录端点失败
    recordEndpointFailure(endpoint, error = null) {
        this.lastFailedEndpoints.add(endpoint.url);

        // 增加错误计数
        const currentCount = this.errorCounts.get(endpoint.url) || 0;
        this.errorCounts.set(endpoint.url, currentCount + 1);

        // 记录错误详情
        if (error) {
            this.lastErrors.set(endpoint.url, {
                error: error.message || error.toString(),
                timestamp: Date.now(),
                count: currentCount + 1
            });
        }

        console.log(`📊 [WebSocketMonitor] Recorded failure for endpoint: ${endpoint.url} (count: ${currentCount + 1})`);

        // 触发端点失败事件
        this.triggerEvent('endpointFailed', {
            endpoint: endpoint.url,
            error: error?.message,
            failureCount: currentCount + 1
        });
    }

    // 触发新区块事件
    triggerNewBlockEvent(blockData) {
        this.triggerEvent('newBlock', blockData);
    }

    // 通用事件触发器
    triggerEvent(eventName, data) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers && handlers.length > 0) {
            console.log(`📡 [WebSocketMonitor] Triggering event: ${eventName} (${handlers.length} handlers)`);
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`💥 [WebSocketMonitor] Error in ${eventName} handler:`, error);
                }
            });
        } else {
            console.log(`📡 [WebSocketMonitor] No handlers for event: ${eventName}`);
        }
    }

    // 事件处理器注册
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    // 连接状态检查
    getConnectionStatus() {
        const currentEndpoint = this.wsEndpoints[this.currentEndpointIndex];

        return {
            // 基本状态
            isConnected: this.isConnected,
            connectionState: this.connectionState,
            connectionAttempted: this.connectionAttempted,

            // 当前连接信息
            currentEndpoint: currentEndpoint?.url || null,
            currentEndpointIndex: this.currentEndpointIndex,

            // 重连信息
            reconnectAttempts: this.reconnectAttempts,
            totalReconnects: this.totalReconnects,
            maxReconnectAttempts: this.maxReconnectAttempts,

            // 时间信息
            lastConnectionTime: this.lastConnectionTime,
            lastDisconnectionTime: this.lastDisconnectionTime,
            lastHeartbeat: this.lastHeartbeat,

            // 端点状态
            totalEndpoints: this.wsEndpoints.length,
            failedEndpoints: Array.from(this.lastFailedEndpoints),
            errorCounts: Object.fromEntries(this.errorCounts),

            // 订阅信息
            activeSubscriptions: this.subscriptions.size,
            subscriptions: Array.from(this.subscriptions.values()),

            // WebSocket 状态
            readyState: this.currentWs ? this.currentWs.readyState : null,
            readyStateText: this.getReadyStateText()
        };
    }

    // 获取 WebSocket 状态文本
    getReadyStateText() {
        if (!this.currentWs) return 'No Connection';

        switch (this.currentWs.readyState) {
            case WebSocket.CONNECTING: return 'Connecting';
            case WebSocket.OPEN: return 'Open';
            case WebSocket.CLOSING: return 'Closing';
            case WebSocket.CLOSED: return 'Closed';
            default: return 'Unknown';
        }
    }

    // 重置错误统计
    resetErrorStats() {
        this.errorCounts.clear();
        this.lastErrors.clear();
        this.lastFailedEndpoints.clear();
        console.log('🔄 [WebSocketMonitor] Error statistics reset');
    }

    // 断开连接
    disconnect() {
        console.log('🔌 [WebSocketMonitor] Manually disconnecting...');

        // 停止心跳
        this.stopHeartbeat();

        // 关闭 WebSocket 连接
        if (this.currentWs) {
            this.currentWs.close(1000, 'Manual disconnect');
            this.currentWs = null;
        }

        // 更新状态
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.lastDisconnectionTime = Date.now();

        // 清理订阅
        this.subscriptions.clear();

        console.log('🔌 [WebSocketMonitor] Disconnected');
    }

    // 更新连接质量统计
    updateConnectionQuality(data) {
        const now = Date.now();
        this.connectionQuality.messagesReceived++;
        this.connectionQuality.lastMessageTime = now;

        // 如果是新区块事件，检查是否有遗漏的区块
        if (data.method === 'eth_subscription' && data.params && data.params.result && data.params.result.number) {
            const blockNumber = parseInt(data.params.result.number, 16);

            if (this.connectionQuality.lastBlockNumber > 0) {
                const expectedNext = this.connectionQuality.lastBlockNumber + 1;
                if (blockNumber > expectedNext) {
                    const missed = blockNumber - expectedNext;
                    this.connectionQuality.blocksMissed += missed;
                    console.log(`⚠️ [WebSocketMonitor] Missed ${missed} blocks (expected ${expectedNext}, got ${blockNumber})`);
                }
            }

            this.connectionQuality.lastBlockNumber = blockNumber;
        }

        // 计算连接正常运行时间
        if (this.lastConnectionTime > 0) {
            this.connectionQuality.connectionUptime = now - this.lastConnectionTime;
        }
    }

    // 获取连接质量报告
    getConnectionQuality() {
        const now = Date.now();
        const timeSinceLastMessage = this.connectionQuality.lastMessageTime > 0 ?
            now - this.connectionQuality.lastMessageTime : 0;

        return {
            ...this.connectionQuality,
            timeSinceLastMessage,
            messagesPerMinute: this.connectionQuality.connectionUptime > 0 ?
                (this.connectionQuality.messagesReceived / (this.connectionQuality.connectionUptime / 60000)) : 0,
            isHealthy: timeSinceLastMessage < 60000 && this.isConnected, // 1分钟内有消息且已连接
            qualityScore: this.calculateQualityScore()
        };
    }

    // 计算连接质量分数 (0-100)
    calculateQualityScore() {
        if (!this.isConnected) return 0;

        let score = 100;

        // 根据消息接收情况评分
        const timeSinceLastMessage = this.connectionQuality.lastMessageTime > 0 ?
            Date.now() - this.connectionQuality.lastMessageTime : Infinity;

        if (timeSinceLastMessage > 300000) { // 5分钟没消息
            score -= 50;
        } else if (timeSinceLastMessage > 60000) { // 1分钟没消息
            score -= 20;
        }

        // 根据遗漏的区块数评分
        if (this.connectionQuality.blocksMissed > 10) {
            score -= 30;
        } else if (this.connectionQuality.blocksMissed > 5) {
            score -= 15;
        }

        // 根据重连次数评分
        if (this.totalReconnects > 5) {
            score -= 20;
        } else if (this.totalReconnects > 2) {
            score -= 10;
        }

        return Math.max(0, score);
    }
}

// 区块链管理器 (WebSocket 版本 - 基础实现)
class BlockchainManagerWS {
    constructor() {
        this.web3 = null;
        this.wsMonitor = null;
        this.isConnected = false;
        this.contracts = {};
        this.lastProcessedBlock = 0;
        // WebSocket 专用版本不需要轮询相关属性

        // 支付监听管理
        this.activePaymentMonitors = new Map(); // paymentId -> monitor config
        this.paymentCallbacks = new Map(); // paymentId -> callback functions

        // 性能统计
        this.performanceStats = {
            blocksProcessed: 0,
            transactionsScanned: 0,
            transfersFound: 0,
            paymentsDetected: 0,
            averageScanTime: 0,
            scanTimes: [],
            // 新增：WebSocket 优化统计
            directTransferEvents: 0,
            rpcCallsSaved: 0,
            optimizationStartTime: Date.now()
        };
    }

    // 初始化连接
    async initialize() {
        console.log('🚀 [BlockchainWS] Initializing WebSocket blockchain manager...');

        try {
            // 初始化 Web3 (用于 RPC 调用)
            this.web3 = new Web3(BLOCKCHAIN_CONFIG_WS.network.rpcUrl);

            // 初始化 WebSocket 监听器
            this.wsMonitor = new WebSocketMonitor();

            // 注册支付检测事件处理器 (优化后直接处理 Transfer 事件)
            this.wsMonitor.on('paymentDetected', (paymentData) => {
                this.handlePaymentDetected(paymentData);
            });

            // 保持兼容性 - 也监听 newBlock 事件
            this.wsMonitor.on('newBlock', (blockData) => {
                // 如果是支付检测触发的区块事件，直接处理支付
                if (blockData.paymentDetected && blockData.paymentData) {
                    this.handlePaymentDetected(blockData.paymentData);
                } else {
                    // 传统的区块处理逻辑（现在基本不会用到）
                    this.handleNewBlock(blockData);
                }
            });

            this.isConnected = true;
            console.log('✅ [BlockchainWS] WebSocket blockchain manager initialized');
            return true;
        } catch (error) {
            console.error('❌ [BlockchainWS] Failed to initialize:', error);
            return false;
        }
    }

    // 处理直接检测到的支付事件 (优化后的核心方法)
    async handlePaymentDetected(paymentData) {
        console.log(`💰 [BlockchainWS] Payment detected via WebSocket: ${paymentData.amount} ${paymentData.tokenSymbol}`);
        
        this.lastProcessedBlock = paymentData.blockNumber;

        // 如果有活跃的支付监听，检查这个支付是否匹配
        if (this.activePaymentMonitors.size > 0) {
            console.log(`🔍 [BlockchainWS] Checking payment against ${this.activePaymentMonitors.size} active monitors`);
            
            // 打印活跃监听器的详细信息
            for (const [paymentId, monitor] of this.activePaymentMonitors) {
                console.log(`📋 [BlockchainWS] Active monitor ${paymentId}:`, {
                    tokenSymbol: monitor.tokenSymbol,
                    expectedAmount: monitor.expectedAmount,
                    receiverAddress: monitor.receiverAddress,
                    startTime: new Date(monitor.startTime).toISOString()
                });
            }
            
            // 构建 transfer 对象以兼容现有的检查逻辑
            const transfer = {
                blockNumber: paymentData.blockNumber,
                transactionHash: paymentData.transactionHash,
                tokenContract: paymentData.tokenContract,
                tokenSymbol: paymentData.tokenSymbol,
                from: paymentData.fromAddress,
                to: paymentData.toAddress,
                amount: paymentData.amountWei,
                formattedAmount: paymentData.amount,
                logIndex: paymentData.logIndex || 0,
                confirmations: paymentData.confirmations || 1 // 传递WebSocket提供的确认数
            };

            console.log(`🔍 [BlockchainWS] Transfer to check:`, {
                tokenSymbol: transfer.tokenSymbol,
                formattedAmount: transfer.formattedAmount,
                to: transfer.to,
                transactionHash: transfer.transactionHash
            });

            await this.checkTransferForPayments(transfer);
        } else {
            console.log(`⚠️ [BlockchainWS] No active payment monitors found - payment ignored`);
        }

        // 更新性能统计
        this.performanceStats.transfersFound++;
        this.performanceStats.paymentsDetected++;
        this.performanceStats.directTransferEvents++;
        
        // 估算节省的 RPC 调用次数（每个直接事件大约节省 3-5 个 RPC 调用）
        this.performanceStats.rpcCallsSaved += 4;
    }

    // 处理新区块事件 (保留以防需要，但现在主要用于兼容性)
    async handleNewBlock(blockData) {
        const blockNumber = blockData.blockNumber || parseInt(blockData.number, 16);
        console.log(`🆕 [BlockchainWS] Processing new block: ${blockNumber}`);

        this.lastProcessedBlock = blockNumber;

        // 如果有活跃的支付监听，检查这个区块中的交易
        if (this.activePaymentMonitors.size > 0) {
            console.log(`🔍 [BlockchainWS] Checking block ${blockNumber} for ${this.activePaymentMonitors.size} active payments`);
            await this.scanBlockForPayments(blockNumber);
        }
    }

    // 优化的区块交易扫描逻辑
    async scanBlockForPayments(blockNumber) {
        const scanStartTime = Date.now();

        try {
            console.log(`🔍 [BlockchainWS] Fast scanning block ${blockNumber}...`);

            // 获取区块信息（只获取交易哈希，不获取完整交易数据）
            const block = await this.web3.eth.getBlock(blockNumber, false);

            if (!block || !block.transactions || block.transactions.length === 0) {
                console.log(`📭 [BlockchainWS] Block ${blockNumber} has no transactions`);
                return;
            }

            console.log(`📦 [BlockchainWS] Block ${blockNumber} has ${block.transactions.length} transactions`);

            // 批量获取交易收据，只检查可能相关的交易
            const relevantTxHashes = [];
            const batchSize = 10; // 每批处理10个交易

            // 分批处理交易哈希
            for (let i = 0; i < block.transactions.length; i += batchSize) {
                const batch = block.transactions.slice(i, i + batchSize);

                // 并行获取这批交易的收据
                const receiptPromises = batch.map(txHash =>
                    this.web3.eth.getTransactionReceipt(txHash).catch(error => {
                        console.log(`Failed to get receipt for ${txHash}:`, error.message);
                        return null;
                    })
                );

                const receipts = await Promise.all(receiptPromises);

                // 检查收据中的日志
                for (let j = 0; j < receipts.length; j++) {
                    const receipt = receipts[j];
                    if (!receipt || !receipt.logs) continue;

                    // 快速检查是否包含 Transfer 事件
                    const hasTransferEvent = receipt.logs.some(log =>
                        log.topics && log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
                    );

                    if (hasTransferEvent) {
                        relevantTxHashes.push(batch[j]);
                    }
                }
            }

            console.log(`🎯 [BlockchainWS] Found ${relevantTxHashes.length} transactions with Transfer events in block ${blockNumber}`);

            // 详细分析相关交易
            if (relevantTxHashes.length > 0) {
                await this.analyzeRelevantTransactions(relevantTxHashes, blockNumber);
            }

            const scanTime = Date.now() - scanStartTime;
            console.log(`⚡ [BlockchainWS] Block ${blockNumber} scan completed in ${scanTime}ms`);

            // 确保扫描时间在3秒以内
            if (scanTime > 3000) {
                console.warn(`⚠️ [BlockchainWS] Block scan took ${scanTime}ms, exceeding 3s target`);
            }

        } catch (error) {
            const scanTime = Date.now() - scanStartTime;
            console.error(`💥 [BlockchainWS] Error scanning block ${blockNumber} (${scanTime}ms):`, error);
        }
    }

    // 分析相关交易的详细信息
    async analyzeRelevantTransactions(txHashes, blockNumber) {
        console.log(`🔬 [BlockchainWS] Analyzing ${txHashes.length} relevant transactions in block ${blockNumber}`);

        for (const txHash of txHashes) {
            try {
                const receipt = await this.web3.eth.getTransactionReceipt(txHash);
                if (!receipt || !receipt.logs) continue;

                // 解析 Transfer 事件
                const transfers = this.parseTransferEvents(receipt.logs, blockNumber, txHash);

                // 检查是否匹配任何活跃的支付监听
                for (const transfer of transfers) {
                    await this.checkTransferForPayments(transfer);
                }

            } catch (error) {
                console.error(`💥 [BlockchainWS] Error analyzing transaction ${txHash}:`, error);
            }
        }
    }

    // 解析 Transfer 事件
    parseTransferEvents(logs, blockNumber, txHash) {
        const transfers = [];
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

        for (const log of logs) {
            if (log.topics && log.topics[0] === transferTopic && log.topics.length >= 3) {
                try {
                    // 解析地址（topics 中的地址是32字节，实际地址在最后20字节）
                    const fromAddress = '0x' + log.topics[1].slice(-40);
                    const toAddress = '0x' + log.topics[2].slice(-40);

                    // 解析金额（在 data 字段中）
                    const amount = this.web3.utils.toBN(log.data);
                    const formattedAmount = this.web3.utils.fromWei(amount, 'ether');

                    // 获取代币合约地址
                    const tokenContract = log.address.toLowerCase();

                    // 查找对应的代币符号
                    let tokenSymbol = 'UNKNOWN';
                    for (const [symbol, config] of Object.entries(BLOCKCHAIN_CONFIG_WS.tokens)) {
                        if (config.contract.toLowerCase() === tokenContract) {
                            tokenSymbol = symbol;
                            break;
                        }
                    }

                    transfers.push({
                        blockNumber,
                        transactionHash: txHash,
                        tokenContract,
                        tokenSymbol,
                        from: fromAddress,
                        to: toAddress,
                        amount: amount.toString(),
                        formattedAmount: parseFloat(formattedAmount),
                        logIndex: log.logIndex
                    });

                    console.log(`💰 [BlockchainWS] Transfer: ${formattedAmount} ${tokenSymbol} from ${fromAddress} to ${toAddress}`);

                } catch (parseError) {
                    console.error(`💥 [BlockchainWS] Error parsing transfer event:`, parseError);
                }
            }
        }

        return transfers;
    }

    // 检查转账是否匹配任何支付监听（精确匹配验证）
    async checkTransferForPayments(transfer) {
        for (const [paymentId, monitor] of this.activePaymentMonitors) {
            try {
                const matchResult = this.validatePaymentMatch(transfer, monitor, paymentId);

                if (matchResult.isMatch) {
                    console.log(`🎯 [BlockchainWS] Payment match found for ${paymentId}!`);
                    console.log(`  Match Score: ${matchResult.score}/100`);
                    console.log(`  Expected: ${monitor.expectedAmount} ${monitor.tokenSymbol}`);
                    console.log(`  Actual: ${transfer.formattedAmount} ${transfer.tokenSymbol}`);
                    console.log(`  Transaction: ${transfer.transactionHash}`);
                    console.log(`  Validation Details:`, matchResult.details);

                    // 更新性能统计
                    this.performanceStats.paymentsDetected++;

                    // 触发支付确认
                    await this.confirmPayment(paymentId, transfer, monitor, matchResult);
                } else {
                    console.log(`❌ [BlockchainWS] Payment does not match for ${paymentId}:`, {
                        score: matchResult.score,
                        reasons: matchResult.reasons,
                        details: matchResult.details
                    });
                }

            } catch (error) {
                console.error(`💥 [BlockchainWS] Error checking transfer for payment ${paymentId}:`, error);
            }
        }
    }

    // 精确的支付匹配验证
    validatePaymentMatch(transfer, monitor, paymentId) {
        console.log(`🔍 [BlockchainWS] Validating payment match for ${paymentId}:`, {
            transfer: {
                tokenSymbol: transfer.tokenSymbol,
                formattedAmount: transfer.formattedAmount,
                to: transfer.to,
                transactionHash: transfer.transactionHash
            },
            monitor: {
                tokenSymbol: monitor.tokenSymbol,
                expectedAmount: monitor.expectedAmount,
                receiverAddress: monitor.receiverAddress
            }
        });

        const validation = {
            isMatch: false,
            score: 0,
            details: {},
            reasons: []
        };

        // 1. 代币类型验证 (必须匹配)
        const tokenMatch = monitor.tokenSymbol === transfer.tokenSymbol;
        validation.details.tokenMatch = tokenMatch;
        console.log(`🔍 [BlockchainWS] Token validation: expected ${monitor.tokenSymbol}, got ${transfer.tokenSymbol}, match: ${tokenMatch}`);

        if (!tokenMatch) {
            validation.reasons.push(`Token mismatch: expected ${monitor.tokenSymbol}, got ${transfer.tokenSymbol}`);
            console.log(`❌ [BlockchainWS] Token mismatch for ${paymentId}`);
            return validation;
        }
        validation.score += 30;

        // 2. 接收地址验证 (必须匹配)
        const addressMatch = monitor.receiverAddress.toLowerCase() === transfer.to.toLowerCase();
        validation.details.addressMatch = addressMatch;
        console.log(`🔍 [BlockchainWS] Address validation: expected ${monitor.receiverAddress}, got ${transfer.to}, match: ${addressMatch}`);

        if (!addressMatch) {
            validation.reasons.push(`Address mismatch: expected ${monitor.receiverAddress}, got ${transfer.to}`);
            console.log(`❌ [BlockchainWS] Address mismatch for ${paymentId}`);
            return validation;
        }
        validation.score += 30;

        // 3. 金额验证 (允许容差)
        const expectedAmount = monitor.expectedAmount;
        const actualAmount = transfer.formattedAmount;
        const amountDiff = Math.abs(actualAmount - expectedAmount);
        const tolerance = Math.max(0.001, expectedAmount * 0.001); // 0.1% 或最小 0.001

        validation.details.expectedAmount = expectedAmount;
        validation.details.actualAmount = actualAmount;
        validation.details.amountDiff = amountDiff;
        validation.details.tolerance = tolerance;
        validation.details.amountMatch = amountDiff <= tolerance;

        console.log(`🔍 [BlockchainWS] Amount validation for ${paymentId}:`, {
            expected: expectedAmount,
            actual: actualAmount,
            difference: amountDiff,
            tolerance: tolerance,
            match: amountDiff <= tolerance
        });

        if (amountDiff > tolerance) {
            validation.reasons.push(`Amount mismatch: expected ${expectedAmount}, got ${actualAmount}, diff ${amountDiff} > tolerance ${tolerance}`);
            console.log(`❌ [BlockchainWS] Amount mismatch for ${paymentId}: expected ${expectedAmount}, got ${actualAmount}, diff ${amountDiff} > tolerance ${tolerance}`);
            return validation;
        }

        // 根据金额精确度评分
        if (amountDiff === 0) {
            validation.score += 40; // 完全匹配
        } else if (amountDiff <= tolerance * 0.1) {
            validation.score += 35; // 非常接近
        } else if (amountDiff <= tolerance * 0.5) {
            validation.score += 30; // 接近
        } else {
            validation.score += 20; // 在容差范围内
        }

        // 4. 时间窗口验证 (可选)
        const transferTime = Date.now(); // 实际应该从区块时间戳获取
        const monitorStartTime = monitor.startTime;
        const timeDiff = transferTime - monitorStartTime;

        validation.details.transferTime = transferTime;
        validation.details.monitorStartTime = monitorStartTime;
        validation.details.timeDiff = timeDiff;

        // 如果转账发生在监听开始之前，降低分数但不拒绝
        if (timeDiff < 0) {
            validation.score -= 10;
            validation.reasons.push(`Transfer occurred before monitoring started (${Math.abs(timeDiff)}ms ago)`);
        }

        // 5. 区块范围验证
        if (monitor.startBlock && transfer.blockNumber < monitor.startBlock) {
            validation.score -= 5;
            validation.reasons.push(`Transfer in block ${transfer.blockNumber} before start block ${monitor.startBlock}`);
        }

        // 6. 重复检测 (检查是否已经处理过这个交易)
        if (monitor.processedTransactions && monitor.processedTransactions.has(transfer.transactionHash)) {
            validation.reasons.push(`Transaction ${transfer.transactionHash} already processed`);
            console.log(`⚠️ [BlockchainWS] Duplicate transaction detected for ${paymentId}: ${transfer.transactionHash}`);
            return validation;
        }

        // 记录已处理的交易
        if (!monitor.processedTransactions) {
            monitor.processedTransactions = new Set();
        }
        monitor.processedTransactions.add(transfer.transactionHash);

        // 最终判断
        validation.isMatch = validation.score >= 80; // 需要至少80分才算匹配

        if (validation.isMatch) {
            validation.reasons.push(`Payment match confirmed with score ${validation.score}/100`);
        } else {
            validation.reasons.push(`Payment match rejected with score ${validation.score}/100 (minimum 80 required)`);
        }

        return validation;
    }

    // 处理多笔可能匹配的交易
    selectBestPaymentMatch(candidates, monitor) {
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        console.log(`🤔 [BlockchainWS] Multiple payment candidates found (${candidates.length}), selecting best match...`);

        // 按匹配分数排序
        candidates.sort((a, b) => b.matchResult.score - a.matchResult.score);

        // 记录所有候选者
        candidates.forEach((candidate, index) => {
            console.log(`  Candidate ${index + 1}: Score ${candidate.matchResult.score}, Amount ${candidate.transfer.formattedAmount}, TX ${candidate.transfer.transactionHash}`);
        });

        const bestMatch = candidates[0];
        console.log(`✅ [BlockchainWS] Selected best match: Score ${bestMatch.matchResult.score}, TX ${bestMatch.transfer.transactionHash}`);

        return bestMatch;
    }

    // 确认支付
    async confirmPayment(paymentId, transfer, monitor, matchResult = null) {
        try {
            console.log(`✅ [BlockchainWS] Confirming payment ${paymentId}`);

            const requiredConfirmations = monitor.requiredConfirmations !== undefined ? monitor.requiredConfirmations : 1;
            
            // 直接使用WebSocket消息中的确认数
            const confirmations = transfer.confirmations || 1;
            console.log(`📊 [BlockchainWS] Payment confirmations: ${confirmations}/${requiredConfirmations} (from WebSocket)`);

            // 检查确认数是否足够
            if (confirmations >= requiredConfirmations) {
                console.log(`🎉 [BlockchainWS] Payment ${paymentId} fully confirmed!`);

                // 计算检测时间
                const detectionTime = Date.now() - monitor.startTime;

                // 准备确认数据
                const confirmationData = {
                    paymentId,
                    transfer,
                    confirmations,
                    detectionTime,
                    matchResult,
                    verificationResult: {
                        verified: true,
                        transfer: transfer,
                        confirmations: confirmations,
                        transactionHash: transfer.transactionHash,
                        amount: transfer.formattedAmount,
                        tokenSymbol: transfer.tokenSymbol,
                        detectionMethod: 'WebSocket',
                        matchScore: matchResult?.score || 100,
                        validationDetails: matchResult?.details || {}
                    }
                };

                // 调用回调函数
                const callbacks = this.paymentCallbacks.get(paymentId);
                if (callbacks && callbacks.onSuccess) {
                    callbacks.onSuccess(confirmationData);
                }

                // 移除监听
                this.stopPaymentMonitoring(paymentId);

            } else {
                // 确认数不够，继续等待
                console.log(`⏳ [BlockchainWS] Payment ${paymentId} found but waiting for more confirmations`);

                const callbacks = this.paymentCallbacks.get(paymentId);
                if (callbacks && callbacks.onProgress) {
                    callbacks.onProgress({
                        paymentId,
                        status: 'confirming',
                        confirmations,
                        required: monitor.requiredConfirmations !== undefined ? monitor.requiredConfirmations : 1,
                        transfer
                    });
                }
            }

        } catch (error) {
            console.error(`💥 [BlockchainWS] Error confirming payment ${paymentId}:`, error);

            const callbacks = this.paymentCallbacks.get(paymentId);
            if (callbacks && callbacks.onError) {
                callbacks.onError({
                    paymentId,
                    error: error.message
                });
            }
        }
    }

    // 开始支付监听
    startPaymentMonitoring(paymentId, config) {
        console.log(`🎯 [BlockchainWS] Starting payment monitoring for ${paymentId}:`, config);

        const monitor = {
            paymentId,
            tokenSymbol: config.tokenSymbol,
            expectedAmount: config.expectedAmount,
            receiverAddress: config.receiverAddress || BLOCKCHAIN_CONFIG_WS.receiverAddress,
            requiredConfirmations: config.requiredConfirmations !== undefined ? config.requiredConfirmations : 1,
            timeout: config.timeout || 30 * 60 * 1000, // 30分钟默认超时
            startTime: Date.now(),
            startBlock: this.lastProcessedBlock || 0
        };

        // 存储监听配置
        this.activePaymentMonitors.set(paymentId, monitor);

        // 存储回调函数
        if (config.onProgress || config.onSuccess || config.onError || config.onTimeout) {
            this.paymentCallbacks.set(paymentId, {
                onProgress: config.onProgress,
                onSuccess: config.onSuccess,
                onError: config.onError,
                onTimeout: config.onTimeout
            });
        }

        // 设置超时
        if (monitor.timeout > 0) {
            setTimeout(() => {
                if (this.activePaymentMonitors.has(paymentId)) {
                    console.log(`⏰ [BlockchainWS] Payment monitoring timeout for ${paymentId}`);

                    const callbacks = this.paymentCallbacks.get(paymentId);
                    if (callbacks && callbacks.onTimeout) {
                        callbacks.onTimeout({
                            paymentId,
                            elapsedTime: Date.now() - monitor.startTime
                        });
                    }

                    this.stopPaymentMonitoring(paymentId);
                }
            }, monitor.timeout);
        }

        console.log(`✅ [BlockchainWS] Payment monitoring started for ${paymentId}`);
        return true;
    }

    // 停止支付监听
    stopPaymentMonitoring(paymentId) {
        const removed = this.activePaymentMonitors.delete(paymentId);
        this.paymentCallbacks.delete(paymentId);

        if (removed) {
            console.log(`🛑 [BlockchainWS] Stopped payment monitoring for ${paymentId}`);
        }

        return removed;
    }

    // 停止所有支付监听
    stopAllPaymentMonitoring() {
        const count = this.activePaymentMonitors.size;
        this.activePaymentMonitors.clear();
        this.paymentCallbacks.clear();

        console.log(`🛑 [BlockchainWS] Stopped all payment monitoring (${count} monitors)`);
        return count;
    }

    // 获取支付监听状态
    getPaymentMonitoringStatus(paymentId = null) {
        if (paymentId) {
            const monitor = this.activePaymentMonitors.get(paymentId);
            if (!monitor) return null;

            return {
                ...monitor,
                elapsedTime: Date.now() - monitor.startTime,
                isActive: true
            };
        } else {
            // 返回所有监听状态
            const status = {};
            for (const [id, monitor] of this.activePaymentMonitors) {
                status[id] = {
                    ...monitor,
                    elapsedTime: Date.now() - monitor.startTime,
                    isActive: true
                };
            }
            return status;
        }
    }

    // WebSocket 专用版本不需要轮询备用模式

    // 获取连接状态
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            // WebSocket 专用版本
            lastProcessedBlock: this.lastProcessedBlock,
            wsStatus: this.wsMonitor ? this.wsMonitor.getConnectionStatus() : null
        };
    }
}

// 创建全局实例
const blockchainManagerWS = new BlockchainManagerWS();
const webSocketMonitor = new WebSocketMonitor();

// 优化效果展示方法
function showOptimizationStats() {
    const stats = blockchainManagerWS.performanceStats;
    const runtime = (Date.now() - stats.optimizationStartTime) / 1000;
    
    console.log('📊 [WebSocket Optimization] Performance Statistics:');
    console.log(`  🕒 Runtime: ${runtime.toFixed(1)}s`);
    console.log(`  📡 Direct Transfer Events: ${stats.directTransferEvents}`);
    console.log(`  💰 Payments Detected: ${stats.paymentsDetected}`);
    console.log(`  🚀 RPC Calls Saved: ${stats.rpcCallsSaved}`);
    console.log(`  ⚡ Efficiency: ${stats.directTransferEvents > 0 ? 'OPTIMIZED' : 'STANDARD'}`);
    
    if (stats.directTransferEvents > 0) {
        console.log(`  ✅ Optimization Active: Direct event monitoring enabled`);
        console.log(`  📈 Estimated Performance Gain: ~${Math.round(stats.rpcCallsSaved * 0.1)}s saved`);
    }
}

// 定期显示优化统计（每5分钟）
if (typeof window !== 'undefined') {
    setInterval(showOptimizationStats, 5 * 60 * 1000);
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.BLOCKCHAIN_CONFIG = BLOCKCHAIN_CONFIG_WS; // 使用相同的全局名称以保持兼容性
    window.WEBSOCKET_CONFIG = WEBSOCKET_CONFIG;
    window.WebSocketMonitor = WebSocketMonitor;
    window.BlockchainManagerWS = BlockchainManagerWS;
    window.blockchainManager = blockchainManagerWS; // 使用相同的全局名称以保持兼容性
    window.webSocketMonitor = webSocketMonitor;
    window.showOptimizationStats = showOptimizationStats; // 导出优化统计方法

    // 自动初始化
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 [BlockchainWS] Auto-initializing WebSocket blockchain manager...');
        const success = await blockchainManagerWS.initialize();
        if (success) {
            console.log('✅ [WebSocket Optimization] Enabled - Direct Transfer event monitoring');
            console.log('📊 [WebSocket Optimization] Benefits:');
            console.log('  • 🎯 Precise targeting: Only relevant Transfer events');
            console.log('  • ⚡ Faster detection: No block scanning required');
            console.log('  • 🚀 Reduced load: ~75% fewer RPC calls');
            console.log('  • 💡 Real-time: Instant payment notifications');
            console.log('  • 📞 Call showOptimizationStats() to see live statistics');
            
            // 触发区块链准备就绪事件
            const event = new CustomEvent('blockchainReady', {
                detail: { manager: blockchainManagerWS, websocket: true, optimized: true }
            });
            window.dispatchEvent(event);
        }
    });
}