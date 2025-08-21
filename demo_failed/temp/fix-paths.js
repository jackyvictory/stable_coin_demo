const fs = require('fs');
const path = require('path');

class PathFixer {
    constructor() {
        this.demoDir = 'demo';
    }

    async fixHtmlPaths(filePath) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // 修复 JavaScript 文件路径
        content = content.replace(/src=["']\/[^"']*\/static\/chunks\/([^"']+)["']/g, 'src="../js/$1"');
        content = content.replace(/src=["']\/[^"']*\/static\/([^"']+)["']/g, 'src="../js/$1"');
        
        // 修复 CSS 文件路径
        content = content.replace(/href=["']\/[^"']*\/static\/css\/([^"']+)["']/g, 'href="../css/$1"');
        
        // 修复图片路径
        content = content.replace(/src=["']([^"']*\.(?:png|jpg|jpeg|gif|svg))["']/g, (match, imagePath) => {
            if (imagePath.startsWith('http') || imagePath.startsWith('//')) {
                return match; // 保持外部链接不变
            }
            if (imagePath.startsWith('./')) {
                return match; // 已经是相对路径
            }
            return `src="../images/${path.basename(imagePath)}"`;
        });
        
        // 修复背景图片路径
        content = content.replace(/url\(['"]?([^'"]*\.(?:png|jpg|jpeg|gif|svg))['"]?\)/g, (match, imagePath) => {
            if (imagePath.startsWith('http') || imagePath.startsWith('//')) {
                return match; // 保持外部链接不变
            }
            if (imagePath.startsWith('./')) {
                return match; // 已经是相对路径
            }
            return `url("../images/${path.basename(imagePath)}")`;
        });
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ 修复路径: ${filePath}`);
    }

    async fixAllHtmlFiles() {
        const pagesDir = path.join(this.demoDir, 'pages');
        const files = fs.readdirSync(pagesDir);
        
        for (const file of files) {
            if (file.endsWith('.html')) {
                const filePath = path.join(pagesDir, file);
                await this.fixHtmlPaths(filePath);
            }
        }
    }

    async run() {
        try {
            console.log('🔧 开始修复资源路径...');
            await this.fixAllHtmlFiles();
            console.log('✅ 路径修复完成！');
        } catch (error) {
            console.error('❌ 修复路径时出现错误:', error.message);
            throw error;
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const fixer = new PathFixer();
    fixer.run().catch(console.error);
}

module.exports = PathFixer;