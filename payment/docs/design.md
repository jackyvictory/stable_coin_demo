# Stable Coin Payment System - 架构设计文档

## 1. 概述

本系统是一个基于稳定币的支付平台，允许用户使用BNB智能链(BSC)上的稳定币(USDT、USDC、BUSD)进行支付。系统采用前后端分离架构，后端使用Golang实现RESTful API，前端使用Vue.js构建用户界面。

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────┐    RESTful API    ┌─────────────────────┐
│   Frontend      │ ◄────────────────►│     Backend API     │
│    (Vue.js)     │                   │    (Golang/Gin)     │
└─────────────────┘                   └─────────────────────┘
                                               │
                                               ▼
                                 ┌──────────────────────────┐
                                 │   Blockchain Services    │
                                 │   (go-ethereum/Web3)     │
                                 └──────────────────────────┘
                                               │
                                               ▼
                                 ┌──────────────────────────┐
                                 │    BNB Smart Chain       │
                                 │   (WebSocket/RPC)        │
                                 └──────────────────────────┘
```

### 2.2 后端架构

#### 技术栈
- **语言**: Golang
- **框架**: Gin Web Framework
- **数据库**: SQLite (嵌入式，单一文件)
- **区块链**: go-ethereum (官方以太坊Go库)
- **API文档**: OpenAPI 3.0 + Swagger UI
- **容器化**: Docker (多阶段构建)

#### 目录结构
```
backend/
├── cmd/
│   └── api/                 # 应用入口点
├── internal/
│   ├── api/                 # HTTP handlers
│   ├── service/             # 业务逻辑层
│   ├── repository/          # 数据访问层
│   ├── blockchain/          # 区块链接口
│   └── config/              # 配置管理
├── pkg/
│   └── utils/               # 公共工具函数
├── migrations/              # 数据库迁移脚本
├── go.mod                   # Go模块定义
└── Dockerfile               # Docker构建文件
```

## 3. 数据模型设计

### 3.1 数据库表结构

#### payment_sessions 表
存储支付会话信息，包括产品信息、支付金额、状态等。

#### tokens 表
存储支持的代币信息，包括合约地址、精度等。

#### networks 表
存储支持的区块链网络信息，包括RPC节点URL等。

### 3.2 数据关系图
```
payment_sessions
├── token_symbol ──────────┐
├── network_id ────────────┤
└── status                 │
                          │
tokens ◄───────────────────┤
├── symbol                 │
├── network_id ────────────┘
└── contract_address

