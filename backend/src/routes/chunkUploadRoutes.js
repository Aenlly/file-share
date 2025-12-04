const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const { FILES_ROOT, generateUniqueFilename, decodeFilename } = require('../utils/fileHelpers');
const { isFolderOwnedByUser, calculateFileHashSmart } = require('./helpers/fileHelpers');
const { sendError } = require('../config/errorCodes');

const UploadSessionModel = require('../models/UploadSessionModel');

/**
 * 获取上传配置（分片大小等）
 */
router.get('/config', authenticate, (req, res) => {
    res.json({
        chunkSize: config.chunkSize,
        maxFileSize: config.maxFileSize
    });
});

/**
 * 分片上传 - 初始化
 */
router.post('/:folderId/chunk/init', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { fileName, fileSize } = req.body;

        if (!fileName || !fileSize) {
            return sendError(res, 'PARAM_MISSING', '文件名和文件大小不能为空');
        }

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        // 使用锁防止并发上传导致的配额竞态
        const lockManager = require('../utils/LockManager');
        const lockKey = `storage:${req.user.username}`;
        
        try {
            await lockManager.acquire(lockKey, 10000); // 10秒超时
            
            // 检查存储配额
            const UserModel = require('../models/UserModel');
            const quotaCheck = await UserModel.checkStorageQuota(req.user.username, fileSize);
            
            if (!quotaCheck.allowed) {
                lockManager.release(lockKey);
                const { formatStorageSize } = require('../utils/storageCalculator');
                return sendError(res, 'STORAGE_QUOTA_EXCEEDED', 
                    `存储空间不足。可用: ${formatStorageSize(quotaCheck.storageAvailable)}, 需要: ${formatStorageSize(fileSize)}`
                );
            }
            
            // 配额检查通过，但保持锁直到会话创建完成
        } catch (lockError) {
            logger.error('获取存储锁失败:', lockError);
            return sendError(res, 'SYSTEM_BUSY', '系统繁忙，请稍后重试');
        }

        const uploadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let originalName = fileName;
        if (originalName.startsWith('UTF8:')) {
            originalName = decodeFilename(originalName);
        }

        // 文件类型检查
        const { validateFileType, sanitizeFilename } = require('../middleware/validation');
        originalName = sanitizeFilename(originalName);
        
        const typeValidation = validateFileType(originalName, config);
        if (!typeValidation.valid) {
            return sendError(res, 'FILE_TYPE_NOT_ALLOWED', typeValidation.error);
        }

        // 创建上传会话（存储到数据库）
        await UploadSessionModel.createSession({
            uploadId,
            folderId,
            fileName: originalName,
            fileSize,
            owner: req.user.username
        });

        // 释放存储锁
        lockManager.release(lockKey);
        
        logger.info(`初始化分片上传: uploadId=${uploadId}, fileName=${originalName}, fileSize=${fileSize}`);
        res.json({ uploadId, fileName: originalName });
    } catch (error) {
        // 确保释放锁
        const lockManager = require('../utils/LockManager');
        const lockKey = `storage:${req.user.username}`;
        lockManager.release(lockKey);
        next(error);
    }
});

/**
 * 分片上传 - 上传分片
 */
router.post('/:folderId/chunk', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { uploadId, chunkIndex, chunk } = req.body;

        if (!uploadId || chunkIndex === undefined || !chunk) {
            return sendError(res, 'PARAM_MISSING');
        }

        const uploadInfo = await UploadSessionModel.findByUploadId(uploadId);
        if (!uploadInfo) {
            return sendError(res, 'RESOURCE_NOT_FOUND', '上传会话不存在或已过期');
        }

        if (uploadInfo.folderId !== folderId) {
            return sendError(res, 'PARAM_INVALID', '文件夹ID不匹配');
        }

        const chunkBuffer = Buffer.from(chunk, 'base64');
        
        // 更新会话的分片数据
        await UploadSessionModel.updateChunks(uploadId, chunkIndex, chunk);

        logger.info(`接收分片: uploadId=${uploadId}, chunkIndex=${chunkIndex}`);
        res.json({ success: true, chunkIndex });
    } catch (error) {
        next(error);
    }
});

/**
 * 分片上传 - 完成上传
 */
router.post('/:folderId/chunk/complete', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { uploadId } = req.body;

        if (!uploadId) {
            return sendError(res, 'PARAM_MISSING', '缺少uploadId');
        }

        const uploadInfo = await UploadSessionModel.findByUploadId(uploadId);
        if (!uploadInfo) {
            return sendError(res, 'RESOURCE_NOT_FOUND', '上传会话不存在或已过期');
        }

        if (uploadInfo.folderId !== folderId) {
            return sendError(res, 'PARAM_INVALID', '文件夹ID不匹配');
        }

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            await UploadSessionModel.deleteSession(uploadId);
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        // 重建文件 Buffer
        const chunkBuffers = uploadInfo.chunks.map(chunk => Buffer.from(chunk, 'base64'));
        const fileBuffer = Buffer.concat(chunkBuffers);
        // 使用智能哈希计算（大文件使用流式处理）
        const fileHash = await calculateFileHashSmart(fileBuffer);
        
        const existingByHash = await FileModel.findByHash(fileHash, folderId);
        if (existingByHash) {
            await UploadSessionModel.deleteSession(uploadId);
            return res.status(200).json({ 
                success: false,
                code: 'FILE_ALREADY_EXISTS',
                error: '文件已存在',
                existingFile: existingByHash.originalName 
            });
        }

        const savedName = generateUniqueFilename(uploadInfo.fileName);
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const filePath = path.join(dirPath, savedName);

        await fs.ensureDir(dirPath);
        await fs.writeFile(filePath, fileBuffer);

        const fileRecord = await FileModel.create({
            folderId,
            originalName: uploadInfo.fileName,
            savedName,
            size: fileBuffer.length,
            mimeType: 'application/octet-stream',
            owner: uploadInfo.owner,
            hash: fileHash
        });

        // 更新用户存储使用量
        const UserModel = require('../models/UserModel');
        await UserModel.incrementStorageUsed(uploadInfo.owner, fileBuffer.length);

        // 标记会话为已完成并删除
        await UploadSessionModel.deleteSession(uploadId);
        logger.info(`分片上传完成: ${uploadInfo.fileName}, size=${fileBuffer.length}`);

        res.json({
            success: true,
            file: {
                id: fileRecord.id,
                originalName: uploadInfo.fileName,
                savedName,
                size: fileBuffer.length
            }
        });
    } catch (error) {
        if (req.body.uploadId) {
            await UploadSessionModel.deleteSession(req.body.uploadId).catch(() => {});
        }
        next(error);
    }
});

// 启动时立即清理一次过期会话
(async () => {
    try {
        const cleanedCount = await UploadSessionModel.cleanExpiredSessions();
        if (cleanedCount > 0) {
            logger.info(`启动时清理过期的分片上传会话: ${cleanedCount} 个`);
        }
    } catch (error) {
        logger.error('启动时清理上传会话失败:', error);
    }
})();

// 定期清理过期的分片上传会话（每10分钟）
setInterval(async () => {
    try {
        const cleanedCount = await UploadSessionModel.cleanExpiredSessions();
        if (cleanedCount > 0) {
            logger.info(`定期清理过期的分片上传会话: ${cleanedCount} 个`);
        }
    } catch (error) {
        logger.error('清理上传会话失败:', error);
    }
}, 10 * 60 * 1000);

module.exports = router;
