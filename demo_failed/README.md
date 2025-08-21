# EVO Payment Demo

这是一个像素级复刻 imsafu 网站并替换为 EVO Payment 品牌的演示项目。

## 项目结构

```
demo/
├── index.html              # 主入口页面
├── pages/                  # 复刻的页面
│   ├── index.html         # 支付首页
│   ├── payment_qrcode.html # 二维码支付页面
│   ├── payment_qrcode_full.html # 完整二维码页面
│   └── success.html       # 支付成功页面
├── css/                   # 样式文件
├── js/                    # JavaScript 文件
├── images/                # 图片资源
└── public/
    └── images/
        └── logo.png       # EVO Payment Logo
```

## 功能特性

✅ **完整页面复刻**: 像素级复刻原网站的所有页面和交互
✅ **品牌替换**: 所有 "imsafu" 文字已替换为 "EVO Payment"
✅ **Logo 替换**: 使用 EVO Payment 的 Logo
✅ **响应式设计**: 保持原网站的响应式布局
✅ **交互保持**: 保留原网站的所有交互功能

## 使用方法

### 1. 本地预览

直接在浏览器中打开以下文件：

- **主页面**: `demo/index.html`
- **支付流程**: `demo/pages/index.html`

### 2. 页面说明

- **index.html**: 主入口页面，包含 EVO Payment 品牌介绍
- **pages/index.html**: 支付首页，用户可以选择支付金额
- **pages/payment_qrcode.html**: 二维码支付页面
- **pages/success.html**: 支付成功页面

### 3. 品牌替换详情

已完成的替换：
- `imsafu` → `EVO Payment`
- `IMSAFU` → `EVO PAYMENT`
- `Imsafu` → `EVO Payment`
- `Pay With imsafu` → `Pay With EVO Payment`
- `donate.imsafu.com` → `evopayment.demo`
- Logo 图片已替换为 EVO Payment Logo

## 下一步开发

根据项目规格，接下来需要实现：

1. **基础项目结构和配置** (任务 3)
2. **支付信息生成功能** (任务 4)
3. **Web3.js 集成** (任务 5)
4. **区块链交易监听** (任务 6)
5. **前端交互功能** (任务 7)

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **UI 框架**: Chakra UI (保持原网站样式)
- **响应式**: 移动端和桌面端适配
- **未来集成**: Web3.js, BNB Smart Chain

## 注意事项

- 当前页面为静态演示，尚未集成区块链功能
- 所有交互功能保持原网站的行为
- 页面路径已修复，资源文件可正常加载
- 支持现代浏览器的所有功能

---

**EVO Payment** - Instant crypto payments on BNB Smart Chain