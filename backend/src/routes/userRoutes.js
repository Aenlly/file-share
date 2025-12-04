const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin, generateToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const UserModel = require('../models/UserModel');

/**
 * 用户登录
 */
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        const user = await UserModel.verifyPassword(username, password);
        if (!user) {
            logger.warn(`登录失败: 用户名或密码错误 (${username})`);
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = generateToken(user);
        logger.info(`用户登录成功: ${username}`);

        res.json({
            token,
            user
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 获取所有用户（仅管理员）
 */
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const users = await UserModel.getAll();
        const sanitized = users.map(u => {
            const { password, ...safe } = u;
            return safe;
        });
        res.json(sanitized);
    } catch (error) {
        next(error);
    }
});

/**
 * 创建用户（仅管理员）
 */
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        const user = await UserModel.create({
            username,
            password,
            role: role || 'user'
        });

        logger.info(`创建用户: ${username} (${user.role})`);
        res.status(201).json(user);
    } catch (error) {
        if (error.message.includes('已存在')) {
            return res.status(409).json({ error: error.message });
        }
        next(error);
    }
});

/**
 * 获取当前用户信息
 */
router.get('/me', authenticate, async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const { password, ...safe } = user;
        res.json(safe);
    } catch (error) {
        next(error);
    }
});

/**
 * 获取用户统计信息
 */
router.get('/stats', authenticate, async (req, res, next) => {
    try {
        const username = req.user.username;
        
        // 获取文件夹数量
        const FolderModel = require('../models/FolderModel');
        const folders = await FolderModel.findByOwner(username);
        const folderCount = folders.length;
        
        // 获取文件数量和总大小
        const FileModel = require('../models/FileModel');
        const files = await FileModel.find({ owner: username });
        const fileCount = files.length;
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        
        // 获取回收站数量
        const RecycleBinModel = require('../models/RecycleBinModel');
        const recycleBinFiles = await RecycleBinModel.findByOwner(username);
        const recycleBinCount = recycleBinFiles.length;
        
        // 获取分享链接数量
        const ShareModel = require('../models/ShareModel');
        const shares = await ShareModel.find({ owner: username });
        const shareCount = shares.length;
        
        // 获取活跃分享数量（7天内有唯一访问的分享）
        const ShareAccessLogModel = require('../models/ShareAccessLogModel');
        const activeShareCount = await ShareAccessLogModel.countActiveShares(shares, 7);
        
        logger.info(`获取用户统计: ${username}`);
        
        res.json({
            folders: folderCount,
            files: fileCount,
            totalSize,
            recycleBin: recycleBinCount,
            shares: shareCount,
            activeShares: activeShareCount
        });
    } catch (error) {
        logger.error(`获取用户统计失败:`, error);
        next(error);
    }
});

/**
 * 获取所有用户统计信息（仅管理员）
 */
router.get('/stats-all', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const FolderModel = require('../models/FolderModel');
        const FileModel = require('../models/FileModel');
        const RecycleBinModel = require('../models/RecycleBinModel');
        const ShareModel = require('../models/ShareModel');
        const ShareAccessLogModel = require('../models/ShareAccessLogModel');
        
        const users = await UserModel.getAll();
        const allStats = [];

        for (const user of users) {
            // 获取文件夹数量
            const folders = await FolderModel.findByOwner(user.username);
            
            // 获取文件数量和总大小
            const files = await FileModel.find({ owner: user.username });
            const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
            
            // 获取回收站数量
            const recycleBinFiles = await RecycleBinModel.findByOwner(user.username);
            
            // 获取分享链接数量
            const shares = await ShareModel.find({ owner: user.username });
            
            // 获取活跃分享数量（7天内有唯一访问的分享）
            const activeShareCount = await ShareAccessLogModel.countActiveShares(shares, 7);
            
            allStats.push({
                userId: user.id,
                username: user.username,
                role: user.role,
                folders: folders.length,
                files: files.length,
                totalSize: totalSize,
                recycleBin: recycleBinFiles.length,
                shares: shares.length,
                activeShares: activeShareCount
            });
        }

        // 计算总计
        const totals = {
            totalUsers: users.length,
            totalFolders: allStats.reduce((sum, s) => sum + s.folders, 0),
            totalFiles: allStats.reduce((sum, s) => sum + s.files, 0),
            totalSize: allStats.reduce((sum, s) => sum + s.totalSize, 0),
            totalShares: allStats.reduce((sum, s) => sum + s.shares, 0),
            totalActiveShares: allStats.reduce((sum, s) => sum + s.activeShares, 0),
        };

        logger.info(`获取全部用户统计 (查询者: ${req.user.username})`);
        
        res.json({
            users: allStats,
            totals
        });
    } catch (error) {
        logger.error(`获取全部用户统计失败:`, error);
        next(error);
    }
});

