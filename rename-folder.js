const fs = require('fs-extra');
const path = require('path');

const filesDir = path.join(__dirname, 'files');
const oldDir = path.join(filesDir, 'user-1');
const newDir = path.join(filesDir, 'admin');

// 检查旧目录是否存在
if (fs.existsSync(oldDir)) {
  // 如果新目录已存在，先删除
  if (fs.existsSync(newDir)) {
    console.log('新目录已存在，将被替换');
    fs.removeSync(newDir);
  }
  
  // 重命名目录
  fs.moveSync(oldDir, newDir);
  console.log('目录重命名成功: user-1 -> admin');
} else {
  console.log('旧目录不存在，无需重命名');
}