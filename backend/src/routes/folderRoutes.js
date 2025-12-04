const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
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
 * 删除文件夹（永久删除，不进入回收站）
 */
router.delete('/:folderId', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);

        // 获取文件夹中的文件数量
        const files = await FileModel.findByFolder(folderId);
        const fileCount = files.length;

        // 删除文件夹记录
        await FolderModel.delete(folderId, req.user.username);
        
        // 删除相关分享
        await ShareModel.deleteByFolderId(folderId);
        
        // 删除文件记录
        await FileModel.deleteByFolder(folderId);

        logger.info(`删除文件夹: ID=${folderId}, 删除文件数: ${fileCount}`);
        res.json({ 
            success: true, 
            message: `文件夹删除成功${fileCount > 0 ? `，已删除 ${fileCount} 个文件` : ''}` 
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
