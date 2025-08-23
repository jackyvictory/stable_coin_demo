# Stable Coin - 加密货币支付系统

一个完整的加密货币支付解决方案，支持多种稳定币支付，集成 BNB Smart Chain 区块链技术。

## 📖 项目概述

Stable Coin 是一个现代化的 Web3 支付系统，专为加密货币捐赠和支付场景设计。系统采用前端 + 区块链的架构，无需后端服务器即可实现完整的支付流程。

### 🎯 设计理念
- **去中心化**: 直接与区块链交互，无需中心化支付处理器
- **用户友好**: 简洁直观的界面，类似传统支付体验
- **安全可靠**: 基于区块链的透明交易，资金安全有保障
- **高度可定制**: 模块化设计，易于集成和定制

### 🏗️ 技术栈
- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **区块链**: Web3.js + BNB Smart Chain
- **部署**: Docker + Nginx + Let's Encrypt
- **样式**: Chakra UI 设计系统
- **监控**: 实时区块链交易监控

### 💡 应用场景
- 🎁 **慈善捐赠**: 透明的慈善捐款平台
- 🛒 **电商支付**: 支持加密货币的在线商店
- 💰 **众筹平台**: 去中心化的项目众筹
- 🎮 **游戏内购**: 区块链游戏的道具购买
- 📱 **数字服务**: SaaS 产品的加密货币订阅

## 📚 目录

