const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const Jimp = require('jimp');
const crypto = require('crypto');

const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const ShareModel = require('../models/ShareModel');
const { FILES_ROOT, generateUniqueFilename, decodeFilename } = require('../utils/fileHelpers');

// 配置multer - 从环境变量读取文件大小限制
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '524288000'); // 默认 500MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: MAX_FILE_SIZE,
        files: 200 // 最多同时上传 200 个文件
    }
});

/**
 * 计算文件的 MD5 哈希值
 */
function calculateFileHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * 检查文件夹是否属于用户（包括子文件夹）
 */
async function isFolderOwnedByUser(folderId, username) {
    const folder = await FolderModel.findById(folderId);
    if (!folder) {
        return false;
    }

    // 检查是否是所有者
    if (folder.owner === username) {
        return true;
    }

    // 检查是否是子文件夹（通过遍历父文件夹链）
    let currentFolder = folder;
    const allFolders = await FolderModel.getAll();

    while (currentFolder.parentId) {
        const parentFolder = allFolders.find(f => f.id === currentFolder.parentId);
        if (!parentFolder) {
            break;
        }

        if (parentFolder.owner === username) {
            return true;
        }

        currentFolder = parentFolder;
    }

    return false;
}

/**
 * 获取用户的所有文件夹
 */
router.get('/', authenticate, async (req, res, next) => {
    try {
        const folders = await FolderModel.findByOwner(req.user.username);
        res.json(folders);
    } catch (error) {
        next(error);
    }
});

/**
 * 获取图片预览（必须在 /:folderId 之前定义）
 */
router.get('/:id/preview/:filename', authenticate, async (req, res, next) => {
    try {
        const { id, filename } = req.params;
        const { width = 800, height = 600 } = req.query;
        const folderId = parseInt(id);
        const decodedFilename = decodeURIComponent(filename);

        logger.info(`获取图片预览: folderId=${folderId}, filename=${decodedFilename}, width=${width}, height=${height}`);

        // 验证文件夹权限
        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            logger.warn(`用户 ${req.user.username} 无权访问文件夹 ${folderId}`);
            return res.status(403).json({ error: '无权访问此文件夹' });
        }

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            logger.warn(`文件夹不存在: folderId=${folderId}`);
            return res.status(404).json({ error: '文件夹不存在' });
        }

        // 尝试通过 savedName 查找文件
        let fileRecord = await FileModel.findBySavedName(decodedFilename, folderId);
        
        // 如果找不到，尝试通过 originalName 查找
        if (!fileRecord) {
            logger.info(`通过savedName未找到文件，尝试originalName: ${decodedFilename}`);
            fileRecord = await FileModel.findByOriginalName(decodedFilename, folderId);
        }

        if (!fileRecord) {
            logger.warn(`文件不存在: filename=${decodedFilename}, folderId=${folderId}`);
            return res.status(404).json({ error: '文件不存在' });
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        logger.info(`文件路径: ${filePath}`);

        if (!await fs.pathExists(filePath)) {
            logger.warn(`物理文件不存在: ${filePath}`);
            return res.status(404).json({ error: '文件不存在' });
        }

        // 检查是否为图片
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const ext = path.extname(fileRecord.savedName).toLowerCase();
        if (!imageExtensions.includes(ext)) {
            logger.warn(`不是图片文件: ${fileRecord.savedName}`);
            return res.status(400).json({ error: '不是图片文件' });
        }

        try {
            // 使用Jimp生成缩略图
            const image = await Jimp.read(filePath);
            const previewWidth = parseInt(width) || 800;
            const previewHeight = parseInt(height) || 600;

            // 手动处理 EXIF 旋转信息（修正手机拍摄照片的方向）
            if (image._exif && image._exif.tags && image._exif.tags.Orientation) {
                const orientation = image._exif.tags.Orientation;
                logger.info(`EXIF Orientation: ${orientation}`);
                
                switch (orientation) {
                    case 2:
                        image.flip(true, false); // 水平翻转
                        break;
                    case 3:
                        image.rotate(180); // 旋转180度
                        break;
                    case 4:
                        image.flip(false, true); // 垂直翻转
                        break;
                    case 5:
                        image.rotate(90).flip(true, false); // 顺时针90度 + 水平翻转
                        break;
                    case 6:
                        image.rotate(90); // 顺时针90度
                        break;
                    case 7:
                        image.rotate(-90).flip(true, false); // 逆时针90度 + 水平翻转
                        break;
                    case 8:
                        image.rotate(-90); // 逆时针90度
                        break;
                    // case 1 或其他值：不需要旋转
                }
            }

            // 保持宽高比缩放
            image.scaleToFit(previewWidth, previewHeight);
            const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

            logger.info(`成功生成预览: ${fileRecord.originalName}`);

            res.set('Content-Type', 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=3600');
            res.send(buffer);
        } catch (error) {
            logger.error(`生成图片预览失败: ${decodedFilename}`, error);
            res.status(500).json({ error: '生成预览失败: ' + error.message });
        }
    } catch (error) {
        logger.error(`图片预览路由错误:`, error);
        next(error);
    }
});

