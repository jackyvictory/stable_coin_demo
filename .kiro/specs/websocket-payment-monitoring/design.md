# WebSocket 支付监听系统设计文档

## 概述

本设计文档描述了基于 WebSocket + 轮询混合机制的支付监听系统，目标是将支付确认延迟从当前的 1.5-3 分钟降低到 5 秒以内。系统采用完全独立的架构，与现有系统并行运行，便于对比测试。

## 架构设计

### 系统架构图

```
用户界面层:
├── index.html (添加 ws 按钮)
├── payment-ws.html (支付方式选择)
├── qrcode-ws.html (二维码支付页面)
└── success-ws.html (支付成功页面)

业务逻辑层:
├── main-ws.js (首页逻辑)
├── payment-ws.js (支付选择逻辑)
├── qrcode-ws.js (支付监听核心逻辑)
├── success-ws.js (成功页面逻辑)
└── payment-handler-ws.js (支付会话管理)

区块链监听层:
├── blockchain-ws.js (区块链连接和 WebSocket 管理)
└── websocket-monitor.js (WebSocket 监听核心)

数据层:
├── SessionStorage (支付会话数据)
└── LocalStorage (配置和缓存)
```

### 核心组件

#### 1. WebSocket 监听管理器 (websocket-monitor.js)
- **职责**: 管理 WebSocket 连接和新区块监听
- **功能**: 
  - 连接到 BSC WebSocket 节点
  - 订阅 newHeads 事件
  - 自动重连机制
  - 连接状态管理

#### 2. 区块链管理器 (blockchain-ws.js)
- **职责**: 区块链交互和交易检测
- **功能**:
  - RPC 调用管理
  - 交易扫描和验证
  - 轮询备用机制
  - 多节点支持

#### 3. 支付监听控制器 (qrcode-ws.js)
- **职责**: 协调 WebSocket 和轮询监听
- **功能**:
  - 监听模式切换
  - 支付检测逻辑
  - 状态更新和用户反馈
  - 性能监控

## 组件和接口设计

### WebSocket 监听管理器

```javascript
class WebSocketMonitor {
    constructor(config) {
        this.wsEndpoints = config.wsEndpoints;
        this.currentWs = null;
        this.currentEndpointIndex = 0;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.isConnected = false;
        this.eventHandlers = new Map();
        this.lastFailedEndpoints = new Set(); // 记录最近失败的端点
    }

    // 尝试连接到可用的 WebSocket 节点
    async connect() {
        console.log('开始尝试 WebSocket 连接...');
        
        for (let i = 0; i < this.wsEndpoints.length; i++) {
            const endpointIndex = (this.currentEndpointIndex + i) % this.wsEndpoints.length;
            const endpoint = this.wsEndpoints[endpointIndex];
            
            console.log(`尝试连接端点 ${i + 1}/${this.wsEndpoints.length}: ${endpoint.url}`);
            
            try {
                await this.connectToEndpoint(endpoint, endpointIndex);
                console.log(`✅ WebSocket 连接成功: ${endpoint.url}`);
                return true; // 连接成功
            } catch (error) {
                console.log(`❌ WebSocket 连接失败: ${endpoint.url}`, error.message);
                this.recordEndpointFailure(endpoint);
                continue; // 尝试下一个端点
            }
        }
        
        console.log('❌ 所有 WebSocket 端点都连接失败，回退到轮询模式');
        return false; // 所有端点都失败，回退到轮询
    }
    
    // 连接到特定端点
    async connectToEndpoint(endpoint, index) {}
    
    // 订阅新区块事件
    subscribeToNewHeads() {}
    
    // 智能重连机制（尝试不同端点）
    async handleReconnect() {
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.wsEndpoints.length;
        return await this.connect();
    }
    
    // 记录端点失败
    recordEndpointFailure(endpoint) {
        this.lastFailedEndpoints.add(endpoint.url);
    }
    
    // 事件处理器注册
    on(event, handler) {}
    
    // 连接状态检查
    getConnectionStatus() {}
}
```

### 区块链管理器 (WebSocket 版本)

```javascript
class BlockchainManagerWS {
    constructor() {
        this.web3 = null;
        this.wsMonitor = null;
        this.isConnected = false;
        this.contracts = {};
        this.lastProcessedBlock = 0;
    }

    // 初始化连接
    async initialize() {}
    
    // WebSocket 模式检测
    async checkBlockForPayments(blockNumber) {}
    
    // 轮询备用模式
    async startPollingBackup() {}
    
    // 交易验证
    async verifyTransaction(tx, expectedAmount, tokenSymbol) {}
    
    // 获取代币转账记录
    async getTokenTransfersInBlock(blockNumber, tokenSymbol, toAddress) {}
}
```

### 支付监听控制器

```javascript
class PaymentListenerWS {
    constructor() {
        this.mode = 'websocket'; // 'websocket' | 'polling'
        this.blockchainManager = null;
        this.wsMonitor = null;
        this.paymentData = null;
        this.isListening = false;
        this.wsConnectionAttempted = false;
    }

    // 启动监听（优先尝试 WebSocket）
    async startListening(paymentData) {
        this.paymentData = paymentData;
        
        // 首先尝试 WebSocket 连接
        console.log('启动支付监听，优先尝试 WebSocket...');
        const wsConnected = await this.wsMonitor.connect();
        
        if (wsConnected) {
            console.log('✅ 使用 WebSocket 模式监听');
            this.mode = 'websocket';
            this.startWebSocketListening();
        } else {
            console.log('⚠️ 所有 WebSocket 端点都失败，使用轮询模式');
            this.mode = 'polling';
            this.startPollingListening();
        }
        
        this.wsConnectionAttempted = true;
    }
    
    // WebSocket 监听
    startWebSocketListening() {}
    
    // 轮询监听
    startPollingListening() {}
    
    // 处理新区块事件
    async handleNewBlock(blockData) {}
    
    // 只在所有 WebSocket 端点都失败时切换到轮询
    switchToPollingMode() {
        if (this.mode === 'websocket') {
            console.log('🔄 WebSocket 连接完全失败，切换到轮询模式');
            this.mode = 'polling';
            this.startPollingListening();
        }
    }
    
    // 一旦有 WebSocket 端点恢复就切换回去
    switchToWebSocketMode() {
        if (this.mode === 'polling') {
            console.log('🔄 WebSocket 连接恢复，切换回 WebSocket 模式');
            this.mode = 'websocket';
            this.startWebSocketListening();
        }
    }
    
    // 支付确认
    confirmPayment(transactionData) {}
    
    // 性能监控
    recordDetectionTime(startTime) {}
}
```

