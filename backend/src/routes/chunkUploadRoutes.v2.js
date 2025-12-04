const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const { authenticate } = require('../middleware/auth');
const { sanitizeFilename, validateFileType } = require('../middleware/validation');
const logger = require('../utils/logger');
const config = require('../config');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const UploadSessionModel = require('../models/UploadSessionModel');
const { FILES_ROOT, generateUniqueFilename, decodeFilename } = require('../utils/fileHelpers');
const { isFolderOwnedByUser, calculateFileHash } = require('./helpers/fileHelpers');
const { sendError } = require('../config/errorCodes');

// 临时文件存储目录
const TEMP_UPLOAD_DIR = path.join('./temp/uploads');

// 确保临时目录存在
fs.ensureDirSync(TEMP_UPLOAD_DIR);

/**
 * 生成上传ID
 */
function generateUploadId() {
    return `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * 获取分片文件路径
 */
function getChunkPath(uploadId, chunkIndex) {
    return path.join(TEMP_UPLOAD_DIR, uploadId, `chunk_${chunkIndex}`);
}

/**
 * 分片上传 - 初始化（支持断点续传）
 */
router.post('/:folderId/chunk/init', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { fileName, fileSize, fileHash, resumeUploadId } = req.body;

        if (!fileName || !fileSize) {
            return sendError(res, 'PARAM_MISSING', '文件名和文件大小不能为空');
        }

        // 验证文件夹权限
        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        let originalName = fileName;
        if (originalName.startsWith('UTF8:')) {
            originalName = decodeFilename(originalName);
        }

        // 文件名安全检查
        originalName = sanitizeFilename(originalName);

        // 文件类型检查
        const typeValidation = validateFileType(originalName, config);
        if (!typeValidation.valid) {
            return sendError(res, 'FILE_TYPE_NOT_ALLOWED', typeValidation.error);
        }

        // 断点续传：检查是否有未完成的上传
        if (resumeUploadId) {
            const existingSession = await UploadSessionModel.findByUploadId(resumeUploadId);
            if (existingSession && existingSession.owner === req.user.username) {
                // 返回已上传的分片信息
                const progress = await UploadSessionModel.getMissingChunks(resumeUploadId);
                logger.info(`恢复上传会话: uploadId=${resumeUploadId}, progress=${progress.progress}%`);
                
                return res.json({
                    uploadId: resumeUploadId,
                    fileName: existingSession.fileName,
                    resumed: true,
                    ...progress
                });
            }
        }

        // 创建新的上传会话
        const uploadId = generateUploadId();
        const chunkSize = config.chunkSize || 5 * 1024 * 1024;
        const totalChunks = Math.ceil(fileSize / chunkSize);

        const session = await UploadSessionModel.createSession({
            uploadId,
            folderId,
            fileName: originalName,
            fileSize,
            fileHash,
            totalChunks,
            chunkSize,
            owner: req.user.username
        });

        // 创建临时目录
        const tempDir = path.join(TEMP_UPLOAD_DIR, uploadId);
        await fs.ensureDir(tempDir);

        logger.info(`初始化分片上传: uploadId=${uploadId}, fileName=${originalName}, totalChunks=${totalChunks}`);
        
        res.json({
            uploadId,
            fileName: originalName,
            totalChunks,
            chunkSize,
            resumed: false
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 分片上传 - 上传分片（支持并发和重传）
 */
router.post('/:folderId/chunk', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { uploadId, chunkIndex, chunk } = req.body;

        if (!uploadId || chunkIndex === undefined || !chunk) {
            return sendError(res, 'PARAM_MISSING', '缺少必要参数');
        }

        // 验证上传会话
        const session = await UploadSessionModel.findByUploadId(uploadId);
        if (!session) {
            return sendError(res, 'RESOURCE_NOT_FOUND', '上传会话不存在或已过期');
        }

        if (session.folderId !== folderId) {
            return sendError(res, 'PARAM_INVALID', '文件夹ID不匹配');
        }

        if (session.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN', '无权访问此上传会话');
        }

        if (session.status !== 'uploading') {
            return sendError(res, 'UPLOAD_SESSION_INVALID', `上传会话状态无效: ${session.status}`);
        }

        // 检查分片索引是否有效
        if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
            return sendError(res, 'PARAM_INVALID', '分片索引无效');
        }

        // 检查分片是否已上传（支持重传）
        if (session.uploadedChunks.includes(chunkIndex)) {
            logger.info(`分片已存在，跳过: uploadId=${uploadId}, chunkIndex=${chunkIndex}`);
            return res.json({
                success: true,
                chunkIndex,
                alreadyUploaded: true,
                progress: Math.round((session.uploadedChunks.length / session.totalChunks) * 100)
            });
        }

        // 保存分片到临时文件
        const chunkPath = getChunkPath(uploadId, chunkIndex);
        const chunkBuffer = Buffer.from(chunk, 'base64');
        
        await fs.ensureDir(path.dirname(chunkPath));
        await fs.writeFile(chunkPath, chunkBuffer);

        // 更新上传进度
        await UploadSessionModel.updateUploadedChunks(uploadId, chunkIndex);

        const updatedSession = await UploadSessionModel.findByUploadId(uploadId);
        const progress = Math.round((updatedSession.uploadedChunks.length / updatedSession.totalChunks) * 100);

        logger.info(`接收分片: uploadId=${uploadId}, chunkIndex=${chunkIndex}, progress=${progress}%`);
        
        res.json({
            success: true,
            chunkIndex,
            uploadedChunks: updatedSession.uploadedChunks.length,
            totalChunks: updatedSession.totalChunks,
            progress
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 分片上传 - 获取上传进度
 */
router.get('/:folderId/chunk/progress/:uploadId', authenticate, async (req, res, next) => {
    try {
        const { uploadId } = req.params;

        const session = await UploadSessionModel.findByUploadId(uploadId);
        if (!session) {
            return sendError(res, 'RESOURCE_NOT_FOUND', '上传会话不存在');
        }

        if (session.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        const progress = await UploadSessionModel.getMissingChunks(uploadId);
        
        res.json({
            ...progress,
            status: session.status,
            fileName: session.fileName,
            fileSize: session.fileSize
        });
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

        // 验证上传会话
        const session = await UploadSessionModel.findByUploadId(uploadId);
        if (!session) {
            return sendError(res, 'RESOURCE_NOT_FOUND', '上传会话不存在');
        }

        if (session.folderId !== folderId) {
            return sendError(res, 'PARAM_INVALID', '文件夹ID不匹配');
        }

        if (session.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        // 检查是否所有分片都已上传
        if (session.uploadedChunks.length !== session.totalChunks) {
            const missing = await UploadSessionModel.getMissingChunks(uploadId);
            return sendError(res, 'UPLOAD_INCOMPLETE', `还有 ${missing.missingChunks.length} 个分片未上传`);
        }

        // 合并分片
        const tempDir = path.join(TEMP_UPLOAD_DIR, uploadId);
        const chunks = [];
        
        for (let i = 0; i < session.totalChunks; i++) {
            const chunkPath = getChunkPath(uploadId, i);
            if (!await fs.pathExists(chunkPath)) {
                throw new Error(`分片文件不存在: chunk_${i}`);
            }
            const chunkBuffer = await fs.readFile(chunkPath);
            chunks.push(chunkBuffer);
        }

        const fileBuffer = Buffer.concat(chunks);
        
        // 验证文件大小
        if (fileBuffer.length !== session.fileSize) {
            throw new Error(`文件大小不匹配: 期望${session.fileSize}, 实际${fileBuffer.length}`);
        }

        // 计算文件哈希
        const fileHash = calculateFileHash(fileBuffer);
        
        // 检查文件是否已存在
        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            throw new Error('文件夹不存在');
        }

        const existingByHash = await FileModel.findByHash(fileHash, folderId);
        if (existingByHash) {
            // 清理临时文件
            await fs.remove(tempDir);
            await UploadSessionModel.completeSession(uploadId);
            
            return res.status(200).json({
                success: false,
                code: 'FILE_ALREADY_EXISTS',
                error: '文件已存在',
                existingFile: existingByHash.originalName
            });
        }

        // 保存文件
        const savedName = generateUniqueFilename(session.fileName);
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const filePath = path.join(dirPath, savedName);

        await fs.ensureDir(dirPath);
        await fs.writeFile(filePath, fileBuffer);

        // 创建文件记录
        const fileRecord = await FileModel.create({
            folderId,
            originalName: session.fileName,
            savedName,
            size: fileBuffer.length,
            mimeType: 'application/octet-stream',
            owner: session.owner,
            hash: fileHash
        });

        // 清理临时文件和会话
        await fs.remove(tempDir);
        await UploadSessionModel.completeSession(uploadId);

        logger.info(`分片上传完成: ${session.fileName}, size=${fileBuffer.length}`);

        res.json({
            success: true,
            file: {
                id: fileRecord.id,
                originalName: session.fileName,
                savedName,
                size: fileBuffer.length,
                hash: fileHash
            }
        });
    } catch (error) {
        logger.error(`完成上传失败: ${error.message}`);
        next(error);
    }
});

/**
 * 分片上传 - 取消上传
 */
router.post('/:folderId/chunk/cancel', authenticate, async (req, res, next) => {
    try {
        const { uploadId } = req.body;

        if (!uploadId) {
            return sendError(res, 'PARAM_MISSING', '缺少uploadId');
        }

        const session = await UploadSessionModel.findByUploadId(uploadId);
        if (!session) {
            return sendError(res, 'RESOURCE_NOT_FOUND', '上传会话不存在');
        }

        if (session.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        // 清理临时文件
        const tempDir = path.join(TEMP_UPLOAD_DIR, uploadId);
        if (await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
        }

        // 取消会话
        await UploadSessionModel.cancelSession(uploadId);

        logger.info(`取消上传: uploadId=${uploadId}`);
        
        res.json({ success: true, message: '上传已取消' });
    } catch (error) {
        next(error);
    }
});

/**
 * 获取用户的活跃上传会话
 */
router.get('/chunk/sessions', authenticate, async (req, res, next) => {
    try {
        const sessions = await UploadSessionModel.getActiveSessionsByOwner(req.user.username);
        
        const sessionsWithProgress = await Promise.all(
            sessions.map(async (session) => {
                const progress = await UploadSessionModel.getMissingChunks(session.uploadId);
                return {
                    uploadId: session.uploadId,
                    fileName: session.fileName,
                    fileSize: session.fileSize,
                    folderId: session.folderId,
                    ...progress,
                    createdAt: session.createdAt,
                    expiresAt: session.expiresAt
                };
            })
        );

        res.json({ sessions: sessionsWithProgress });
    } catch (error) {
        next(error);
    }
});

// 定期清理过期的上传会话
setInterval(async () => {
    try {
        const cleanedCount = await UploadSessionModel.cleanupExpiredSessions();
        if (cleanedCount > 0) {
            logger.info(`清理了 ${cleanedCount} 个过期的上传会话`);
        }
    } catch (error) {
        logger.error('清理过期上传会话失败:', error);
    }
}, 30 * 60 * 1000); // 每30分钟清理一次

module.exports = router;
