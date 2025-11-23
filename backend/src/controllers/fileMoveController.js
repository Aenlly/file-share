const fs = require('fs-extra');
const path = require('path');
const Folder = require('../models/Folder');
const File = require('../models/File');
const { FILES_ROOT } = require('../utils/fileHelpers');

// 移动文件到另一个文件夹
const moveFile = (req, res) => {
    try {
        const { filename, targetFolderId } = req.body;
        const folderId = parseInt(req.params.folderId);
        
        console.log(`移动文件请求: filename=${filename}, sourceFolderId=${folderId}, targetFolderId=${targetFolderId}`);
        
        // 验证源文件夹和目标文件夹
        const folders = Folder.findByOwner(req.user.username);
        const sourceFolder = folders.find(f => f.id === folderId);
        const targetFolder = folders.find(f => f.id === parseInt(targetFolderId));
        
        console.log(`源文件夹: ${JSON.stringify(sourceFolder)}`);
        console.log(`目标文件夹: ${JSON.stringify(targetFolder)}`);
        
        if (!sourceFolder || !targetFolder) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        const sourcePath = path.join(FILES_ROOT, sourceFolder.physicalPath, filename);
        const targetPath = path.join(FILES_ROOT, targetFolder.physicalPath, filename);
        
        console.log(`源路径: ${sourcePath}`);
        console.log(`目标路径: ${targetPath}`);
        
        if (!fs.existsSync(sourcePath)) {
            console.log(`源文件不存在: ${sourcePath}`);
            return res.status(404).json({ error: '源文件不存在' });
        }
        
        // 查找文件记录
        const fileRecord = File.findBySavedName(filename, folderId);
        console.log(`文件记录: ${JSON.stringify(fileRecord)}`);
        
        if (!fileRecord) {
            return res.status(404).json({ error: '文件记录不存在' });
        }
        
        // 移动文件
        fs.moveSync(sourcePath, targetPath);
        console.log(`文件已移动`);
        
        // 更新文件记录中的folderId
        const files = File.getAll();
        const fileIndex = files.findIndex(f => f.id === fileRecord.id);
        if (fileIndex !== -1) {
            files[fileIndex].folderId = parseInt(targetFolderId);
            // 使用writeJSON_UTF8保存文件
            const fs = require('fs-extra');
            const path = require('path');
            const filePath = path.join(__dirname, '../../data/files.json');
            const jsonString = JSON.stringify(files, null, 2);
            const buffer = Buffer.from(jsonString, 'utf8');
            fs.writeFileSync(filePath, buffer);
            console.log(`文件记录已更新`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error(`移动文件失败: ${error}`);
        res.status(500).json({ error: '移动文件失败' });
    }
};

module.exports = {
    moveFile
};