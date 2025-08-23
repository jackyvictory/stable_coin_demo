// Stable Coin - QR Code Page JavaScript (WebSocket Version)

// 全局变量
let paymentData = null;
let countdownInterval = null;
let paymentListenerWS = null;
let isMonitoringEnabled = true; // 监控启用状态

// WebSocket 控制按钮处理 - 管理页面自动创建的连接
function handleWebSocketControl() {
    const button = document.getElementById('ws-main-control-button');
    if (!button) return;
    
    if (window.blockchainManager && window.blockchainManager.wsMonitor) {
        const wsMonitor = window.blockchainManager.wsMonitor;
        
        if (wsMonitor.isConnected) {
            // 记录断开操作开始
            addWebSocketDebugMessage('🔌 Manual disconnect initiated', 'websocket', {
                currentEndpoint: wsMonitor.wsEndpoints?.[wsMonitor.currentEndpointIndex]?.name || 'Unknown',
                connectionState: wsMonitor.connectionState,
                isActive: wsMonitor.isConnected
            });
            
            // 断开页面自动创建的连接
            wsMonitor.disconnect();
            button.textContent = '🔌 Connect';
            button.style.background = '#28a745';
            addWebSocketDebugMessage('WebSocket connection closed', 'warning', {
                reason: 'Manual disconnect',
                previousState: 'connected'
            });
            
            // 停止支付监听
            if (paymentListenerWS && paymentListenerWS.isActive) {
                addWebSocketDebugMessage('Stopping payment monitoring...', 'warning');
                paymentListenerWS.stopMonitoring();
                addWebSocketDebugMessage('Payment monitoring stopped successfully', 'warning', {
                    wasActive: true,
                    paymentId: paymentData?.paymentId || 'Unknown'
                });
            } else {
                addWebSocketDebugMessage('No active payment monitoring to stop', 'info');
            }
            
            // 更新页面状态
            updatePaymentStatus('error', 'Disconnected from blockchain');
            addWebSocketDebugMessage('Page status updated to disconnected', 'info');
            
        } else {
            // 记录重连操作开始
            addWebSocketDebugMessage('🔌 Manual reconnect initiated', 'websocket', {
                previousState: wsMonitor.connectionState,
                availableEndpoints: wsMonitor.wsEndpoints?.length || 0
            });
            
            // 检查监控是否被禁用
            if (!isMonitoringEnabled) {
                addWebSocketDebugMessage('❌ Cannot reconnect - monitoring is disabled', 'warning', {
                    reason: 'Monitoring has been manually stopped',
                    suggestion: 'Use Start Monitoring button to re-enable'
                });
                return;
            }
            
            // 重新连接并恢复支付监听
            button.textContent = '⏳ Connecting...';
            button.style.background = '#6c757d';
            addWebSocketDebugMessage('Attempting WebSocket reconnection...', 'websocket', {
                endpoints: wsMonitor.wsEndpoints?.map(ep => ep.name || ep.url) || [],
                targetEndpoint: wsMonitor.wsEndpoints?.[0]?.name || 'Unknown',
                monitoringEnabled: isMonitoringEnabled
            });
            
            wsMonitor.connect().then(success => {
                if (success) {
                    button.textContent = '🔌 Disconnect';
                    button.style.background = '#dc3545';
                    
                    const connectionDetails = {
                        endpoint: wsMonitor.wsEndpoints?.[wsMonitor.currentEndpointIndex]?.name || 'Unknown',
                        endpointIndex: wsMonitor.currentEndpointIndex,
                        connectionState: wsMonitor.connectionState,
                        readyState: wsMonitor.ws?.readyState
                    };
                    
                    addWebSocketDebugMessage('WebSocket reconnection successful', 'success', connectionDetails);
                    
                    // 恢复支付监听
                    if (paymentData && !paymentListenerWS?.isActive) {
                        addWebSocketDebugMessage('Restoring payment monitoring...', 'info', {
                            paymentId: paymentData.paymentId,
                            targetAddress: paymentData.walletAddress,
                            expectedAmount: paymentData.price
                        });
                        restartPaymentMonitoring();
                    } else if (!paymentData) {
                        addWebSocketDebugMessage('No payment data available for monitoring', 'warning');
                    } else if (paymentListenerWS?.isActive) {
                        addWebSocketDebugMessage('Payment monitoring already active', 'info');
                    }
                } else {
                    button.textContent = '🔌 Connect';
                    button.style.background = '#28a745';
                    addWebSocketDebugMessage('WebSocket reconnection failed', 'error', {
                        reason: 'All endpoints failed',
                        attemptedEndpoints: wsMonitor.wsEndpoints?.length || 0
                    });
                }
            }).catch(error => {
                button.textContent = '🔌 Connect';
                button.style.background = '#28a745';
                addWebSocketDebugMessage('WebSocket reconnection error', 'error', {
                    error: error.message,
                    stack: error.stack?.split('\n')[0]
                });
            });
        }
    } else {
        addWebSocketDebugMessage('Blockchain manager not available', 'error', {
            hasBlockchainManager: !!window.blockchainManager,
            hasWsMonitor: !!(window.blockchainManager?.wsMonitor)
        });
    }
}

// 切换 WebSocket 调试信息显示
function toggleWebSocketDebugInfo() {
    const debugPanel = document.getElementById('ws-debug-messages');
    if (!debugPanel) return;
    
    if (debugPanel.style.display === 'none') {
        debugPanel.style.display = 'block';
    } else {
        debugPanel.style.display = 'none';
    }
}

// 清除 WebSocket 调试消息
function clearWebSocketDebugMessages() {
    const debugContent = document.getElementById('ws-debug-content');
    if (debugContent) {
        debugContent.innerHTML = '<div style="color: #6c757d; font-style: italic;">WebSocket messages will appear here...</div>';
    }
}

// WebSocket调试消息存储 (页面加载时就开始记录)
let wsDebugMessages = [];

// 添加 WebSocket 调试消息 (增强版 - 始终记录)
function addWebSocketDebugMessage(message, type = 'info', details = null) {
    const timestamp = new Date().toLocaleTimeString();
    
    // 获取图标
    let icon = '';
    switch (type) {
        case 'success': icon = '✅'; break;
        case 'error': icon = '❌'; break;
        case 'warning': icon = '⚠️'; break;
        case 'websocket': icon = '🔌'; break;
        case 'heartbeat': icon = '💓'; break;
        case 'message': icon = '📨'; break;
        case 'block': icon = '🧱'; break;
        case 'transaction': icon = '💰'; break;
        default: icon = 'ℹ️';
    }
    
    // 存储到全局数组 (始终记录，无论调试面板是否打开)
    const debugMessage = {
        timestamp,
        message,
        type,
        details,
        icon,
        fullText: `${icon} [${timestamp}] ${message}`
    };
    
    wsDebugMessages.push(debugMessage);
    
    // 限制消息数量，保留最新的100条
    if (wsDebugMessages.length > 100) {
        wsDebugMessages = wsDebugMessages.slice(-100);
    }
    
    // 如果调试面板存在且可见，实时更新显示
    const debugContent = document.getElementById('ws-debug-content');
    if (debugContent) {
        updateWebSocketDebugDisplay();
    }
    
    // 同时输出到控制台以便开发调试
    console.log(`[WebSocket Debug] ${message}`, details || '');
}

// Debug 功能函数
function toggleDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    const toggleBtn = document.getElementById('debug-toggle-btn');
    
    if (!debugPanel || !toggleBtn) {
        console.error('Debug panel or toggle button not found');
        return;
    }
    
    const isHidden = debugPanel.style.display === 'none';
    
    if (isHidden) {
        debugPanel.style.display = 'block';
        toggleBtn.innerHTML = '⚙️ Hide Debug';
        toggleBtn.style.opacity = '1';
        
        // 更新WebSocket状态信息
        updateWebSocketStatusInfo();
    } else {
        debugPanel.style.display = 'none';
        toggleBtn.innerHTML = '⚙️ Debug';
        toggleBtn.style.opacity = '0.6';
    }
}

// 重启支付监听
function restartPaymentMonitoring() {
    if (!paymentData) {
        addWebSocketDebugMessage('Cannot restart payment monitoring', 'error', {
            reason: 'No payment data available',
            hasPaymentData: false
        });
        return;
    }
    
    addWebSocketDebugMessage('🔄 Restarting payment monitoring...', 'info', {
        paymentId: paymentData.paymentId,
        walletAddress: paymentData.walletAddress,
        expectedAmount: paymentData.price,
        tokenSymbol: paymentData.selectedPayment?.symbol,
        network: paymentData.selectedNetwork?.name
    });
    
    // 重新初始化支付监听器
    initializePaymentListener().then(() => {
        addWebSocketDebugMessage('✅ Payment monitoring restarted successfully', 'success', {
            monitoringMode: 'WebSocket',
            isActive: paymentListenerWS?.isActive || false,
            wsConnected: window.blockchainManager?.wsMonitor?.isConnected || false
        });
        
        // 记录监听目标信息
        addWebSocketDebugMessage('Payment monitoring targets configured', 'info', {
            targetAddress: paymentData.walletAddress,
            expectedAmount: `${paymentData.price} ${paymentData.selectedPayment?.symbol}`,
            tokenContract: paymentData.selectedPayment?.contractAddress,
            network: paymentData.selectedNetwork?.name,
            chainId: paymentData.selectedNetwork?.chainId
        });
        
    }).catch(error => {
        addWebSocketDebugMessage('❌ Failed to restart payment monitoring', 'error', {
            error: error.message,
            paymentId: paymentData?.paymentId,
            hasBlockchainManager: !!window.blockchainManager,
            hasWsMonitor: !!(window.blockchainManager?.wsMonitor)
        });
    });
}

