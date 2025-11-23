const fs = require('fs-extra');
const path = require('path');

// 读取文件夹数据
const foldersPath = path.join(__dirname, '../data/folders.json');
const folders = JSON.parse(fs.readFileSync(foldersPath, 'utf8'));

// 修复文件夹ID与physicalPath不匹配的问题
const fixedFolders = folders.map(folder => {
  // 如果有parentId，说明是子文件夹
  if (folder.parentId) {
    // 检查physicalPath中是否包含不同的ID
    const pathParts = folder.physicalPath.split('/');
    const pathId = pathParts[pathParts.length - 1];
    
    if (pathId !== folder.id.toString()) {
      // 修复physicalPath中的ID
      const newPathParts = [...pathParts];
      newPathParts[newPathParts.length - 1] = folder.id.toString();
      folder.physicalPath = newPathParts.join('/');
      console.log(`修复文件夹 ${folder.alias} 的路径: ${folder.physicalPath}`);
      
      // 同时移动文件系统中的文件夹
      const { FILES_ROOT } = require('../src/utils/fileHelpers');
      const oldPath = path.join(FILES_ROOT, pathParts.join('/'));
      const newPath = path.join(FILES_ROOT, folder.physicalPath);
      
      if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        fs.moveSync(oldPath, newPath);
        console.log(`移动文件夹: ${oldPath} 到 ${newPath}`);
      }
    }
  }
  return folder;
});

// 保存修复后的数据
fs.writeFileSync(foldersPath, JSON.stringify(fixedFolders, null, 2));
console.log('文件夹ID匹配修复完成');