const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const JSZip = require('jszip');
const Jimp = require('jimp');

const logger = require('../utils/logger');
const ShareModel = require('../models/ShareModel');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const ShareAccessLogModel = require('../models/ShareAccessLogModel');
const { FILES_ROOT } = require('../utils/fileHelpers');
const { sendError } = require('../config/errorCodes');

/**
 * 获取访问者信息（IP和设备码）
 */
function getVisitorInfo(req) {
    // 获取真实IP（考虑代理）
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
        || req.headers['x-real-ip'] 
        || req.connection?.remoteAddress 
        || req.socket?.remoteAddress
        || 'unknown';
    
    // 获取设备码（从请求头或cookie）
    const deviceId = req.headers['x-device-id'] 
        || req.cookies?.deviceId 
        || req.headers['user-agent']?.substring(0, 100) // 降级使用UA的一部分
        || 'unknown';
    
    const userAgent = req.headers['user-agent'] || '';
    
    return { ip, deviceId, userAgent };
}

/**
 * 记录分享访问日志（异步，不阻塞响应）
 */
async function logShareAccess(req, share) {
    try {
        const { ip, deviceId, userAgent } = getVisitorInfo(req);
        await ShareAccessLogModel.logAccess({
            shareCode: share.code,
            shareId: share.id,
            ip,
            deviceId,
            userAgent
        });
    } catch (error) {
        // 记录日志失败不影响正常访问
        logger.error(`记录分享访问日志失败: ${error.message}`);
    }
}

/**
 * 获取分享信息（单数形式，用于兼容前端）
 * 包含文件和子文件夹列表
 */
router.get('/share/:code', async (req, res, next) => {
    try {
        const { code } = req.params;
        const { folderId } = req.query; // 获取查询参数中的 folderId
        logger.info(`获取分享信息: code=${code}, folderId=${folderId || '根目录'}`);

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            logger.warn(`分享验证失败: ${validation.reason}`);
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        const rootFolder = await FolderModel.findById(share.folderId);
        
        // 确定要查询的文件夹ID：如果提供了folderId参数，使用它；否则使用分享的根文件夹ID
        const targetFolderId = folderId ? parseInt(folderId) : share.folderId;
        const targetFolder = await FolderModel.findById(targetFolderId);
        
        if (!targetFolder) {
            logger.warn(`目标文件夹不存在: folderId=${targetFolderId}`);
            return sendError(res, 'FOLDER_NOT_FOUND');
        }
        
        // 验证目标文件夹是否属于分享的文件夹树（安全检查）
        if (folderId) {
            let currentFolder = targetFolder;
            let isValid = false;
            
            // 向上遍历，检查是否能到达根文件夹
            while (currentFolder) {
                if (currentFolder.id === share.folderId) {
                    isValid = true;
                    break;
                }
                if (!currentFolder.parentId) break;
                currentFolder = await FolderModel.findById(currentFolder.parentId);
            }
            
            if (!isValid) {
                logger.warn(`无权访问文件夹: folderId=${targetFolderId}, shareFolderId=${share.folderId}`);
                return sendError(res, 'AUTH_FORBIDDEN');
            }
        }
        
        logger.info(`分享验证成功: rootFolderId=${share.folderId}, targetFolderId=${targetFolderId}, folderAlias=${targetFolder.alias}`);

        // 记录访问日志（仅在访问根目录时记录，避免重复）
        if (!folderId || targetFolderId === share.folderId) {
            logShareAccess(req, share);
        }

        // 获取目标文件夹的文件列表
        const files = await FileModel.findByFolder(targetFolderId);
        logger.info(`找到 ${files.length} 个文件`);

        // 获取目标文件夹的子文件夹列表（分享场景不限制owner）
        const subFolders = await FolderModel.findByParentId(targetFolderId);
        logger.info(`找到 ${subFolders.length} 个子文件夹`);

        res.json({
            folderId: targetFolderId,
            folderAlias: targetFolder.alias, // 保持兼容性
            alias: targetFolder.alias, // 前端使用的字段
            code: share.code,
            expireTime: share.expireTime,
            files: files,
            subFolders: subFolders,
            isRootFolder: targetFolderId === share.folderId,
            parentFolder: targetFolder.parentId ? await FolderModel.findById(targetFolder.parentId) : null,
            share: share // 添加完整的分享信息，供前端显示过期时间等
        });
    } catch (error) {
        logger.error(`获取分享信息失败: ${error.message}`);
        next(error);
    }
});