// WebSocket 消息拦截器 - 监听所有 WebSocket 交互
function setupWebSocketMessageInterceptor() {
    if (!window.blockchainManager || !window.blockchainManager.wsMonitor) {
        return;
    }
    
    const wsMonitor = window.blockchainManager.wsMonitor;
    
    // 拦截 WebSocket 连接事件
    const originalConnect = wsMonitor.connect.bind(wsMonitor);
    wsMonitor.connect = async function(...args) {
        addWebSocketDebugMessage('Initiating WebSocket connection...', 'websocket', {
            endpoints: this.wsEndpoints?.length || 0,
            currentEndpoint: this.currentEndpointIndex
        });
        
        const result = await originalConnect(...args);
        
        // 记录连接结果
        if (result && this.ws) {
            addWebSocketDebugMessage('✅ WebSocket connection attempt successful', 'success', {
                endpoint: this.wsEndpoints?.[this.currentEndpointIndex]?.name || 'Unknown',
                endpointUrl: this.wsEndpoints?.[this.currentEndpointIndex]?.url,
                endpointIndex: this.currentEndpointIndex,
                totalEndpoints: this.wsEndpoints?.length || 0,
                readyState: this.ws.readyState,
                timestamp: new Date().toISOString()
            });
        } else {
            addWebSocketDebugMessage('❌ WebSocket connection attempt failed', 'error', {
                attemptedEndpoint: this.wsEndpoints?.[this.currentEndpointIndex]?.name || 'Unknown',
                endpointUrl: this.wsEndpoints?.[this.currentEndpointIndex]?.url,
                endpointIndex: this.currentEndpointIndex,
                totalEndpoints: this.wsEndpoints?.length || 0,
                hasWebSocket: !!this.ws,
                connectionResult: result,
                timestamp: new Date().toISOString()
            });
        }
        
        if (result && this.ws) {
            // 拦截 WebSocket 消息
            const originalOnMessage = this.ws.onmessage;
            this.ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    // 检测心跳消息
                    if (data.type === 'ping' || data.type === 'pong') {
                        addWebSocketDebugMessage(`💓 Heartbeat ${data.type}`, 'heartbeat', {
                            type: data.type,
                            timestamp: data.timestamp || new Date().toISOString(),
                            dataSize: event.data.length + ' bytes',
                            connectionHealth: 'Good'
                        });
                    }
                    // 检测订阅消息
                    else if (data.method === 'eth_subscription') {
                        const isBlockData = data.params?.result?.number;
                        const messageType = isBlockData ? 'block' : 'transaction';
                        const messageIcon = isBlockData ? '🧱' : '💰';
                        
                        addWebSocketDebugMessage(`${messageIcon} Subscription message`, messageType, {
                            subscription: data.params?.subscription,
                            blockNumber: isBlockData ? parseInt(data.params.result.number, 16) : undefined,
                            transactionHash: !isBlockData ? data.params?.result?.hash : undefined,
                            dataSize: event.data.length + ' bytes'
                        });
                    }
                    // 检测RPC响应
                    else if (data.id && (data.result !== undefined || data.error)) {
                        addWebSocketDebugMessage('📨 RPC response received', 'message', {
                            id: data.id,
                            method: data.method || 'unknown',
                            hasResult: data.result !== undefined,
                            hasError: !!data.error,
                            error: data.error?.message || data.error,
                            dataSize: event.data.length + ' bytes'
                        });
                    }
                    // 其他消息
                    else {
                        addWebSocketDebugMessage('📨 WebSocket message received', 'message', {
                            method: data.method,
                            id: data.id,
                            type: data.type,
                            result: data.result ? 'Present' : 'None',
                            error: data.error || 'None',
                            dataSize: event.data.length + ' bytes'
                        });
                    }
                } catch (e) {
                    addWebSocketDebugMessage('📨 WebSocket raw message received', 'message', {
                        data: event.data.substring(0, 200) + (event.data.length > 200 ? '...' : ''),
                        size: event.data.length + ' bytes',
                        parseError: e.message
                    });
                }
                
                if (originalOnMessage) {
                    originalOnMessage.call(this, event);
                }
            };
            
            // 拦截 WebSocket 发送
            const originalSend = this.ws.send.bind(this.ws);
            this.ws.send = function(data) {
                try {
                    const parsedData = JSON.parse(data);
                    
                    // 检测心跳消息
                    if (parsedData.type === 'ping' || parsedData.type === 'pong') {
                        addWebSocketDebugMessage(`💓 Sending heartbeat ${parsedData.type}`, 'heartbeat', {
                            type: parsedData.type,
                            timestamp: parsedData.timestamp || new Date().toISOString(),
                            dataSize: data.length + ' bytes'
                        });
                    }
                    // 检测订阅请求
                    else if (parsedData.method === 'eth_subscribe') {
                        addWebSocketDebugMessage('🔔 Subscription request sent', 'websocket', {
                            method: parsedData.method,
                            id: parsedData.id,
                            subscriptionType: parsedData.params?.[0],
                            params: parsedData.params,
                            dataSize: data.length + ' bytes'
                        });
                    }
                    // 检测取消订阅请求
                    else if (parsedData.method === 'eth_unsubscribe') {
                        addWebSocketDebugMessage('🔕 Unsubscribe request sent', 'websocket', {
                            method: parsedData.method,
                            id: parsedData.id,
                            subscriptionId: parsedData.params?.[0],
                            dataSize: data.length + ' bytes'
                        });
                    }
                    // 其他RPC请求
                    else {
                        addWebSocketDebugMessage('🔌 WebSocket message sent', 'websocket', {
                            method: parsedData.method,
                            id: parsedData.id,
                            params: parsedData.params ? 'Present' : 'None',
                            dataSize: data.length + ' bytes'
                        });
                    }
                } catch (e) {
                    addWebSocketDebugMessage('🔌 WebSocket raw message sent', 'websocket', {
                        data: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
                        size: data.length + ' bytes',
                        parseError: e.message
                    });
                }
                
                return originalSend(data);
            };
            
            // 监听连接状态变化
            this.ws.onopen = function(event) {
                const wsMonitor = window.blockchainManager?.wsMonitor;
                addWebSocketDebugMessage('🟢 WebSocket connection established', 'success', {
                    readyState: this.readyState,
                    url: this.url,
                    protocol: this.protocol || 'none',
                    endpoint: wsMonitor?.wsEndpoints?.[wsMonitor?.currentEndpointIndex]?.name || 'Unknown',
                    endpointIndex: wsMonitor?.currentEndpointIndex,
                    timestamp: new Date().toISOString()
                });
                
                // 更新按钮状态
                updateWebSocketControlButton();
            };
            
            this.ws.onclose = function(event) {
                const wsMonitor = window.blockchainManager?.wsMonitor;
                const closeReasons = {
                    1000: 'Normal closure',
                    1001: 'Going away',
                    1002: 'Protocol error',
                    1003: 'Unsupported data',
                    1006: 'Abnormal closure',
                    1011: 'Server error',
                    1012: 'Service restart'
                };
                
                addWebSocketDebugMessage('🔴 WebSocket connection closed', 'warning', {
                    code: event.code,
                    reason: event.reason || closeReasons[event.code] || 'Unknown reason',
                    wasClean: event.wasClean,
                    endpoint: wsMonitor?.wsEndpoints?.[wsMonitor?.currentEndpointIndex]?.name || 'Unknown',
                    timestamp: new Date().toISOString()
                });
                
                // 更新按钮状态
                updateWebSocketControlButton();
            };
            
            this.ws.onerror = function(event) {
                const wsMonitor = window.blockchainManager?.wsMonitor;
                const readyStateNames = {
                    0: 'CONNECTING',
                    1: 'OPEN', 
                    2: 'CLOSING',
                    3: 'CLOSED'
                };
                
                addWebSocketDebugMessage('❌ WebSocket error occurred', 'error', {
                    type: event.type,
                    readyState: this.readyState,
                    readyStateName: readyStateNames[this.readyState] || 'UNKNOWN',
                    endpoint: wsMonitor?.wsEndpoints?.[wsMonitor?.currentEndpointIndex]?.name || 'Unknown',
                    endpointUrl: wsMonitor?.wsEndpoints?.[wsMonitor?.currentEndpointIndex]?.url || this.url,
                    endpointIndex: wsMonitor?.currentEndpointIndex,
                    totalEndpoints: wsMonitor?.wsEndpoints?.length || 0,
                    protocol: this.protocol || 'none',
                    extensions: this.extensions || 'none',
                    timestamp: new Date().toISOString(),
                    errorContext: 'Connection error during operation'
                });
                
                // 如果是连接阶段的错误，记录更多详细信息
                if (this.readyState === 0) { // CONNECTING
                    addWebSocketDebugMessage('🔴 Connection establishment failed', 'error', {
                        phase: 'Connection establishment',
                        endpoint: wsMonitor?.wsEndpoints?.[wsMonitor?.currentEndpointIndex]?.name || 'Unknown',
                        possibleCauses: [
                            'Network connectivity issues',
                            'Endpoint server down',
                            'Firewall blocking connection',
                            'Invalid endpoint URL',
                            'SSL/TLS certificate issues'
                        ],
                        nextAction: wsMonitor?.currentEndpointIndex < (wsMonitor?.wsEndpoints?.length - 1) ? 'Try next endpoint' : 'All endpoints exhausted'
                    });
                }
            };
        }
        
        return result;
    };
}

// 更新 WebSocket 控制按钮状态
function updateWebSocketControlButton() {
    const button = document.getElementById('ws-main-control-button');
    if (!button) return;
    
    if (window.blockchainManager && window.blockchainManager.wsMonitor) {
        const wsMonitor = window.blockchainManager.wsMonitor;
        
        if (wsMonitor.isConnected) {
            button.textContent = '🔌 Disconnect';
            button.style.background = '#dc3545';
        } else if (wsMonitor.connectionState === 'connecting') {
            button.textContent = '⏳ Connecting...';
            button.style.background = '#6c757d';
        } else {
            button.textContent = '🔌 Connect';
            button.style.background = '#28a745';
        }
    } else {
        button.textContent = '🔌 Connect';
        button.style.background = '#28a745';
    }
}

// 确保函数在全局作用域中可用
window.handleWebSocketControl = handleWebSocketControl;
window.toggleWebSocketDebugInfo = toggleWebSocketDebugInfo;
window.clearWebSocketDebugMessages = clearWebSocketDebugMessages;
window.toggleDebugPanel = toggleDebugPanel;

// 支付监听控制器类 (WebSocket 专用版本)
class PaymentListenerWS {
    constructor() {
        this.isActive = false;
        this.paymentData = null;

        // 状态回调
        this.onStatusUpdate = null;
        this.onPaymentConfirmed = null;
        this.onError = null;

        console.log('🎯 [PaymentListenerWS] WebSocket-only payment listener initialized');
    }

    // 开始监听支付 (仅 WebSocket)
    async startMonitoring(paymentData, callbacks = {}) {
        if (this.isActive) {
            console.log('⚠️ [PaymentListenerWS] Monitoring already active');
            return false;
        }

        this.paymentData = paymentData;
        this.onStatusUpdate = callbacks.onStatusUpdate || (() => { });
        this.onPaymentConfirmed = callbacks.onPaymentConfirmed || (() => { });
        this.onError = callbacks.onError || (() => { });

        console.log('🎯 [PaymentListenerWS] Starting WebSocket payment monitoring for:', paymentData.paymentId);

        // 尝试 WebSocket 模式
        const wsSuccess = await this.tryWebSocketMode();

        if (wsSuccess) {
            console.log('✅ [PaymentListenerWS] WebSocket mode activated');
            this.isActive = true;
            this.onStatusUpdate('websocket', 'connected', 'Payment monitoring active');
            return true;
        } else {
            console.error('❌ [PaymentListenerWS] WebSocket connection failed');
            this.onError('WebSocket connection failed', { reason: 'All endpoints failed' });
            return false;
        }
    }

