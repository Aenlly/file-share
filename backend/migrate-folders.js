const fs = require('fs-extra');
const path = require('path');

// 读取文件夹数据
const foldersPath = path.join(__dirname, 'data', 'folders.json');
const folders = JSON.parse(fs.readFileSync(foldersPath, 'utf8'));

// 文件根目录
const FILES_ROOT = path.join(__dirname, 'files');

// 迁移函数
function migrateFolders() {
  let updated = false;
  
  folders.forEach(folder => {
    // 检查是否需要迁移
    if (folder.physicalPath.startsWith('user-')) {
      // 提取用户ID
      const userId = folder.physicalPath.split('/')[0];
      
      // 新的物理路径使用用户名
      const newPhysicalPath = folder.physicalPath.replace(userId, folder.owner);
      const oldPath = path.join(FILES_ROOT, folder.physicalPath);
      const newPath = path.join(FILES_ROOT, newPhysicalPath);
      
      // 如果旧路径存在且新路径不存在，则移动目录
      if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        console.log(`移动目录: ${oldPath} -> ${newPath}`);
        fs.moveSync(oldPath, newPath);
        
        // 更新文件夹记录
        folder.physicalPath = newPhysicalPath;
        updated = true;
      } else if (fs.existsSync(oldPath) && fs.existsSync(newPath)) {
        // 如果两个路径都存在，可能需要合并文件
        console.log(`警告: 两个路径都存在，需要手动处理: ${oldPath} 和 ${newPath}`);
      } else if (!fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        // 如果两个路径都不存在，只需更新记录
        folder.physicalPath = newPhysicalPath;
        updated = true;
      }
    }
  });
  
  // 如果有更新，保存文件夹数据
  if (updated) {
    fs.writeFileSync(foldersPath, JSON.stringify(folders, null, 2));
    console.log('文件夹数据已更新');
  } else {
    console.log('没有需要迁移的文件夹');
  }
}

// 执行迁移
migrateFolders();