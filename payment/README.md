# 稳定币支付系统

一个现代化的加密货币支付系统，使用Golang后端和Vue.js前端构建，支持BNB智能链上的稳定币支付。

## 项目结构

```
payment/
├── docs/                    # 文档和API规范
│   ├── api-spec.yaml        # OpenAPI 3.0规范
│   └── design.md            # 架构设计文档
├── frontend/                # 前端应用 (Vue.js)
│   ├── public/              # 静态资源
│   ├── src/                 # 源代码
│   ├── package.json         # 前端依赖
│   └── vite.config.js       # 构建配置
├── backend/                 # 后端应用 (Golang)
│   ├── cmd/                 # 应用入口点
│   ├── internal/            # 内部包
│   ├── pkg/                 # 公共包
│   ├── migrations/          # 数据库迁移
│   ├── go.mod               # Go模块
│   └── Dockerfile           # 后端Docker镜像
├── docker-compose.yml       # Docker Compose配置
└── README.md                # 本文档
```

## 功能特性

- **现代化架构**: 前后端分离，RESTful API
- **区块链集成**: 支持BNB智能链稳定币 (USDT, USDC, BUSD)
- **数据库**: SQLite简化部署，支持迁移
- **容器化**: Docker和Docker Compose简化部署
- **API文档**: OpenAPI 3.0规范，支持Swagger UI
- **实时监控**: 基于WebSocket的支付状态更新

## 环境要求

- Docker和Docker Compose
- Node.js (前端开发)
- Go 1.21+ (后端开发)
- Make (可选，用于简化命令)

## 快速开始

### 使用Docker Compose (推荐)

```bash
# 克隆仓库
git clone <repository-url>
cd payment

# 启动所有服务
docker-compose up -d

# 访问应用
# 前端: http://localhost:3000
# 后端API: http://localhost:8080
# API文档: http://localhost:8080/swagger/index.html
```

> 注意: Docker构建可能需要一些时间，特别是第一次运行时。如果遇到构建问题，请参考下面的本地开发说明。

### 使用Makefile (推荐)

```bash
# 克隆仓库
git clone <repository-url>
cd payment

# 查看可用命令
make help

# 初始化开发环境
make dev-init

# 构建所有服务
make build

# 启动所有服务
make start

# 查看服务状态
make status

# 查看日志
make logs

# 停止所有服务
make stop
```

### 本地运行和调试

如果您在Docker环境中遇到构建问题，可以使用以下步骤在本地运行和调试应用：

### 后端开发

```bash
cd backend

# 安装依赖
go mod tidy

# 运行迁移并启动服务器
go run cmd/api/main.go
```

后端API将在 http://localhost:8080 上运行。

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 http://localhost:3000 上运行，并自动代理API请求到后端。

## 故障排除

### Docker构建问题

如果在Docker构建过程中遇到问题：

1. 确保您的Docker环境可以访问Docker Hub
2. 尝试更新依赖库版本：
   ```bash
   cd backend
   go get -u github.com/mattn/go-sqlite3
   ```
3. 清理Docker缓存并重新构建：
   ```bash
   docker-compose build --no-cache
   ```

### 端口冲突

如果遇到端口冲突错误，请确保没有其他服务正在使用端口3000（前端）或8080（后端）：
```bash
# 检查端口使用情况
lsof -i :3000
lsof -i :8080

# 杀死占用端口的进程
kill <PID>
```

## API文档

API使用OpenAPI 3.0规范进行文档化。您可以在`docs/api-spec.yaml`找到规范文件。

导入Postman的方法：
1. 打开Postman
2. 点击"Import"
3. 选择`docs/api-spec.yaml`文件
4. 集合将自动创建

## 数据库

应用使用SQLite进行数据存储。数据库文件存储在`backend/data/payment.db`，并在Docker中挂载为卷。

### 迁移

数据库迁移在应用启动时自动处理。迁移文件位于`backend/migrations/`。

## 配置

环境变量可以在`docker-compose.yml`中设置或直接传递给容器：

| 变量 | 描述 | 默认值 |
|------|------|--------|
| SERVER_PORT | 后端服务器端口 | 8080 |
| DB_PATH | SQLite数据库路径 | ./data/payment.db |
| JWT_SECRET | JWT密钥 | payment_secret_key |
| BLOCKCHAIN_RPC | BSC RPC节点 | https://bsc-dataseed1.binance.org/ |
| RECEIVER_ADDRESS | 收款地址 | 0xe27577B0e3920cE35f100f66430de0108cb78a04 |
| PAYMENT_TIMEOUT | 支付会话超时(分钟) | 30 |

## 构建Docker镜像

### 后端

```bash
cd backend
docker build -t payment-backend .
```

### 前端

```bash
cd frontend
docker build -t payment-frontend .
```

## 测试

### 后端API测试

您可以使用提供的OpenAPI规范配合Postman或curl测试API：

```bash
# 创建支付会话
curl -X POST http://localhost:8080/api/v1/payments \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "peanut",
    "productName": "Peanuts",
    "amount": 1.00,
    "currency": "USD",
    "tokenSymbol": "USDT",
    "networkId": "BSC",
    "receiverAddress": "0xe27577B0e3920cE35f100f66430de0108cb78a04"
  }'

# 获取支付会话状态
curl http://localhost:8080/api/v1/payments/{paymentId}

# 处理支付
curl -X POST http://localhost:8080/api/v1/payments/{paymentId}/process \
  -H "Content-Type: application/json" \
  -d '{"transactionHash": "0x..."}'
```

## 架构概览

### 后端 (Golang)

- **框架**: Gin Web框架
- **数据库**: SQLite配合sqlx
- **区块链**: go-ethereum库
- **API**: RESTful配合OpenAPI 3.0文档
- **容器**: 多阶段Docker构建

### 前端 (Vue.js)

- **框架**: Vue 3配合Composition API
- **构建工具**: Vite
- **路由**: Vue Router
- **HTTP客户端**: Axios
- **容器**: Nginx多阶段构建

## 安全

- 生产环境强制HTTPS
- 输入验证和清理
- 速率限制
- 基于JWT的认证
- 安全头设置
- 数据库参数化查询

## 监控和日志

- 健康检查端点
- 结构化日志
- Docker健康检查
- 错误追踪

## 贡献

1. Fork仓库
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

本项目使用MIT许可证。