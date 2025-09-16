const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置
const rootDir = process.argv[2] || '.';
const htmlFiles = ['index.html', 'payment.html', 'qrcode.html', 'success.html'];
const resourceDirs = ['css', 'js', 'images'];

// 存储文件哈希映射
const hashMap = {};

// 计算文件的MD5哈希值
function calculateHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(data).digest('hex').substring(0, 8);
}

// 递归遍历目录，计算所有文件的哈希值
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else {
      const ext = path.extname(file).toLowerCase();
      // 只处理特定类型的静态资源文件
      if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
        const hash = calculateHash(filePath);
        const relativePath = path.relative(rootDir, filePath);
        hashMap[relativePath] = hash;
        
        // 重命名文件，添加哈希值
        const dirName = path.dirname(filePath);
        const fileName = path.basename(file, ext);
        const newFileName = `${fileName}.${hash}${ext}`;
        const newFilePath = path.join(dirName, newFileName);
        
        fs.renameSync(filePath, newFilePath);
        console.log(`Renamed: ${relativePath} -> ${path.join(path.dirname(relativePath), newFileName)}`);
      }
    }
  });
}

// 更新HTML文件中的资源引用
function updateHtmlFiles() {
  htmlFiles.forEach(htmlFile => {
    const filePath = path.join(rootDir, htmlFile);
    
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 更新CSS链接
      content = content.replace(
        /<link[^>]+href=["'](.*?\.(css))["'][^>]*>/g,
        (match, url, ext) => {
          // 处理相对路径
          const fullPath = path.join('css', path.basename(url));
          if (hashMap[fullPath]) {
            const dir = path.dirname(url);
            const fileName = path.basename(url, `.${ext}`);
            const hashedUrl = path.join(dir, `${fileName}.${hashMap[fullPath]}.${ext}`).replace(/\\\\/g, '/');
            return match.replace(url, hashedUrl);
          }
          return match;
        }
      );
      
      // 更新JS脚本引用
      content = content.replace(
        /<script[^>]+src=["'](.*?\.(js))["'][^>]*>/g,
        (match, url, ext) => {
          // 处理相对路径
          const fullPath = path.join('js', path.basename(url));
          if (hashMap[fullPath]) {
            const dir = path.dirname(url);
            const fileName = path.basename(url, `.${ext}`);
            const hashedUrl = path.join(dir, `${fileName}.${hashMap[fullPath]}.${ext}`).replace(/\\\\/g, '/');
            return match.replace(url, hashedUrl);
          }
          return match;
        }
      );
      
      // 更新图片引用
      content = content.replace(
        /<img[^>]+src=["'](.*?\.(png|jpg|jpeg|gif|svg|ico))["'][^>]*>/g,
        (match, url, ext) => {
          // 处理相对路径
          const fullPath = path.join('images', path.basename(url));
          if (hashMap[fullPath]) {
            const dir = path.dirname(url);
            const fileName = path.basename(url, `.${ext}`);
            const hashedUrl = path.join(dir, `${fileName}.${hashMap[fullPath]}.${ext}`).replace(/\\\\/g, '/');
            return match.replace(url, hashedUrl);
          }
          return match;
        }
      );
      
      // 更新CSS背景图片引用
      content = content.replace(
        /url\\(\\(["']?(.*?\.(png|jpg|jpeg|gif|svg|ico))["']?\\)\\)/g,
        (match, url, ext) => {
          // 处理相对路径
          const fullPath = path.join('images', path.basename(url));
          if (hashMap[fullPath]) {
            const dir = path.dirname(url);
            const fileName = path.basename(url, `.${ext}`);
            const hashedUrl = path.join(dir, `${fileName}.${hashMap[fullPath]}.${ext}`).replace(/\\\\/g, '/');
            return match.replace(url, hashedUrl);
          }
          return match;
        }
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated references in: ${htmlFile}`);
    }
  });
}

// 更新CSS文件中的资源引用
function updateCssFiles() {
  const cssDir = path.join(rootDir, 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(file => path.extname(file) === '.css');
    
    cssFiles.forEach(cssFile => {
      const filePath = path.join(cssDir, cssFile);
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 更新CSS中使用相对路径的背景图片引用
      content = content.replace(
        /background-image:\s*url\(['"]?(\.\.\/images\/[^'")]+)['"]?\)/g,
        (match, url) => {
          // 处理相对路径
          const fileName = path.basename(url);
          const fullPath = path.join('images', fileName);
          if (hashMap[fullPath]) {
            const ext = path.extname(fileName);
            const name = path.basename(fileName, ext);
            const hashedUrl = `../images/${name}.${hashMap[fullPath]}${ext}`;
            return match.replace(url, hashedUrl);
          }
          return match;
        }
      );
      
      // 更新CSS中使用绝对路径的背景图片引用
      content = content.replace(
        /background-image:\s*url\(['"]?(\/images\/[^'")]+)['"]?\)/g,
        (match, url) => {
          // 处理绝对路径
          const fileName = path.basename(url);
          const fullPath = path.join('images', fileName);
          if (hashMap[fullPath]) {
            const ext = path.extname(fileName);
            const name = path.basename(fileName, ext);
            const hashedUrl = `/images/${name}.${hashMap[fullPath]}${ext}`;
            return match.replace(url, hashedUrl);
          }
          return match;
        }
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated CSS references in: ${cssFile}`);
    });
  }
}

// 主函数
function main() {
  console.log('Generating resource hashes...');
  
  // 处理资源目录
  resourceDirs.forEach(dir => {
    const dirPath = path.join(rootDir, dir);
    if (fs.existsSync(dirPath)) {
      processDirectory(dirPath);
    }
  });
  
  // 更新HTML文件中的引用
  updateHtmlFiles();
  
  // 更新CSS文件中的引用
  updateCssFiles();
  
  console.log('Resource hashing completed!');
  console.log('HashMap:', hashMap);
}

main();