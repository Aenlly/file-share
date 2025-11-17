const fs = require('fs-extra');
const path = require('path');
const Folder = require('../models/Folder');
const { FILES_ROOT } = require('../utils/fileHelpers');

// 移动文件到另一个文件夹
const moveFile = (req, res) => {
    try {
        const { filename, targetFolderId } = req.body;
        const folderId = parseInt(req.params.folderId);
        
        // 验证源文件夹和目标文件夹
        const folders = Folder.findByOwner(req.user.username);
        const sourceFolder = folders.find(f => f.id === folderId);
        const targetFolder = folders.find(f => f.id === parseInt(targetFolderId));
        
        if (!sourceFolder || !targetFolder) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        const sourcePath = path.join(FILES_ROOT, sourceFolder.physicalPath, filename);
        const targetPath = path.join(FILES_ROOT, targetFolder.physicalPath, filename);
        
        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ error: '源文件不存在' });
        }
        
        // 移动文件
        fs.moveSync(sourcePath, targetPath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: '移动文件失败' });
    }
};

module.exports = {
    moveFile
};