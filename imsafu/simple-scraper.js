const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class SimpleScraper {
  constructor() {
    this.baseUrl = 'https://donate.imsafu.com';
    this.outputDir = './imsafu';
    this.downloadedAssets = new Set();
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
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
          'Accept-Encoding': 'identity', // 不使用压缩
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      };

      protocol.get(url, options, (response) => {
        let data = '';
        
        response.setEncoding('utf8'); // 确保以UTF-8编码读取
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          if (response.statusCode === 200) {
            resolve(data);
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
            resolve(); // 继续执行，不因单个资源失败而停止
          }
        }).on('error', (err) => {
          console.log(`Error downloading ${url}:`, err.message);
          resolve(); // 继续执行
        });
      } catch (error) {
        console.log(`Error processing ${url}:`, error.message);
        resolve();
      }
    });
  }

  extractAssetsFromHtml(html, baseUrl) {
    const assets = [];
    
    // 简单的正则表达式提取资源链接
    const patterns = [
      // CSS files
      /<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*>/gi,
      // JS files
      /<script[^>]+src=["']([^"']+\.js[^"']*)["'][^>]*>/gi,
      // Images
      /<img[^>]+src=["']([^"']+\.(png|jpg|jpeg|gif|svg|ico)[^"']*)["'][^>]*>/gi,
      // Background images in CSS
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      // Other assets
      /<link[^>]+href=["']([^"']+\.(woff|woff2|ttf|eot)[^"']*)["'][^>]*>/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let assetUrl = match[1];
        
        // 处理相对URL
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

    return [...new Set(assets)]; // 去重
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
        
        // 添加小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`Error processing asset ${assetUrl}:`, error.message);
      }
    }
  }

  async run() {
    console.log('开始爬取 imsafu 网站...');
    
    await this.init();
    
    try {
      // 爬取首页
      console.log('正在爬取首页...');
      const homeHtml = await this.fetchPage(this.baseUrl);
      
      // 保存首页HTML
      const homePagePath = path.join(this.outputDir, 'pages', 'index.html');
      fs.writeFileSync(homePagePath, homeHtml, 'utf8');
      console.log('首页HTML已保存');
      
      // 下载首页的静态资源
      await this.downloadAssetsFromHtml(homeHtml, this.baseUrl);
      
      // 尝试找到支付页面链接
      console.log('正在查找支付页面链接...');
      const paymentLinks = this.extractPaymentLinks(homeHtml, this.baseUrl);
      
      // 爬取支付相关页面
      for (let i = 0; i < paymentLinks.length; i++) {
        const link = paymentLinks[i];
        try {
          console.log(`正在爬取支付页面: ${link}`);
          const pageHtml = await this.fetchPage(link);
          
          const pagePath = path.join(this.outputDir, 'pages', `payment_${i + 1}.html`);
          fs.writeFileSync(pagePath, pageHtml, 'utf8');
          console.log(`支付页面 ${i + 1} 已保存`);
          
          // 下载页面资源
          await this.downloadAssetsFromHtml(pageHtml, link);
          
          // 添加延迟避免请求过快
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.log(`爬取支付页面 ${link} 时出错:`, error.message);
        }
      }
      
      console.log('爬取完成！');
      console.log(`所有文件已保存到: ${this.outputDir}`);
      
    } catch (error) {
      console.error('爬取过程中出错:', error);
    }
  }

  extractPaymentLinks(html, baseUrl) {
    const links = [];
    
    // 查找可能的支付相关链接
    const patterns = [
      /<a[^>]+href=["']([^"']*pay[^"']*)["'][^>]*>/gi,
      /<a[^>]+href=["']([^"']*donate[^"']*)["'][^>]*>/gi,
      /<a[^>]+href=["']([^"']*checkout[^"']*)["'][^>]*>/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let link = match[1];
        
        // 处理相对URL
        if (link.startsWith('//')) {
          link = 'https:' + link;
        } else if (link.startsWith('/')) {
          link = baseUrl + link;
        } else if (!link.startsWith('http')) {
          link = baseUrl + '/' + link;
        }
        
        links.push(link);
      }
    });

    return [...new Set(links)]; // 去重
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const scraper = new SimpleScraper();
  scraper.run().catch(console.error);
}

module.exports = SimpleScraper;