/**
 * 验证分享访问码
 */
router.post('/shares/verify', async (req, res, next) => {
    try {
        const { code } = req.body;

        if (!code) {
            return sendError(res, 'SHARE_CODE_REQUIRED');
        }

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        const folder = await FolderModel.findById(share.folderId);

        res.json({
            folderId: share.folderId,
            folderAlias: folder ? folder.alias : '未知文件夹'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 获取分享文件夹内容
 */
router.get('/shares/:code/files', async (req, res, next) => {
    try {
        const { code } = req.params;
        logger.info(`获取分享文件夹内容: code=${code}`);

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            logger.warn(`分享验证失败: ${validation.reason}`);
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        logger.info(`分享验证成功: folderId=${share.folderId}`);
        
        const files = await FileModel.findByFolder(share.folderId);
        logger.info(`找到 ${files.length} 个文件`);

        res.json(files);
    } catch (error) {
        logger.error(`获取分享文件夹内容失败: ${error.message}`);
        next(error);
    }
});

/**
 * 下载单个分享文件（新路径，兼容前端）
 */
router.get('/share/:code/file/:filename', async (req, res, next) => {
    try {
        const { code, filename } = req.params;
        const { folderId } = req.query; // 支持子文件夹
        const decodedFilename = decodeURIComponent(filename);

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        const targetFolderId = folderId ? parseInt(folderId) : share.folderId;
        const folder = await FolderModel.findById(targetFolderId);

        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        const fileRecord = await FileModel.findByOriginalName(decodedFilename, targetFolderId);
        if (!fileRecord) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        if (!await fs.pathExists(filePath)) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        logger.info(`访客下载文件: ${decodedFilename} (访问码: ${code}, 文件夹: ${targetFolderId})`);
        res.download(filePath, decodedFilename);
    } catch (error) {
        next(error);
    }
});

/**
 * 下载单个分享文件（旧路径，保持兼容）
 */
router.get('/shares/:code/download/:filename', async (req, res, next) => {
    try {
        const { code, filename } = req.params;
        const decodedFilename = decodeURIComponent(filename);

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        const folder = await FolderModel.findById(share.folderId);

        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        const fileRecord = await FileModel.findByOriginalName(decodedFilename, share.folderId);
        if (!fileRecord) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        if (!await fs.pathExists(filePath)) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        logger.info(`访客下载文件: ${decodedFilename} (访问码: ${code})`);
        res.download(filePath, decodedFilename);
    } catch (error) {
        next(error);
    }
});

/**
 * 下载分享文件夹（打包为ZIP）- 新路径，支持子文件夹
 */
router.get('/share/:code/download', async (req, res, next) => {
    try {
        const { code } = req.params;
        const { folderId } = req.query;

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        const targetFolderId = folderId ? parseInt(folderId) : share.folderId;
        const folder = await FolderModel.findById(targetFolderId);

        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        if (!await fs.pathExists(dirPath)) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        // 递归添加文件到ZIP
        const addFilesToZip = async (zip, currentFolder, currentPath = '') => {
            const files = await FileModel.findByFolder(currentFolder.id);

            for (const fileRecord of files) {
                const filePath = path.join(FILES_ROOT, currentFolder.physicalPath, fileRecord.savedName);

                if (await fs.pathExists(filePath)) {
                    const fileContent = await fs.readFile(filePath);
                    const relativePath = currentPath 
                        ? `${currentPath}/${fileRecord.originalName}` 
                        : fileRecord.originalName;
                    zip.file(relativePath, fileContent);
                }
            }

            // 处理子文件夹
            const subFolders = await FolderModel.findByParentId(currentFolder.id);

            for (const subFolder of subFolders) {
                const subPath = currentPath 
                    ? `${currentPath}/${subFolder.alias}` 
                    : subFolder.alias;
                await addFilesToZip(zip, subFolder, subPath);
            }
        };

        const zip = new JSZip();
        await addFilesToZip(zip, folder);

        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        const zipFileName = `${folder.alias}.zip`;

        logger.info(`访客下载文件夹: ${folder.alias} (访问码: ${code}, 文件夹ID: ${targetFolderId})`);

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${zipFileName}"`
        });

        res.send(zipContent);
    } catch (error) {
        next(error);
    }
});

/**
 * 下载分享文件夹（打包为ZIP）- 旧路径，保持兼容
 */
router.get('/shares/:code/download-all', async (req, res, next) => {
    try {
        const { code } = req.params;

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        const folder = await FolderModel.findById(share.folderId);

        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        if (!await fs.pathExists(dirPath)) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        // 递归添加文件到ZIP
        const addFilesToZip = async (zip, currentFolder, currentPath = '') => {
            const files = await FileModel.findByFolder(currentFolder.id);

            for (const fileRecord of files) {
                const filePath = path.join(FILES_ROOT, currentFolder.physicalPath, fileRecord.savedName);

                if (await fs.pathExists(filePath)) {
                    const fileContent = await fs.readFile(filePath);
                    const relativePath = currentPath 
                        ? `${currentPath}/${fileRecord.originalName}` 
                        : fileRecord.originalName;
                    zip.file(relativePath, fileContent);
                }
            }

            // 处理子文件夹
            const subFolders = await FolderModel.findByParentId(currentFolder.id);

            for (const subFolder of subFolders) {
                const subPath = currentPath 
                    ? `${currentPath}/${subFolder.alias}` 
                    : subFolder.alias;
                await addFilesToZip(zip, subFolder, subPath);
            }
        };

        const zip = new JSZip();
        await addFilesToZip(zip, folder);

        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        const zipFileName = `${folder.alias}.zip`;

        logger.info(`访客下载文件夹: ${folder.alias} (访问码: ${code})`);

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${zipFileName}"`
        });

        res.send(zipContent);
    } catch (error) {
        next(error);
    }
});

/**
 * 获取图片预览
 */
router.get('/shares/:code/preview/:filename', async (req, res, next) => {
    try {
        const { code, filename } = req.params;
        const { width = 200, height = 200 } = req.query;
        const decodedFilename = decodeURIComponent(filename);

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        const folder = await FolderModel.findById(share.folderId);

        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        const fileRecord = await FileModel.findByOriginalName(decodedFilename, share.folderId);
        if (!fileRecord) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        if (!await fs.pathExists(filePath)) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        // 检查是否为图片
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const ext = path.extname(decodedFilename).toLowerCase();
        if (!imageExtensions.includes(ext)) {
            return sendError(res, 'FILE_NOT_IMAGE');
        }

        try {
            // 使用Jimp生成缩略图
            const image = await Jimp.read(filePath);
            const previewWidth = parseInt(width) || 200;
            const previewHeight = parseInt(height) || 200;

            // 手动处理 EXIF 旋转信息（修正手机拍摄照片的方向）
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

            // 使用 scaleToFit 保持宽高比
            image.scaleToFit(previewWidth, previewHeight);
            const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

            res.set('Content-Type', 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=3600');
            res.send(buffer);
        } catch (error) {
            logger.error(`生成图片预览失败: ${decodedFilename}`, error);
            sendError(res, 'SERVER_ERROR', '生成预览失败');
        }
    } catch (error) {
        next(error);
    }
});

/**
 * 获取分享的子文件夹
 */
router.get('/shares/:code/subfolders', async (req, res, next) => {
    try {
        const { code } = req.params;
        logger.info(`获取分享的子文件夹: code=${code}`);

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            logger.warn(`分享验证失败: ${validation.reason}`);
            return sendError(res, 'SHARE_EXPIRED', validation.reason);
        }

        const share = validation.share;
        logger.info(`分享验证成功: folderId=${share.folderId}`);
        
        const subFolders = await FolderModel.findByParentId(share.folderId);
        logger.info(`找到 ${subFolders.length} 个子文件夹`);

        res.json(subFolders);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
