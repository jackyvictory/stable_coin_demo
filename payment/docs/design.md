# Stable Coin Payment System - 架构设计文档

## 1. 概述

本系统是一个基于稳定币的支付平台，允许用户使用BNB智能链(BSC)上的稳定币(USDT、USDC、BUSD)进行支付。系统采用前后端分离架构，后端使用Golang实现RESTful API，前端使用现代化框架构建用户界面。

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────┐    RESTful API    ┌─────────────────────┐
│   Frontend      │ ◄────────────────►│     Backend API     │
│  (Vue/React)    │                   │    (Golang/Gin)     │
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

#### 配置信息查询
- `GET /api/v1/tokens` - 获取支持的代币列表
- `GET /api/v1/networks` - 获取支持的网络列表

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