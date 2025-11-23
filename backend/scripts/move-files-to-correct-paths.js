const fs = require('fs-extra');
const path = require('path');
const { FILES_ROOT } = require('../src/utils/fileHelpers');

// 读取文件夹和文件数据
const foldersPath = path.join(__dirname, '../data/folders.json');
const filesPath = path.join(__dirname, '../data/files.json');
const folders = JSON.parse(fs.readFileSync(foldersPath, 'utf8'));
const files = JSON.parse(fs.readFileSync(filesPath, 'utf8'));

// 处理每个文件
files.forEach(file => {
  const folder = folders.find(f => f.id === file.folderId);
  if (!folder) return;
  
  // 构建正确的文件路径
  const correctPath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
  
  // 检查文件是否存在于错误路径中
  const wrongPathParts = folder.physicalPath.split('/');
  if (wrongPathParts.length >= 2) {
    // 构建错误路径（包含重复的用户名）
    const wrongPath = path.join(FILES_ROOT, wrongPathParts[0], wrongPathParts[0], ...wrongPathParts.slice(1), file.savedName);
    
    if (fs.existsSync(wrongPath) && !fs.existsSync(correctPath)) {
      // 移动文件到正确路径
      fs.ensureDirSync(path.dirname(correctPath));
      fs.moveSync(wrongPath, correctPath);
      console.log(`移动文件: ${file.originalName} 从 ${wrongPath} 到 ${correctPath}`);
    }
  }
});

console.log('文件移动完成');