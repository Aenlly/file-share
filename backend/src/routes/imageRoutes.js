const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const Jimp = require('jimp');

const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const { FILES_ROOT } = require('../utils/fileHelpers');
const { isFolderOwnedByUser } = require('./helpers/fileHelpers');

/**
 * 处理 EXIF 旋转信息
 */
function handleExifOrientation(image) {
    if (image._exif && image._exif.tags && image._exif.tags.Orientation) {
        const orientation = image._exif.tags.Orientation;
        logger.info(`EXIF Orientation: ${orientation}`);
        
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
}

/**
 * 获取图片预览
 */
router.get('/:id/preview/:filename', authenticate, async (req, res, next) => {
    try {
        const { id, filename } = req.params;
        const { width = 800, height = 600 } = req.query;
        const folderId = parseInt(id);
        const decodedFilename = decodeURIComponent(filename);

        logger.info(`获取图片预览: folderId=${folderId}, filename=${decodedFilename}`);

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return res.status(403).json({ error: '无权访问此文件夹' });
        }

        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        let fileRecord = await FileModel.findBySavedName(decodedFilename, folderId);
        if (!fileRecord) {
            fileRecord = await FileModel.findByOriginalName(decodedFilename, folderId);
        }

        if (!fileRecord) {
            return res.status(404).json({ error: '文件不存在' });
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        if (!await fs.pathExists(filePath)) {
            return res.status(404).json({ error: '文件不存在' });
        }

        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const ext = path.extname(fileRecord.savedName).toLowerCase();
        if (!imageExtensions.includes(ext)) {
            return res.status(400).json({ error: '不是图片文件' });
        }

        const image = await Jimp.read(filePath);
        const previewWidth = parseInt(width) || 800;
        const previewHeight = parseInt(height) || 600;

        handleExifOrientation(image);
        image.scaleToFit(previewWidth, previewHeight);
        const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(buffer);
    } catch (error) {
        logger.error(`图片预览失败:`, error);
        next(error);
    }
});

/**
 * 通过文件ID获取图片预览
 */
router.get('/:folderId/preview/by-id/:fileId', authenticate, async (req, res, next) => {
    try {
        const { folderId, fileId } = req.params;
        const { width = 800, height = 600 } = req.query;
        const folderIdInt = parseInt(folderId);
        const fileIdInt = parseInt(fileId);

        if (!await isFolderOwnedByUser(folderIdInt, req.user.username)) {
            return res.status(403).json({ error: '无权访问此文件夹' });
        }

        const folder = await FolderModel.findById(folderIdInt);
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const fileRecord = await FileModel.findById(fileIdInt);
        if (!fileRecord || fileRecord.folderId !== folderIdInt) {
            return res.status(404).json({ error: '文件不存在' });
        }

        const filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
        if (!await fs.pathExists(filePath)) {
            return res.status(404).json({ error: '文件不存在' });
        }

        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const ext = path.extname(fileRecord.savedName).toLowerCase();
        if (!imageExtensions.includes(ext)) {
            return res.status(400).json({ error: '不是图片文件' });
        }

        const image = await Jimp.read(filePath);
        const previewWidth = parseInt(width) || 800;
        const previewHeight = parseInt(height) || 600;

        handleExifOrientation(image);
        image.scaleToFit(previewWidth, previewHeight);
        const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(buffer);
    } catch (error) {
        logger.error(`图片预览失败:`, error);
        next(error);
    }
});

module.exports = router;