    // 尝试 WebSocket 模式
    async tryWebSocketMode() {
        try {
            addWebSocketDebugMessage('Initializing WebSocket connection...', 'websocket');
            console.log('🔌 [PaymentListenerWS] Checking blockchain manager...');
            
            if (!window.blockchainManager) {
                console.error('❌ [PaymentListenerWS] BlockchainManager not available');
                addWebSocketDebugMessage('BlockchainManager not available', 'error');
                return false;
            }

            addWebSocketDebugMessage('BlockchainManager found', 'success');
            console.log('✅ [PaymentListenerWS] BlockchainManager found');
            console.log('🔌 [PaymentListenerWS] Checking WebSocket monitor...');
            
            if (!window.blockchainManager.wsMonitor) {
                console.error('❌ [PaymentListenerWS] WebSocket monitor not available');
                addWebSocketDebugMessage('WebSocket monitor not available', 'error');
                return false;
            }

            addWebSocketDebugMessage('WebSocket monitor found', 'success');
            console.log('✅ [PaymentListenerWS] WebSocket monitor found');
            
            // 显示连接详情
            const wsMonitor = window.blockchainManager.wsMonitor;
            const connectionDetails = {
                endpoints: wsMonitor.wsEndpoints?.length || 0,
                currentEndpoint: wsMonitor.currentEndpointIndex,
                connectionState: wsMonitor.connectionState,
                availableEndpoints: wsMonitor.wsEndpoints?.map((ep, index) => ({
                    index,
                    name: ep.name,
                    url: ep.url,
                    status: index === wsMonitor.currentEndpointIndex ? '[Active]' : '[Standby]'
                }))
            };
            addWebSocketDebugMessage('🔄 Attempting WebSocket connection...', 'websocket', connectionDetails);
            console.log('🔌 [PaymentListenerWS] Attempting WebSocket connection...');

            // 记录连接开始时间
            const connectionStartTime = Date.now();
            
            // 尝试连接 WebSocket
            const wsConnected = await window.blockchainManager.wsMonitor.connect();
            
            const connectionDuration = Date.now() - connectionStartTime;

            if (!wsConnected) {
                console.log('❌ [PaymentListenerWS] WebSocket connection failed');
                addWebSocketDebugMessage('❌ All WebSocket endpoints failed', 'error', {
                    totalEndpoints: wsMonitor.wsEndpoints?.length || 0,
                    attemptedEndpoints: wsMonitor.wsEndpoints?.map(ep => ep.name || ep.url),
                    connectionDuration: `${connectionDuration}ms`,
                    lastAttemptedEndpoint: wsMonitor.wsEndpoints?.[wsMonitor.currentEndpointIndex]?.name || 'Unknown',
                    possibleIssues: [
                        'All endpoints are down',
                        'Network connectivity problems', 
                        'Firewall blocking WebSocket connections',
                        'Invalid endpoint configurations'
                    ],
                    timestamp: new Date().toISOString()
                });
                return false;
            }

            const connectedEndpoint = wsMonitor.wsEndpoints[wsMonitor.currentEndpointIndex];
            addWebSocketDebugMessage('✅ WebSocket connection established successfully', 'success', {
                endpoint: connectedEndpoint?.name || 'Unknown',
                url: connectedEndpoint?.url || 'Unknown',
                endpointIndex: wsMonitor.currentEndpointIndex,
                connectionDuration: `${connectionDuration}ms`,
                readyState: wsMonitor.ws?.readyState,
                protocol: wsMonitor.ws?.protocol || 'none',
                extensions: wsMonitor.ws?.extensions || 'none',
                timestamp: new Date().toISOString()
            });
            console.log('✅ [PaymentListenerWS] WebSocket connection successful');
            
            // 初始化心跳监控
            this.initializeHeartbeatMonitoring(wsMonitor);

            // 开始支付监听 (修复参数格式)
            const monitoringConfig = {
                tokenSymbol: this.paymentData.selectedPayment.symbol,
                expectedAmount: this.paymentData.price,
                receiverAddress: window.BLOCKCHAIN_CONFIG?.receiverAddress || '0xe27577B0e3920cE35f100f66430de0108cb78a04',
                requiredConfirmations: 1, // 使用默认值1确认
                timeout: 30 * 60 * 1000, // 30分钟
                onSuccess: (confirmationData) => {
                    console.log('🎉 [PaymentListenerWS] Payment confirmed via WebSocket!', confirmationData);
                    this.handlePaymentEvent('confirmed', confirmationData);
                },
                onError: (error) => {
                    console.error('💥 [PaymentListenerWS] Payment monitoring error:', error);
                    this.handlePaymentEvent('error', error);
                },
                onTimeout: (data) => {
                    console.log('⏰ [PaymentListenerWS] Payment monitoring timeout:', data);
                    this.handlePaymentEvent('timeout', data);
                },
                onProgress: (data) => {
                    this.handlePaymentEvent('progress', data);
                }
            };
            
            addWebSocketDebugMessage('Starting payment monitoring...', 'websocket', {
                paymentId: this.paymentData.paymentId,
                token: monitoringConfig.tokenSymbol,
                amount: monitoringConfig.expectedAmount,
                receiver: monitoringConfig.receiverAddress,
                timeout: monitoringConfig.timeout / 1000 + 's'
            });
            
            const monitoringStarted = window.blockchainManager.startPaymentMonitoring(
                this.paymentData.paymentId, // 第一个参数：paymentId
                monitoringConfig
            );

            if (!monitoringStarted) {
                console.error('❌ [PaymentListenerWS] Failed to start payment monitoring');
                return false;
            }

            console.log('✅ [PaymentListenerWS] WebSocket monitoring started successfully');
            addWebSocketDebugMessage(`Monitoring started for payment ${this.paymentData.paymentId}`, 'success');
            return true;

        } catch (error) {
            console.error('💥 [PaymentListenerWS] Error in WebSocket mode:', error);
            return false;
        }
    }









    // 处理支付事件 (WebSocket 专用)
    handlePaymentEvent(eventType, eventData) {
        console.log(`📨 [PaymentListenerWS] WebSocket event: ${eventType}`, eventData);
        
        // 记录所有事件到调试面板
        addWebSocketDebugMessage(`Event: ${eventType}`, 'message', eventData);

        switch (eventType) {
            case 'started':
                this.onStatusUpdate('websocket', 'monitoring', 'Payment monitoring started');
                addWebSocketDebugMessage('Payment monitoring started', 'success', {
                    paymentId: this.paymentData?.paymentId,
                    timestamp: new Date().toISOString()
                });
                console.log('✅ [PaymentListenerWS] WebSocket monitoring started');
                break;

            case 'progress':
                let progressMessage = 'Monitoring for payment...';
                let progressDetails = {};
                
                if (eventData.blockNumber) {
                    progressMessage = `Processing block ${eventData.blockNumber}`;
                    progressDetails.blockNumber = eventData.blockNumber;
                    progressDetails.blockHash = eventData.blockHash;
                    progressDetails.timestamp = eventData.timestamp;
                    
                    // 更新区块检查计数
                    const blocksCheckedElement = document.getElementById('blocks-checked');
                    if (blocksCheckedElement) {
                        const currentCount = parseInt(blocksCheckedElement.textContent) || 0;
                        blocksCheckedElement.textContent = currentCount + 1;
                    }
                    
                    addWebSocketDebugMessage(`New block received`, 'block', progressDetails);
                } else if (eventData.transactionsScanned) {
                    progressMessage = `Scanned ${eventData.transactionsScanned} transactions`;
                    progressDetails.transactionsScanned = eventData.transactionsScanned;
                    progressDetails.relevantTransactions = eventData.relevantTransactions || 0;
                    
                    addWebSocketDebugMessage(`Transactions scanned`, 'transaction', progressDetails);
                } else if (eventData.heartbeat) {
                    progressMessage = 'WebSocket heartbeat';
                    progressDetails.heartbeat = true;
                    progressDetails.timestamp = new Date().toISOString();
                    
                    addWebSocketDebugMessage('Heartbeat received', 'heartbeat', progressDetails);
                } else if (eventData.subscription) {
                    progressMessage = 'Subscription event';
                    progressDetails.subscription = eventData.subscription;
                    progressDetails.data = eventData.data;
                    
                    addWebSocketDebugMessage('Subscription event', 'websocket', progressDetails);
                }
                
                // 更新消息匹配计数
                if (eventData.messagesMatched !== undefined) {
                    const messagesMatchedElement = document.getElementById('ws-messages-matched');
                    if (messagesMatchedElement) {
                        messagesMatchedElement.textContent = eventData.messagesMatched;
                    }
                    progressDetails.messagesMatched = eventData.messagesMatched;
                }
                
                this.onStatusUpdate('websocket', 'monitoring', progressMessage);
                break;

            case 'confirmed':
                console.log('🎉 [PaymentListenerWS] Payment confirmed via WebSocket!');
                const confirmationDetails = {
                    transactionHash: eventData.transactionHash,
                    blockNumber: eventData.blockNumber,
                    amount: eventData.amount,
                    from: eventData.from,
                    to: eventData.to,
                    detectionTime: Date.now() - (this.paymentData?.detectionStartTime || Date.now())
                };
                addWebSocketDebugMessage('🎉 Payment confirmed!', 'success', confirmationDetails);
                this.handlePaymentConfirmed({
                    ...eventData,
                    detectionMethod: 'websocket',
                    detectedAt: Date.now()
                });
                this.stopMonitoring();
                break;

            case 'error':
                console.error('💥 [PaymentListenerWS] WebSocket monitoring error:', eventData);
                const errorDetails = {
                    error: eventData.error || eventData.message || 'Unknown error',
                    code: eventData.code,
                    timestamp: new Date().toISOString(),
                    endpoint: window.blockchainManager?.wsMonitor?.wsEndpoints?.[window.blockchainManager?.wsMonitor?.currentEndpointIndex]?.name
                };
                addWebSocketDebugMessage(`Monitoring error occurred`, 'error', errorDetails);
                this.handleMonitoringError(eventData, 'websocket');
                this.stopMonitoring();
                break;

            case 'timeout':
                console.log('⏰ [PaymentListenerWS] WebSocket monitoring timeout');
                const timeoutDetails = {
                    duration: eventData.duration || 'Unknown',
                    reason: eventData.reason || 'Monitoring timeout',
                    timestamp: new Date().toISOString()
                };
                addWebSocketDebugMessage('⏰ Monitoring timeout', 'warning', timeoutDetails);
                this.handleMonitoringTimeout(eventData, 'websocket');
                this.stopMonitoring();
                break;

            default:
                console.log(`🤷 [PaymentListenerWS] Unknown event type: ${eventType}`);
                addWebSocketDebugMessage(`Unknown event: ${eventType}`, 'warning', eventData);
        }
    }