- [✨ 核心特性](#-核心特性)
- [🚀 快速开始](#-快速开始)
- [⚙️ 配置说明](#️-配置说明)
- [📁 项目结构](#-项目结构)
- [💳 支付流程](#-支付流程)
- [🔗 区块链集成](#-区块链集成)
- [🛠️ 开发指南](#️-开发指南)
- [🚀 生产环境部署](#-生产环境部署)
- [🔧 故障排除](#-故障排除)

## ✨ 核心特性

### 🎨 用户界面
- **现代化设计**: 基于 Chakra UI 设计系统的响应式界面
- **完整支付流程**: 产品选择 → 支付方式 → 二维码支付 → 成功确认
- **实时状态更新**: 支付状态实时监控和用户反馈
- **多语言支持**: 中英文界面支持

### 💰 支付功能
- **多币种支持**: USDT、USDC、USDC.e、BUSD、TUSD
- **固定收款地址**: 统一的收款钱包地址管理
- **实时汇率**: 美元定价，自动代币数量计算
- **支付超时**: 30分钟支付窗口，自动过期处理

### 🔗 区块链集成
- **BNB Smart Chain**: 基于 BSC 主网的代币转账监控
- **智能合约**: ERC-20 代币标准支持
- **多 RPC 节点**: 自动故障转移和负载均衡
- **交易确认**: 实时区块链交易状态监控

### 🛠️ 技术架构
- **模块化设计**: 清晰的代码结构和组件分离
- **状态管理**: 完整的支付会话和状态管理
- **错误处理**: 全面的错误捕获和用户友好提示
- **调试工具**: 内置调试面板和开发者工具

## 🚀 快速开始

### 方式一：Docker Compose 部署（推荐）

```bash
# 进入项目部署目录
cd demo/deploy

# 启动应用（后台运行）
docker-compose up -d

# 查看运行状态
docker-compose ps

# 访问应用
open http://localhost:8080

# 查看日志
docker-compose logs -f

# 停止应用
docker-compose down
```

### 方式二：Docker 容器部署

```bash
# 进入项目部署目录
cd demo/deploy

# 构建镜像
docker build -t evo-payment .

# 运行容器
docker run -d -p 8080:80 --name evo-payment-app evo-payment

# 访问应用
open http://localhost:8080

# 查看日志
docker logs -f evo-payment-app

# 停止容器
docker stop evo-payment-app
docker rm evo-payment-app
```

### 方式三：开发模式

使用静态文件服务器直接运行（适合开发调试）：

```bash
# 进入项目部署目录
cd demo

# 使用 Python（推荐）
python3 -m http.server 8080

# 使用 Node.js
npx http-server -p 8080

# 使用 PHP
php -S localhost:8080

# 然后访问
open http://localhost:8080
```

## ⚙️ 配置说明

### 主配置文件 `config.js`

```javascript
const CONFIG = {
  // 区块链配置
  blockchain: {
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    chainId: 56,                    // BSC 主网
    confirmations: 3,               // 确认数
    pollingInterval: 5000           // 轮询间隔（毫秒）
  },
  
  // 支付配置
  payment: {
    receiverAddress: '0xe27577B0e3920cE35f100f66430de0108cb78a04',
    supportedTokens: ['USDT', 'USDC', 'BUSD'],
    paymentTimeout: 30 * 60 * 1000, // 30分钟超时
    qrCodeImage: './images/wallet_qr.jpg'
  },
  
  // 代币合约地址（BSC 主网）
  tokens: {
    USDT: {
      contract: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18
    },
    USDC: {
      contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18
    },
    BUSD: {
      contract: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      decimals: 18
    }
  }
};
```

### 关键配置项

- **收款地址**: 固定的 BSC 钱包地址，所有支付都发送到此地址
- **支持代币**: USDT、USDC、USDC.e、BUSD、TUSD
- **网络设置**: BNB Smart Chain 主网（Chain ID: 56）
- **超时设置**: 支付会话 30 分钟自动过期
- **RPC 节点**: 多个备用节点，自动故障转移

## 📁 项目结构

```
demo/
├── 📄 核心页面 (WebSocket 版本)
│   ├── index.html              # 首页（产品选择）
│   ├── payment-ws.html         # 收银台页面（支付方式选择）
│   ├── qrcode-ws.html         # 二维码支付页面
│   ├── success-ws.html        # 支付成功页面
│   └── test-payment-success.html # 测试页面
│
├── ⚙️ 配置文件
│   ├── config.js              # 应用主配置
│   └── .dockerignore          # Docker 忽略文件
│
├── 🎨 样式文件
│   └── css/
│       ├── main.css           # 主样式文件
│       ├── payment.css        # 支付页面样式
│       ├── qrcode.css         # 二维码页面样式
│       └── success.css        # 成功页面样式
│
├── 💻 JavaScript 模块
│   └── js/
│       ├── main.js            # 主页面逻辑
│       ├── payment-ws.js      # 支付页面逻辑 (WebSocket)
│       ├── qrcode-ws.js       # 二维码页面逻辑 (WebSocket)
│       ├── success-ws.js      # 成功页面逻辑 (WebSocket)
│       ├── payment-handler-ws.js # 支付会话管理 (WebSocket)
│       └── blockchain-ws.js   # 区块链集成 (WebSocket)
│
├── 🖼️ 资源文件
│   ├── images/
│   │   ├── logo.png           # 应用 Logo
│   │   ├── avatar.jpg         # 用户头像
│   │   ├── wallet_qr.jpg      # 钱包二维码
│   │   └── donation_bg.png    # 背景图片
│   └── lib/
│       └── web3.min.js        # Web3.js 库
│
├── 🐳 部署配置
│   └── deploy/
│       ├── Dockerfile         # Docker 镜像构建
│       ├── docker-compose.yml # Docker Compose 配置
│       ├── nginx.conf         # Nginx 服务器配置
│       ├── docker-entrypoint.sh # 容器启动脚本
│       ├── deploy.sh          # 主部署脚本
│       ├── manage.sh          # 应用管理脚本
│       ├── cache-manager.sh   # 缓存管理脚本
│       └── DEPLOYMENT.md      # 详细部署指南
│
└── 📋 日志和证书
    ├── logs/                  # 应用日志
    │   ├── access.log
    │   └── error.log
    └── ssl/                   # SSL 证书
        ├── cert.pem
        └── key.pem
```

## 💳 支付流程

### 1. 产品选择页面（index.html）
- 🥜 选择捐赠产品（花生 $0.01 - 水果 $3.00）
- 📝 显示捐赠信息和团队头像
- 🔘 点击 "Pay With Stable Coin" 按钮

### 2. 支付方式选择页面（payment-ws.html）
- 💰 **选择代币**: USDT、USDC、USDC.e、BUSD、TUSD
- 🌐 **选择网络**: BNB Smart Chain（BSC）
- ⏰ 显示支付 ID 和过期时间倒计时
- ✅ 点击 "Continue to Payment" 进入下一步

### 3. 二维码支付页面（qrcode-ws.html）
- 📱 显示钱包地址二维码
- 📋 可复制的钱包地址
- 📊 实时支付状态监控
- 🔄 区块链交易确认进度
- 🛠️ 内置调试工具面板

### 4. 支付成功页面（success-ws.html）
- ✅ 支付确认信息
- 📄 交易详情摘要
- 🔗 区块链浏览器链接
- 🏠 返回首页或新建支付

### 支付状态管理
```javascript
const PaymentStatus = {
    PENDING: 'pending',      // 等待用户选择
    WAITING: 'waiting',      // 等待支付
    MONITORING: 'monitoring', // 监听中
    CONFIRMED: 'confirmed',   // 已确认
    COMPLETED: 'completed',   // 已完成
    EXPIRED: 'expired',      // 已过期
    FAILED: 'failed'         // 支付失败
};
```

## 🔗 区块链集成

### 网络配置
- **主网**: BNB Smart Chain (Chain ID: 56)
- **收款地址**: `0xe27577B0e3920cE35f100f66430de0108cb78a04`
- **区块浏览器**: https://bscscan.com

### 支持的代币合约
```javascript
const TOKENS = {
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  TUSD: '0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9'
};
```

### RPC 节点配置
- **主节点**: `https://bsc-dataseed1.binance.org/`
- **备用节点**: 自动故障转移到多个 BSC RPC 端点
- **健康检查**: 每 60 秒检查 RPC 节点状态
- **智能切换**: 遇到限流或错误自动切换节点

### 交易监控机制
- **轮询间隔**: 5 秒检查一次新交易
- **确认要求**: 1 个区块确认
- **超时设置**: 30 分钟支付窗口
- **智能延迟**: 避免 RPC 限流的智能调用间隔
- **错误重试**: 自动重试和错误恢复机制

### 区块链监控特性
```javascript
// 智能 RPC 调用管理
- 多 RPC 端点负载均衡
- 自动故障检测和切换  
- 调用频率限制和智能延迟
- 连接健康状态监控

// 交易监控优化
- 增量区块扫描
- Transfer 事件过滤
- 交易哈希验证
- 确认数实时更新
```

## 🛠️ 开发指南

### 本地开发环境

```bash
# 1. 克隆项目
git clone <repository-url>
cd demo

# 2. 启动开发服务器
python3 -m http.server 8080

# 3. 访问应用
open http://localhost:8080
```

### 代码结构说明

#### 前端架构
- **模块化设计**: 每个页面独立的 JS 和 CSS 文件
- **状态管理**: `PaymentHandler` 类管理支付会话
- **事件驱动**: 基于事件的状态变化通知
- **错误处理**: 全面的错误捕获和用户提示

#### 关键模块

**支付处理器 (`payment-handler.js`)**
```javascript
// 创建支付会话
const session = paymentHandler.createPaymentSession(productInfo);

// 更新支付状态  
paymentHandler.updatePaymentSession(paymentId, { status: 'confirmed' });

// 页面导航管理
paymentHandler.navigateToPage('qr-code', paymentId);
```

**区块链管理器 (`blockchain.js`)**
```javascript
// 初始化连接
await blockchainManager.initialize();

// 监控交易
const transfers = await blockchainManager.getLatestTokenTransfers(
  'USDT', receiverAddress, fromBlock
);
```

### 调试工具

#### 内置调试面板
- 🧪 **快速测试**: 模拟支付成功，无需真实转账
- ⏯️ **轮询控制**: 暂停/恢复区块链监控
- 🌐 **RPC 状态**: 实时 RPC 连接状态
- 🔧 **调试按钮**: 各种测试和诊断功能

#### 开发者工具
```javascript
// 浏览器控制台可用的全局对象
window.paymentHandler    // 支付会话管理
window.blockchainManager // 区块链连接管理  
window.CONFIG           // 应用配置
window.PaymentStatus    // 支付状态枚举
```

### 自定义配置

#### 修改收款地址
```javascript
// config.js
payment: {
  receiverAddress: '0x你的钱包地址',
  // ...
}
```

#### 添加新代币
```javascript
// config.js  
tokens: {
  NEWTOKEN: {
    symbol: 'NEWTOKEN',
    contract: '0x合约地址',
    decimals: 18
  }
}
```

#### 调整监控参数
```javascript
// config.js
blockchain: {
  pollingInterval: 3000,  // 3秒轮询
  confirmations: 1,       // 1个确认
  // ...
}
```

### 测试和调试

#### 快速测试流程
1. 打开 `qrcode-ws.html` 页面
2. 点击 "⚙️ Debug" 按钮
3. 使用 "🧪 快速测试" 模拟支付成功
4. 验证页面跳转和状态更新

#### 区块链测试
1. 使用调试面板的 "🌐 RPC Connection Status"
2. 测试不同 RPC 端点的连接状态
3. 验证交易监控和事件解析

#### 日志调试
```javascript
// 启用详细日志
localStorage.setItem('debug', 'true');

// 查看支付状态
console.log(paymentHandler.getCurrentPayment());

// 查看区块链状态
console.log(blockchainManager.getRpcStatus());
```

## 生产环境部署

### ⚡ 优化部署方式 (推荐)

**智能缓存构建，显著提升部署速度**

#### 🚀 完整部署 (首次部署)
使用优化的多阶段构建，创建基础镜像缓存：
```bash
./demo/deploy-complete.sh <user@host> <domain> <ssh-key> <email>
```
**示例：**
```bash
./demo/deploy-complete.sh ubuntu@18.141.172.113 demo.ctbz.xyz ~/.ssh/key.pem admin@example.com
```

**首次部署流程：**
1. ✨ 智能清理环境
2. 🔨 构建基础镜像缓存 (包含nginx、工具等)
3. 📦 构建应用镜像 (仅项目文件)
4. 🛠️ 准备远程环境
5. 🌐 验证网络连通性
6. 🔒 申请Let's Encrypt SSL证书
7. 🚀 启动HTTPS服务
8. ✅ 健康检查和验证

#### ⚡ 快速更新 (后续部署)
利用缓存快速更新应用代码，构建时间减少80%+：
```bash
./demo/deploy-quick.sh <user@host> <domain> <ssh-key>
```
**示例：**
```bash
./demo/deploy-quick.sh ubuntu@18.141.172.113 demo.ctbz.xyz ~/.ssh/key.pem
```

**快速更新流程：**
1. ⚡ 利用基础镜像缓存快速构建 (仅10-30秒)
2. 📤 快速推送应用镜像
3. 🔄 零停机更新服务
4. ✅ 健康检查

#### 🔧 缓存管理
管理Docker镜像缓存，优化存储空间：
```bash
./demo/cache-manager.sh status    # 查看缓存状态
./demo/cache-manager.sh clean     # 清理旧版本 (保留缓存)
./demo/cache-manager.sh rebuild   # 重建基础镜像缓存
./demo/cache-manager.sh size      # 显示镜像大小统计
```

**性能对比：**
- 🐌 传统部署: 5-10分钟 (每次下载基础组件)
- ⚡ 优化部署: 首次3-5分钟，后续1-2分钟
- 💾 存储优化: 分层缓存，减少重复下载

## AWS EC2 部署

### 🚀 方式1: 终极一键部署 (推荐)

**智能检测，自动配置SSL，一键搞定所有** - 真正的零配置部署：

```bash
# 一条命令完成所有部署 (包含SSL证书自动生成)
./deploy-ultimate.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/your-key.pem your-email@example.com

# 或者仅HTTP模式
./deploy-ultimate.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/your-key.pem

# 就这么简单！自动完成：
# - 环境预检查 (域名解析、SSH连接)
# - 本地构建一体化镜像
# - 推送镜像到远程服务器
# - 自动安装必要依赖 (Docker, certbot等)
# - 自动生成Let's Encrypt SSL证书
# - 智能启动应用 (自动选择HTTP/HTTPS)
# - 设置证书自动续期
```

**🎯 智能特性:**
- ✅ 自动检测域名解析
- ✅ 自动安装必要依赖
- ✅ 自动生成SSL证书 (Let's Encrypt)
- ✅ 自动选择HTTP/HTTPS配置
- ✅ 自动设置证书续期
- ✅ 智能健康检查和状态监控

### 方式2: 一体化镜像部署

**一个镜像搞定一切** - 应用代码、配置文件、管理脚本全部打包到单个镜像：

```bash
# 基础一键部署 (需要手动配置SSL)
./deploy-simple.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/your-key.pem

# 或包含SSL自动生成
./deploy-auto-ssl.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/your-key.pem your-email@example.com
```

**特性:**
- ✅ 极简部署流程
- ✅ 无需配置文件管理
- ✅ 可选SSL自动生成
- ✅ 智能启动脚本

### 方式2: 分离配置部署

本地构建镜像并推送到远程主机：

```bash
# 完整部署流程
./deploy-to-remote.sh ubuntu@your-ec2-ip your-domain.com ~/.ssh/your-key.pem your-email@example.com

# 或分步骤部署
./build-and-push.sh ubuntu@your-ec2-ip ~/.ssh/your-key.pem
ssh -i ~/.ssh/your-key.pem ubuntu@your-ec2-ip
cd /opt/evo-payment
./deploy-remote.sh your-domain.com
```

### 方式3: 传统上传部署

上传项目文件到服务器后在服务器上构建：

```bash
# 上传项目到 EC2
./upload-to-ec2.sh ubuntu@your-ec2-ip ~/.ssh/your-key.pem

# SSH 连接到 EC2
ssh -i ~/.ssh/your-key.pem ubuntu@your-ec2-ip
cd /opt/evo-payment

# 准备环境
./prepare-ec2.sh

# 重新登录使 Docker 权限生效
exit && ssh -i ~/.ssh/your-key.pem ubuntu@your-ec2-ip
cd /opt/evo-payment

# 运行快速设置向导
./quick-setup.sh
```

### 手动部署

#### 1. 环境准备
```bash
./prepare-ec2.sh  # 安装 Docker, Docker Compose 等
```

#### 2. SSL 证书配置 (可选)

**Let's Encrypt 免费证书 (推荐):**
```bash
./setup-ssl.sh --letsencrypt your-domain.com your-email@example.com
```

**使用现有证书:**
```bash
./setup-ssl.sh /path/to/cert.pem /path/to/key.pem
```

#### 3. 部署应用
```bash
./deploy-aws.sh your-domain.com
```

#### 4. 监控和管理
```bash
./monitor.sh status    # 查看状态
./monitor.sh logs      # 查看日志
./monitor.sh restart   # 重启服务
```

### 证书管理

**Let's Encrypt 证书自动续期:**
- 部署时自动设置 cron 任务
- 手动续期: `./renew-ssl.sh`

### 生产环境特性

- Nginx 优化配置 (Gzip, 缓存, 安全头部)
- HTTPS 支持和自动重定向
- Let's Encrypt 证书自动续期
- 健康检查和监控
- 日志管理和轮转
- 一键部署和管理脚本

## 🔧 故障排除

### 常见问题

#### 1. 支付监控不工作
**症状**: 二维码页面无法检测到支付
**解决方案**:
```bash
# 检查 RPC 连接状态
打开调试面板 → "🌐 RPC Connection Status"

# 测试区块链连接
点击 "🔄 Refresh RPC Status"

# 切换 RPC 节点
点击 "🔄 Switch RPC"
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

#### 4. 区块链 RPC 限流
**症状**: 频繁出现 "rate limit" 错误
**解决方案**:
- 系统会自动切换到备用 RPC 节点
- 调整 `config.js` 中的 `pollingInterval` 增加间隔
- 使用调试面板暂停监控，手动刷新

### 开发环境检查清单

- [ ] **Docker**: 确保 Docker 和 Docker Compose 已安装
- [ ] **端口**: 确保 8080 和 8443 端口可用
- [ ] **网络**: 确保可以访问 BSC RPC 节点
- [ ] **浏览器**: 使用现代浏览器，启用 JavaScript
- [ ] **HTTPS**: 生产环境需要有效的 SSL 证书

### 性能优化建议

#### 前端优化
- 启用浏览器缓存
- 压缩静态资源
- 使用 CDN 加速

#### 区块链优化  
- 合理设置轮询间隔
- 使用多个 RPC 端点
- 实施智能重试机制

#### 服务器优化
- 配置 Nginx 缓存
- 启用 Gzip 压缩
- 设置适当的安全头部

### 监控和日志

#### 应用日志
```bash
# Docker 日志
docker-compose logs -f

# Nginx 访问日志
tail -f logs/access.log

# Nginx 错误日志  
tail -f logs/error.log
```

#### 区块链监控
```bash
# 在浏览器控制台
console.log(blockchainManager.getRpcStatus());
console.log(paymentHandler.getPaymentStats());
```

### 技术支持

如遇到问题，请提供以下信息：
1. **错误描述**: 详细的错误现象和重现步骤
2. **环境信息**: 操作系统、浏览器版本、Docker 版本
3. **日志信息**: 相关的错误日志和控制台输出
4. **配置信息**: `config.js` 中的相关配置（隐藏敏感信息）

### 联系方式
- 📧 技术支持: [技术支持邮箱]
- 📖 文档: 查看 `deploy/DEPLOYMENT.md` 获取详细部署指南
- 🐛 问题反馈: 提交 GitHub Issue