## 数据模型

### 支付会话数据模型

```javascript
const PaymentSessionWS = {
    paymentId: String,
    product: String,
    price: Number,
    selectedPayment: {
        symbol: String,
        name: String,
        contract: String
    },
    selectedNetwork: {
        symbol: String,
        name: String,
        chainId: Number
    },
    status: String, // 'pending' | 'monitoring' | 'confirmed' | 'expired'
    createdAt: Number,
    expiresAt: Number,
    monitoringStartBlock: Number, // 开始监听的区块号
    detectionStartTime: Number, // 开始检测的时间戳
    
    // WebSocket 特有字段
    wsConnectionStatus: String, // 'connecting' | 'connected' | 'disconnected'
    monitoringMode: String, // 'websocket' | 'polling' | 'hybrid'
    lastProcessedBlock: Number,
    
    // 性能监控
    performanceMetrics: {
        detectionTime: Number, // 检测耗时（毫秒）
        blocksScanned: Number, // 扫描的区块数
        wsReconnects: Number // WebSocket 重连次数
    }
};
```

### WebSocket 配置模型

```javascript
const WebSocketConfig = {
    // 多个 WebSocket 端点，按优先级排序
    endpoints: [
        {
            url: 'wss://bsc-ws-node.nariox.org/',
            priority: 1,
            timeout: 5000
        },
        {
            url: 'wss://bsc.publicnode.com/',
            priority: 2,
            timeout: 5000
        },
        {
            url: 'wss://bsc-mainnet.nodereal.io/ws/v1/YOUR_API_KEY',
            priority: 3,
            timeout: 8000
        },
        {
            url: 'wss://bsc-dataseed1.binance.org/ws/',
            priority: 4,
            timeout: 10000
        }
    ],
    
    // 连接策略
    connectionStrategy: {
        reconnectInterval: 5000, // 重连间隔（毫秒）
        maxReconnectAttempts: 3, // 最大重连尝试次数
        connectionTimeout: 10000 // 连接超时时间
    },
    
    heartbeatInterval: 30000, // 心跳间隔
    subscriptions: ['newHeads'], // 订阅的事件类型
    
    // 轮询备用配置
    pollingConfig: {
        interval: 2000, // 2秒轮询间隔
        blocksPerBatch: 20, // 每批检查20个区块
        maxBatches: 10 // 最多10批
    }
};
```

## 错误处理策略

### WebSocket 错误处理

1. **连接失败**:
   - 按优先级顺序尝试所有 WebSocket 端点
   - 记录每个端点的失败次数和原因
   - **只有当所有备选端点都无法建立连接时，才回退到轮询模式**
   - 定期重试失败的端点，一旦任何端点恢复就切换回 WebSocket

2. **连接断开**:
   - 立即尝试重连当前端点
   - 重连失败则切换到下一个端点
   - 重连期间启动轮询备用
   - 用户状态实时提示

3. **端点故障转移**:
   - 按配置顺序依次尝试端点
   - 连接断开时切换到下一个端点
   - 定期重试失败的端点

4. **数据解析错误**:
   - 跳过错误数据包
   - 继续监听后续事件
   - 错误计数和详细日志
   - 异常数据报告和分析

### 轮询错误处理

1. **RPC 调用失败**:
   - 切换到备用 RPC 节点
   - 调整轮询间隔
   - 重试机制

2. **区块数据异常**:
   - 跳过异常区块
   - 继续检查后续区块
   - 记录异常日志

## 测试策略

### 测试代码组织

所有测试相关代码统一放置在 `demo/debug/` 目录中：

```
demo/debug/
├── websocket-test.html          # WebSocket 连接测试页面
├── payment-flow-test.html       # 支付流程测试页面
├── js/
│   ├── websocket-test.js       # WebSocket 连接测试脚本
│   └── payment-test.js         # 支付流程测试脚本
└── README.md                   # 测试说明文档
```

### 测试功能

1. **WebSocket 连接测试** (`demo/debug/websocket-test.html`):
   - 测试所有端点的连接状态
   - 模拟连接失败和重连
   - 验证事件订阅功能

2. **支付流程测试** (`demo/debug/payment-flow-test.html`):
   - 端到端支付流程验证
   - 模拟不同的支付场景
   - 网络异常恢复测试





## 维护和扩展

### 代码维护

1. **模块化设计**:
   - 清晰的模块边界
   - 标准化的接口
   - 完善的文档

2. **版本管理**:
   - 语义化版本控制
   - 变更日志维护
   - 向后兼容性

### 功能扩展

1. **多链支持**:
   - 架构支持多区块链
   - 配置化链参数
   - 统一的接口设计

2. **监听优化**:
   - 更多 WebSocket 节点
   - 智能节点选择
   - 负载均衡机制