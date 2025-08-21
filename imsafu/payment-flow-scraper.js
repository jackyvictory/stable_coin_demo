const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

class PaymentFlowScraper {
  constructor() {
    this.baseUrl = 'https://donate.imsafu.com';
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

  async tryPaymentUrls() {
    // 尝试不同的支付页面 URL
    const paymentUrls = [
      // 基本支付页面
      `${this.baseUrl}/payment_qrcode`,
      `${this.baseUrl}/payment_qrcode?payID=test&brand=imsafu&memo=test&currency=USD`,
      
      // 可能的其他支付相关页面
      `${this.baseUrl}/payment`,
      `${this.baseUrl}/pay`,
      `${this.baseUrl}/checkout`,
      
      // API 端点
      `${this.baseUrl}/api/payment`,
      `${this.baseUrl}/api/pay`,
      
      // 可能的静态页面
      `${this.baseUrl}/payment.html`,
      `${this.baseUrl}/pay.html`,
      `${this.baseUrl}/checkout.html`
    ];

    const results = [];

    for (const url of paymentUrls) {
      try {
        console.log(`尝试访问: ${url}`);
        const response = await this.fetchPage(url);
        
        console.log(`状态码: ${response.statusCode}`);
        
        if (response.statusCode === 200 && response.data.length > 100) {
          console.log(`✅ 成功访问: ${url}`);
          
          // 保存页面内容
          const urlObj = new URL(url);
          const filename = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_') + 
                          (urlObj.search ? '_' + urlObj.search.replace(/[^a-zA-Z0-9]/g, '_') : '') + 
                          '.html';
          const outputPath = path.join(this.outputDir, 'pages', filename);
          
          fs.writeFileSync(outputPath, response.data, 'utf8');
          console.log(`保存到: ${outputPath}`);
          
          results.push({
            url: url,
            statusCode: response.statusCode,
            filename: filename,
            contentLength: response.data.length
          });
          
          // 分析页面内容寻找更多链接
          await this.analyzePageForLinks(response.data, url);
          
        } else if (response.statusCode === 302 || response.statusCode === 301) {
          console.log(`🔄 重定向到: ${response.headers.location}`);
          if (response.headers.location) {
            // 尝试访问重定向的 URL
            try {
              const redirectUrl = response.headers.location.startsWith('http') 
                ? response.headers.location 
                : this.baseUrl + response.headers.location;
              
              const redirectResponse = await this.fetchPage(redirectUrl);
              if (redirectResponse.statusCode === 200) {
                console.log(`✅ 重定向成功: ${redirectUrl}`);
                
                const filename = 'redirect_' + path.basename(redirectUrl) + '.html';
                const outputPath = path.join(this.outputDir, 'pages', filename);
                fs.writeFileSync(outputPath, redirectResponse.data, 'utf8');
                
                results.push({
                  url: redirectUrl,
                  originalUrl: url,
                  statusCode: redirectResponse.statusCode,
                  filename: filename,
                  contentLength: redirectResponse.data.length
                });
              }
            } catch (redirectError) {
              console.log(`❌ 重定向失败: ${redirectError.message}`);
            }
          }
        } else {
          console.log(`❌ 无法访问: ${response.statusCode}`);
        }
        
      } catch (error) {
        console.log(`❌ 错误: ${error.message}`);
      }
      
      // 添加延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  async analyzePageForLinks(html, baseUrl) {
    // 查找页面中的链接
    const linkPatterns = [
      /<a[^>]+href=["']([^"']+)["'][^>]*>/gi,
      /<form[^>]+action=["']([^"']+)["'][^>]*>/gi,
      /window\.location\s*=\s*["']([^"']+)["']/gi,
      /location\.href\s*=\s*["']([^"']+)["']/gi
    ];

    const foundLinks = new Set();

    linkPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let link = match[1];
        
        // 处理相对 URL
        if (link.startsWith('/')) {
          link = this.baseUrl + link;
        } else if (!link.startsWith('http')) {
          continue; // 跳过相对路径和其他协议
        }
        
        // 只关注支付相关的链接
        if (link.includes('pay') || link.includes('checkout') || link.includes('qr')) {
          foundLinks.add(link);
        }
      }
    });

    // 尝试访问找到的链接
    for (const link of foundLinks) {
      try {
        console.log(`发现链接: ${link}`);
        const response = await this.fetchPage(link);
        
        if (response.statusCode === 200 && response.data.length > 100) {
          console.log(`✅ 链接可访问: ${link}`);
          
          const urlObj = new URL(link);
          const filename = 'discovered_' + urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_') + '.html';
          const outputPath = path.join(this.outputDir, 'pages', filename);
          
          fs.writeFileSync(outputPath, response.data, 'utf8');
          console.log(`保存发现的页面: ${outputPath}`);
        }
      } catch (error) {
        console.log(`无法访问发现的链接 ${link}: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async run() {
    console.log('开始爬取支付流程页面...');
    
    const results = await this.tryPaymentUrls();
    
    console.log('\n=== 爬取结果 ===');
    if (results.length > 0) {
      results.forEach(result => {
        console.log(`✅ ${result.url} -> ${result.filename} (${result.contentLength} bytes)`);
      });
    } else {
      console.log('❌ 未找到可访问的支付页面');
    }
    
    // 生成报告
    const reportPath = path.join(this.outputDir, 'payment-flow-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      results: results,
      totalPages: results.length
    }, null, 2), 'utf8');
    
    console.log(`\n📋 支付流程报告: ${reportPath}`);
  }
}

if (require.main === module) {
  const scraper = new PaymentFlowScraper();
  scraper.run().catch(console.error);
}

module.exports = PaymentFlowScraper;