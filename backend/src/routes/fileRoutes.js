const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { sanitizeFilename, validateFileType } = require('../middleware/validation');
const logger = require('../utils/logger');
const config = require('../config');
const { scanFile } = require('../utils/fileScanner');
const UserModel = require('../models/UserModel');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const { FILES_ROOT, generateUniqueFilename } = require('../utils/fileHelpers');
const { normalizeFilename } = require('../utils/filenameEncoder');
const { isFolderOwnedByUser, calculateFileHashSmart } = require('./helpers/fileHelpers');
const { sendError } = require('../config/errorCodes');

// 配置multer
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '524288000');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: MAX_FILE_SIZE,
        files: 200
    }
});

/**
 * 获取文件夹内的文件
 */
router.get('/:folderId/files', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        
        logger.info(`获取文件列表: folderId=${folderId}, user=${req.user.username}`);
        
        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        const files = await FileModel.findByFolder(folderId);
        logger.info(`成功获取文件列表: folderId=${folderId}, count=${files.length}`);
        res.json(files);
    } catch (error) {
        logger.error(`获取文件列表失败:`, error);
        next(error);
    }
});

/**
 * 上传文件
 */
router.post('/:folderId/upload', authenticate, uploadLimiter, upload.array('files', 200), async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const folder = await FolderModel.findById(folderId);

        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        if (!req.files || req.files.length === 0) {
            return sendError(res, 'PARAM_INVALID', '没有上传文件');
        }

        // 检查存储配额
        const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);
        const quotaCheck = await UserModel.checkStorageQuota(req.user.username, totalUploadSize);
        
        if (!quotaCheck.allowed) {
            const { formatStorageSize } = require('../utils/storageCalculator');
            return sendError(res, 'STORAGE_QUOTA_EXCEEDED', 
                `存储空间不足。可用: ${formatStorageSize(quotaCheck.storageAvailable)}, 需要: ${formatStorageSize(totalUploadSize)}`
            );
        }

        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const forceUpload = req.body.force === 'true';
        const uploadedFiles = [];
        const existingFiles = [];
        const errorFiles = [];

        for (const file of req.files) {
            try {
                // 统一文件名处理
                let originalName = normalizeFilename(file.originalname);
                
                // 文件名安全检查
                originalName = sanitizeFilename(originalName);
                
                // 文件类型检查
                const typeValidation = validateFileType(originalName, config);
                if (!typeValidation.valid) {
                    errorFiles.push({
                        filename: originalName,
                        error: typeValidation.error
                    });
                    continue;
                }

                // 文件安全扫描
                const scanResult = await scanFile(file.buffer, originalName);
                if (!scanResult.valid) {
                    logger.warn(`文件安全扫描失败: ${originalName}`, scanResult);
                    errorFiles.push({
                        filename: originalName,
                        error: `安全检查失败: ${scanResult.message}`
                    });
                    continue;
                }

                // 使用智能哈希计算（大文件使用流式处理）
                const fileHash = await calculateFileHashSmart(file.buffer);
                logger.info(`文件哈希: ${originalName} -> ${fileHash} (大小: ${file.size} 字节)`);

                // 检查哈希是否已存在
                const existingByHash = await FileModel.findByHash(fileHash, folderId);
                if (existingByHash && !forceUpload) {
                    existingFiles.push({ 
                        filename: originalName,
                        size: file.size,
                        hash: fileHash,
                        existingFile: existingByHash.originalName,
                        existingId: existingByHash.id,
                        reason: 'hash_match'
                    });
                    continue;
                }

                // 检查文件名是否已存在
                const existingByName = await FileModel.findByOriginalName(originalName, folderId);
                if (existingByName && !forceUpload) {
                    if (existingByName.hash && existingByName.hash !== fileHash) {
                        logger.info(`文件名相同但内容不同，允许上传: ${originalName}`);
                    } else if (!existingByName.hash) {
                        if (existingByName.size !== file.size) {
                            logger.info(`文件名相同但大小不同，允许上传: ${originalName}`);
                        } else {
                            existingFiles.push({ 
                                filename: originalName,
                                size: file.size,
                                existingId: existingByName.id,
                                reason: 'name_and_size_match'
                            });
                            continue;
                        }
                    } else {
                        existingFiles.push({ 
                            filename: originalName,
                            size: file.size,
                            hash: fileHash,
                            existingId: existingByName.id,
                            reason: 'name_match'
                        });
                        continue;
                    }
                }

                const savedName = generateUniqueFilename(originalName);
                const filePath = path.join(dirPath, savedName);

                await fs.ensureDir(dirPath);
                await fs.writeFile(filePath, file.buffer);

                const fileRecord = await FileModel.create({
                    folderId,
                    originalName,
                    savedName,
                    size: file.size,
                    mimeType: file.mimetype,
                    owner: req.user.username,
                    hash: fileHash
                });

                uploadedFiles.push({
                    id: fileRecord.id,
                    originalName,
                    savedName,
                    size: file.size
                });

                logger.info(`上传文件: ${originalName}`);
                
                // 更新用户存储使用量
                await UserModel.incrementStorageUsed(req.user.username, file.size);
            } catch (error) {
                errorFiles.push({
                    filename: file.originalname,
                    error: error.message
                });
            }
        }

        const result = {
            success: uploadedFiles.length > 0,
            uploadedFiles,
            existingFiles,
            errorFiles,
            total: req.files.length
        };

        if (existingFiles.length > 0 && !forceUpload) {
            return res.status(200).json(result);
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * 删除文件（移至回收站）
 */
router.delete('/:folderId/file', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { filenames, filename } = req.body;

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            return res.status(200).json({ 
                success: false, 
                code: 'FOLDER_NOT_FOUND',
                error: '文件夹不存在' 
            });
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return res.status(200).json({ 
                success: false, 
                code: 'FOLDER_FORBIDDEN',
                error: '无权访问' 
            });
        }

        const filesToDelete = filenames || [filename];

        const result = await FileModel.batchMoveToRecycleBin(
            filesToDelete, 
            folderId, 
            req.user.username
        );

        logger.info(`移至回收站: ${result.deletedFiles.map(f => f.originalName).join(', ')}`);

        // 注意：移至回收站不减少存储使用量，因为文件仍然存在
        // 只有永久删除时才减少

        res.json({
            success: result.deletedFiles.length > 0,
            deletedFiles: result.deletedFiles,
            errorFiles: result.errorFiles,
            total: filesToDelete.length,
            deleteType: 'logical'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 下载文件
 */
router.get('/:folderId/download/:filename', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        let filename = decodeURIComponent(req.params.filename);
        
        // 文件名安全检查（防止路径遍历）
        filename = sanitizeFilename(filename);
        
        logger.info(`下载文件: folderId=${folderId}, filename=${filename}`);

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        let fileRecord = await FileModel.findBySavedName(filename, folderId);
        if (!fileRecord) {
            fileRecord = await FileModel.findByOriginalName(filename, folderId);
        }
        
        if (!fileRecord) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        
        if (!await fs.pathExists(filePath)) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        res.download(filePath, fileRecord.originalName);
    } catch (error) {
        logger.error(`下载文件失败:`, error);
        next(error);
    }
});

/**
 * 通过文件ID下载文件
 */
router.get('/:folderId/download/by-id/:fileId', authenticate, async (req, res, next) => {
    try {
        const fileId = parseInt(req.params.fileId);
        
        logger.info(`通过ID下载文件: fileId=${fileId}`);

        // 先获取文件记录
        const fileRecord = await FileModel.findById(fileId);
        
        if (!fileRecord) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        // 使用文件实际所在的文件夹
        const actualFolderId = fileRecord.folderId;
        const folder = await FolderModel.findById(actualFolderId);
        
        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        // 检查用户是否有权限访问该文件夹
        if (!await isFolderOwnedByUser(actualFolderId, req.user.username)) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        
        if (!await fs.pathExists(filePath)) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        res.download(filePath, fileRecord.originalName);
    } catch (error) {
        logger.error(`通过ID下载文件失败:`, error);
        next(error);
    }
});

/**
 * 移动文件到另一个文件夹
 */
router.post('/:folderId/move', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { filename, targetFolderId } = req.body;

        logger.info(`文件移动请求: 源=${folderId}, 目标=${targetFolderId}, 文件=${filename}`);
        
        const targetFolderIdNum = parseInt(targetFolderId);

        if (!filename || !targetFolderId) {
            return res.status(200).json({ 
                success: false, 
                code: 'MISSING_PARAMS',
                error: '文件名和目标文件夹ID不能为空' 
            });
        }

        // 验证源文件夹
        const sourceFolder = await FolderModel.findById(folderId);
        if (!sourceFolder) {
            return res.status(200).json({ 
                success: false, 
                code: 'SOURCE_FOLDER_NOT_FOUND',
                error: '源文件夹不存在' 
            });
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return res.status(200).json({ 
                success: false, 
                code: 'SOURCE_FOLDER_FORBIDDEN',
                error: '无权访问源文件夹' 
            });
        }

        // 验证目标文件夹
        const targetFolder = await FolderModel.findById(targetFolderIdNum);
        if (!targetFolder) {
            return res.status(200).json({ 
                success: false, 
                code: 'TARGET_FOLDER_NOT_FOUND',
                error: '目标文件夹不存在' 
            });
        }

        if (!await isFolderOwnedByUser(targetFolderIdNum, req.user.username)) {
            return res.status(200).json({ 
                success: false, 
                code: 'TARGET_FOLDER_FORBIDDEN',
                error: '无权访问目标文件夹' 
            });
        }

        // 查找文件
        const fileRecord = await FileModel.findBySavedName(filename, folderId);
        if (!fileRecord) {
            return res.status(200).json({ 
                success: false, 
                code: 'FILE_NOT_FOUND',
                error: '文件不存在' 
            });
        }

        // 移动物理文件
        const sourcePath = path.join(FILES_ROOT, sourceFolder.physicalPath, fileRecord.savedName);
        const targetPath = path.join(FILES_ROOT, targetFolder.physicalPath, fileRecord.savedName);

        if (!await fs.pathExists(sourcePath)) {
            return res.status(200).json({ 
                success: false, 
                code: 'FILE_PHYSICAL_NOT_FOUND',
                error: '文件物理路径不存在' 
            });
        }

        await fs.ensureDir(path.dirname(targetPath));
        await fs.move(sourcePath, targetPath);

        // 更新文件记录
        await FileModel.update(fileRecord.id, { folderId: targetFolderIdNum });

        logger.info(`文件移动成功: ${fileRecord.originalName} -> ${targetFolder.alias}`);

        res.json({
            success: true,
            message: '文件移动成功',
            file: {
                id: fileRecord.id,
                originalName: fileRecord.originalName,
                savedName: fileRecord.savedName,
                folderId: targetFolderIdNum
            },
            sourceFolder: {
                id: sourceFolder.id,
                alias: sourceFolder.alias
            },
            targetFolder: {
                id: targetFolder.id,
                alias: targetFolder.alias
            }
        });
    } catch (error) {
        logger.error(`文件移动失败:`, error);
        next(error);
    }
});

module.exports = router;
