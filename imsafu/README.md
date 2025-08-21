# imsafu 网站爬虫

这个爬虫工具用于爬取 https://donate.imsafu.com 网站的所有页面和静态资源。

## 安装依赖

```bash
cd imsafu
npm install
```

## 运行爬虫

```bash
# 方式1: 直接运行
npm start

# 方式2: 使用运行脚本
node run-scraper.js

# 方式3: 直接运行爬虫
node scraper.js
```

## 输出结构

爬虫会在 `imsafu` 目录下创建以下结构：

```
imsafu/
├── pages/          # HTML页面文件
│   ├── index.html  # 首页
│   ├── payment.html # 支付页面
│   └── step_*.html # 其他流程页面
├── css/            # CSS样式文件
├── js/             # JavaScript文件
├── images/         # 图片资源
└── assets/         # 其他静态资源
```

## 功能特性

- ✅ 爬取首页内容
- ✅ 自动点击 "Pay With imsafu" 按钮
- ✅ 爬取支付流程的所有页面
- ✅ 下载所有静态资源 (CSS, JS, 图片)
- ✅ 保持原有目录结构
- ✅ 错误处理和重试机制

## 注意事项

- 爬虫运行时会打开浏览器窗口 (headless: false)，方便调试
- 如果网站结构发生变化，可能需要调整选择器
- 网络不稳定时，部分资源可能下载失败，但不会影响整体流程