    // WebSocket 错误处理
    handleMonitoringError(errorData, sourceMode) {
        const errorMessage = errorData.error || errorData.message || 'Payment monitoring error';

        // 更新状态
        this.onStatusUpdate('websocket', 'error', `Error: ${errorMessage}`);

        // 触发错误回调
        this.onError(`Payment monitoring error: ${errorMessage}`, errorData);

        // 记录错误统计
        if (this.paymentData && this.paymentData.performanceMetrics) {
            this.paymentData.performanceMetrics.errors =
                (this.paymentData.performanceMetrics.errors || 0) + 1;
            this.paymentData.performanceMetrics.lastError = {
                timestamp: Date.now(),
                source: 'websocket',
                message: errorMessage
            };
        }
    }

    // WebSocket 超时处理
    handleMonitoringTimeout(timeoutData, sourceMode) {
        const timeoutMessage = 'Payment monitoring timeout';

        // 更新状态
        this.onStatusUpdate('websocket', 'timeout', timeoutMessage);

        // 触发错误回调
        this.onError(timeoutMessage, timeoutData);

        // 记录超时统计
        if (this.paymentData && this.paymentData.performanceMetrics) {
            this.paymentData.performanceMetrics.timeouts =
                (this.paymentData.performanceMetrics.timeouts || 0) + 1;
            this.paymentData.performanceMetrics.lastTimeout = {
                timestamp: Date.now(),
                source: 'websocket'
            };
        }
    }

    // 处理支付确认 (WebSocket 专用)
    handlePaymentConfirmed(confirmationData) {
        console.log('🎉 [PaymentListenerWS] Payment confirmed via WebSocket!', confirmationData);

        // 停止监听
        this.stopMonitoring();

        // 更新支付数据
        if (this.paymentData) {
            this.paymentData.verificationResult = confirmationData.verificationResult;
            this.paymentData.confirmedAt = confirmationData.detectedAt || Date.now();
            this.paymentData.txHash = confirmationData.transaction?.hash;
            this.paymentData.blockNumber = confirmationData.blockNumber;
            this.paymentData.status = 'confirmed';

            // 保存完整的确认数据供 success 页面使用
            this.paymentData.confirmationData = {
                transactionHash: confirmationData.transfer?.transactionHash || confirmationData.transaction?.hash,
                blockNumber: confirmationData.transfer?.blockNumber || confirmationData.blockNumber,
                fromAddress: confirmationData.transfer?.from,
                toAddress: confirmationData.transfer?.to,
                contractAddress: confirmationData.transfer?.tokenContract,
                amount: confirmationData.transfer?.formattedAmount,
                tokenSymbol: confirmationData.transfer?.tokenSymbol,
                blockTimestamp: confirmationData.blockTimestamp || Date.now(),
                networkName: this.paymentData.selectedNetwork?.name || 'BNB Smart Chain (BSC)'
            };

            // 计算检测时间
            if (this.paymentData.detectionStartTime) {
                const detectionTime = Date.now() - this.paymentData.detectionStartTime;
                this.paymentData.performanceMetrics = {
                    ...this.paymentData.performanceMetrics,
                    detectionTime: detectionTime,
                    detectionMethod: 'websocket'
                };
            }

            console.log('💾 [PaymentListenerWS] Saving updated payment data with confirmation info:', this.paymentData);

            // 保存更新的支付数据
            sessionStorage.setItem('paymentData', JSON.stringify(this.paymentData));
        }

        // 触发确认回调
        this.onPaymentConfirmed({
            ...confirmationData,
            detectionMethod: 'websocket'
        });
    }



    // 初始化心跳监控
    initializeHeartbeatMonitoring(wsMonitor) {
        if (!wsMonitor || !wsMonitor.ws) return;
        
        addWebSocketDebugMessage('🫀 Initializing heartbeat monitoring...', 'heartbeat', {
            endpoint: wsMonitor.wsEndpoints?.[wsMonitor.currentEndpointIndex]?.name || 'Unknown',
            monitoringInterval: '30 seconds',
            timeoutThreshold: '60 seconds'
        });
        
        // 清除之前的心跳监控
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
        }
        
        this.lastHeartbeatTime = Date.now();
        this.heartbeatMissedCount = 0;
        
        // 设置心跳检测间隔 (每30秒)
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastHeartbeat = now - this.lastHeartbeatTime;
            
            if (timeSinceLastHeartbeat > 60000) { // 60秒没有心跳
                this.heartbeatMissedCount++;
                addWebSocketDebugMessage('⚠️ Heartbeat timeout detected', 'warning', {
                    timeSinceLastHeartbeat: `${Math.round(timeSinceLastHeartbeat / 1000)}s`,
                    missedCount: this.heartbeatMissedCount,
                    threshold: '60s',
                    connectionState: wsMonitor.ws?.readyState
                });
                
                if (this.heartbeatMissedCount >= 3) {
                    addWebSocketDebugMessage('💔 Connection appears dead - multiple heartbeat timeouts', 'error', {
                        missedCount: this.heartbeatMissedCount,
                        lastHeartbeat: new Date(this.lastHeartbeatTime).toISOString(),
                        recommendation: 'Consider reconnecting'
                    });
                }
            } else {
                // 重置错过计数
                if (this.heartbeatMissedCount > 0) {
                    addWebSocketDebugMessage('💚 Heartbeat recovered', 'success', {
                        previousMissedCount: this.heartbeatMissedCount,
                        timeSinceLastHeartbeat: `${Math.round(timeSinceLastHeartbeat / 1000)}s`
                    });
                    this.heartbeatMissedCount = 0;
                }
            }
        }, 30000); // 每30秒检查一次
        
        // 监听WebSocket消息以更新心跳时间
        const originalOnMessage = wsMonitor.ws.onmessage;
        wsMonitor.ws.onmessage = (event) => {
            // 更新最后心跳时间
            this.lastHeartbeatTime = Date.now();
            
            // 检查是否是心跳消息
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ping' || data.type === 'pong') {
                    addWebSocketDebugMessage(`💓 Heartbeat ${data.type} received`, 'heartbeat', {
                        type: data.type,
                        responseTime: data.timestamp ? `${Date.now() - new Date(data.timestamp).getTime()}ms` : 'unknown',
                        connectionHealth: this.heartbeatMissedCount === 0 ? 'Excellent' : 'Recovering'
                    });
                }
            } catch (e) {
                // 不是JSON消息，可能是其他类型的心跳
            }
            
            // 调用原始处理函数
            if (originalOnMessage) {
                originalOnMessage.call(wsMonitor.ws, event);
            }
        };
    }

    // 停止监听 (WebSocket 专用)
    stopMonitoring() {
        console.log('🛑 [PaymentListenerWS] Stopping WebSocket payment monitoring...');

        this.isActive = false;
        
        // 清理心跳监控
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            addWebSocketDebugMessage('🫀 Heartbeat monitoring stopped', 'info');
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }

        // 停止 WebSocket 监听
        if (window.blockchainManager && this.paymentData) {
            window.blockchainManager.stopPaymentMonitoring(this.paymentData.paymentId);
        }

        console.log('✅ [PaymentListenerWS] WebSocket payment monitoring stopped');
    }

    // 获取监听状态 (WebSocket 专用)
    getStatus() {
        return {
            isActive: this.isActive,
            paymentId: this.paymentData?.paymentId,
            mode: 'websocket'
        };
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    // 页面加载时立即开始记录调试信息
    addWebSocketDebugMessage('Page loaded, initializing WebSocket monitoring...', 'info');
    
    loadPaymentData();
    initializeQRCodePage();
    
    // 初始化WebSocket UI状态
    setTimeout(() => {
        updateWebSocketStatusInfo();
        updateMonitoringControlButton(); // 初始化监控控制按钮状态
        
        // 设置 WebSocket 消息拦截器
        setupWebSocketMessageInterceptor();
        addWebSocketDebugMessage('WebSocket message interceptor initialized', 'websocket');
        
        // 定期更新WebSocket状态 (每2秒)
        setInterval(() => {
            updateWebSocketStatusInfo();
            updateMonitoringControlButton(); // 定期更新按钮状态
        }, 2000);
    }, 500);
    
    startWebSocketMonitoring();
});

