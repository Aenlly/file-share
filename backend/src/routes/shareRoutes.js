const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { validateShareExpiration } = require('../middleware/validation');
const logger = require('../utils/logger');
const ShareModel = require('../models/ShareModel');
const FolderModel = require('../models/FolderModel');
const ShareAccessLogModel = require('../models/ShareAccessLogModel');
const { sendError } = require('../config/errorCodes');

/**
 * 获取用户的所有分享
 */
router.get('/', authenticate, async (req, res, next) => {
    try {
        const shares = await ShareModel.getWithFolderInfo(req.user.username);
        res.json(shares);
    } catch (error) {
        next(error);
    }
});

/**
 * 创建分享
 */
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { folderId, expireInMs } = req.body;

        if (!folderId) {
            return sendError(res, 'SHARE_INVALID_INPUT');
        }

        const folder = await FolderModel.findById(folderId);
        if (!folder || folder.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        const share = await ShareModel.create({
            folderId,
            owner: req.user.username,
            expireInMs: expireInMs || 7 * 24 * 60 * 60 * 1000 // 默认7天
        });

        logger.info(`创建分享: 文件夹=${folder.alias}, 访问码=${share.code}`);

        res.status(201).json({
            code: share.code,
            expireTime: new Date(share.expireTime).toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 更新分享过期时间
 */
router.put('/:shareId', authenticate, validateShareExpiration, async (req, res, next) => {
    try {
        const shareId = parseInt(req.params.shareId);
        const { expireInMs } = req.body;

        if (!expireInMs) {
            return sendError(res, 'SHARE_INVALID_INPUT');
        }

        const share = await ShareModel.findById(shareId);
        if (!share || share.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        const updated = await ShareModel.updateExpireTime(shareId, expireInMs);
        logger.info(`更新分享过期时间: ID=${shareId}`);

        res.json({
            expireTime: new Date(updated.expireTime).toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 删除分享
 */
router.delete('/:shareId', authenticate, async (req, res, next) => {
    try {
        const shareId = parseInt(req.params.shareId);

        const share = await ShareModel.findById(shareId);
        if (!share || share.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        // 删除分享的访问日志
        await ShareAccessLogModel.deleteByShareCode(share.code);
        
        await ShareModel.delete(shareId);
        logger.info(`删除分享: ID=${shareId}`);

        res.json({ success: true, message: '分享删除成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * 批量删除分享
 */
router.post('/batch/delete', authenticate, async (req, res, next) => {
    try {
        const { shareIds } = req.body;

        if (!Array.isArray(shareIds) || shareIds.length === 0) {
            return sendError(res, 'SHARE_INVALID_INPUT');
        }

        const deletedIds = [];
        const errorIds = [];

        for (const shareId of shareIds) {
            try {
                const share = await ShareModel.findById(shareId);
                if (!share || share.owner !== req.user.username) {
                    errorIds.push(shareId);
                    continue;
                }

                // 删除分享的访问日志
                await ShareAccessLogModel.deleteByShareCode(share.code);
                
                await ShareModel.delete(shareId);
                deletedIds.push(shareId);
            } catch (error) {
                errorIds.push(shareId);
            }
        }

        logger.info(`批量删除分享: 成功=${deletedIds.length}, 失败=${errorIds.length}`);

        res.json({
            success: deletedIds.length > 0,
            deletedIds,
            errorIds
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 批量更新分享过期时间
 */
router.post('/batch/extend', authenticate, validateShareExpiration, async (req, res, next) => {
    try {
        const { shareIds, expireInMs } = req.body;

        if (!Array.isArray(shareIds) || shareIds.length === 0) {
            return sendError(res, 'SHARE_INVALID_INPUT');
        }

        if (!expireInMs) {
            return sendError(res, 'SHARE_INVALID_INPUT');
        }

        const updatedIds = [];
        const errorIds = [];

        for (const shareId of shareIds) {
            try {
                const share = await ShareModel.findById(shareId);
                if (!share || share.owner !== req.user.username) {
                    errorIds.push(shareId);
                    continue;
                }

                await ShareModel.updateExpireTime(shareId, expireInMs);
                updatedIds.push(shareId);
            } catch (error) {
                errorIds.push(shareId);
            }
        }

        logger.info(`批量延长分享: 成功=${updatedIds.length}, 失败=${errorIds.length}`);

        res.json({
            success: updatedIds.length > 0,
            updatedIds,
            errorIds
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