/**
 * 通过文件ID获取图片预览（备用方案，必须在 /:folderId 之前定义）
 */
router.get('/:folderId/preview/by-id/:fileId', authenticate, async (req, res, next) => {
    try {
        const { folderId, fileId } = req.params;
        const { width = 800, height = 600 } = req.query;
        const folderIdInt = parseInt(folderId);
        const fileIdInt = parseInt(fileId);

        logger.info(`通过ID获取图片预览: folderId=${folderIdInt}, fileId=${fileIdInt}`);

        // 验证文件夹权限
        if (!await isFolderOwnedByUser(folderIdInt, req.user.username)) {
            return res.status(403).json({ error: '无权访问此文件夹' });
        }

        const folder = await FolderModel.findById(folderIdInt);
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const fileRecord = await FileModel.findById(fileIdInt);
        if (!fileRecord || fileRecord.folderId !== folderIdInt) {
            logger.warn(`文件不存在或不属于该文件夹: fileId=${fileIdInt}, folderId=${folderIdInt}`);
            return res.status(404).json({ error: '文件不存在' });
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        if (!await fs.pathExists(filePath)) {
            return res.status(404).json({ error: '文件不存在' });
        }

        // 检查是否为图片
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const ext = path.extname(fileRecord.savedName).toLowerCase();
        if (!imageExtensions.includes(ext)) {
            return res.status(400).json({ error: '不是图片文件' });
        }

        try {
            const image = await Jimp.read(filePath);
            const previewWidth = parseInt(width) || 800;
            const previewHeight = parseInt(height) || 600;

            // 手动处理 EXIF 旋转信息
            if (image._exif && image._exif.tags && image._exif.tags.Orientation) {
                const orientation = image._exif.tags.Orientation;
                switch (orientation) {
                    case 2: image.flip(true, false); break;
                    case 3: image.rotate(180); break;
                    case 4: image.flip(false, true); break;
                    case 5: image.rotate(90).flip(true, false); break;
                    case 6: image.rotate(90); break;
                    case 7: image.rotate(-90).flip(true, false); break;
                    case 8: image.rotate(-90); break;
                }
            }

            image.scaleToFit(previewWidth, previewHeight);
            const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

            res.set('Content-Type', 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=3600');
            res.send(buffer);
        } catch (error) {
            logger.error(`生成图片预览失败:`, error);
            res.status(500).json({ error: '生成预览失败' });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * 创建文件夹
 */
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { alias, parentId } = req.body;

        if (!alias) {
            return res.status(400).json({ error: '文件夹名称不能为空' });
        }

        const folder = await FolderModel.create({
            alias,
            parentId: parentId || null,
            owner: req.user.username
        });

        logger.info(`创建文件夹: ${alias} (所有者: ${req.user.username})`);
        res.status(201).json(folder);
    } catch (error) {
        next(error);
    }
});

/**
 * 获取文件夹详情
 */
router.get('/:folderId', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const folder = await FolderModel.findById(folderId);

        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const hasAccess = await isFolderOwnedByUser(folderId, req.user.username);
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问' });
        }

        res.json(folder);
    } catch (error) {
        next(error);
    }
});

