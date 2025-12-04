const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

const { authenticate } = require('../middleware/auth');
const { canAccessResource } = require('../middleware/permission');
const logger = require('../utils/logger');
const RecycleBinModel = require('../models/RecycleBinModel');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const { FILES_ROOT } = require('../utils/fileHelpers');

/**
 * 获取回收站文件列表
 */
router.get('/', authenticate, canAccessResource('recycle', 'view'), async (req, res, next) => {
    try {
        const files = await RecycleBinModel.findByOwner(req.user.username);
        
        logger.info(`获取回收站文件列表: user=${req.user.username}, count=${files.length}`);
        
        res.json(files);
    } catch (error) {
        logger.error('获取回收站文件列表失败:', error);
        next(error);
    }
});

/**
 * 恢复回收站文件
 */
router.post('/restore/:fileId', authenticate, canAccessResource('recycle', 'restore'), async (req, res, next) => {
    try {
        const fileId = parseInt(req.params.fileId);
        
        const recycleBinFile = await RecycleBinModel.findById(fileId);
        if (!recycleBinFile) {
            return res.status(404).json({ error: '文件不存在' });
        }

        // 检查权限
        if (!req.canManageAll && recycleBinFile.owner !== req.user.username) {
            return res.status(403).json({ error: '权限不足' });
        }

        // 恢复文件
        await FileModel.insert({
            originalName: recycleBinFile.originalName,
            savedName: recycleBinFile.savedName,
            size: recycleBinFile.size,
            mimeType: recycleBinFile.mimeType,
            folderId: recycleBinFile.folderId,
            owner: recycleBinFile.owner,
            hash: recycleBinFile.hash
        });

        // 从回收站删除
        await RecycleBinModel.delete(fileId);

        logger.info(`恢复文件: ${recycleBinFile.originalName}`);
        
        res.json({ success: true, message: '文件恢复成功' });
    } catch (error) {
        logger.error('恢复文件失败:', error);
        next(error);
    }
});

/**
 * 清空回收站
 */
router.delete('/clear', authenticate, canAccessResource('recycle', 'delete'), async (req, res, next) => {
    try {
        const files = await RecycleBinModel.findByOwner(req.user.username);
        
        let deletedCount = 0;
        let errorCount = 0;

        for (const file of files) {
            try {
                const folder = await FolderModel.findById(file.folderId);
                if (folder) {
                    const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
                    if (await fs.pathExists(filePath)) {
                        await fs.remove(filePath);
                    }
                }
                
                await RecycleBinModel.delete(file.id);
                deletedCount++;
            } catch (error) {
                logger.error(`删除文件失败: ${file.originalName}`, error);
                errorCount++;
            }
        }

        logger.info(`清空回收站: user=${req.user.username}, 成功=${deletedCount}, 失败=${errorCount}`);
        
        res.json({ 
            success: true, 
            message: `清空回收站成功，删除 ${deletedCount} 个文件`,
            deletedCount,
            errorCount
        });
    } catch (error) {
        logger.error('清空回收站失败:', error);
        next(error);
    }
});

/**
 * 从回收站永久删除文件
 */
router.delete('/:fileId', authenticate, canAccessResource('recycle', 'delete'), async (req, res, next) => {
    try {
        const fileId = parseInt(req.params.fileId);
        
        const recycleBinFile = await RecycleBinModel.findById(fileId);
        if (!recycleBinFile) {
            return res.status(404).json({ error: '文件不存在' });
        }

        // 检查权限
        if (!req.canManageAll && recycleBinFile.owner !== req.user.username) {
            return res.status(403).json({ error: '权限不足' });
        }

        // 删除物理文件
        const folder = await FolderModel.findById(recycleBinFile.folderId);
        if (folder) {
            const filePath = path.join(FILES_ROOT, folder.physicalPath, recycleBinFile.savedName);
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
                logger.info(`删除物理文件: ${filePath}`);
            }
        }

        // 从回收站删除记录
        await RecycleBinModel.delete(fileId);

        logger.info(`永久删除文件: ${recycleBinFile.originalName}`);
        
        res.json({ success: true, message: '文件已永久删除' });
    } catch (error) {
        logger.error('永久删除文件失败:', error);
        next(error);
    }
});

module.exports = router;
