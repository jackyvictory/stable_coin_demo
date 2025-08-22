# 需求文档

## 介绍

本项目旨在创建一个像素级复刻 https://donate.imsafu.com 的支付系统，并将其改造为 EVO Payment 品牌。系统包括商品选购首页、收银台页面、以及 BNB Smart Chain 主网区块链交易监听功能。所有 imsafu 品牌元素将替换为 EVO Payment。

## 需求

### 需求 1

**用户故事：** 作为用户，我希望看到一个与 https://donate.imsafu.com 完全相同但使用 EVO Payment 品牌的首页，以便我可以选择捐赠商品。

#### 验收标准

1. 当我访问首页时，系统应该显示与 https://donate.imsafu.com 完全相同的布局和样式
2. 当我查看页面时，所有 "imsafu" 文字应该替换为 "EVO Payment"
3. 当我查看页面时，所有 imsafu 标志应该替换为 /Users/zhangjacky/src/stable_coin_payment/demo/images/logo.png
4. 当我查看页面时，页面应该显示商品选项和价格（如：Peanut $0.25, Rice $0.50 等）
5. 当我查看页面时，每个商品都是一个单选框，所有商品都下方有一个 "Pay With EVO Payment" 按钮

### 需求 2

**用户故事：** 作为用户，我希望点击 "Pay With EVO Payment" 后进入收银台页面，以便我可以选择支付方式和网络。

#### 验收标准

1. 当我点击 "Pay With EVO Payment" 时，系统应该导航到收银台页面
2. 当我查看收银台页面时，它应该与 imsafu 支付页面（https://imsafu.com/payment_qrcode?payID=pay_01K36R5TXAX6EN1QGHHVKD36EJ&brand=IMSAFU.com&memo=Food+Donation+%28Peanut%29&redirect_url=https%3A%2F%2Fdonate.imsafu.com%2Fsuccess&currency=USD）完全相同但使用 EVO Payment 品牌
3. 当我查看收银台页面时，它应该显示 "Select Payment" 下拉框，包含加密货币选项
4. 当我查看收银台页面时，它应该显示 "Select Network" 下拉框，包含区块链网络选项
5. 当我点击下拉框时，它们应该在模态框/弹窗中显示相应选项

### 需求 3

**用户故事：** 作为用户，我希望在选择支付方式和网络后看到二维码支付页面，以便我可以完成支付。

#### 验收标准

1. 当我选择了支付方式和网络后，系统应该显示二维码支付页面
2. 当我查看二维码页面时，它应该显示来自 /Users/zhangjacky/src/stable_coin_payment/demo/images/wallet_qr.jpg 的固定二维码图片，二维码下方的钱包地址固定显示为 0xe27577B0e3920cE35f100f66430de0108cb78a04，并提供 copy 按钮
3. 当我查看二维码页面时，它应该显示支付详情，包括金额和选择的加密货币
4. 当我查看二维码页面时，它应该显示英文的支付说明
5. 当我查看二维码页面时，所有品牌元素应该是 EVO Payment 而不是 imsafu

### 需求 4

**用户故事：** 作为用户，我希望系统能自动检测我在 BNB Smart Chain 上的支付，以便在支付完成后自动跳转到成功页面。

#### 验收标准

1. 当显示二维码页面时，系统应该开始监听 BNB Smart Chain 主网的交易
2. 当检测到匹配金额的交易时，系统应该验证交易详情
3. 当支付确认后，系统应该自动跳转到成功页面
4. 当监听交易时，系统应该向用户提供实时状态更新
5. 当支付超时时，系统应该显示相应的英文错误信息

### 需求 5

**用户故事：** 作为开发者，我希望系统具有响应式设计并在桌面设备上正常工作。

#### 验收标准

1. 当我在桌面设备上访问时，所有页面应该保持最佳视觉效果
2. 当网络较慢时，系统应该显示适当的加载指示器
3. 当发生错误时，系统应该显示用户友好的英文错误信息
4. 当我与元素交互时，应该有清晰的视觉反馈和状态指示器