/**
 * 删除文件夹
 */
router.delete('/:folderId', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);

        await FolderModel.delete(folderId, req.user.username);

        // 删除相关的分享链接
        await ShareModel.deleteByFolderId(folderId);

        // 删除相关的文件记录
        await FileModel.deleteByFolder(folderId);

        logger.info(`删除文件夹: ID=${folderId} (所有者: ${req.user.username})`);
        res.json({ success: true, message: '文件夹删除成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * 获取文件夹内的文件
 */
router.get('/:folderId/files', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const folder = await FolderModel.findById(folderId);

        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const hasAccess = await isFolderOwnedByUser(folderId, req.user.username);
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问' });
        }

        const files = await FileModel.findByFolder(folderId);
        res.json(files);
    } catch (error) {
        next(error);
    }
});

/**
 * 分片上传 - 初始化
 */
const chunkUploads = new Map(); // 存储分片上传的临时数据

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

        const hasAccess = await isFolderOwnedByUser(folderId, req.user.username);
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问' });
        }

        // 生成唯一的上传ID
        const uploadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 解码文件名（如果是UTF8编码的）
        let originalName = fileName;
        if (originalName.startsWith('UTF8:')) {
            originalName = decodeFilename(originalName);
        }

        // 存储上传信息
        chunkUploads.set(uploadId, {
            folderId,
            fileName: originalName,
            fileSize,
            chunks: [],
            owner: req.user.username,
            createdAt: Date.now()
        });

        logger.info(`初始化分片上传: uploadId=${uploadId}, fileName=${originalName}, fileSize=${fileSize}`);

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

        // 将base64转换为Buffer
        const chunkBuffer = Buffer.from(chunk, 'base64');
        
        // 存储分片
        uploadInfo.chunks[chunkIndex] = chunkBuffer;

        logger.info(`接收分片: uploadId=${uploadId}, chunkIndex=${chunkIndex}, size=${chunkBuffer.length}`);

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

        // 合并所有分片
        const fileBuffer = Buffer.concat(uploadInfo.chunks);
        
        // 计算文件哈希
        const fileHash = calculateFileHash(fileBuffer);
        
        // 检查文件是否已存在
        const existingByHash = await FileModel.findByHash(fileHash, folderId);
        if (existingByHash) {
            chunkUploads.delete(uploadId);
            return res.status(409).json({ 
                error: '文件已存在',
                existingFile: existingByHash.originalName 
            });
        }

        // 生成保存的文件名
        const savedName = generateUniqueFilename(uploadInfo.fileName);
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const filePath = path.join(dirPath, savedName);

        // 保存文件
        await fs.ensureDir(dirPath);
        await fs.writeFile(filePath, fileBuffer);

        // 创建文件记录
        const fileRecord = await FileModel.create({
            folderId,
            originalName: uploadInfo.fileName,
            savedName,
            size: fileBuffer.length,
            mimeType: 'application/octet-stream', // 分片上传时可能无法获取准确的MIME类型
            owner: uploadInfo.owner,
            hash: fileHash
        });

        // 清理上传信息
        chunkUploads.delete(uploadId);

        logger.info(`分片上传完成: ${uploadInfo.fileName} (文件夹: ${folder.alias})`);

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
        // 清理上传信息
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
}, 10 * 60 * 1000); // 每10分钟检查一次

/**
 * 上传文件
 */
