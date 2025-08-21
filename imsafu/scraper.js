const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class WebScraper {
  constructor() {
    this.baseUrl = 'https://donate.imsafu.com';
    this.outputDir = './imsafu';
    this.downloadedAssets = new Set();
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

  async downloadAsset(url, outputPath) {
    return new Promise((resolve, reject) => {
      if (this.downloadedAssets.has(url)) {
        resolve();
        return;
      }

      const protocol = url.startsWith('https:') ? https : http;
      const file = fs.createWriteStream(outputPath);
      
      protocol.get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            this.downloadedAssets.add(url);
            console.log(`Downloaded: ${url}`);
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
    });
  }

  async extractAndDownloadAssets(page, html) {
    const assets = [];
    
    // 提取CSS文件
    const cssLinks = await page.$$eval('link[rel="stylesheet"]', links => 
      links.map(link => link.href)
    );
    
    // 提取JS文件
    const jsScripts = await page.$$eval('script[src]', scripts => 
      scripts.map(script => script.src)
    );
    
    // 提取图片
    const images = await page.$$eval('img[src]', imgs => 
      imgs.map(img => img.src)
    );
    
    // 合并所有资源
    assets.push(...cssLinks, ...jsScripts, ...images);
    
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
      } catch (error) {
        console.log(`Error processing asset ${assetUrl}:`, error.message);
      }
    }
  }

  async scrapeHomePage() {
    const browser = await puppeteer.launch({ 
      headless: false, // 设为false以便调试
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // 设置用户代理
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('正在访问首页...');
      await page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // 等待页面完全加载
      await page.waitForTimeout(3000);
      
      // 获取页面HTML
      const html = await page.content();
      
      // 保存首页HTML
      const homePagePath = path.join(this.outputDir, 'pages', 'index.html');
      fs.writeFileSync(homePagePath, html, 'utf8');
      console.log('首页HTML已保存');
      
      // 下载静态资源
      await this.extractAndDownloadAssets(page, html);
      
      return { page, html };
    } catch (error) {
      console.error('爬取首页时出错:', error);
      throw error;
    }
  }

  async scrapePaymentFlow(page) {
    try {
      console.log('正在查找 "Pay With imsafu" 按钮...');
      
      // 等待并点击支付按钮
      const payButton = await page.waitForSelector('a[href*="pay"], button:contains("Pay"), a:contains("Pay")', { timeout: 10000 });
      
      if (!payButton) {
        // 尝试其他可能的选择器
        const possibleSelectors = [
          'a[href*="donate"]',
          'button[class*="pay"]',
          'a[class*="pay"]',
          '.pay-button',
          '#pay-button',
          '[data-action="pay"]'
        ];
        
        for (const selector of possibleSelectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              console.log(`找到支付按钮: ${selector}`);
              await element.click();
              break;
            }
          } catch (e) {
            continue;
          }
        }
      } else {
        await payButton.click();
      }
      
      console.log('已点击支付按钮，等待页面加载...');
      
      // 等待新页面加载
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle');
      
      // 获取支付页面HTML
      const paymentHtml = await page.content();
      
      // 保存支付页面HTML
      const paymentPagePath = path.join(this.outputDir, 'pages', 'payment.html');
      fs.writeFileSync(paymentPagePath, paymentHtml, 'utf8');
      console.log('支付页面HTML已保存');
      
      // 下载支付页面的静态资源
      await this.extractAndDownloadAssets(page, paymentHtml);
      
      // 尝试继续支付流程，获取更多页面
      await this.scrapeAdditionalPages(page);
      
    } catch (error) {
      console.error('爬取支付流程时出错:', error);
      // 继续执行，不因为找不到按钮而停止
    }
  }

  async scrapeAdditionalPages(page) {
    try {
      // 查找可能的下一步按钮或链接
      const nextButtons = await page.$$('button, a[href]');
      
      for (let i = 0; i < Math.min(nextButtons.length, 5); i++) {
        try {
          const button = nextButtons[i];
          const text = await button.textContent();
          const href = await button.getAttribute('href');
          
          // 如果是相关的支付流程按钮
          if (text && (text.includes('Next') || text.includes('Continue') || text.includes('Proceed') || 
                      text.includes('Confirm') || text.includes('Pay') || text.includes('Submit'))) {
            
            console.log(`尝试点击按钮: ${text}`);
            await button.click();
            await page.waitForTimeout(2000);
            
            // 保存当前页面
            const currentHtml = await page.content();
            const pagePath = path.join(this.outputDir, 'pages', `step_${i + 1}.html`);
            fs.writeFileSync(pagePath, currentHtml, 'utf8');
            console.log(`步骤 ${i + 1} 页面已保存`);
            
            // 下载当前页面的资源
            await this.extractAndDownloadAssets(page, currentHtml);
          }
        } catch (error) {
          console.log(`处理按钮 ${i} 时出错:`, error.message);
          continue;
        }
      }
    } catch (error) {
      console.error('爬取额外页面时出错:', error);
    }
  }

  async run() {
    console.log('开始爬取 imsafu 网站...');
    
    await this.init();
    
    const browser = await puppeteer.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 爬取首页
      console.log('正在爬取首页...');
      await page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const html = await page.content();
      const homePagePath = path.join(this.outputDir, 'pages', 'index.html');
      fs.writeFileSync(homePagePath, html, 'utf8');
      console.log('首页HTML已保存');
      
      await this.extractAndDownloadAssets(page, html);
      
      // 爬取支付流程
      console.log('正在爬取支付流程...');
      await this.scrapePaymentFlow(page);
      
      console.log('爬取完成！');
      console.log(`所有文件已保存到: ${this.outputDir}`);
      
    } catch (error) {
      console.error('爬取过程中出错:', error);
    } finally {
      await browser.close();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const scraper = new WebScraper();
  scraper.run().catch(console.error);
}

module.exports = WebScraper;