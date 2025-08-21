# 🚀 EVO Payment 本地运行指南

## 快速启动

### 方法1: 使用 Node.js 服务器 (推荐)

1. **启动开发服务器**
   ```bash
   node start-server.js
   ```

2. **打开浏览器访问**
   - 主应用: http://localhost:3000/demo/app.html
   - 或直接访问: http://localhost:3000 (会自动重定向)

### 方法2: 使用 Python 简单服务器

如果你有 Python 环境：

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

然后访问: http://localhost:8000/demo/app.html

### 方法3: 使用 Live Server (VS Code 扩展)

1. 安装 VS Code 的 "Live Server" 扩展
2. 右键点击 `demo/app.html` 文件
3. 选择 "Open with Live Server"

## 📱 功能演示页面

启动服务器后，你可以访问以下演示页面：

| 页面 | 地址 | 功能 |
|------|------|------|
| **主应用** | `/demo/app.html` | 完整的支付应用 |
| 支付处理演示 | `/demo/payment-demo.html` | 支付信息生成和管理 |
| 区块链连接演示 | `/demo/blockchain-demo.html` | Web3 钱包连接 |
| 交易监听演示 | `/demo/monitor-demo.html` | 区块链交易监听 |
| UI组件演示 | `/demo/ui-demo.html` | 用户界面组件 |
| 错误处理演示 | `/demo/error-demo.html` | 错误处理系统 |
| 响应式设计演示 | `/demo/responsive-demo.html` | 响应式布局 |

## 🔧 开发环境要求

- **Node.js** (推荐 v14 或更高版本)
- **现代浏览器** (Chrome, Firefox, Safari, Edge)
- **MetaMask 钱包** (用于完整功能测试)

## 🌐 网络配置

项目默认配置为 BSC 主网：
- **网络**: Binance Smart Chain (BSC)
- **Chain ID**: 56
- **RPC URL**: https://bsc-dataseed1.binance.org/

支持的代币：
- **USDT**: 0x55d398326f99059fF775485246999027B3197955
- **USDC**: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d  
- **BUSD**: 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56

## 📋 使用步骤

### 1. 启动项目
```bash
node start-server.js
```

### 2. 连接钱包
- 确保安装了 MetaMask 或其他 Web3 钱包
- 切换到 BSC 主网
- 点击 "Connect Wallet" 连接钱包

### 3. 测试支付流程
1. 选择支付金额 (10, 25, 50, 100, 250, 500 USD)
2. 选择代币 (USDT, USDC, BUSD)
3. 生成支付二维码
4. 使用钱包扫码或手动转账
5. 系统自动监听并确认交易

## 🔍 调试和测试

### 浏览器开发者工具
- 按 F12 打开开发者工具
- 查看 Console 标签页的日志输出
- Network 标签页可以查看网络请求

### 测试功能
- **支付ID生成**: 每次都会生成唯一ID
- **二维码生成**: 包含支付信息的二维码
- **状态管理**: 支付状态实时更新
- **错误处理**: 各种错误情况的处理
- **响应式设计**: 在不同设备上的显示效果

## 🚨 常见问题

### 1. 端口被占用
```
❌ 端口 3000 已被占用
```
**解决方案**: 修改 `start-server.js` 中的 `PORT` 变量为其他端口

### 2. 钱包连接失败
```
❌ 未检测到 Web3 钱包
```
**解决方案**: 
- 安装 MetaMask 浏览器扩展
- 确保钱包已解锁
- 刷新页面重试

### 3. 网络不支持
```
⚠️ 请切换到 BNB Smart Chain 网络
```
**解决方案**: 
- 在 MetaMask 中添加 BSC 网络
- 或点击应用中的网络切换按钮

### 4. 文件加载失败
```
❌ 404 页面未找到
```
**解决方案**: 
- 确保从项目根目录启动服务器
- 检查文件路径是否正确

## 📊 性能监控

服务器会输出访问日志：
```
2024-01-01T12:00:00.000Z - GET /demo/app.html
2024-01-01T12:00:01.000Z - GET /demo/css/responsive-styles.css
2024-01-01T12:00:02.000Z - GET /demo/js/payment-handler.js
```

## 🔒 安全注意事项

⚠️ **重要提醒**:
- 这是演示项目，不要在主网上使用大额资金测试
- 私钥和助记词请妥善保管
- 建议使用测试网络进行开发测试

## 📞 技术支持

如果遇到问题：
1. 检查浏览器控制台的错误信息
2. 确认网络连接正常
3. 验证钱包配置正确
4. 查看服务器日志输出

---

🎉 **祝你使用愉快！EVO Payment 让加密货币支付变得简单！**