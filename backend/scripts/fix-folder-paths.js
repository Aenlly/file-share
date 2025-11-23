const fs = require('fs-extra');
const path = require('path');

// 读取文件夹数据
const foldersPath = path.join(__dirname, '../data/folders.json');
const folders = JSON.parse(fs.readFileSync(foldersPath, 'utf8'));

// 修复子文件夹的physicalPath
const fixedFolders = folders.map(folder => {
  // 如果有parentId，说明是子文件夹
  if (folder.parentId) {
    // 查找父文件夹
    const parentFolder = folders.find(f => f.id === folder.parentId);
    if (parentFolder) {
      // 修复子文件夹的physicalPath，移除重复的用户名
      const parts = folder.physicalPath.split('/');
      if (parts.length >= 2 && parts[0] === parts[1]) {
        // 移除重复的用户名
        parts.shift();
        folder.physicalPath = parts.join('/');
        console.log(`修复文件夹 ${folder.alias} 的路径: ${folder.physicalPath}`);
      }
    }
  }
  return folder;
});

// 保存修复后的数据
fs.writeFileSync(foldersPath, JSON.stringify(fixedFolders, null, 2));
console.log('文件夹路径修复完成');