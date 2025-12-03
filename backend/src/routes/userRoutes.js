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

        // 删除用户的分享链接
        const ShareModel = require('../models/ShareModel');
        await ShareModel.deleteByOwner(user.username);

        // 删除用户
        await UserModel.delete(userId);
        logger.info(`删除用户: ${user.username}`);

        res.json({ success: true, message: '用户删除成功' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
