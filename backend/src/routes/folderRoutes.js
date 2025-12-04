const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config');
const FolderModel = require('../models/FolderModel');
const ShareModel = require('../models/ShareModel');
const FileModel = require('../models/FileModel');
const { isFolderOwnedByUser } = require('./helpers/fileHelpers');
const { sendError } = require('../config/errorCodes');

// 导入子路由
const imageRoutes = require('./imageRoutes');
const fileRoutes = require('./fileRoutes');
const chunkUploadRoutes = require('./chunkUploadRoutes');

// 挂载子路由
router.use('/', imageRoutes);
router.use('/', fileRoutes);
router.use('/', chunkUploadRoutes);

/**
 * 获取上传配置
 */
router.get('/upload/config', authenticate, async (req, res, next) => {
    try {
        res.json({
            chunkSize: config.chunkSize,
            maxFileSize: config.maxFileSize
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 获取用户的所有文件夹
 */
router.get('/', authenticate, async (req, res, next) => {
    try {
        logger.info(`获取文件夹列表: user=${req.user.username}`);
        const folders = await FolderModel.findByOwner(req.user.username);
        logger.info(`成功获取文件夹列表: count=${folders.length}`);
        res.json(folders);
    } catch (error) {
        logger.error(`获取文件夹列表失败:`, error);
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
            return sendError(res, 'PARAM_INVALID', '文件夹名称不能为空');
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
        logger.info(`获取文件夹详情: folderId=${folderId}`);
        
        const folder = await FolderModel.findById(folderId);

        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        res.json(folder);
    } catch (error) {
        logger.error(`获取文件夹详情失败:`, error);
        next(error);
    }
});

/**
 * 删除文件夹（移至回收站）
 */
router.delete('/:folderId', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const RecycleBinModel = require('../models/RecycleBinModel');

        // 获取文件夹信息
        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        // 检查权限
        if (folder.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        // 获取文件夹中的所有文件
        const files = await FileModel.findByFolder(folderId);

        // 获取父文件夹信息（如果有）
        let parentFolder = null;
        if (folder.parentId) {
            parentFolder = await FolderModel.findById(folder.parentId);
        }

        // 将文件夹和文件移至回收站
        await RecycleBinModel.moveFolderToRecycleBin(folder, files, parentFolder);
        
        // 删除文件夹记录
        await FolderModel.delete(folderId, req.user.username);
        
        // 删除相关分享
        await ShareModel.deleteByFolderId(folderId);
        
        // 删除文件记录
        await FileModel.deleteByFolder(folderId);

        logger.info(`删除文件夹: ID=${folderId}, 文件数: ${files.length}, 已移至回收站`);
        res.json({ 
            success: true, 
            message: `文件夹已移至回收站${files.length > 0 ? `（包含 ${files.length} 个文件）` : ''}` 
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 获取子文件夹
 */
router.get('/:folderId/subfolders', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        logger.info(`获取子文件夹: folderId=${folderId}`);
        
        const folder = await FolderModel.findById(folderId);

        if (!folder) {
            return sendError(res, 'FOLDER_NOT_FOUND');
        }

        if (!await isFolderOwnedByUser(folderId, req.user.username)) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        const subFolders = await FolderModel.findByParentId(folderId, req.user.username);
        logger.info(`成功获取子文件夹: count=${subFolders.length}`);
        res.json(subFolders);
    } catch (error) {
        logger.error(`获取子文件夹失败:`, error);
        next(error);
    }
});

module.exports = router;
