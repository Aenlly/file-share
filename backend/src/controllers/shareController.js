const fs = require('fs-extra');
const fsNative = require('fs');
const path = require('path');
const Share = require('../models/Share');
const Folder = require('../models/Folder');
const { FILES_ROOT } = require('../utils/fileHelpers');

// 创建分享链接
const createShare = (req, res) => {
    try {
        const { folderId, expireInMs = 86400000 } = req.body;
        
        // 验证文件夹所有权
        const folders = Folder.getAll();
        const folder = folders.find(f => f.id === folderId && f.owner === req.user.username);
        if (!folder) {
            return res.status(403).json({ error: '无权分享' });
        }
        
        const share = Share.create({
            folderId,
            owner: req.user.username,
            expireInMs
        });
        
        res.json(share);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取用户分享链接
const getShares = (req, res) => {
    try {
        const shares = Share.getWithFolderInfo(req.user.username);
        res.json(shares);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新分享链接
const updateShare = (req, res) => {
    try {
        const shareId = parseInt(req.params.id);
        const { expireInMs } = req.body;
        
        const shares = Share.getAll();
        const share = shares.find(s => s.id === shareId && s.owner === req.user.username);
        
        if (!share) {
            return res.status(404).json({ error: '分享链接不存在或无权限' });
        }
        
        const updatedShare = Share.update(shareId, { expireInMs });
        res.json(updatedShare);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 删除分享链接
const deleteShare = (req, res) => {
    try {
        const shareId = parseInt(req.params.id);
        
        const shares = Share.getAll();
        const share = shares.find(s => s.id === shareId && s.owner === req.user.username);
        
        if (!share) {
            return res.status(404).json({ error: '分享链接不存在或无权限' });
        }
        
        Share.delete(shareId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 验证分享链接
const verifyShare = (req, res) => {
    try {
        const { code } = req.params;
        // 访问码区分大小写，直接使用原始输入
        const share = Share.findByCode(code);
        
        if (!share) {
            return res.status(404).json({ error: '分享链接不存在' });
        }
        
        if (Date.now() > share.expireTime) {
            return res.status(410).json({ error: '分享链接已过期' });
        }
        
        const folders = Folder.getAll();
        const folder = folders.find(f => f.id === share.folderId);
        
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        // 获取文件夹文件列表
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        
        let files = [];
        if (fs.existsSync(dirPath)) {
            // 先从文件模型中获取文件信息
            const File = require('../models/File');
            const fileRecords = File.findByFolder(share.folderId);
            
            // 获取物理文件列表
            const rawFiles = fs.readdirSync(dirPath).filter(f => fsNative.statSync(path.join(dirPath, f)).isFile());
            
            // 合并文件模型信息和物理文件信息
            files = fileRecords.map(fileRecord => {
                // 检查物理文件是否存在
                const physicalFile = rawFiles.find(name => name === fileRecord.savedName);
                
                if (physicalFile) {
                    return {
                        name: fileRecord.originalName, // 使用原始文件名
                        originalName: fileRecord.savedName // 保存的文件名用于文件操作
                    };
                }
                return null;
            }).filter(file => file !== null);
            
            // 如果文件模型中没有记录，则使用物理文件列表
            if (files.length === 0) {
                files = rawFiles.map(name => {
                    // 尝试修复文件名编码问题
                    let displayName = name;
                    try {
                        // 如果文件名包含非ASCII字符，尝试转换编码
                        if (/[^\\x00-\\x7F]/.test(name)) {
                            displayName = Buffer.from(name, 'latin1').toString('utf8');
                        }
                    } catch (e) {
                        // 如果转换失败，使用原始名称
                        console.error('文件名编码转换失败:', e);
                    }
                    
                    return {
                        name: displayName,
                        originalName: name // 保留原始名称用于文件操作
                    };
                });
            }
        }
        
        res.json({
            alias: folder.alias,
            files,
            share: {
                code: share.code,
                expireTime: share.expireTime
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createShare,
    getShares,
    updateShare,
    deleteShare,
    verifyShare
};