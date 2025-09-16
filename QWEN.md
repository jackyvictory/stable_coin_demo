# 稳定币演示 - 现代化 Web3 支付系统

## 项目概述

本项目实现了一个完整的去中心化加密货币支付解决方案，支持多种稳定币支付，基于 BNB Smart Chain (BSC) 区块链技术，采用 WebSocket 实时监控。这是一个零后端架构的纯前端 + 区块链解决方案。

### 核心特性

#### 技术亮点
- **🔌 WebSocket 实时监控**: 替代传统轮询，真正的实时交易检测
- **⚡ 零后端架构**: 纯前端 + 区块链，无需服务器维护
- **🔄 智能故障转移**: 多 RPC 端点自动切换，确保服务可用性
- **📱 响应式设计**: 完美支持桌面和移动设备
- **🛡️ 安全可靠**: 基于区块链的透明交易，资金安全有保障

#### 支付体验
- **直观的支付流程**: 产品选择 → 支付方式 → 扫码支付 → 成功确认
- **多币种支持**: USDT、USDC、USDC.e、BUSD、TUSD
- **实时状态更新**: 支付状态实时监控和用户反馈
- **智能超时管理**: 30分钟支付窗口，自动过期处理

#### 技术架构
- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **区块链**: Web3.js + BNB Smart Chain (BSC)
- **监控**: WebSocket 实时事件监听
- **部署**: Docker + Nginx + Let's Encrypt SSL
- **样式**: 基于 Chakra UI 设计系统

## 构建和运行

### 快速开始方法

#### 🐳 方式一：Docker Compose 部署（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd demo/deploy

# 一键启动
docker-compose up -d

# 查看运行状态
docker-compose ps

# 访问应用
open http://localhost:8080
```

#### ⚡ 方式二：开发模式

```bash
# 进入项目目录
cd demo

# 使用 Python 启动静态服务器
python3 -m http.server 8080

# 或使用 Node.js
npx http-server -p 8080

# 访问应用
open http://localhost:8080
```

#### 🌐 方式三：生产环境部署

```bash
# 完整部署（包含 SSL 证书申请）
./deploy/deploy.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/key.pem your-email@example.com

# 快速更新（跳过镜像构建）
./deploy/deploy.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/key.pem your-email@example.com false
```

## 开发约定

### 代码结构

项目遵循模块化结构，关注点清晰分离：

```
demo/
├── 📄 核心页面
│   ├── index.html              # 🏠 首页（产品选择）
│   ├── payment.html            # 💳 支付方式选择页面
│   ├── qrcode.html            # 📱 二维码支付页面
│   └── success.html           # ✅ 支付成功页面
│
├── ⚙️ 配置文件
│   ├── config.js              # 🔧 应用主配置
│   └── .dockerignore          # 🐳 Docker 忽略文件
│
├── 🎨 样式文件
│   └── css/
│       ├── main.css           # 🎨 主样式文件
│       ├── payment.css        # 💳 支付页面样式
│       ├── qrcode.css         # 📱 二维码页面样式
│       └── success.css        # ✅ 成功页面样式
│
├── 💻 JavaScript 模块
│   └── js/
│       ├── main.js            # 🏠 主页面逻辑
│       ├── payment.js         # 💳 支付页面逻辑
│       ├── qrcode.js          # 📱 二维码页面逻辑
│       ├── success.js         # ✅ 成功页面逻辑
│       ├── payment-handler.js # 🔄 支付会话管理
│       └── blockchain.js      # 🔗 区块链集成 (WebSocket)
│
├── 🖼️ 资源文件
│   ├── images/
│   │   ├── logo.png           # 🏷️ 应用 Logo
│   │   ├── avatar_circular.png # 👤 用户头像
│   │   └── wallet_qr.jpg      # 📱 钱包二维码
│   └── lib/
│       └── web3.min.js        # 🌐 Web3.js 库
│
├── 🐳 部署配置
│   └── deploy/
│       ├── Dockerfile         # 🐳 Docker 镜像构建
│       ├── docker-compose.yml # 🐙 Docker Compose 配置
│       ├── nginx.conf         # 🌐 Nginx 服务器配置
│       ├── docker-entrypoint.sh # 🚀 容器启动脚本
│       ├── deploy.sh          # 🚀 主部署脚本
│       └── cache-manager.sh   # 📦 缓存管理脚本
│
└── 📋 运行时文件
    ├── logs/                  # 📝 应用日志
    └── ssl/                   # 🔒 SSL 证书
