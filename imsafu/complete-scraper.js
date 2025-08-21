const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class CompleteScraper {
  constructor() {
    this.baseUrl = 'https://donate.imsafu.com';
    this.outputDir = './imsafu';
    this.downloadedAssets = new Set();
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.scrapedPages = new Map();
  }

  async init() {
    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // 创建子目录
    ['pages', 'assets', 'css', 'js', 'images'].forEach(dir => {
      const dirPath = path.join(this.outputDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  async fetchPage(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const options = {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      };

      protocol.get(url, options, (response) => {
        let data = '';
        
        response.setEncoding('utf8');
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          if (response.statusCode === 200) {
            resolve(data);
          } else if (response.statusCode === 302 || response.statusCode === 301) {
            // 处理重定向
            const redirectUrl = response.headers.location;
            console.log(`重定向到: ${redirectUrl}`);
            this.fetchPage(redirectUrl).then(resolve).catch(reject);
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  async downloadAsset(url, outputPath) {
    return new Promise((resolve, reject) => {
      if (this.downloadedAssets.has(url)) {
        resolve();
        return;
      }

      try {
        const protocol = url.startsWith('https:') ? https : http;
        const file = fs.createWriteStream(outputPath);
        
        const options = {
          headers: {
            'User-Agent': this.userAgent
          }
        };
        
        protocol.get(url, options, (response) => {
          if (response.statusCode === 200) {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              this.downloadedAssets.add(url);
              console.log(`Downloaded: ${path.basename(outputPath)}`);
              resolve();
            });
          } else {
            console.log(`Failed to download ${url}: ${response.statusCode}`);
            resolve();
          }
        }).on('error', (err) => {
          console.log(`Error downloading ${url}:`, err.message);
          resolve();
        });
      } catch (error) {
        console.log(`Error processing ${url}:`, error.message);
        resolve();
      }
    });
  }

  extractAssetsFromHtml(html, baseUrl) {
    const assets = [];
    
    const patterns = [
      /<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*>/gi,
      /<script[^>]+src=["']([^"']+\.js[^"']*)["'][^>]*>/gi,
      /<img[^>]+src=["']([^"']+\.(png|jpg|jpeg|gif|svg|ico)[^"']*)["'][^>]*>/gi,
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      /<link[^>]+href=["']([^"']+\.(woff|woff2|ttf|eot)[^"']*)["'][^>]*>/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let assetUrl = match[1];
        
        if (assetUrl.startsWith('//')) {
          assetUrl = 'https:' + assetUrl;
        } else if (assetUrl.startsWith('/')) {
          assetUrl = baseUrl + assetUrl;
        } else if (!assetUrl.startsWith('http')) {
          assetUrl = baseUrl + '/' + assetUrl;
        }
        
        assets.push(assetUrl);
      }
    });

    return [...new Set(assets)];
  }

  async downloadAssetsFromHtml(html, baseUrl) {
    const assets = this.extractAssetsFromHtml(html, baseUrl);
    
    console.log(`Found ${assets.length} assets to download`);
    
    for (const assetUrl of assets) {
      try {
        const url = new URL(assetUrl);
        const filename = path.basename(url.pathname) || 'index.html';
        let outputPath;
        
        if (assetUrl.includes('.css')) {
          outputPath = path.join(this.outputDir, 'css', filename);
        } else if (assetUrl.includes('.js')) {
          outputPath = path.join(this.outputDir, 'js', filename);
        } else if (assetUrl.match(/\.(png|jpg|jpeg|gif|svg|ico)$/i)) {
          outputPath = path.join(this.outputDir, 'images', filename);
        } else {
          outputPath = path.join(this.outputDir, 'assets', filename);
        }
        
        await this.downloadAsset(assetUrl, outputPath);
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`Error processing asset ${assetUrl}:`, error.message);
      }
    }
  }

  // 尝试通过分析 Next.js 路由来获取支付页面
  async discoverPaymentPages() {
    const paymentUrls = [];
    
    // 常见的支付页面路径
    const possiblePaths = [
      '/pay',
      '/payment',
      '/checkout',
      '/donate',
      '/api/payment',
      '/_next/static/chunks/pages/pay.js',
      '/_next/static/chunks/pages/payment.js',
      '/_next/static/chunks/pages/checkout.js'
    ];

    for (const path of possiblePaths) {
      const url = this.baseUrl + path;
      try {
        console.log(`尝试访问: ${url}`);
        const html = await this.fetchPage(url);
        
        if (html && html.length > 100) {
          paymentUrls.push(url);
          console.log(`✅ 找到支付页面: ${url}`);
          
          // 保存页面
          const filename = path.replace(/[^a-zA-Z0-9]/g, '_') + '.html';
          const outputPath = path.join(this.outputDir, 'pages', filename);
          fs.writeFileSync(outputPath, html, 'utf8');
          
          // 下载页面资源
          await this.downloadAssetsFromHtml(html, url);
        }
      } catch (error) {
        console.log(`❌ 无法访问 ${url}: ${error.message}`);
      }
      
      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return paymentUrls;
  }

  // 分析 JavaScript 文件寻找路由信息
  async analyzeJavaScriptForRoutes() {
    const jsDir = path.join(this.outputDir, 'js');
    const routes = [];
    
    if (!fs.existsSync(jsDir)) {
      return routes;
    }

    const jsFiles = fs.readdirSync(jsDir);
    
    for (const file of jsFiles) {
      try {
        const filePath = path.join(jsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 查找路由相关的模式
        const routePatterns = [
          /["']\/pay["']/g,
          /["']\/payment["']/g,
          /["']\/checkout["']/g,
          /["']\/donate["']/g,
          /router\.push\(["']([^"']+)["']\)/g,
          /href:\s*["']([^"']+)["']/g
        ];

        routePatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const route = match[1] || match[0].replace(/['"]/g, '');
            if (route.startsWith('/') && !routes.includes(route)) {
              routes.push(route);
              console.log(`发现路由: ${route}`);
            }
          }
        });
        
      } catch (error) {
        console.log(`分析 ${file} 时出错:`, error.message);
      }
    }

    return routes;
  }

  // 尝试通过 API 端点获取支付信息
  async tryApiEndpoints() {
    const apiEndpoints = [
      '/api/payment',
      '/api/pay',
      '/api/checkout',
      '/api/donate',
      '/.well-known/payment',
      '/payment-config.json',
      '/config.json'
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const url = this.baseUrl + endpoint;
        console.log(`尝试 API 端点: ${url}`);
        
        const response = await this.fetchPage(url);
        if (response) {
          console.log(`✅ 找到 API 端点: ${url}`);
          
          // 保存 API 响应
          const filename = endpoint.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
          const outputPath = path.join(this.outputDir, 'assets', filename);
          fs.writeFileSync(outputPath, response, 'utf8');
        }
      } catch (error) {
        console.log(`❌ API 端点 ${endpoint} 不可用`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  async run() {
    console.log('开始完整爬取 imsafu 网站...');
    
    await this.init();
    
    try {
      // 1. 爬取首页
      console.log('\n=== 第1步: 爬取首页 ===');
      const homeHtml = await this.fetchPage(this.baseUrl);
      const homePagePath = path.join(this.outputDir, 'pages', 'index.html');
      fs.writeFileSync(homePagePath, homeHtml, 'utf8');
      console.log('首页HTML已保存');
      
      await this.downloadAssetsFromHtml(homeHtml, this.baseUrl);
      
      // 2. 分析 JavaScript 文件寻找路由
      console.log('\n=== 第2步: 分析 JavaScript 路由 ===');
      const discoveredRoutes = await this.analyzeJavaScriptForRoutes();
      
      // 3. 尝试访问发现的路由
      console.log('\n=== 第3步: 访问发现的路由 ===');
      for (const route of discoveredRoutes) {
        try {
          const url = this.baseUrl + route;
          const html = await this.fetchPage(url);
          
          if (html && html.length > 100) {
            const filename = route.replace(/[^a-zA-Z0-9]/g, '_') + '.html';
            const outputPath = path.join(this.outputDir, 'pages', filename);
            fs.writeFileSync(outputPath, html, 'utf8');
            console.log(`保存页面: ${route}`);
            
            await this.downloadAssetsFromHtml(html, url);
          }
        } catch (error) {
          console.log(`无法访问路由 ${route}: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 4. 尝试常见的支付页面路径
      console.log('\n=== 第4步: 尝试常见支付页面路径 ===');
      await this.discoverPaymentPages();
      
      // 5. 尝试 API 端点
      console.log('\n=== 第5步: 尝试 API 端点 ===');
      await this.tryApiEndpoints();
      
      // 6. 生成爬取报告
      console.log('\n=== 爬取完成 ===');
      this.generateReport();
      
    } catch (error) {
      console.error('爬取过程中出错:', error);
    }
  }

  generateReport() {
    const pagesDir = path.join(this.outputDir, 'pages');
    const jsDir = path.join(this.outputDir, 'js');
    const imagesDir = path.join(this.outputDir, 'images');
    const assetsDir = path.join(this.outputDir, 'assets');
    
    const report = {
      timestamp: new Date().toISOString(),
      pages: fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir) : [],
      javascript: fs.existsSync(jsDir) ? fs.readdirSync(jsDir) : [],
      images: fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [],
      assets: fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []
    };
    
    const reportPath = path.join(this.outputDir, 'scrape-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    console.log(`\n📊 爬取报告:`);
    console.log(`📄 页面文件: ${report.pages.length} 个`);
    console.log(`📜 JavaScript文件: ${report.javascript.length} 个`);
    console.log(`🖼️  图片文件: ${report.images.length} 个`);
    console.log(`📦 其他资源: ${report.assets.length} 个`);
    console.log(`📋 详细报告: ${reportPath}`);
    console.log(`📁 所有文件保存在: ${this.outputDir}`);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const scraper = new CompleteScraper();
  scraper.run().catch(console.error);
}

module.exports = CompleteScraper;