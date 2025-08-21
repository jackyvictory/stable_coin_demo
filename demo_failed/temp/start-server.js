/**
 * EVO Payment 本地开发服务器
 * 启动一个简单的 HTTP 服务器来运行项目
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 服务器配置
const PORT = 3000;
const HOST = 'localhost';

// MIME 类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 获取文件的 MIME 类型
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    // 解析 URL
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // 如果是根路径，重定向到主应用
    if (pathname === '/') {
        pathname = '/demo/app.html';
    }
    
    // 构建文件路径
    const filePath = path.join(__dirname, pathname);
    
    console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);
    
    // 检查文件是否存在
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // 文件不存在，返回 404
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>404 - 页面未找到</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            text-align: center; 
                            padding: 50px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            min-height: 100vh;
                            margin: 0;
                        }
                        .container {
                            background: rgba(255,255,255,0.1);
                            padding: 40px;
                            border-radius: 15px;
                            display: inline-block;
                            margin-top: 100px;
                        }
                        h1 { font-size: 48px; margin-bottom: 20px; }
                        p { font-size: 18px; margin-bottom: 30px; }
                        a { 
                            color: white; 
                            text-decoration: none; 
                            background: rgba(255,255,255,0.2);
                            padding: 10px 20px;
                            border-radius: 25px;
                            transition: all 0.3s;
                        }
                        a:hover { background: rgba(255,255,255,0.3); }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>404</h1>
                        <p>页面未找到: ${pathname}</p>
                        <a href="/demo/app.html">返回 EVO Payment 主页</a>
                    </div>
                </body>
                </html>
            `);
            return;
        }
        
        // 读取文件
        fs.readFile(filePath, (err, data) => {
            if (err) {
                // 读取错误，返回 500
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>500 - 服务器错误</title>
                        <style>
                            body { 
                                font-family: Arial, sans-serif; 
                                text-align: center; 
                                padding: 50px;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>500 - 服务器错误</h1>
                        <p>无法读取文件: ${pathname}</p>
                        <a href="/demo/app.html" style="color: white;">返回主页</a>
                    </body>
                    </html>
                `);
                return;
            }
            
            // 成功读取文件，返回内容
            const mimeType = getMimeType(filePath);
            res.writeHead(200, { 
                'Content-Type': mimeType,
                'Cache-Control': 'no-cache'  // 开发环境不缓存
            });
            res.end(data);
        });
    });
});

// 启动服务器
server.listen(PORT, HOST, () => {
    console.log('🚀 EVO Payment 开发服务器启动成功！');
    console.log('');
    console.log('📋 服务器信息:');
    console.log(`   - 地址: http://${HOST}:${PORT}`);
    console.log(`   - 主应用: http://${HOST}:${PORT}/demo/app.html`);
    console.log(`   - 时间: ${new Date().toLocaleString()}`);
    console.log('');
    console.log('🎯 可用页面:');
    console.log(`   - 主应用: http://${HOST}:${PORT}/demo/app.html`);
    console.log(`   - 支付演示: http://${HOST}:${PORT}/demo/payment-demo.html`);
    console.log(`   - 区块链演示: http://${HOST}:${PORT}/demo/blockchain-demo.html`);
    console.log(`   - 监听演示: http://${HOST}:${PORT}/demo/monitor-demo.html`);
    console.log(`   - UI演示: http://${HOST}:${PORT}/demo/ui-demo.html`);
    console.log(`   - 错误处理演示: http://${HOST}:${PORT}/demo/error-demo.html`);
    console.log(`   - 响应式演示: http://${HOST}:${PORT}/demo/responsive-demo.html`);
    console.log('');
    console.log('💡 提示:');
    console.log('   - 按 Ctrl+C 停止服务器');
    console.log('   - 修改文件后刷新浏览器即可看到更改');
    console.log('   - 服务器会自动处理跨域请求');
    console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

// 错误处理
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，请尝试其他端口或关闭占用该端口的程序`);
        console.error('💡 你可以修改 start-server.js 中的 PORT 变量来使用其他端口');
    } else {
        console.error('❌ 服务器错误:', err.message);
    }
    process.exit(1);
});