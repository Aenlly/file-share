const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { PERMISSIONS, PERMISSION_GROUPS, ROLE_PRESETS } = require('../config/permissions');
const UserModel = require('../models/UserModel');
const logger = require('../utils/logger');

/**
 * 获取所有权限定义
 */
router.get('/definitions', authenticate, requirePermission(PERMISSIONS.PERMISSION_VIEW), async (req, res, next) => {
    try {
        res.json({
            permissions: PERMISSIONS,
            groups: PERMISSION_GROUPS,
            rolePresets: Object.keys(ROLE_PRESETS)
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 获取角色预设权限
 */
router.get('/role-presets/:role', authenticate, requirePermission(PERMISSIONS.PERMISSION_VIEW), async (req, res, next) => {
    try {
        const { role } = req.params;
        const permissions = ROLE_PRESETS[role];
        
        if (!permissions) {
            return res.status(404).json({ error: '角色不存在' });
        }

        res.json({ role, permissions });
    } catch (error) {
        next(error);
    }
});

/**
 * 获取用户权限
 */
router.get('/user/:userId', authenticate, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        
        // 只能查看自己的权限，或者有权限管理权限
        if (req.user.id !== userId) {
            const hasPermission = await UserModel.hasPermission(req.user.id, PERMISSIONS.PERMISSION_VIEW);
            if (!hasPermission) {
                return res.status(403).json({ error: '权限不足' });
            }
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions || []
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 更新用户权限
 */
router.put('/user/:userId', authenticate, requirePermission(PERMISSIONS.PERMISSION_MANAGE), async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const { permissions } = req.body;

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: '权限必须是数组' });
        }

        // 验证权限是否有效
        const validPermissions = Object.values(PERMISSIONS);
        const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
        
        if (invalidPermissions.length > 0) {
            return res.status(400).json({ 
                error: '包含无效权限',
                invalid: invalidPermissions 
            });
        }

        await UserModel.updatePermissions(userId, permissions);
        logger.info(`更新用户权限: ID=${userId}, 权限数=${permissions.length}`);

        const user = await UserModel.findById(userId);
        const { password, ...safe } = user;
        res.json(safe);
    } catch (error) {
        next(error);
    }
});

/**
 * 应用角色预设权限
 */
router.post('/user/:userId/apply-role', authenticate, requirePermission(PERMISSIONS.PERMISSION_MANAGE), async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const { role } = req.body;

        const permissions = ROLE_PRESETS[role];
        if (!permissions) {
            return res.status(400).json({ error: '角色不存在' });
        }

        await UserModel.updateRole(userId, role);
        logger.info(`应用角色预设: ID=${userId}, 角色=${role}`);

        const user = await UserModel.findById(userId);
        const { password, ...safe } = user;
        res.json(safe);
    } catch (error) {
        next(error);
    }
});

/**
 * 检查当前用户权限
 */
router.post('/check', authenticate, async (req, res, next) => {
    try {
        const { permission, permissions } = req.body;

        const user = await UserModel.findById(req.user.id);
        const userPermissions = user.permissions || [];

        let result;
        if (permission) {
            // 检查单个权限
            result = { hasPermission: userPermissions.includes(permission) };
        } else if (Array.isArray(permissions)) {
            // 检查多个权限
            result = {
                permissions: permissions.reduce((acc, p) => {
                    acc[p] = userPermissions.includes(p);
                    return acc;
                }, {})
            };
        } else {
            return res.status(400).json({ error: '请提供 permission 或 permissions 参数' });
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
