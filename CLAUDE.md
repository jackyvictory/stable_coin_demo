# CLAUDE.md

此文件为在该代码库中工作的Claude Code（claude.ai/code）提供指导。

## 项目概述

这是一个稳定币支付演示应用程序，允许用户使用BNB智能链（BSC）网络上的稳定币（如USDT、USDC和BUSD）进行加密货币支付。该应用程序具有从产品选择到支付完成的完整支付流程，并具备实时区块链交易监控功能。

## 架构

### 前端结构
- **主页面**: 
  - `index.html` - 产品选择页面，包含5个捐赠项目
  - `payment.html` - 支付方式和网络选择
  - `qrcode.html` - 二维码显示和实时支付监控
  - `success.html` - 支付确认和区块链交易详情

### 关键组件
1. **支付流程**: 
   - 产品选择 → 支付方式选择 → 二维码支付 → 实时监控 → 成功确认
2. **区块链集成**: 
   - 使用Web3.js与BSC网络交互
   - 基于WebSocket的实时交易监控
   - 支持BSC上的USDT、USDC、BUSD代币
3. **部署系统**: 
   - 基于Docker的容器化部署
   - 多阶段Docker构建，带有缓存优化
   - 使用Let's Encrypt自动管理SSL证书
   - 资源哈希处理，实现高效的浏览器缓存

### 后端/基础设施
- **容器化**: Docker多阶段构建
- **Web服务器**: 支持动态HTTP/HTTPS配置的Nginx
- **SSL管理**: 自动化的Let's Encrypt证书处理
- **缓存**: Docker层缓存，加快后续部署速度
- **资源优化**: 资产哈希处理，实现长期缓存

## 开发命令

### 构建过程
```bash
# 使用资源哈希构建Docker镜像
docker build -f deploy/Dockerfile -t evo-payment:latest .

# 使用特定标签构建
docker build -f deploy/Dockerfile -t evo-payment:20231201-120000 .
```

### 部署
```bash
# 完整部署（包含新镜像构建）
./deploy.sh user@host domain.com ~/.ssh/key.pem admin@example.com

# 快速部署（使用现有镜像）
./deploy.sh user@host domain.com ~/.ssh/key.pem admin@example.com false
```

### 本地开发
```bash
# 生成资源哈希用于缓存
node deploy/generate-resource-hashes.js .

# 管理Docker缓存
./deploy/cache-manager.sh status
./deploy/cache-manager.sh clean
```

### 容器管理
```bash
# 启动应用
./manage.sh start

# 停止应用
./manage.sh stop

# 重启应用
./manage.sh restart

# 查看日志
./manage.sh logs

# 检查状态
./manage.sh status

# 续期SSL证书
./manage.sh ssl-renew
```

## 关键文件和目录

### 核心应用
- `index.html` - 主产品选择页面
- `payment.html` - 支付方式选择
- `qrcode.html` - 二维码和监控界面
- `success.html` - 支付成功确认
- `config.js` - 全局配置设置

### JavaScript模块
- `js/payment-handler.js` - 支付会话管理
- `js/blockchain.js` - 区块链交互和WebSocket监控
- `js/qrcode.js` - 二维码页面功能
- `js/main.js` - 主页面交互

### 样式
- `css/main.css` - 所有页面共享的样式
- `css/payment.css` - 支付特定样式
- `css/qrcode.css` - 二维码页面样式
- `css/success.css` - 成功页面样式

### 部署基础设施
- `deploy/Dockerfile` - 多阶段Docker构建
- `deploy/deploy.sh` - 完整部署脚本
- `deploy/nginx.conf` - Nginx服务器配置
- `deploy/docker-compose.yml` - 容器编排
- `deploy/manage.sh` - 应用管理
- `deploy/cache-manager.sh` - Docker缓存管理
- `deploy/generate-resource-hashes.js` - 资产优化
- `deploy/docker-entrypoint.sh` - 容器启动脚本

## 配置

应用程序通过`config.js`进行配置，定义了：
- 区块链RPC端点和设置
- 支持的代币和合约地址
- 支付接收地址和超时设置
- UI品牌和主题颜色
- 网络配置

## 实时监控

二维码页面实现了基于WebSocket的实时交易监控：
- 连接到多个BSC WebSocket端点以实现冗余
- 监控代币合约上的Transfer事件
- 将交易与预期支付金额匹配
- 检测到支付时自动更新UI
- 连接失败时的回退机制

## 安全考虑

- 所有敏感配置都已外化
- 生产环境中强制SSL加密
- 实施内容安全策略头部
- API端点速率限制
- 安全的Docker容器配置