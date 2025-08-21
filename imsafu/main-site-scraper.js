const fs = require('fs');
const path = require('path');
const https = require('https');

class MainSiteScraper {
  constructor() {
    this.baseUrl = 'https://imsafu.com';
    this.outputDir = './imsafu';
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async fetchPage(url) {
    return new Promise((resolve, reject) => {
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

      https.get(url, options, (response) => {
        let data = '';
        response.setEncoding('utf8');
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            data: data
          });
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  async run() {
    console.log('检查主站点 imsafu.com...');
    
    const urlsToTry = [
      'https://imsafu.com',
      'https://imsafu.com/payment_qrcode',
      'https://imsafu.com/api/payment',
      'https://imsafu.com/donate'
    ];

    for (const url of urlsToTry) {
      try {
        console.log(`尝试访问: ${url}`);
        const response = await this.fetchPage(url);
        
        console.log(`状态码: ${response.statusCode}`);
        
        if (response.statusCode === 200 && response.data.length > 100) {
          console.log(`✅ 成功访问: ${url}`);
          
          // 保存页面内容
          const filename = url.replace(/[^a-zA-Z0-9]/g, '_') + '.html';
          const outputPath = path.join(this.outputDir, 'pages', filename);
          
          fs.writeFileSync(outputPath, response.data, 'utf8');
          console.log(`保存到: ${outputPath}`);
          
          // 查找支付相关的链接
          const paymentLinks = this.extractPaymentLinks(response.data);
          if (paymentLinks.length > 0) {
            console.log('发现支付相关链接:');
            paymentLinks.forEach(link => console.log(`  - ${link}`));
          }
          
        } else if (response.statusCode === 302 || response.statusCode === 301) {
          console.log(`🔄 重定向到: ${response.headers.location}`);
        } else {
          console.log(`❌ 无法访问: ${response.statusCode}`);
        }
        
      } catch (error) {
        console.log(`❌ 错误: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  extractPaymentLinks(html) {
    const links = [];
    const patterns = [
      /<a[^>]+href=["']([^"']*payment[^"']*)["'][^>]*>/gi,
      /<a[^>]+href=["']([^"']*pay[^"']*)["'][^>]*>/gi,
      /<a[^>]+href=["']([^"']*checkout[^"']*)["'][^>]*>/gi,
      /<a[^>]+href=["']([^"']*qr[^"']*)["'][^>]*>/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        links.push(match[1]);
      }
    });

    return [...new Set(links)];
  }
}

if (require.main === module) {
  const scraper = new MainSiteScraper();
  scraper.run().catch(console.error);
}

module.exports = MainSiteScraper;