// 加载支付数据
function loadPaymentData() {
    console.log('📊 [QRCodeWS] Loading payment data...');
    
    // 优先从支付处理器获取数据
    if (typeof window.paymentHandler !== 'undefined') {
        console.log('🔍 [QRCodeWS] Checking payment handler...');
        const currentPayment = window.paymentHandler.getCurrentPayment();
        if (currentPayment) {
            console.log('✅ [QRCodeWS] Payment data loaded from payment handler');
            paymentData = currentPayment;
            displayPaymentInfo();
            startExpirationCountdown();
            return;
        }
    }

    // 回退到 sessionStorage
    console.log('🔍 [QRCodeWS] Checking sessionStorage...');
    const data = sessionStorage.getItem('paymentData');
    if (data) {
        console.log('✅ [QRCodeWS] Payment data loaded from sessionStorage');
        paymentData = JSON.parse(data);
        console.log('   PaymentId:', paymentData.paymentId);
        console.log('   Amount:', paymentData.price);
        console.log('   Token:', paymentData.selectedPayment?.symbol);
        displayPaymentInfo();
        startExpirationCountdown();
    } else {
        // 如果没有支付数据，创建测试数据或重定向
        console.log('⚠️ [QRCodeWS] No payment data found');
        
        // 在开发环境中创建测试数据
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('🧪 [QRCodeWS] Creating test payment data for development');
            paymentData = {
                paymentId: 'test-' + Date.now(),
                product: 'peanut',
                price: 0.01,
                selectedPayment: {
                    symbol: 'USDT',
                    name: 'Tether USD',
                    contract: '0x55d398326f99059fF775485246999027B3197955'
                },
                selectedNetwork: {
                    symbol: 'BSC',
                    name: 'BNB Smart Chain'
                },
                timestamp: Date.now(),
                expiresAt: Date.now() + 30 * 60 * 1000
            };
            sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
            displayPaymentInfo();
            startExpirationCountdown();
        } else {
            alert('No payment data found. Redirecting to homepage.');
            window.location.href = 'index.html';
        }
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
        amountElement.textContent = `${paymentData.price.toFixed(2)}`;

        // 显示选择的支付方式和网络
        if (paymentData.selectedPayment) {
            if (paymentData.selectedPayment.symbol === paymentData.selectedPayment.name) {
                paymentMethodElement.textContent = paymentData.selectedPayment.symbol;
            } else {
                paymentMethodElement.textContent = `${paymentData.selectedPayment.symbol} - ${paymentData.selectedPayment.name}`;
            }
        } else {
            paymentMethodElement.textContent = 'Not selected';
        }

        if (paymentData.selectedNetwork) {
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
            expirationTime = new Date(paymentData.expiresAt);
        } else if (paymentData.timestamp) {
            expirationTime = new Date(paymentData.timestamp + 30 * 60 * 1000);
        } else {
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

    if (isNaN(minutes) || isNaN(seconds)) {
        console.error('Invalid time calculation:', { diff, minutes, seconds, date, now });
        return 'Invalid Time';
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 开始过期倒计时
function startExpirationCountdown() {
    if (!paymentData) return;

    let expirationTime;
    if (paymentData.expiresAt) {
        expirationTime = new Date(paymentData.expiresAt);
    } else if (paymentData.timestamp) {
        expirationTime = new Date(paymentData.timestamp + 30 * 60 * 1000);
    } else {
        expirationTime = new Date(Date.now() + 30 * 60 * 1000);
    }

    const expirationElement = document.getElementById('qr-expiration-time');

    const updateCountdown = () => {
        let timeString;

        if (typeof window.paymentHandler !== 'undefined' && paymentData.paymentId) {
            timeString = window.paymentHandler.formatRemainingTime(paymentData.paymentId);
        } else {
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
        }
    };

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

// 初始化二维码页面
function initializeQRCodePage() {
    // 设置钱包地址
    const walletAddressInput = document.getElementById('wallet-address');
    if (walletAddressInput) {
        walletAddressInput.value = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
    }

    // 初始化状态 - 连接区块链
    updatePaymentStatus('connecting', 'Connecting to blockchain');
    updateMonitoringStatus('Blockchain', 'Connecting...');

    console.log('🚀 [QRCodeWS] QR Code page initialized');
}

// 开始 WebSocket 监听
async function startWebSocketMonitoring() {
    console.log('🔌 [QRCodeWS] Starting WebSocket monitoring...');
    console.log('   paymentData:', paymentData);
    
    if (!paymentData) {
        console.error('❌ [QRCodeWS] No payment data available');
        updatePaymentStatus('error', 'No payment data available');
        return;
    }
    
    if (!paymentData.selectedPayment) {
        console.error('❌ [QRCodeWS] No selected payment method');
        updatePaymentStatus('error', 'No payment method selected');
        return;
    }

    console.log('✅ [QRCodeWS] Payment data validated');
    console.log('   PaymentId:', paymentData.paymentId);
    console.log('   Amount:', paymentData.price);
    console.log('   Token:', paymentData.selectedPayment.symbol);
    
    // 添加详细的初始化调试信息
    const initDetails = {
        paymentId: paymentData.paymentId,
        product: paymentData.product,
        amount: paymentData.price,
        token: paymentData.selectedPayment.symbol,
        tokenContract: paymentData.selectedPayment.contract,
        network: paymentData.selectedNetwork?.symbol,
        timestamp: new Date().toISOString()
    };
    addWebSocketDebugMessage('Starting WebSocket monitoring initialization', 'websocket', initDetails);
    
    updatePaymentStatus('connecting', 'Connecting to blockchain');
    updateMonitoringStatus('Blockchain', 'Connecting...');

    // 等待区块链管理器初始化
    const waitForBlockchain = () => {
        console.log('🔍 [QRCodeWS] Checking for blockchain manager...');
        console.log('   window.blockchainManager:', typeof window.blockchainManager);
        console.log('   window.blockchainManagerWS:', typeof window.blockchainManagerWS);
        console.log('   window.webSocketMonitor:', typeof window.webSocketMonitor);
        
        const managerStatus = {
            blockchainManager: typeof window.blockchainManager,
            blockchainManagerWS: typeof window.blockchainManagerWS,
            webSocketMonitor: typeof window.webSocketMonitor,
            timestamp: new Date().toISOString()
        };
        addWebSocketDebugMessage('Checking blockchain manager availability', 'websocket', managerStatus);
        
        if (typeof window.blockchainManager !== 'undefined') {
            console.log('✅ [QRCodeWS] Blockchain manager found');
            
            const managerDetails = {
                isConnected: window.blockchainManager.isConnected,
                hasWsMonitor: !!window.blockchainManager.wsMonitor,
                wsMonitorState: window.blockchainManager.wsMonitor?.connectionState,
                wsMonitorConnected: window.blockchainManager.wsMonitor?.isConnected,
                availableEndpoints: window.blockchainManager.wsMonitor?.wsEndpoints?.length || 0
            };
            addWebSocketDebugMessage('Blockchain manager found', 'success', managerDetails);
            console.log('   isConnected:', window.blockchainManager.isConnected);
            console.log('   wsMonitor:', window.blockchainManager.wsMonitor ? 'exists' : 'null');
            
            if (window.blockchainManager.wsMonitor) {
                console.log('   wsMonitor.isConnected:', window.blockchainManager.wsMonitor.isConnected);
                console.log('   wsMonitor.connectionState:', window.blockchainManager.wsMonitor.connectionState);
            }
            
            initializePaymentListener();
        } else {
            console.log('⏳ [QRCodeWS] Waiting for blockchain manager...');
            setTimeout(waitForBlockchain, 1000);
        }
    };

    // 也监听blockchainReady事件
    window.addEventListener('blockchainReady', (event) => {
        console.log('✅ [QRCodeWS] Received blockchainReady event');
        if (paymentData && paymentData.selectedPayment) {
            initializePaymentListener();
        }
    });

    // 监听 WebSocket 连接状态变化
    window.addEventListener('websocketStatusChanged', (event) => {
        console.log('🔄 [QRCodeWS] WebSocket status changed:', event.detail);
        updateWebSocketControlButton();
        addWebSocketDebugMessage(`WebSocket status: ${event.detail.status}`, 'info');
    });

    waitForBlockchain();
}

// 初始化支付监听器 (完整实现)
// 初始化支付监听器 (使用统一控制器)
async function initializePaymentListener() {
    try {
        console.log('🎯 [QRCodeWS] Initializing payment listener...');
        
        // 检查监控是否被禁用
        if (!isMonitoringEnabled) {
            addWebSocketDebugMessage('❌ Payment listener initialization skipped - monitoring disabled', 'warning');
            return;
        }

        // 验证支付数据
        if (!paymentData || !paymentData.selectedPayment) {
            throw new Error('Invalid payment data for monitoring');
        }

        // 创建支付监听控制器
        if (!paymentListenerWS) {
            paymentListenerWS = new PaymentListenerWS();
        }

        // 设置检测开始时间
        paymentData.detectionStartTime = Date.now();

        // 开始监听
        const success = await paymentListenerWS.startMonitoring(paymentData, {
            onStatusUpdate: (mode, status, message) => {
                console.log(`📊 [QRCodeWS] Status update: ${mode} - ${status} - ${message}`);

                // 提供详细的状态信息
                const statusDetails = {
                    timestamp: Date.now(),
                    mode: mode,
                    message: message
                };

                // 从消息中提取额外信息
                if (message.includes('block')) {
                    const blockMatch = message.match(/block (\d+)/);
                    if (blockMatch) {
                        statusDetails.lastBlock = blockMatch[1];
                    }
                }

                if (message.includes('endpoint')) {
                    const endpointMatch = message.match(/endpoint (\d+)/);
                    if (endpointMatch) {
                        statusDetails.endpoint = `EP${endpointMatch[1]}`;
                    }
                }

                updateMonitoringStatus('Blockchain', status, statusDetails);
                
                // 根据连接状态更新主要状态显示
                if (status === 'connected' || status === 'monitoring') {
                    updatePaymentStatus('waiting', 'Waiting for payment');
                } else if (status === 'connecting') {
                    updatePaymentStatus('connecting', 'Connecting to blockchain');
                } else if (status === 'error' || status === 'timeout') {
                    updatePaymentStatus('error', 'Blockchain disconnected, reconnecting...');
                }
            },

            onPaymentConfirmed: (confirmationData) => {
                console.log('🎉 [QRCodeWS] Payment confirmed via unified controller!', confirmationData);
                handlePaymentSuccess({
                    paymentId: paymentData.paymentId,
                    confirmations: 1,
                    detectionTime: confirmationData.detectionMethod === 'websocket' ?
                        (Date.now() - paymentData.detectionStartTime) :
                        (confirmationData.detectedAt - paymentData.detectionStartTime),
                    verificationResult: confirmationData.verificationResult,
                    detectionMethod: confirmationData.detectionMethod
                });
            },

            onError: (message, error) => {
                console.error('💥 [QRCodeWS] Payment monitoring error:', message, error);
                updatePaymentStatus('error', 'Blockchain disconnected, reconnecting...');
            }
        });

        if (success) {
            console.log('✅ [QRCodeWS] Payment monitoring started successfully');

            // 启动监听时间计数器
            startMonitoringTimeCounter();
            
            // 更新 WebSocket 控制按钮状态
            const controlButton = document.getElementById('ws-main-control-button');
            if (controlButton) {
                controlButton.textContent = '🔌 Disconnect';
                controlButton.style.background = '#dc3545';
            }

            // 更新支付处理器状态
            if (window.paymentHandler && paymentData.paymentId) {
                window.paymentHandler.updatePaymentSession(paymentData.paymentId, {
                    monitoringMode: 'websocket',
                    detectionStartTime: paymentData.detectionStartTime
                });
            }
        } else {
            throw new Error('Failed to start payment monitoring');
        }

    } catch (error) {
        console.error('💥 [QRCodeWS] Error initializing payment listener:', error);
        updatePaymentStatus('error', 'Blockchain disconnected, reconnecting...');

        // WebSocket 专用版本：连接失败时不切换到轮询
        console.error('💥 [QRCodeWS] WebSocket monitoring initialization failed');
    }
}

// 处理新区块事件 (完整实现)
async function handleNewBlock(blockData) {
    const blockNumber = parseInt(blockData.number, 16);
    console.log(`🆕 [QRCodeWS] New block received: ${blockNumber}`);

    // 显示实时区块检查状态
    updatePaymentStatus('monitoring', `Checking block ${blockNumber}...`);

    // 短暂显示检查状态后恢复正常监听状态
    setTimeout(() => {
        updatePaymentStatus('monitoring', 'Monitoring via WebSocket...');
    }, 1000);
}

// 处理支付成功 (快速页面跳转)
function handlePaymentSuccess(data) {
    console.log('🎉 [QRCodeWS] Processing payment success:', data);

    // 立即更新状态
    updatePaymentStatus('confirmed', 'Payment Confirmed!');
    updateMonitoringStatus('Blockchain', 'Payment Confirmed');

    // 停止监听时间计数器
    stopMonitoringTimeCounter();

    // 停止所有监听
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (window.webSocketMonitor) {
        // 不断开 WebSocket，只停止支付监听
        if (window.blockchainManager) {
            window.blockchainManager.stopPaymentMonitoring(paymentData.paymentId);
        }
    }

    console.log('🎉 [QRCodeWS] Payment confirmed, preparing for redirect...');

    // 更新支付数据
    if (paymentData && data.verificationResult) {
        paymentData.verificationResult = data.verificationResult;
        paymentData.confirmedAt = Date.now();
        paymentData.status = 'confirmed';

        // 添加 WebSocket 特有的性能数据
        paymentData.performanceMetrics = {
            ...paymentData.performanceMetrics,
            detectionTime: data.detectionTime || 0,
            detectionMethod: 'WebSocket',
            matchScore: data.verificationResult.matchScore || 100,
            confirmations: data.confirmations || 1
        };

        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    }

    // 快速跳转到成功页面 (1秒延迟，让用户看到确认状态)
    setTimeout(() => {
        console.log('🚀 [QRCode] Redirecting to success page...');
        window.location.href = 'success.html';
    }, 1000);
}

// WebSocket 状态监控功能
let monitoringStartTime = null;
let monitoringTimeInterval = null;

// 更新 WebSocket 状态信息
function updateWebSocketStatusInfo() {
    // 更新连接状态
    updateWebSocketConnectionStatus();
    
    // 更新监控目标信息
    updateWebSocketTargetInfo();
    
    // 更新可用端点信息
    updateWebSocketEndpointsInfo();
    
    // 更新控制按钮状态
    updateWebSocketControlButton();
}

// 更新 WebSocket 连接状态
function updateWebSocketConnectionStatus() {
    const endpointElement = document.getElementById('ws-current-endpoint');
    const statusElement = document.getElementById('ws-connection-status');
    
    if (!endpointElement || !statusElement) return;
    
    if (window.blockchainManager && window.blockchainManager.wsMonitor) {
        const wsMonitor = window.blockchainManager.wsMonitor;
        
        // 更新当前端点
        if (wsMonitor.isConnected && wsMonitor.wsEndpoints && wsMonitor.currentEndpointIndex >= 0) {
            const currentEndpoint = wsMonitor.wsEndpoints[wsMonitor.currentEndpointIndex];
            endpointElement.textContent = currentEndpoint.name || currentEndpoint.url;
            endpointElement.style.color = '#007bff';
        } else {
            endpointElement.textContent = 'Not connected';
            endpointElement.style.color = '#6c757d';
        }
        
        // 更新连接状态
        if (wsMonitor.isConnected) {
            statusElement.textContent = 'Connected';
            statusElement.style.color = '#28a745';
        } else if (wsMonitor.connectionState === 'connecting') {
            statusElement.textContent = 'Connecting...';
            statusElement.style.color = '#ffc107';
        } else {
            statusElement.textContent = 'Disconnected';
            statusElement.style.color = '#dc3545';
        }
    } else {
        endpointElement.textContent = 'Manager not ready';
        endpointElement.style.color = '#6c757d';
        statusElement.textContent = 'Not initialized';
        statusElement.style.color = '#6c757d';
    }
}

// 更新监控目标信息
function updateWebSocketTargetInfo() {
    const targetAddressElement = document.getElementById('ws-target-address');
    const expectedAmountElement = document.getElementById('ws-expected-amount');
    const tokenContractElement = document.getElementById('ws-token-contract');
    
    if (!targetAddressElement || !expectedAmountElement || !tokenContractElement) return;
    
    if (paymentData) {
        // 目标地址 - 显示开头和结尾，中间省略
        const receiverAddress = window.BLOCKCHAIN_CONFIG?.receiverAddress || '0xe27577B0e3920cE35f100f66430de0108cb78a04';
        const formatAddress = (address) => {
            if (!address || address.length <= 12) return address;
            return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        };
        targetAddressElement.textContent = formatAddress(receiverAddress);
        targetAddressElement.title = receiverAddress; // 完整地址显示在tooltip中
        
        // 期望金额
        if (paymentData.selectedPayment) {
            expectedAmountElement.textContent = `${paymentData.price} ${paymentData.selectedPayment.symbol}`;
        } else {
            expectedAmountElement.textContent = `${paymentData.price} (Unknown token)`;
        }
        
        // 代币合约 - 同样使用省略格式
        if (paymentData.selectedPayment && paymentData.selectedPayment.contract) {
            const contractAddress = paymentData.selectedPayment.contract;
            tokenContractElement.textContent = formatAddress(contractAddress);
            tokenContractElement.title = contractAddress; // 完整地址显示在tooltip中
        } else {
            tokenContractElement.textContent = 'Not specified';
            tokenContractElement.title = '';
        }
    } else {
        targetAddressElement.textContent = 'Loading...';
        expectedAmountElement.textContent = 'Loading...';
        tokenContractElement.textContent = 'Loading...';
    }
}

// 更新可用端点信息
function updateWebSocketEndpointsInfo() {
    const endpointsElement = document.getElementById('ws-backup-endpoints');
    
    if (!endpointsElement) return;
    
    if (window.blockchainManager && window.blockchainManager.wsMonitor && window.blockchainManager.wsMonitor.wsEndpoints) {
        const endpoints = window.blockchainManager.wsMonitor.wsEndpoints;
        const currentIndex = window.blockchainManager.wsMonitor.currentEndpointIndex;
        
        let endpointsText = '';
        endpoints.forEach((endpoint, index) => {
            const status = index === currentIndex ? '🟢 [Active]' : '⚪ [Standby]';
            endpointsText += `${status} ${endpoint.name || `EP${index + 1}`}\n`;
        });
        
        endpointsElement.textContent = endpointsText.trim();
    } else {
        endpointsElement.textContent = 'Endpoints not loaded';
    }
}

// 启动监听时间计数器
function startMonitoringTimeCounter() {
    monitoringStartTime = Date.now();
    
    const updateMonitoringTime = () => {
        const timeElement = document.getElementById('monitoring-time');
        if (timeElement && monitoringStartTime) {
            const elapsed = Date.now() - monitoringStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    };
    
    updateMonitoringTime();
    monitoringTimeInterval = setInterval(updateMonitoringTime, 1000);
}

// 停止监听时间计数器
function stopMonitoringTimeCounter() {
    if (monitoringTimeInterval) {
        clearInterval(monitoringTimeInterval);
        monitoringTimeInterval = null;
    }
}



// WebSocket 专用版本不需要轮询切换功能

// 更新支付状态
function updatePaymentStatus(status, message) {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const statusDot = statusIndicator ? statusIndicator.querySelector('.status-dot') : null;

    if (statusText) {
        statusText.textContent = message;
    }

    if (statusDot) {
        // 清除所有状态类
        statusDot.classList.remove('confirmed', 'failed', 'connecting', 'waiting', 'error');

        switch (status) {
            case 'connecting':
                statusDot.classList.add('connecting');
                break;
            case 'waiting':
            case 'monitoring':
                statusDot.classList.add('waiting');
                break;
            case 'confirmed':
                statusDot.classList.add('confirmed');
                break;
            case 'failed':
            case 'expired':
            case 'error':
                statusDot.classList.add('failed');
                break;
            default:
                break;
        }
    }

    if (paymentData) {
        paymentData.status = status;
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    }

    console.log('💳 [QRCodeWS] Payment status updated:', status, message);
}

// 更新监听模式状态
// 更新监听模式状态 (增强版)
function updateMonitoringStatus(mode, status, details = null) {
    const monitoringModeElement = document.getElementById('monitoring-mode');
    const connectionStatusElement = document.getElementById('connection-status');

    if (monitoringModeElement) {
        // 显示模式和额外信息
        let modeText = mode;
        if (details && details.endpoint) {
            modeText += ` (${details.endpoint})`;
        } else if (details && details.blocksChecked) {
            modeText += ` (${details.blocksChecked} blocks)`;
        }

        monitoringModeElement.textContent = modeText;

        // 根据模式设置颜色和图标
        if (mode === 'WebSocket') {
            monitoringModeElement.style.color = '#007bff';
            monitoringModeElement.style.fontWeight = 'bold';
            // WebSocket 专用版本不需要轮询样式
        } else {
            monitoringModeElement.style.color = '#6c757d';
            monitoringModeElement.style.fontWeight = 'normal';
        }
    }

    if (connectionStatusElement) {
        // 显示状态和时间戳
        let statusText = status;
        if (details && details.timestamp) {
            const time = new Date(details.timestamp).toLocaleTimeString();
            statusText += ` (${time})`;
        } else if (details && details.lastBlock) {
            statusText += ` #${details.lastBlock}`;
        }

        connectionStatusElement.textContent = statusText;

        // 根据状态设置颜色和样式
        if (status === 'Connected' || status === 'Active' || status.includes('monitoring')) {
            connectionStatusElement.style.color = '#28a745';
            connectionStatusElement.style.fontWeight = 'bold';
        } else if (status === 'Connecting...' || status.includes('Initializing')) {
            connectionStatusElement.style.color = '#17a2b8';
            connectionStatusElement.style.fontWeight = 'normal';
            // 添加闪烁效果
            connectionStatusElement.style.animation = 'pulse 1.5s infinite';
        } else if (status === 'Error' || status === 'Failed' || status.includes('timeout')) {
            connectionStatusElement.style.color = '#dc3545';
            connectionStatusElement.style.fontWeight = 'bold';
            connectionStatusElement.style.animation = 'none';
        } else {
            connectionStatusElement.style.color = '#6c757d';
            connectionStatusElement.style.fontWeight = 'normal';
            connectionStatusElement.style.animation = 'none';
        }
    }

    // 更新监听统计
    updateMonitoringStats(mode, status, details);

    // 记录状态更新日志
    console.log(`📊 [QRCodeWS] Status updated: ${mode} - ${status}`, details);
}

// 更新监听统计信息
function updateMonitoringStats(mode, status, details) {
    // 更新区块检查计数
    const blocksCheckedElement = document.getElementById('blocks-checked');
    if (blocksCheckedElement && details && details.lastBlock) {
        blocksCheckedElement.textContent = details.lastBlock;
    }

    // 更新监听时间
    updateMonitoringTime();
}

// 更新监听时间计数器 (变量已在前面声明)

function startMonitoringTimeCounter() {
    monitoringStartTime = Date.now();

    // 清除之前的计时器
    if (monitoringTimeInterval) {
        clearInterval(monitoringTimeInterval);
    }

    // 每秒更新一次监听时间
    monitoringTimeInterval = setInterval(updateMonitoringTime, 1000);
}

function updateMonitoringTime() {
    const monitoringTimeElement = document.getElementById('monitoring-time');

    if (monitoringTimeElement && monitoringStartTime) {
        const elapsed = Date.now() - monitoringStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        monitoringTimeElement.textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function stopMonitoringTimeCounter() {
    if (monitoringTimeInterval) {
        clearInterval(monitoringTimeInterval);
        monitoringTimeInterval = null;
    }
}

// 显示模式切换通知
function showModeSwitchNotification(message, type = 'info') {
    const notification = document.getElementById('mode-switch-notification');
    const messageElement = document.getElementById('mode-switch-message');

    if (notification && messageElement) {
        messageElement.textContent = message;

        // 根据类型设置样式
        switch (type) {
            case 'warning':
                notification.style.backgroundColor = '#fff3cd';
                notification.style.borderColor = '#ffeaa7';
                notification.style.color = '#856404';
                break;
            case 'error':
                notification.style.backgroundColor = '#f8d7da';
                notification.style.borderColor = '#f5c6cb';
                notification.style.color = '#721c24';
                break;
            case 'success':
                notification.style.backgroundColor = '#d4edda';
                notification.style.borderColor = '#c3e6cb';
                notification.style.color = '#155724';
                break;
            default: // info
                notification.style.backgroundColor = '#d1ecf1';
                notification.style.borderColor = '#bee5eb';
                notification.style.color = '#0c5460';
        }

        notification.style.display = 'block';

        // 3秒后自动隐藏
        setTimeout(() => {
            hideModeSwitchNotification();
        }, 3000);
    }
}

// 隐藏模式切换通知
function hideModeSwitchNotification() {
    const notification = document.getElementById('mode-switch-notification');
    if (notification) {
        notification.style.display = 'none';
    }
}

// 复制钱包地址
function copyAddress() {
    const walletAddressInput = document.getElementById('wallet-address');
    const copyButton = document.getElementById('copy-address-btn');

    if (walletAddressInput && copyButton) {
        walletAddressInput.select();
        walletAddressInput.setSelectionRange(0, 99999);

        try {
            document.execCommand('copy');

            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '<span class="copy-text">Copied!</span>';
            copyButton.classList.add('copied');

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

// 刷新状态
function refreshStatus() {
    console.log('🔄 [QRCodeWS] Refreshing status (UI only)...');
    
    // 获取按钮元素
    const refreshButton = document.querySelector('.refresh-button');
    if (!refreshButton) return;
    
    // 保存原始内容
    const originalContent = refreshButton.innerHTML;
    
    // 显示loading状态 - 只有图标转圈
    refreshButton.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">🔄</span> Refreshing...';
    refreshButton.disabled = true;
    refreshButton.style.opacity = '0.7';
    
    // 2秒后恢复原状
    setTimeout(() => {
        refreshButton.innerHTML = originalContent;
        refreshButton.disabled = false;
        refreshButton.style.opacity = '1';
        console.log('✅ [QRCodeWS] Status refresh completed (UI only)');
    }, 2000);
}

// 停止/开始监控控制
function toggleMonitoring() {
    const button = document.getElementById('monitoring-control-button');
    if (!button) {
        // 如果按钮不存在，创建一个
        console.warn('Monitoring control button not found');
        return;
    }
    
    if (isMonitoringEnabled) {
        // 停止监控
        stopMonitoring();
    } else {
        // 开始监控
        startMonitoring();
    }
}

// 停止监控
function stopMonitoring() {
    addWebSocketDebugMessage('🛑 Stopping payment monitoring...', 'warning', {
        previousState: 'monitoring',
        reason: 'Manual stop requested'
    });
    
    isMonitoringEnabled = false;
    
    // 停止支付监听器
    if (paymentListenerWS && paymentListenerWS.isActive) {
        paymentListenerWS.stopMonitoring();
        addWebSocketDebugMessage('Payment listener stopped', 'warning');
    }
    
    // 断开WebSocket连接并禁用自动重连
    if (window.blockchainManager && window.blockchainManager.wsMonitor) {
        const wsMonitor = window.blockchainManager.wsMonitor;
        if (wsMonitor.isConnected) {
            addWebSocketDebugMessage('Disconnecting WebSocket (monitoring stopped)', 'warning', {
                endpoint: wsMonitor.wsEndpoints?.[wsMonitor.currentEndpointIndex]?.name || 'Unknown',
                autoReconnect: false
            });
            
            // 禁用自动重连
            wsMonitor.autoReconnect = false;
            wsMonitor.disconnect();
        }
    }
    
    // 更新按钮状态
    updateMonitoringControlButton();
    
    // 更新页面状态
    updatePaymentStatus('stopped', 'Disconnected from blockchain');
    
    addWebSocketDebugMessage('✅ Payment monitoring stopped successfully', 'success', {
        monitoringEnabled: false,
        autoReconnect: false
    });
}

// 开始监控
function startMonitoring() {
    addWebSocketDebugMessage('🚀 Starting payment monitoring...', 'info', {
        previousState: 'stopped',
        reason: 'Manual start requested'
    });
    
    isMonitoringEnabled = true;
    
    // 启用自动重连
    if (window.blockchainManager && window.blockchainManager.wsMonitor) {
        window.blockchainManager.wsMonitor.autoReconnect = true;
    }
    
    // 重新初始化支付监听
    if (paymentData) {
        addWebSocketDebugMessage('Reinitializing payment listener...', 'info', {
            paymentId: paymentData.paymentId,
            targetAddress: paymentData.walletAddress
        });
        
        initializePaymentListener().then(() => {
            addWebSocketDebugMessage('✅ Payment monitoring started successfully', 'success', {
                monitoringEnabled: true,
                autoReconnect: true,
                wsConnected: window.blockchainManager?.wsMonitor?.isConnected || false
            });
        }).catch(error => {
            addWebSocketDebugMessage('❌ Failed to start payment monitoring', 'error', {
                error: error.message
            });
        });
    } else {
        addWebSocketDebugMessage('❌ Cannot start monitoring - no payment data', 'error');
    }
    
    // 更新按钮状态
    updateMonitoringControlButton();
    
    // 更新页面状态
    updatePaymentStatus('connecting', 'Starting monitoring...');
}

// 更新监控控制按钮状态
function updateMonitoringControlButton() {
    const button = document.getElementById('monitoring-control-button');
    if (!button) return;
    
    if (isMonitoringEnabled) {
        button.textContent = '🛑 Stop Monitoring';
        button.style.background = '#dc3545';
        button.style.color = 'white';
        button.title = 'Stop payment monitoring and disconnect WebSocket';
    } else {
        button.textContent = '🚀 Start Monitoring';
        button.style.background = '#28a745';
        button.style.color = 'white';
        button.title = 'Start payment monitoring and connect WebSocket';
    }
}

// 返回支付选择页面
function goBack() {
    // 停止统一监听控制器
    if (paymentListenerWS) {
        paymentListenerWS.stopMonitoring();
    }

    // 停止倒计时
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // 停止监听时间计数器
    stopMonitoringTimeCounter();

    // 跳转回支付选择页面
    window.location.href = 'payment.html';
}

// Debug 功能函数 (已在前面定义)

// WebSocket调试消息管理
let wsDebugVisible = false;



// 更新WebSocket调试显示
function updateWebSocketDebugDisplay() {
    const debugContent = document.getElementById('ws-debug-content');
    if (!debugContent) return;
    
    if (wsDebugMessages.length === 0) {
        debugContent.innerHTML = '<div style="color: #6c757d; font-style: italic;">WebSocket messages will appear here...</div>';
        return;
    }
    
    const messagesHtml = wsDebugMessages.map(msg => {
        let typeColor = '#6c757d';
        let backgroundColor = '#f8f9fa';
        
        switch (msg.type) {
            case 'success':
                typeColor = '#155724';
                backgroundColor = '#d4edda';
                break;
            case 'error':
                typeColor = '#721c24';
                backgroundColor = '#f8d7da';
                break;
            case 'warning':
                typeColor = '#856404';
                backgroundColor = '#fff3cd';
                break;
            case 'websocket':
                typeColor = '#0056b3';
                backgroundColor = '#e8f4fd';
                break;
            case 'heartbeat':
                typeColor = '#4169e1';
                backgroundColor = '#f0f8ff';
                break;
            case 'message':
                typeColor = '#495057';
                backgroundColor = '#f8f9fa';
                break;
            case 'block':
                typeColor = '#0066cc';
                backgroundColor = '#e6f3ff';
                break;
            case 'transaction':
                typeColor = '#cc6600';
                backgroundColor = '#fff0e6';
                break;
        }
        
        let detailsHtml = '';
        if (msg.details) {
            const detailsText = typeof msg.details === 'object' 
                ? JSON.stringify(msg.details, null, 2) 
                : msg.details;
            detailsHtml = `<div style="color: #6c757d; font-size: 10px; margin-top: 2px; white-space: pre-wrap;">${detailsText}</div>`;
        }
        
        return `<div style="margin-bottom: 4px; padding: 4px 6px; border-radius: 3px; font-size: 11px; line-height: 1.4; background-color: ${backgroundColor}; color: ${typeColor}; border-left: 3px solid ${typeColor};">
            ${msg.fullText}${detailsHtml}
        </div>`;
    }).join('');
    
    debugContent.innerHTML = messagesHtml;
    debugContent.scrollTop = debugContent.scrollHeight;
}

// 切换WebSocket调试信息显示
function toggleWebSocketDebugInfo() {
    const debugPanel = document.getElementById('ws-debug-messages');
    if (!debugPanel) return;
    
    wsDebugVisible = !wsDebugVisible;
    
    if (wsDebugVisible) {
        debugPanel.style.display = 'block';
        updateWebSocketDebugDisplay();
    } else {
        debugPanel.style.display = 'none';
    }
}

// 清除WebSocket调试消息
function clearWebSocketDebugMessages() {
    wsDebugMessages = [];
    updateWebSocketDebugDisplay();
}

// 更新WebSocket UI状态
function updateWebSocketUI(status, message) {
    const connectionStatus = document.getElementById('ws-connection-status');
    const mainControlBtn = document.getElementById('ws-main-control-button');
    
    if (connectionStatus) {
        connectionStatus.textContent = message || status;
        
        // 更新状态颜色
        switch (status) {
            case 'connected':
                connectionStatus.style.color = '#28a745';
                break;
            case 'connecting':
                connectionStatus.style.color = '#ffc107';
                break;
            case 'disconnected':
                connectionStatus.style.color = '#6c757d';
                break;
            case 'error':
                connectionStatus.style.color = '#dc3545';
                break;
        }
    }
    
    // 更新主控制按钮
    if (mainControlBtn) {
        switch (status) {
            case 'connected':
                mainControlBtn.textContent = '🔌 Disconnect';
                mainControlBtn.style.background = '#dc3545';
                mainControlBtn.disabled = false;
                mainControlBtn.style.opacity = '1';
                break;
            case 'connecting':
                mainControlBtn.textContent = '⏳ Connecting...';
                mainControlBtn.style.background = '#ffc107';
                mainControlBtn.style.color = '#212529';
                mainControlBtn.disabled = true;
                mainControlBtn.style.opacity = '0.8';
                break;
            case 'disconnected':
                mainControlBtn.textContent = '🔌 Connect';
                mainControlBtn.style.background = '#28a745';
                mainControlBtn.style.color = 'white';
                mainControlBtn.disabled = false;
                mainControlBtn.style.opacity = '1';
                break;
            case 'error':
                mainControlBtn.textContent = '🔄 Reconnect';
                mainControlBtn.style.background = '#ffc107';
                mainControlBtn.style.color = '#212529';
                mainControlBtn.disabled = false;
                mainControlBtn.style.opacity = '1';
                break;
        }
    }
}

// 重复的 updateWebSocketStatusInfo 函数已删除

// 主WebSocket控制函数
function handleWebSocketControl() {
    if (!window.blockchainManager || !window.blockchainManager.wsMonitor) {
        console.error('WebSocket Monitor not available');
        updateWebSocketUI('error', 'WebSocket Monitor not available');
        addWebSocketDebugMessage('error', 'WebSocket Monitor not available');
        return;
    }
    
    const wsMonitor = window.blockchainManager.wsMonitor;
    const currentStatus = getWebSocketRealStatus();
    
    addWebSocketDebugMessage('connection', `Control button clicked, current status: ${currentStatus}`);
    
    switch (currentStatus) {
        case 'connected':
            handleDisconnectWebSocket();
            break;
        case 'connecting':
            // 连接中时不允许操作
            break;
        case 'disconnected':
        case 'error':
        default:
            handleConnectWebSocket();
            break;
    }
}

// 获取WebSocket真实状态
function getWebSocketRealStatus() {
    if (!window.blockchainManager || !window.blockchainManager.wsMonitor) {
        return 'error';
    }
    
    const wsMonitor = window.blockchainManager.wsMonitor;
    
    // 检查WebSocket连接状态
    if (wsMonitor.ws) {
        switch (wsMonitor.ws.readyState) {
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.OPEN:
                return 'connected';
            case WebSocket.CLOSING:
                return 'disconnecting';
            case WebSocket.CLOSED:
                return 'disconnected';
            default:
                return 'unknown';
        }
    }
    
    return 'disconnected';
}

// WebSocket连接控制函数
function handleConnectWebSocket() {
    console.log('🔌 [Debug] Connecting WebSocket...');
    addWebSocketDebugMessage('connection', 'Initiating WebSocket connection...');
    
    if (!window.blockchainManager || !window.blockchainManager.wsMonitor) {
        console.error('WebSocket Monitor not available');
        updateWebSocketUI('error', 'WebSocket Monitor not available');
        addWebSocketDebugMessage('error', 'WebSocket Monitor not available');
        return;
    }
    
    const wsMonitor = window.blockchainManager.wsMonitor;
    updateWebSocketUI('connecting', 'Connecting...');
    
    // 监听WebSocket事件
    setupWebSocketEventListeners(wsMonitor);
    
    wsMonitor.connect().then(success => {
        if (success) {
            updateWebSocketUI('connected', 'Connected');
            updatePaymentStatus('waiting', 'Waiting for payment');
            addWebSocketDebugMessage('connection', 'WebSocket connected successfully');
        } else {
            updateWebSocketUI('error', 'Connection failed');
            updatePaymentStatus('error', 'Connection failed');
            addWebSocketDebugMessage('error', 'WebSocket connection failed');
        }
    }).catch(error => {
        updateWebSocketUI('error', 'Connection error');
        addWebSocketDebugMessage('error', 'WebSocket connection error', error);
    });
}

function handleDisconnectWebSocket() {
    console.log('🔌 [Debug] Disconnecting WebSocket...');
    
    if (!window.blockchainManager || !window.blockchainManager.wsMonitor) {
        console.error('WebSocket Monitor not available');
        addWebSocketDebugMessage('WebSocket Monitor not available for disconnect', 'error', {
            hasBlockchainManager: !!window.blockchainManager,
            hasWsMonitor: !!(window.blockchainManager?.wsMonitor)
        });
        return;
    }
    
    const wsMonitor = window.blockchainManager.wsMonitor;
    
    // 记录断开前的状态
    addWebSocketDebugMessage('🔌 Initiating WebSocket disconnect...', 'websocket', {
        currentState: wsMonitor.connectionState,
        isConnected: wsMonitor.isConnected,
        currentEndpoint: wsMonitor.wsEndpoints?.[wsMonitor.currentEndpointIndex]?.name || 'Unknown',
        readyState: wsMonitor.ws?.readyState,
        hasActivePaymentMonitoring: paymentListenerWS?.isActive || false
    });
    
    // 执行断开
    wsMonitor.disconnect();
    
    // 记录断开后的状态
    addWebSocketDebugMessage('WebSocket disconnect completed', 'warning', {
        newState: wsMonitor.connectionState,
        isConnected: wsMonitor.isConnected,
        reason: 'Manual disconnect via debug controls'
    });
    
    updateWebSocketUI('disconnected', 'Disconnected');
    updatePaymentStatus('error', 'Blockchain disconnected');
    
    addWebSocketDebugMessage('UI and payment status updated after disconnect', 'info', {
        uiStatus: 'disconnected',
        paymentStatus: 'error'
    });
}

// 设置WebSocket事件监听器
function setupWebSocketEventListeners(wsMonitor) {
    if (!wsMonitor.ws) return;
    
    const ws = wsMonitor.ws;
    
    // 连接打开
    ws.addEventListener('open', (event) => {
        addWebSocketDebugMessage('connection', 'WebSocket connection opened');
    });
    
    // 接收消息
    ws.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // 区分不同类型的消息
            if (data.method === 'eth_subscription') {
                addWebSocketDebugMessage('message', 'Received subscription message', {
                    subscription: data.params?.subscription,
                    result: data.params?.result?.number ? `Block #${parseInt(data.params.result.number, 16)}` : 'Transaction data'
                });
            } else if (data.id && data.result) {
                addWebSocketDebugMessage('message', 'Received RPC response', {
                    id: data.id,
                    method: data.method || 'unknown'
                });
            } else if (data.type === 'ping' || data.type === 'pong') {
                addWebSocketDebugMessage('heartbeat', `Heartbeat: ${data.type}`);
            } else {
                addWebSocketDebugMessage('message', 'Received message', data);
            }
        } catch (error) {
            addWebSocketDebugMessage('message', 'Received raw message', { data: event.data });
        }
    });
    
    // 连接关闭
    ws.addEventListener('close', (event) => {
        addWebSocketDebugMessage('close', `WebSocket connection closed`, {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });
    });
    
    // 连接错误
    ws.addEventListener('error', (event) => {
        addWebSocketDebugMessage('error', 'WebSocket error occurred');
    });
}

// 处理WebSocket连接/断开切换 (保持向后兼容)
function handleToggleWebSocket() {
    handleWebSocketControl();
}

// 显示WebSocket状态详情 (兼容旧版本)
function debugWebSocketStatus() {
    toggleWebSocketDebugInfo();
}

// 测试功能
function simulatePaymentSuccessForTesting() {
    console.log('🧪 [Test] Simulating payment success...');
    
    // 模拟支付确认数据
    const mockConfirmationData = {
        verificationResult: {
            isValid: true,
            matchScore: 100,
            transaction: {
                hash: '0x1234567890abcdef1234567890abcdef12345678',
                from: '0x1111111111111111111111111111111111111111',
                to: '0xe27577B0e3920cE35f100f66430de0108cb78a04',
                value: paymentData ? paymentData.price : 10,
                tokenSymbol: paymentData ? paymentData.selectedPayment.symbol : 'USDT'
            }
        },
        blockNumber: 12345678,
        detectionMethod: 'websocket-test'
    };
    
    handlePaymentSuccess({
        paymentId: paymentData ? paymentData.paymentId : 'test-payment',
        confirmations: 1,
        detectionTime: 2500,
        verificationResult: mockConfirmationData.verificationResult,
        detectionMethod: 'websocket-test'
    });
}

function testDirectJumpToSuccess() {
    console.log('🚀 [Test] Direct jump to success page...');
    window.location.href = 'success.html';
}

// 返回支付选择页面
function goBack() {
    // 停止统一监听控制器
    if (paymentListenerWS) {
        paymentListenerWS.stopMonitoring();
    }

    // 停止监听时间计数器
    stopMonitoringTimeCounter();

    // 清除定时器
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // WebSocket 专用版本不需要清理轮询

    console.log('🔙 [QRCode] Going back to payment selection');
    window.location.href = 'payment.html';
}

// 重复的 simulatePaymentSuccessForTesting 函数已删除

// 重复的 testDirectJumpToSuccess 函数已删除

// 确认支付 (兼容旧接口)
function confirmPayment(verificationResult = null) {
    console.log('🎉 [QRCodeWS] Legacy confirmPayment called, converting to new format...');

    // 转换为新的数据格式
    const successData = {
        paymentId: paymentData?.paymentId,
        confirmations: verificationResult?.confirmations || 1,
        detectionTime: paymentData?.detectionStartTime ? Date.now() - paymentData.detectionStartTime : 0,
        verificationResult: verificationResult || {
            verified: true,
            detectionMethod: 'WebSocket (Legacy)',
            matchScore: 100
        }
    };

    // 使用新的处理函数
    handlePaymentSuccess(successData);
}

// 调试函数占位符 (toggleDebugPanel 已在前面定义)

// 其他调试函数占位符
function showRpcStatus() { console.log('RPC status - to be implemented'); }
function debugGetBlockNumber() { console.log('Get block number debug - to be implemented'); }
function testWebSocketConnection() { console.log('Test WebSocket connection - to be implemented'); }
function clearLocalStorage() { localStorage.clear(); console.log('Local storage cleared'); }
function testAlternativeRPC() { console.log('Test alternative RPC - to be implemented'); }
function debugSwitchRPC() { console.log('Switch RPC debug - to be implemented'); }
function testCompleteFlow() { console.log('Complete flow test - to be implemented'); }