networks ◄─────────────────┐
├── id                     │
├── chain_id               │
├── rpc_url                │
└── websocket_url          │
```

## 4. API设计

### 4.1 RESTful原则
- 使用HTTP动词表示操作类型(GET, POST, PUT, DELETE)
- 使用名词表示资源(/api/v1/payments)
- 版本化API(/api/v1/)
- 合理的状态码(200, 201, 400, 404, 500等)

### 4.2 核心API端点

#### 支付会话管理
- `POST /api/v1/payments` - 创建支付会话
- `GET /api/v1/payments/{paymentId}` - 获取支付会话状态
- `POST /api/v1/payments/{paymentId}/process` - 处理支付验证

#### 配置信息查询
- `GET /api/v1/tokens` - 获取支持的代币列表
- `GET /api/v1/networks` - 获取支持的网络列表

#### 系统监控和统计
- `GET /api/v1/stats/payments` - 获取支付统计数据
- `GET /api/v1/stats/monitoring` - 获取监控性能数据
- `GET /api/v1/stats/system` - 获取系统健康状态
- `GET /api/v1/stats/websocket` - 获取WebSocket连接统计信息
- `GET /api/v1/stats/websocket/messages` - 获取WebSocket消息日志
- `GET /health` - 健康检查端点

## 5. 区块链接口设计

### 5.1 核心功能
- 连接到BSC网络的多个RPC节点
- 监听代币合约的Transfer事件
- 验证交易的有效性(金额、地址)
- 实时更新支付状态

### 5.2 技术实现
- 使用go-ethereum库进行区块链交互
- WebSocket连接实现实时事件监听
- 多节点故障转移机制
- 交易确认机制(默认3个区块确认)

## 6. 安全设计

### 6.1 API安全
- 请求频率限制(Rate Limiting)
- 输入验证和清理
- CORS配置
- HTTPS强制传输

### 6.2 数据安全
- 敏感信息不存储(私钥等)
- 数据库访问控制
- 日志审计
- 定期备份

### 6.3 区块链安全
- 地址校验和验证
- 金额精确匹配
- 防重放攻击
- 交易签名验证

## 7. 部署架构

### 7.1 容器化部署
使用Docker Compose进行多容器编排:
- backend-api: Golang后端API服务
- nginx: 反向代理和静态文件服务
- sqlite: 嵌入在后端容器中的数据库

### 7.2 环境配置
- 开发环境(dev)
- 测试环境(staging)
- 生产环境(prod)

### 7.3 监控和日志
- 应用日志收集
- 性能监控
- 健康检查端点(/health)
- 错误追踪

## 8. 性能优化

### 8.1 数据库优化
- 索引优化
- 查询缓存
- 连接池管理

### 8.2 API优化
- 响应压缩(Gzip)
- 缓存策略
- 异步处理

### 8.3 区块链优化
- 连接复用
- 批量请求
- 本地缓存常用数据

## 9. 扩展性考虑

### 9.1 水平扩展
- 无状态API服务
- 分布式缓存
- 负载均衡

### 9.2 功能扩展
- 支持更多代币
- 支持更多区块链网络
- 添加管理后台
- 集成第三方支付网关

## 10. 项目管理

### 10.1 开发流程
- Git分支策略
- CI/CD流水线
- 代码审查
- 自动化测试

### 10.2 文档管理
- API文档(OpenAPI)
- 技术文档
- 用户手册
- 部署指南

## 11. 系统监控和统计API

### 11.1 监控指标设计

#### 支付监控指标
- 支付成功率统计（按时间段、代币类型等维度）
- 支付平均处理时间
- 支付失败原因分类统计
- 每日/每周/每月支付量趋势

#### 区块链监控指标
- WebSocket连接质量和稳定性指标
- 区块链监控延迟统计
- 交易验证成功率
- 区块同步延迟

#### 系统性能指标
- API响应时间和吞吐量监控
- 数据库查询性能
- 内存和CPU使用率
- 系统错误率统计

### 11.2 统计API端点

#### 支付统计数据
`GET /api/v1/stats/payments`
```json
{
  "total_payments": 1250,
  "successful_payments": 1180,
  "failed_payments": 70,
  "success_rate": 94.4,
  "payments_by_token": {
    "USDT": 520,
    "USDC": 430,
    "BUSD": 300
  },
  "payments_by_period": {
    "24h": 45,
    "7d": 320,
    "30d": 1250
  },
  "average_processing_time": 15.2,
  "failure_reasons": {
    "amount_mismatch": 35,
    "address_mismatch": 20,
    "transaction_failed": 15
  }
}
```

#### 监控性能数据
`GET /api/v1/stats/monitoring`
```json
{
  "websocket_connections": {
    "active": 3,
    "healthy": 2,
    "degraded": 1
  },
  "blockchain_monitoring": {
    "average_latency": 120,
    "last_block_processed": 28756341,
    "blocks_behind": 0,
    "events_detected": 1250
  },
  "validation_performance": {
    "average_validation_time": 2.1,
    "validation_success_rate": 99.2
  }
}
```

#### 系统健康状态
`GET /api/v1/stats/system`
```json
{
  "uptime": 86400,
  "cpu_usage": 25.5,
  "memory_usage": 45.2,
  "disk_usage": 12.3,
  "api_response_time": 45,
  "error_rate": 0.1,
  "database_health": "healthy",
  "blockchain_connection": "connected"
}
```

#### WebSocket连接统计
`GET /api/v1/stats/websocket`
```json
{
  "frontend": {
    "totalConnections": 150,
    "activeConnections": 3,
    "connectionErrors": 5,
    "reconnectAttempts": 2,
    "lastConnectionTime": "2023-12-01T10:30:00Z",
    "lastDisconnectionTime": "2023-12-01T09:15:00Z"
  },
  "blockchain": {
    "isConnected": true,
    "currentEndpoint": "wss://bsc-ws-node.nariox.org",
    "totalConnectionAttempts": 25,
    "reconnectAttempts": 3,
    "activeSubscriptions": 3,
    "lastConnectionTime": "2023-12-01T10:00:00Z",
    "lastDisconnectionTime": "2023-12-01T08:30:00Z"
  }
}
```

#### WebSocket消息日志
`GET /api/v1/stats/websocket/messages?limit=50`
```json
{
  "messages": [
    {
      "source": "frontend",
      "type": "payment_status_update",
      "paymentId": "pay_1234567890",
      "direction": "out",
      "data": {
        "status": "paid",
        "transactionHash": "0x1234567890abcdef...",
        "blockNumber": 12345678,
        "confirmations": 3,
        "amount": "10.00",
        "token": "USDT"
      },
      "timestamp": "2023-12-01T10:30:00Z"
    },
    {
      "source": "blockchain",
      "type": "transfer_event",
      "direction": "in",
      "data": {
        "from": "0xabcdef1234567890...",
        "to": "0xe27577B0e3920cE3...",
        "value": "10000000000000000000",
        "token": "USDT"
      },
      "timestamp": "2023-12-01T10:29:45Z"
    }
  ],
  "count": 2
}
```

### 11.3 监控仪表板设计

#### 实时支付监控视图
- 当前活跃支付会话数量
- 最近支付状态更新
- 实时交易检测展示
- 支付成功率实时图表

#### 系统健康状态概览
- 各组件健康状态指示灯
- 关键性能指标(KPI)展示
- 系统负载可视化
- 错误和警告信息汇总

#### 性能趋势图表展示
- 支付量历史趋势图
- 系统响应时间趋势
- 区块链监控延迟变化
- 错误率随时间变化图

### 11.4 告警机制
- 支付成功率低于阈值告警
- 系统错误率异常告警
- 区块链连接中断告警
- 性能指标异常告警

## 14. WebSocket监控功能更新

### 14.1 新增API端点

#### WebSocket统计信息
- `GET /api/v1/stats/websocket` - 获取WebSocket连接统计信息
  - 前端WebSocket连接状态
  - 区块链WebSocket连接状态

#### WebSocket消息日志
- `GET /api/v1/stats/websocket/messages` - 获取WebSocket消息日志
  - 支持limit参数限制返回消息数量
  - 返回前端和区块链WebSocket消息
  - 按时间倒序排列

### 14.2 前端监控页面

#### 独立监控页面
- 创建独立的WebSocket监控页面 (`websocket-monitor.html`)
- 通过 `/src/websocket-monitor.html` 访问
- 实时显示前端和区块链WebSocket连接状态
- 分别展示前端和区块链WebSocket消息日志
- 提供手动刷新和自动刷新功能

#### Vue组件监控
- 创建WebSocket状态监控Vue组件 (`WebSocketStatusMonitor.vue`)
- 在管理界面中集成WebSocket监控功能
- 提供前端和区块链WebSocket连接状态展示
- 分别显示前端和区块链WebSocket消息日志

### 14.3 消息日志功能

#### 前端WebSocket消息日志
- 记录所有前端WebSocket连接的消息
- 包括ping/pong心跳消息
- 包括支付状态更新消息
- 包括连接建立和断开事件

#### 区块链WebSocket消息日志
- 记录所有区块链WebSocket连接的消息
- 包括RPC请求和响应
- 包括订阅确认消息
- 包括代币转账事件
- 包括连接建立和断开事件

### 14.4 监控页面特性

#### 实时数据刷新
- 每10-30秒自动刷新监控数据
- 支持手动刷新按钮
- 显示最后更新时间

#### 连接状态指示
- 彩色状态指示灯显示连接状态
- 详细的连接统计信息
- 连接和断开时间戳

#### 消息分类显示
- 前端WebSocket消息单独显示区域
- 区块链WebSocket消息单独显示区域
- 消息按时间倒序排列
- 支持消息类型、方向筛选

#### 消息详情展示
- 完整的消息数据结构展示
- JSON格式化显示
- 时间戳显示
- 消息方向标识（输入/输出）

## 12. WebSocket实时支付状态推送

### 12.1 设计目标
为提升用户体验并减少前端轮询开销，后端将实现WebSocket服务，用于实时向客户端推送支付状态更新。当后端监听到区块链上的支付完成事件时，将通过WebSocket连接主动推送给前端，实现即时状态更新。

### 12.2 技术方案

#### WebSocket服务架构
- 后端将在Gin框架中集成WebSocket支持
- 每个前端客户端连接时创建唯一标识符(session ID)
- 后端维护session ID与支付ID的映射关系
- 当支付状态发生变化时，根据映射关系找到对应客户端进行推送

#### 连接管理
- 客户端通过REST API创建支付会话后，获得支付ID
- 客户端使用支付ID连接WebSocket服务
- 后端验证支付ID有效性并建立连接
- 支持连接心跳机制，防止连接中断

#### 消息格式
- 使用JSON格式进行消息传输
- 包含消息类型、数据内容、时间戳等字段
- 支持多种消息类型：连接确认、支付状态更新、错误通知等

### 12.3 WebSocket端点设计

#### 连接端点
`WebSocket /ws/payments/{paymentId}`
- 客户端通过支付ID建立WebSocket连接
- 服务端验证支付ID并创建会话

#### 消息结构
```json
{
  "type": "payment_status_update",
  "paymentId": "pay_1234567890",
  "data": {
    "status": "paid",
    "transactionHash": "0x1234567890abcdef...",
    "blockNumber": 12345678,
    "confirmations": 3,
    "amount": "10.00",
    "token": "USDT"
  },
  "timestamp": "2023-12-01T10:30:00Z"
}
```

### 12.4 实现细节

#### 后端实现
- 在Gin框架中集成WebSocket支持
- 创建WebSocket连接管理器，处理连接建立、维护和断开
- 实现支付状态变更监听器，当检测到支付完成时触发推送
- 添加连接认证和授权机制
- 实现心跳检测机制，维持连接活性

#### 消息类型定义
1. **连接确认消息** (`connection_ack`)
   - 客户端连接成功后发送
   - 包含连接状态和会话信息

2. **支付状态更新消息** (`payment_status_update`)
   - 支付状态发生变更时发送
   - 包含最新的支付状态信息

3. **错误通知消息** (`error`)
   - 发生错误时发送
   - 包含错误代码和描述信息

4. **心跳消息** (`ping`/`pong`)
   - 定期发送以维持连接
   - 防止连接因超时断开

### 12.5 安全考虑
- WebSocket连接需通过支付ID进行身份验证
- 实现消息签名验证机制
- 添加连接数限制，防止资源耗尽攻击
- 实现速率限制，防止单个客户端占用过多资源
- 使用WSS(WebSocket Secure)确保传输安全

### 12.6 性能优化
- 使用连接池管理WebSocket连接
- 实现批量消息推送机制
- 添加消息队列缓冲，处理高并发场景
- 优化内存使用，及时清理无效连接

### 12.7 前端集成设计

#### 客户端WebSocket连接流程
- 前端通过REST API创建支付会话后获得支付ID
- 使用支付ID建立WebSocket连接到`/ws/payments/{paymentId}`
- 连接成功后监听服务端推送的消息
- 根据收到的支付状态更新消息实时更新UI界面

#### 消息处理机制
- 连接确认消息：验证连接成功，开始监听状态更新
- 支付状态更新消息：解析支付状态并更新UI组件
- 错误通知消息：显示错误信息给用户
- 心跳消息：定期回应服务端心跳，维持连接活性

#### 前端状态管理
- 维护WebSocket连接状态（连接中、已连接、已断开）
- 缓存最近收到的支付状态信息
- 实现连接重试机制，网络中断时自动重连
- 提供状态更新回调接口，供UI组件注册监听

#### 用户体验优化
- 实时显示支付状态变化，无需手动刷新页面
- 在支付成功时自动跳转到成功页面
- 连接异常时给出友好提示并提供重连选项
- 添加加载状态指示器，提升用户感知体验

## 13. 前端架构设计

### 13.1 技术栈
- **框架**: Vue.js 3 + Vue Router
- **构建工具**: Vite
- **状态管理**: Vuex (可选)
- **样式**: CSS Modules + PostCSS
- **HTTP客户端**: Axios 或 Fetch API
- **WebSocket**: 原生WebSocket API

### 13.2 前端组件结构
```
frontend/src/
├── assets/                  # 静态资源文件
├── components/              # 可复用组件
│   ├── ProductSelection.vue # 产品选择页面
│   ├── PaymentPage.vue      # 支付方式选择页面
│   ├── QrPaymentPage.vue    # 二维码支付和监控页面
│   ├── PaymentSuccess.vue   # 支付成功页面
│   └── WebSocketStatusMonitor.vue # WebSocket状态监控组件
├── router/                  # 路由配置
├── store/                   # 状态管理(如需要)
├── App.vue                  # 根组件
└── main.js                  # 应用入口点
```

### 13.3 页面流程设计

#### 1. 产品选择页面 (ProductSelection.vue)
- 展示可购买的产品列表
- 用户可以选择一个产品
- 点击支付按钮进入支付页面

#### 2. 支付方式选择页面 (PaymentPage.vue)
- 显示所选产品的详细信息
- 用户选择支付代币类型(USDT、USDC、BUSD等)
- 用户选择网络(BSC等)
- 点击继续按钮创建支付会话

#### 3. 二维码支付页面 (QrPaymentPage.vue)
- 显示支付二维码和钱包地址
- 建立WebSocket连接监听支付状态
- 实时显示支付状态变化
- 支付成功后自动跳转到成功页面

#### 4. 支付成功页面 (PaymentSuccess.vue)
- 显示支付成功的确认信息
- 展示交易详情和区块链信息
- 提供返回首页或进行新支付的选项

### 13.4 前端WebSocket实现

#### 连接管理
- 在二维码支付页面建立WebSocket连接
- 使用支付ID作为连接参数
- 实现连接重试机制
- 处理连接异常和错误

#### 消息处理
- 监听并解析不同类型的WebSocket消息
- 根据消息类型更新页面状态
- 实现心跳机制维持连接

#### 用户体验优化
- 实时状态更新，无需手动刷新
- 加载状态指示器
- 友好的错误提示
- 自动跳转到成功页面