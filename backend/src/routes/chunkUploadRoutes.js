const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const { FILES_ROOT, generateUniqueFilename, decodeFilename } = require('../utils/fileHelpers');
const { isFolderOwnedByUser, calculateFileHash } = require('./helpers/fileHelpers');

// 存储分片上传的临时数据
const chunkUploads = new Map();

/**
 * 分片上传 - 初始化
 */
router.post('/:folderId/chunk/init', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { fileName, fileSize } = req.body;

        if (!fileName || !fileSize) {
            return res.status(400).json({ error: '文件名和文件大小不能为空' });
        }

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return res.status(403).json({ error: '无权访问' });
        }

        const uploadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let originalName = fileName;
        if (originalName.startsWith('UTF8:')) {
            originalName = decodeFilename(originalName);
        }

        chunkUploads.set(uploadId, {
            folderId,
            fileName: originalName,
            fileSize,
            chunks: [],
            owner: req.user.username,
            createdAt: Date.now()
        });

        logger.info(`初始化分片上传: uploadId=${uploadId}, fileName=${originalName}`);
        res.json({ uploadId, fileName: originalName });
    } catch (error) {
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
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const uploadInfo = chunkUploads.get(uploadId);
        if (!uploadInfo) {
            return res.status(404).json({ error: '上传会话不存在或已过期' });
        }

        if (uploadInfo.folderId !== folderId) {
            return res.status(400).json({ error: '文件夹ID不匹配' });
        }

        const chunkBuffer = Buffer.from(chunk, 'base64');
        uploadInfo.chunks[chunkIndex] = chunkBuffer;

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
            return res.status(400).json({ error: '缺少uploadId' });
        }

        const uploadInfo = chunkUploads.get(uploadId);
        if (!uploadInfo) {
            return res.status(404).json({ error: '上传会话不存在或已过期' });
        }

        if (uploadInfo.folderId !== folderId) {
            return res.status(400).json({ error: '文件夹ID不匹配' });
        }

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            chunkUploads.delete(uploadId);
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const fileBuffer = Buffer.concat(uploadInfo.chunks);
        const fileHash = calculateFileHash(fileBuffer);
        
        const existingByHash = await FileModel.findByHash(fileHash, folderId);
        if (existingByHash) {
            chunkUploads.delete(uploadId);
            return res.status(409).json({ 
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

        chunkUploads.delete(uploadId);
        logger.info(`分片上传完成: ${uploadInfo.fileName}`);

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
            chunkUploads.delete(req.body.uploadId);
        }
        next(error);
    }
});

// 定期清理过期的分片上传会话（超过1小时）
setInterval(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const [uploadId, uploadInfo] of chunkUploads.entries()) {
        if (now - uploadInfo.createdAt > oneHour) {
            chunkUploads.delete(uploadId);
            logger.info(`清理过期的分片上传会话: ${uploadId}`);
        }
    }
}, 10 * 60 * 1000);

module.exports = router;
