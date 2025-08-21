const fs = require('fs');
const path = require('path');

class BrandReplacer {
    constructor() {
        this.replacements = {
            // 文字替换映射
            text: {
                'imsafu': 'EVO Payment',
                'IMSAFU': 'EVO PAYMENT',
                'Imsafu': 'EVO Payment',
                'instant crypto payments': 'instant crypto payments',
                'donate.imsafu.com': 'evopayment.demo',
                'Pay With imsafu': 'Pay With EVO Payment'
            },
            // 图片替换映射
            images: {
                // 将会在运行时动态添加需要替换的图片
            }
        };
        
        this.sourceDir = 'imsafu/imsafu';
        this.targetDir = 'demo';
        this.logoPath = 'demo/public/images/logo.png';
    }

    async replaceInFile(filePath, content) {
        let modifiedContent = content;
        
        // 替换文字内容
        for (const [oldText, newText] of Object.entries(this.replacements.text)) {
            const regex = new RegExp(oldText, 'gi');
            modifiedContent = modifiedContent.replace(regex, newText);
        }
        
        // 替换图片路径 - 将所有 imsafu 相关的图片替换为 logo
        modifiedContent = modifiedContent.replace(
            /src=["']([^"']*(?:logo|brand|imsafu)[^"']*)["']/gi,
            'src="./images/logo.png"'
        );
        
        // 替换背景图片路径
        modifiedContent = modifiedContent.replace(
            /background-image:\s*url\(['"]?([^'"]*(?:logo|brand|imsafu)[^'"]*?)['"]?\)/gi,
            'background-image: url("./images/logo.png")'
        );
        
        return modifiedContent;
    }

    async copyDirectory(source, target) {
        // 创建目标目录
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }

        const items = fs.readdirSync(source);
        
        for (const item of items) {
            const sourcePath = path.join(source, item);
            const targetPath = path.join(target, item);
            const stat = fs.statSync(sourcePath);
            
            if (stat.isDirectory()) {
                await this.copyDirectory(sourcePath, targetPath);
            } else {
                await this.copyAndReplaceFile(sourcePath, targetPath);
            }
        }
    }

    async copyAndReplaceFile(sourcePath, targetPath) {
        const ext = path.extname(sourcePath).toLowerCase();
        
        // 确保目标目录存在
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        if (['.html', '.css', '.js', '.json'].includes(ext)) {
            // 文本文件需要进行内容替换
            const content = fs.readFileSync(sourcePath, 'utf8');
            const modifiedContent = await this.replaceInFile(sourcePath, content);
            fs.writeFileSync(targetPath, modifiedContent, 'utf8');
            console.log(`✓ 已处理文本文件: ${sourcePath} -> ${targetPath}`);
        } else {
            // 二进制文件直接复制
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`✓ 已复制文件: ${sourcePath} -> ${targetPath}`);
        }
    }

    async createProjectStructure() {
        // 创建基础目录结构
        const dirs = [
            'demo',
            'demo/js',
            'demo/css', 
            'demo/images',
            'demo/pages'
        ];
        
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✓ 创建目录: ${dir}`);
            }
        }
    }

    async replacePages() {
        console.log('开始复刻页面...');
        
        // 创建项目结构
        await this.createProjectStructure();
        
        // 复制并替换所有内容
        await this.copyDirectory(this.sourceDir, this.targetDir);
        
        console.log('✓ 页面复刻完成！');
    }

    async createMainIndex() {
        // 创建主入口页面
        const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EVO Payment - Instant Crypto Payments</title>
    <style>
        body {
            font-family: 'Roboto', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        .logo {
            width: 120px;
            height: auto;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        p {
            color: #666;
            margin-bottom: 30px;
        }
        .btn {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="./images/logo.png" alt="EVO Payment" class="logo">
        <h1>EVO Payment</h1>
        <p>Instant crypto payments on BNB Smart Chain</p>
        <a href="./pages/index.html" class="btn">Start Payment Demo</a>
    </div>
</body>
</html>`;
        
        fs.writeFileSync('demo/index.html', indexContent);
        console.log('✓ 创建主入口页面: demo/index.html');
    }

    async run() {
        try {
            console.log('🚀 开始品牌替换和页面复刻...');
            
            // 检查源目录是否存在
            if (!fs.existsSync(this.sourceDir)) {
                throw new Error(`源目录不存在: ${this.sourceDir}`);
            }
            
            // 检查 logo 文件是否存在
            if (!fs.existsSync(this.logoPath)) {
                console.log(`⚠️  Logo 文件不存在: ${this.logoPath}`);
                console.log('请确保在 demo/public/images/ 目录下有 logo.png 文件');
            }
            
            // 执行页面复刻
            await this.replacePages();
            
            // 创建主入口页面
            await this.createMainIndex();
            
            console.log('✅ 品牌替换和页面复刻完成！');
            console.log('📁 复刻的页面保存在 demo 目录中');
            console.log('🌐 可以通过 demo/index.html 访问主页面');
            
        } catch (error) {
            console.error('❌ 处理过程中出现错误:', error.message);
            throw error;
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const replacer = new BrandReplacer();
    replacer.run().catch(console.error);
}

module.exports = BrandReplacer;