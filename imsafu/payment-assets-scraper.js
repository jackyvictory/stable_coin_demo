const fs = require('fs');
const path = require('path');
const https = require('https');

class PaymentAssetsScraper {
  constructor() {
    this.baseUrl = 'https://imsafu.com';
    this.outputDir = './imsafu';
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.downloadedAssets = new Set();
  }

  async downloadAsset(url, outputPath) {
    return new Promise((resolve, reject) => {
      if (this.downloadedAssets.has(url)) {
        resolve();
        return;
      }

      try {
        const protocol = url.startsWith('https:') ? https : require('http');
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

  async run() {
    console.log('开始下载支付页面的静态资源...');
    
    // 读取支付页面HTML
    const paymentHtmlPath = path.join(this.outputDir, 'pages', 'payment_qrcode_full.html');
    
    if (!fs.existsSync(paymentHtmlPath)) {
      console.error('支付页面HTML文件不存在:', paymentHtmlPath);
      return;
    }
    
    const html = fs.readFileSync(paymentHtmlPath, 'utf8');
    console.log('已读取支付页面HTML');
    
    // 提取资源链接
    const assets = this.extractAssetsFromHtml(html, this.baseUrl);
    console.log(`发现 ${assets.length} 个资源需要下载`);
    
    // 下载资源
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
    
    console.log('支付页面资源下载完成！');
    
    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      totalAssets: assets.length,
      downloadedAssets: this.downloadedAssets.size,
      assets: assets
    };
    
    const reportPath = path.join(this.outputDir, 'payment-assets-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`资源下载报告: ${reportPath}`);
  }
}

if (require.main === module) {
  const scraper = new PaymentAssetsScraper();
  scraper.run().catch(console.error);
}

module.exports = PaymentAssetsScraper;