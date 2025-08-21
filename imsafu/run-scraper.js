#!/usr/bin/env node

const WebScraper = require('./scraper');

async function main() {
  console.log('='.repeat(50));
  console.log('imsafu 网站爬虫工具');
  console.log('='.repeat(50));
  
  const scraper = new WebScraper();
  
  try {
    await scraper.run();
    console.log('\n✅ 爬取任务完成！');
    console.log('📁 文件保存位置: ./imsafu/');
    console.log('📄 页面文件: ./imsafu/pages/');
    console.log('🎨 静态资源: ./imsafu/css/, ./imsafu/js/, ./imsafu/images/');
  } catch (error) {
    console.error('\n❌ 爬取失败:', error.message);
    process.exit(1);
  }
}

main();