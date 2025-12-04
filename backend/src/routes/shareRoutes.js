const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const ShareModel = require('../models/ShareModel');
const FolderModel = require('../models/FolderModel');
const ShareAccessLogModel = require('../models/ShareAccessLogModel');

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
            return res.status(400).json({ error: '文件夹ID不能为空' });
        }

        const folder = await FolderModel.findById(folderId);
        if (!folder || folder.owner !== req.user.username) {
            return res.status(403).json({ error: '无权访问' });
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
router.put('/:shareId', authenticate, async (req, res, next) => {
    try {
        const shareId = parseInt(req.params.shareId);
        const { expireInMs } = req.body;

        if (!expireInMs) {
            return res.status(400).json({ error: '过期时间不能为空' });
        }

        const share = await ShareModel.findById(shareId);
        if (!share || share.owner !== req.user.username) {
            return res.status(403).json({ error: '无权修改' });
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
            return res.status(403).json({ error: '无权删除' });
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
            return res.status(400).json({ error: '分享ID列表不能为空' });
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
router.post('/batch/extend', authenticate, async (req, res, next) => {
    try {
        const { shareIds, expireInMs } = req.body;

        if (!Array.isArray(shareIds) || shareIds.length === 0) {
            return res.status(400).json({ error: '分享ID列表不能为空' });
        }

        if (!expireInMs) {
            return res.status(400).json({ error: '过期时间不能为空' });
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
