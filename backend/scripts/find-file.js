const fs = require('fs-extra');
const path = require('path');
const { FILES_ROOT } = require('../src/utils/fileHelpers');

// 查找文件
function findFile(basePath, fileName) {
  const files = [];
  
  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.includes(fileName)) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(basePath);
  return files;
}

// 查找文件
const fileName = '0655ba65';
const foundFiles = findFile(FILES_ROOT, fileName);

console.log(`找到 ${foundFiles.length} 个匹配的文件:`);
foundFiles.forEach(file => console.log(file));