/**
 * 更新用户（仅管理员可更新其他用户）
 */
router.put('/:id', authenticate, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;

        // 只有管理员可以更新其他用户
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: '无权修改' });
        }

        if (role) {
            await UserModel.updateRole(userId, role);
            logger.info(`更新用户角色: ID=${userId}, 角色=${role}`);
        }

        const user = await UserModel.findById(userId);
        const { password, ...safe } = user;
        res.json(safe);
    } catch (error) {
        next(error);
    }
});

/**
 * 修改密码
 */
router.post('/:id/change-password', authenticate, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const { oldPassword, newPassword } = req.body;

        // 只能修改自己的密码，除非是管理员
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: '无权修改' });
        }

        if (!newPassword) {
            return res.status(400).json({ error: '新密码不能为空' });
        }

        // 非管理员需要验证旧密码
        if (req.user.role !== 'admin' && oldPassword) {
            const user = await UserModel.findById(userId);
            const verified = await UserModel.verifyPassword(user.username, oldPassword);
            if (!verified) {
                return res.status(401).json({ error: '旧密码错误' });
            }
        }

        await UserModel.updatePassword(userId, newPassword);
        logger.info(`用户修改密码: ID=${userId}`);

        res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * 删除用户（仅管理员）
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);

        // 不能删除自己
        if (req.user.id === userId) {
            return res.status(400).json({ error: '不能删除自己' });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        logger.info(`开始删除用户及其所有数据: ${user.username}`);

        const fs = require('fs-extra');
        const path = require('path');
        const { FILES_ROOT } = require('../utils/fileHelpers');

        // 1. 删除用户的分享链接
        const ShareModel = require('../models/ShareModel');
        const deletedShares = await ShareModel.deleteByOwner(user.username);
        logger.info(`删除分享链接: ${deletedShares} 个`);

        // 2. 删除用户的回收站数据
        const RecycleBinModel = require('../models/RecycleBinModel');
        const recycleBinFiles = await RecycleBinModel.findByOwner(user.username);
        for (const file of recycleBinFiles) {
            try {
                await RecycleBinModel.permanentDelete(file.id, user.username);
            } catch (error) {
                logger.error(`删除回收站文件失败: ${file.originalName}`, error);
            }
        }
        logger.info(`删除回收站数据: ${recycleBinFiles.length} 个`);

        // 3. 删除用户的文件记录
        const FileModel = require('../models/FileModel');
        const files = await FileModel.find({ owner: user.username });
        for (const file of files) {
            try {
                await FileModel.delete(file.id, user.username);
            } catch (error) {
                logger.error(`删除文件记录失败: ${file.originalName}`, error);
            }
        }
        logger.info(`删除文件记录: ${files.length} 个`);

        // 4. 删除用户的文件夹和物理文件
        const FolderModel = require('../models/FolderModel');
        const folders = await FolderModel.findByOwner(user.username);
        
        for (const folder of folders) {
            try {
                // 删除物理文件夹
                const folderPath = path.join(FILES_ROOT, folder.physicalPath);
                if (await fs.pathExists(folderPath)) {
                    await fs.remove(folderPath);
                    logger.info(`删除物理文件夹: ${folderPath}`);
                }
                
                // 删除文件夹记录
                await FolderModel.delete(folder.id, user.username);
            } catch (error) {
                logger.error(`删除文件夹失败: ${folder.alias}`, error);
            }
        }
        logger.info(`删除文件夹: ${folders.length} 个`);

        // 5. 删除用户根目录（使用 id-username 格式）
        const userRootPath = path.join(FILES_ROOT, `${userId}-${user.username}`);
        if (await fs.pathExists(userRootPath)) {
            await fs.remove(userRootPath);
            logger.info(`删除用户根目录: ${userRootPath}`);
        }

        // 6. 最后删除用户
        await UserModel.delete(userId);
        logger.info(`删除用户完成: ${user.username}`);

        res.json({ 
            success: true, 
            message: '用户及其所有数据已删除',
            details: {
                shares: deletedShares,
                recycleBin: recycleBinFiles.length,
                files: files.length,
                folders: folders.length
            }
        });
    } catch (error) {
        logger.error(`删除用户失败:`, error);
        next(error);
    }
});

module.exports = router;
