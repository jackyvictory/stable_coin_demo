# WebSocket 支付监听系统需求文档

## 介绍

本功能旨在创建一个基于 WebSocket + 轮询混合机制的支付监听系统，以提升支付确认速度，从当前的1.5-3分钟延迟降低到5秒以内。该系统将作为现有轮询系统的并行版本，便于对比测试效果。

## 需求

### 需求 1：独立的支付流程入口

**用户故事：** 作为用户，我希望能够选择使用新的快速支付监听方式，以便体验更快的支付确认速度。

#### 验收标准

1. WHEN 用户访问首页 THEN 系统应在现有 "Pay With Stable Coin" 按钮下方显示一个不显眼的 "Pay With Stable Coin (ws)" 按钮
2. WHEN 用户点击 "(ws)" 按钮 THEN 系统应跳转到 payment-ws.html 页面
3. WHEN 用户在 payment-ws.html 选择支付方式后 THEN 系统应跳转到 qrcode-ws.html 页面
4. WHEN 任何步骤出现错误 THEN 系统应提供回退到原有流程的选项
5. WHEN 创建 WebSocket 版本文件 THEN 系统应从对应的原版文件复制并修改（如：payment.html → payment-ws.html）

### 需求 2：WebSocket 实时区块监听

**用户故事：** 作为系统，我需要通过 WebSocket 实时监听新区块，以便在交易被打包后立即检测到支付。

#### 验收标准

1. WHEN 系统初始化 THEN 应尝试连接到可用的 BSC WebSocket 节点
2. WHEN WebSocket 连接成功 THEN 系统应订阅 newHeads 事件监听新区块
3. WHEN 收到新区块事件 THEN 系统应立即检查该区块中的相关交易
4. WHEN WebSocket 连接失败或断开 THEN 系统应自动尝试重连
5. WHEN WebSocket 重连失败超过3次 THEN 系统应回退到轮询模式

### 需求 3：轮询备用机制

**用户故事：** 作为系统，我需要在 WebSocket 不可用时提供轮询备用机制，确保支付监听的可靠性。

#### 验收标准

1. WHEN WebSocket 连接失败 THEN 系统应启动轮询备用机制
2. WHEN 使用轮询模式 THEN 系统应每2秒检查一次新区块
3. WHEN 轮询检查 THEN 系统应优先检查最新的20个区块
4. WHEN WebSocket 恢复连接 THEN 系统应自动切换回 WebSocket 模式
5. WHEN 轮询和 WebSocket 同时运行 THEN 系统应避免重复检查同一区块
6. WHEN 实现轮询备用机制 THEN 系统应在 -ws 文件中独立实现，不调用原版文件的轮询代码

### 需求 4：支付检测优化

**用户故事：** 作为用户，我希望系统能够快速准确地检测到我的支付，无论我使用哪种钱包。

#### 验收标准

1. WHEN 检测到新区块 THEN 系统应在3秒内完成该区块的交易扫描
2. WHEN 支付交易被打包到区块 THEN 系统应在5秒内检测到并确认支付
3. WHEN 找到匹配的交易 THEN 系统应验证交易金额、代币类型和接收地址
4. WHEN 交易确认数达到要求 THEN 系统应立即触发支付成功流程
5. WHEN 检测到多笔可能匹配的交易 THEN 系统应选择最符合条件的交易
6. WHEN 支付检测超时（30分钟）THEN 系统应显示超时提示

### 需求 5：性能监控和调试

**用户故事：** 作为开发者，我需要能够监控 WebSocket 连接状态和检测性能，以便优化系统。

#### 验收标准

1. WHEN 系统运行 THEN 应显示 WebSocket 连接状态（连接中/已连接/已断开/重连中）
2. WHEN 系统运行 THEN 应记录检测延迟时间（从交易发送到检测到的时间）
3. WHEN 系统运行 THEN 应提供调试面板显示详细的监听状态
4. WHEN 出现错误 THEN 系统应记录错误日志并显示用户友好的错误信息
5. WHEN 用户需要 THEN 系统应提供手动切换到原有流程的选项

### 需求 6：用户体验优化

**用户故事：** 作为用户，我希望新的支付流程与原有流程保持一致的用户体验，同时享受更快的确认速度。

#### 验收标准

1. WHEN 用户使用 WebSocket 流程 THEN 界面应与原有流程保持一致的设计风格
2. WHEN 支付被检测到 THEN 系统应显示实时的确认进度
3. WHEN 支付确认成功 THEN 系统应在2秒内跳转到成功页面
4. WHEN 连接状态改变 THEN 系统应向用户显示相应的状态提示
5. WHEN 用户遇到问题 THEN 系统应提供清晰的故障排除指导

### 需求 7：兼容性和回退机制

**用户故事：** 作为用户，我希望即使新功能出现问题，也能够正常完成支付流程。

#### 验收标准

1. WHEN WebSocket 功能不可用 THEN 系统应自动回退到优化的轮询模式
2. WHEN 浏览器不支持 WebSocket THEN 系统应显示兼容性提示并提供原有流程链接
3. WHEN 网络环境不稳定 THEN 系统应智能选择最适合的监听方式
4. WHEN 用户主动选择 THEN 系统应允许用户手动切换监听模式
5. WHEN 系统出现严重错误 THEN 应提供"使用原版本"的紧急回退选项

### 需求 8：代码复用和维护性

**用户故事：** 作为开发者，我希望新的 WebSocket 系统能够最大化复用现有代码，以便减少开发工作量和维护成本。

#### 验收标准

1. WHEN 创建 WebSocket 版本的页面文件 THEN 系统应从对应的原版文件复制（payment.html → payment-ws.html, qrcode.html → qrcode-ws.html, success.html → success-ws.html）
2. WHEN 创建 WebSocket 版本的 JavaScript 文件 THEN 系统应从对应的原版文件复制（payment.js → payment-ws.js, qrcode.js → qrcode-ws.js, blockchain.js → blockchain-ws.js）
3. WHEN 修改 WebSocket 版本文件 THEN 系统应只修改与 WebSocket 监听相关的部分，保持其他功能不变
4. WHEN 引用 JavaScript 文件 THEN WebSocket 版本的 HTML 文件应引用对应的 -ws 版本 JavaScript 文件
5. WHEN 页面跳转 THEN WebSocket 版本的页面应跳转到对应的 -ws 版本页面
6. WHEN 实现轮询备用机制 THEN 系统应在 -ws 版本的 JavaScript 文件中独立实现轮询逻辑，不依赖或调用原版文件的代码
7. WHEN 两套系统并行运行 THEN 系统应确保 -ws 版本和原版本完全独立，互不影响