```

### 关键组件

#### 1. 支付流程管理 (`payment-handler.js`)
处理支付会话创建、状态跟踪和页面间导航。

#### 2. 区块链集成 (`blockchain.js`)
实现基于 WebSocket 的区块链交易实时监控，具有多个 RPC 端点之间的智能故障转移。

#### 3. UI 页面
- `index.html`: 产品选择界面
- `payment.html`: 支付方式和网络选择
- `qrcode.html`: 二维码显示和实时支付监控
- `success.html`: 支付确认和区块链交易详情

### 配置

主配置文件位于 `demo/config.js`:

```javascript
const CONFIG = {
  // 🔗 区块链配置
  blockchain: {
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    chainId: 56,                    // BSC 主网
    confirmations: 1                // WebSocket 版本只需 1 个确认
  },
  
  // 💳 支付配置
  payment: {
    receiverAddress: '0xe27577B0e3920cE35f100f66430de0108cb78a04',
    supportedTokens: ['USDT', 'USDC', 'USDC.e', 'BUSD', 'TUSD'],
    paymentTimeout: 30 * 60 * 1000, // 30分钟超时
    qrCodeImage: './images/wallet_qr.jpg'
  },
  
  // 🪙 代币合约配置
  tokens: {
    USDT: {
      symbol: 'USDT',
      name: 'Tether USD',
      contract: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18
    },
    USDC: {
      symbol: 'USDC', 
      name: 'USD Coin',
      contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18
    }
    // ... 更多代币配置
  },
  
  // 🌐 网络配置
  networks: {
    BSC: {
      name: 'BNB Smart Chain',
      chainId: 56,
      rpcUrl: 'https://bsc-dataseed1.binance.org/',
      blockExplorer: 'https://bscscan.com'
    }
  }
};
```

### WebSocket 监控配置

WebSocket 端点在 `demo/js/blockchain.js` 中配置:

```javascript
const WEBSOCKET_CONFIG = {
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
    }
  ],
  
  connectionStrategy: {
    reconnectInterval: 5000,
    maxReconnectAttempts: 3,
    connectionTimeout: 10000
  },
  
  heartbeatInterval: 30000
};
```

## 测试

### 开发环境设置

1. 确保已安装 Docker 和 Docker Compose
2. 确保端口 8080 和 8443 可用
3. 确保可以访问 BSC RPC 节点
4. 使用启用 JavaScript 的现代浏览器

### 测试流程

#### 完整测试步骤

1. **产品选择测试**
   ```bash
   # 访问首页，测试产品选择
   open http://localhost:8080
   ```

2. **支付流程测试**
   ```bash
   # 使用调试面板进行快速测试
   # 1. 选择产品 → 2. 选择支付方式 → 3. 点击调试面板中的"快速测试"
   ```

3. **WebSocket 连接测试**
   ```javascript
   // 控制台测试 WebSocket 连接
   blockchainMonitor.connect().then(() => {
     console.log('WebSocket 连接成功');
   });
   ```

4. **真实支付测试**
   ```bash
   # 使用测试网络或小额真实转账进行测试
   # 确保钱包中有少量 BSC 测试币
   ```

## 部署

### AWS EC2 部署

#### 🚀 方式一：完整自动化部署（推荐）

**智能检测，自动 SSL 配置，一键搞定所有**：

```bash
# 完整部署（包含 SSL 证书自动生成）
./deploy/deploy.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/your-key.pem your-email@example.com

# HTTP 模式部署
./deploy/deploy.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/your-key.pem temp@example.com

# 自动完成：
# - 环境预检查和依赖安装
# - 智能镜像构建和缓存优化
# - 推送镜像到远程服务器
# - 自动生成 Let's Encrypt SSL 证书
# - 智能启动应用（自动选择 HTTP/HTTPS）
# - 设置证书自动续期和健康检查
```

#### 方式二：快速更新部署

**利用缓存机制，快速更新应用程序代码**：

```bash
# 快速更新（跳过镜像构建，直接部署）
./deploy/deploy.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/your-key.pem your-email@example.com false

# 适用场景：
# - 配置文件更新
# - SSL 证书续期
# - 服务重启维护
```

## 故障排除

### 常见问题

#### 1. 支付监控不工作
**症状**: 二维码页面无法检测到支付
**解决方案**:
```bash
# 检查 RPC 连接状态
打开调试面板 → "🌐 RPC 连接状态"

# 测试区块链连接
点击 "🔄 刷新 RPC 状态"

# 切换 RPC 节点
点击 "🔄 切换 RPC"
```

#### 2. Docker 容器启动失败
**症状**: `docker-compose up` 报错
**解决方案**:
```bash
# 检查端口占用
lsof -i :8080
lsof -i :8443

# 清理旧容器
docker-compose down
docker system prune -f

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

#### 3. SSL 证书问题
**症状**: HTTPS 访问失败
**解决方案**:
```bash
# 检查证书状态
cd demo
./deploy/manage.sh ssl-check

# 手动续期证书
./deploy/manage.sh ssl-renew

# 重启服务
./deploy/manage.sh restart
```

## 性能监控

### 实时监控指标

#### WebSocket 连接质量
```javascript
// 获取连接质量信息
const quality = blockchainMonitor.getConnectionQuality();
console.log('连接质量:', quality);

// 示例输出
{
  messagesReceived: 1250,
  averageLatency: 45,      // 毫秒
  connectionUptime: 3600,  // 秒
  blocksMissed: 0,
  lastMessageTime: 1640995200000
}
```

#### 支付系统统计
```javascript
// 获取支付统计
const stats = paymentHandler.getPaymentStats();
console.log('支付统计:', stats);

// 示例输出
{
  total: 156,
  completed: 142,
  failed: 8,
  expired: 6,
  websocketMode: 156,
  averageDetectionTime: 2.3 // 秒
}
```