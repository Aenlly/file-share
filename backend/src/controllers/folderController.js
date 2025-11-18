const Folder = require('../models/Folder');
const Share = require('../models/Share');
const fs = require('fs-extra');
const fsNative = require('fs');
const path = require('path');
const { FILES_ROOT } = require('../utils/fileHelpers');

// 获取用户文件夹
const getFolders = (req, res) => {
    try {
        const folders = Folder.findByOwner(req.user.username);
        
        // 为每个文件夹添加文件列表
        const foldersWithFiles = folders.map(folder => {
            const dirPath = path.join(FILES_ROOT, folder.physicalPath);
            let files = [];
            
            if (fs.existsSync(dirPath)) {
                files = fs.readdirSync(dirPath)
                    .filter(f => fsNative.statSync(path.join(dirPath, f)).isFile())
                    .map(filename => {
                        const filePath = path.join(dirPath, filename);
                        const stats = fsNative.statSync(filePath);
                        
                        return {
                            name: filename,
                            size: stats.size,
                            mtime: stats.mtime
                        };
                    });
            }
            
            return {
                ...folder,
                files
            };
        });
        
        res.json(foldersWithFiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 创建文件夹
const createFolder = (req, res) => {
    try {
        const { alias, parentId } = req.body;
        const folder = Folder.create({
            alias,
            owner: req.user.username,
            parentId
        });
        res.json(folder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 删除文件夹
const deleteFolder = (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        // 删除文件夹
        const folder = Folder.delete(id, req.user.username);
        
        // 删除与该文件夹相关的所有分享链接
        Share.deleteByFolderId(id);
        
        res.json({ success: true });
    } catch (error) {
        res.status(403).json({ error: error.message });
    }
};

// 获取子文件夹
const getSubFolders = (req, res) => {
    try {
        const parentId = req.params.parentId;
        const folders = Folder.findByParentId(parseInt(parentId), req.user.username);
        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取文件夹层级结构
const getFolderHierarchy = (req, res) => {
    try {
        const folders = Folder.getFolderHierarchy(req.user.username);
        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getFolders,
    createFolder,
    deleteFolder,
    getSubFolders,
    getFolderHierarchy
};