router.post('/:folderId/upload', authenticate, uploadLimiter, upload.array('files', 200), async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const folder = await FolderModel.findById(folderId);

        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const hasAccess = await isFolderOwnedByUser(folderId, req.user.username);
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const forceUpload = req.body.force === 'true';
        const uploadedFiles = [];
        const existingFiles = [];
        const errorFiles = [];

        for (const file of req.files) {
            try {
                let originalName = file.originalname;
                if (originalName.startsWith('UTF8:')) {
                    originalName = decodeFilename(originalName);
                }

                // 计算文件哈希值
                const fileHash = calculateFileHash(file.buffer);
                logger.info(`文件哈希: ${originalName} -> ${fileHash}`);

                // 1. 首先检查哈希是否已存在（最准确的重复检测）
                const existingByHash = await FileModel.findByHash(fileHash, folderId);
                if (existingByHash && !forceUpload) {
                    logger.info(`检测到重复文件（哈希相同）: ${originalName} 与 ${existingByHash.originalName}`);
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

                // 2. 检查文件名是否已存在（防止同名文件）
                const existingByName = await FileModel.findByOriginalName(originalName, folderId);
                if (existingByName && !forceUpload) {
                    // 如果文件名相同但哈希不同，说明是不同内容的同名文件
                    if (existingByName.hash && existingByName.hash !== fileHash) {
                        logger.info(`文件名相同但内容不同，允许上传: ${originalName}`);
                        // 继续上传，但不标记为重复
                    } else if (!existingByName.hash) {
                        // 旧文件没有哈希值（可能是旧版本数据），使用大小比对
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
                        // 文件名和哈希都相同（已在上面的哈希检查中处理）
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

                // 保存文件
                await fs.ensureDir(dirPath);
                await fs.writeFile(filePath, file.buffer);

                // 创建文件记录（包含哈希值）
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

                logger.info(`上传文件: ${originalName} (文件夹: ${folder.alias})`);
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
            return res.status(409).json(result);
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * 删除文件
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

        const hasAccess = await isFolderOwnedByUser(folderId, req.user.username);
        if (!hasAccess) {
            return res.status(200).json({ 
                success: false, 
                code: 'FOLDER_FORBIDDEN',
                error: '无权访问' 
            });
        }

        const filesToDelete = filenames || [filename];
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);

        const result = await FileModel.batchDelete(filesToDelete, folderId, req.user.username);

        // 删除物理文件
        for (const file of result.deletedFiles) {
            const filePath = path.join(dirPath, file.savedName);
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
            }
        }

        logger.info(`删除文件: ${result.deletedFiles.map(f => f.originalName).join(', ')} (文件夹: ${folder.alias})`);

        res.json({
            success: result.deletedFiles.length > 0,
            deletedFiles: result.deletedFiles,
            errorFiles: result.errorFiles,
            total: filesToDelete.length
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
        const filename = decodeURIComponent(req.params.filename);
        
        logger.info(`下载文件请求: folderId=${folderId}, filename=${filename}, user=${req.user.username}`);

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            logger.warn(`文件夹不存在: folderId=${folderId}`);
            return res.status(404).json({ 
                success: false, 
                code: 'FOLDER_NOT_FOUND',
                error: '文件夹不存在' 
            });
        }

        const hasAccess = await isFolderOwnedByUser(folderId, req.user.username);
        if (!hasAccess) {
            logger.warn(`用户 ${req.user.username} 无权访问文件夹 ${folderId}`);
            return res.status(403).json({ 
                success: false, 
                code: 'FOLDER_FORBIDDEN',
                error: '无权访问' 
            });
        }

        // 先尝试通过 savedName 查找（唯一标识），如果找不到再尝试 originalName（兼容旧代码）
        let fileRecord = await FileModel.findBySavedName(filename, folderId);
        if (!fileRecord) {
            logger.info(`通过 savedName 未找到，尝试 originalName: ${filename}`);
            fileRecord = await FileModel.findByOriginalName(filename, folderId);
        }
        
        if (!fileRecord) {
            logger.warn(`文件不存在: filename=${filename}, folderId=${folderId}`);
            return res.status(404).json({ 
                success: false, 
                code: 'FILE_NOT_FOUND',
                error: '文件不存在' 
            });
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        logger.info(`文件路径: ${filePath}`);
        
        if (!await fs.pathExists(filePath)) {
            logger.error(`物理文件不存在: ${filePath}`);
            return res.status(404).json({ 
                success: false, 
                code: 'FILE_PHYSICAL_NOT_FOUND',
                error: '文件不存在' 
            });
        }

        logger.info(`开始下载: ${fileRecord.originalName} (${fileRecord.size} bytes)`);
        
        // 设置响应头，防止缓存
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
 * 移动文件到另一个文件夹
 */
router.post('/:folderId/move', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { filename, targetFolderId } = req.body;

        // 打印请求数据
        logger.info(`=== 文件移动请求开始 ===`);
        logger.info(`用户: ${req.user.username}`);
        logger.info(`源文件夹ID: ${folderId} (类型: ${typeof folderId})`);
        logger.info(`文件名: ${filename}`);
        logger.info(`目标文件夹ID: ${targetFolderId} (类型: ${typeof targetFolderId})`);
        
        // 确保targetFolderId是数字
        const targetFolderIdNum = parseInt(targetFolderId);
        logger.info(`目标文件夹ID转换后: ${targetFolderIdNum} (类型: ${typeof targetFolderIdNum})`);

        if (!filename || !targetFolderId) {
            logger.warn(`缺少必要参数: filename=${filename}, targetFolderId=${targetFolderId}`);
            return res.status(200).json({ 
                success: false, 
                code: 'MISSING_PARAMS',
                error: '文件名和目标文件夹ID不能为空' 
            });
        }

        // 验证源文件夹权限
        const sourceFolder = await FolderModel.findById(folderId);
        logger.info(`源文件夹查询结果: ${sourceFolder ? `存在 (${sourceFolder.alias})` : '不存在'}`);
        
        if (!sourceFolder) {
            logger.error(`源文件夹不存在: ID=${folderId}`);
            return res.status(200).json({ 
                success: false, 
                code: 'SOURCE_FOLDER_NOT_FOUND',
                error: '源文件夹不存在' 
            });
        }

        const hasSourceAccess = await isFolderOwnedByUser(folderId, req.user.username);
        logger.info(`源文件夹权限检查: ${hasSourceAccess ? '有权限' : '无权限'}`);
        
        if (!hasSourceAccess) {
            logger.error(`无权访问源文件夹: ID=${folderId}, 用户=${req.user.username}`);
            return res.status(200).json({ 
                success: false, 
                code: 'SOURCE_FOLDER_FORBIDDEN',
                error: '无权访问源文件夹' 
            });
        }

        // 验证目标文件夹权限
        const targetFolder = await FolderModel.findById(targetFolderIdNum);
        logger.info(`目标文件夹查询结果: ${targetFolder ? `存在 (${targetFolder.alias})` : '不存在'}`);
        
        if (!targetFolder) {
            logger.error(`目标文件夹不存在: ID=${targetFolderIdNum}`);
            return res.status(200).json({ 
                success: false, 
                code: 'TARGET_FOLDER_NOT_FOUND',
                error: '目标文件夹不存在' 
            });
        }

        const hasTargetAccess = await isFolderOwnedByUser(targetFolderIdNum, req.user.username);
        logger.info(`目标文件夹权限检查: ${hasTargetAccess ? '有权限' : '无权限'}`);
        
        if (!hasTargetAccess) {
            logger.error(`无权访问目标文件夹: ID=${targetFolderIdNum}, 用户=${req.user.username}`);
            return res.status(200).json({ 
                success: false, 
                code: 'TARGET_FOLDER_FORBIDDEN',
                error: '无权访问目标文件夹' 
            });
        }

        // 查找文件
        logger.info(`查询文件: savedName=${filename}, folderId=${folderId}`);
        const fileRecord = await FileModel.findBySavedName(filename, folderId);
        logger.info(`文件查询结果: ${fileRecord ? `找到 (ID=${fileRecord.id}, originalName=${fileRecord.originalName})` : '未找到'}`);
        
        if (!fileRecord) {
            logger.error(`文件不存在: savedName=${filename}, folderId=${folderId}`);
            return res.status(200).json({ 
                success: false, 
                code: 'FILE_NOT_FOUND',
                error: '文件不存在' 
            });
        }

        // 移动物理文件
        const sourcePath = path.join(FILES_ROOT, sourceFolder.physicalPath, fileRecord.savedName);
        const targetPath = path.join(FILES_ROOT, targetFolder.physicalPath, fileRecord.savedName);

        logger.info(`物理路径信息:`);
        logger.info(`  FILES_ROOT: ${FILES_ROOT}`);
        logger.info(`  源文件夹物理路径: ${sourceFolder.physicalPath}`);
        logger.info(`  目标文件夹物理路径: ${targetFolder.physicalPath}`);
        logger.info(`  文件savedName: ${fileRecord.savedName}`);
        logger.info(`  源文件完整路径: ${sourcePath}`);
        logger.info(`  目标文件完整路径: ${targetPath}`);

        const sourceExists = await fs.pathExists(sourcePath);
        logger.info(`源文件是否存在: ${sourceExists}`);
        
        if (!sourceExists) {
            logger.error(`源文件物理路径不存在: ${sourcePath}`);
            return res.status(200).json({ 
                success: false, 
                code: 'FILE_PHYSICAL_NOT_FOUND',
                error: '文件物理路径不存在' 
            });
        }

        try {
            await fs.ensureDir(path.dirname(targetPath));
            logger.info(`创建目标目录: ${path.dirname(targetPath)}`);
        } catch (error) {
            logger.error(`创建目标目录失败: ${error.message}`);
            return res.status(200).json({ 
                success: false, 
                code: 'CREATE_DIR_FAILED',
                error: `创建目标目录失败: ${error.message}` 
            });
        }

        try {
            await fs.move(sourcePath, targetPath);
            logger.info(`物理文件移动成功: ${sourcePath} -> ${targetPath}`);
        } catch (error) {
            logger.error(`物理文件移动失败: ${error.message}`);
            return res.status(200).json({ 
                success: false, 
                code: 'FILE_MOVE_FAILED',
                error: `物理文件移动失败: ${error.message}` 
            });
        }

        try {
            // 更新文件记录
            await FileModel.update(fileRecord.id, { folderId: targetFolderIdNum });
            logger.info(`数据库更新成功: 文件ID=${fileRecord.id}, 新文件夹ID=${targetFolderIdNum}`);
        } catch (error) {
            logger.error(`数据库更新失败: ${error.message}`);
            // 尝试回滚物理文件移动
            try {
                await fs.move(targetPath, sourcePath);
                logger.info(`物理文件已回滚: ${targetPath} -> ${sourcePath}`);
            } catch (rollbackError) {
                logger.error(`回滚失败: ${rollbackError.message}`);
            }
            return res.status(200).json({ 
                success: false, 
                code: 'DB_UPDATE_FAILED',
                error: `数据库更新失败: ${error.message}` 
            });
        }

        logger.info(`=== 文件移动成功 ===`);
        logger.info(`文件: ${fileRecord.originalName} (savedName: ${fileRecord.savedName})`);
        logger.info(`从: ${sourceFolder.alias} (ID: ${sourceFolder.id})`);
        logger.info(`到: ${targetFolder.alias} (ID: ${targetFolder.id})`);
        logger.info(`数据库已更新: 文件ID=${fileRecord.id}, 新文件夹ID=${targetFolderIdNum}`);

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
        logger.error(`=== 文件移动异常 ===`);
        logger.error(`错误信息: ${error.message}`);
        logger.error(`错误堆栈:`, error);
        next(error);
    }
});

/**
 * 获取子文件夹
 */
router.get('/:folderId/subfolders', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const folder = await FolderModel.findById(folderId);

        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const hasAccess = await isFolderOwnedByUser(folderId, req.user.username);
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问' });
        }

        const subFolders = await FolderModel.findByParentId(folderId, req.user.username);
        res.json(subFolders);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
