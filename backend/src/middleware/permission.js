/**
 * 权限检查中间件
 */

const logger = require('../utils/logger');
const UserModel = require('../models/UserModel');
const { sendError } = require('../config/errorCodes');

/**
 * 检查用户是否拥有指定权限
 * @param {string|string[]} requiredPermissions - 需要的权限（单个或数组）
 * @param {string} mode - 检查模式：'any'（任一权限）或 'all'（所有权限）
 */
const requirePermission = (requiredPermissions, mode = 'any') => {
    return async (req, res, next) => {
        if (!req.user) {
            return sendError(res, 'AUTH_TOKEN_MISSING');
        }

        try {
            // 获取用户完整信息（包含权限）
            const user = await UserModel.findById(req.user.id);
            if (!user) {
                return sendError(res, 'AUTH_USER_NOT_FOUND');
            }

            const userPermissions = user.permissions || [];
            const permissions = Array.isArray(requiredPermissions) 
                ? requiredPermissions 
                : [requiredPermissions];

            let hasPermission = false;

            if (mode === 'all') {
                // 需要拥有所有权限
                hasPermission = permissions.every(p => userPermissions.includes(p));
            } else {
                // 需要拥有任一权限
                hasPermission = permissions.some(p => userPermissions.includes(p));
            }

            if (!hasPermission) {
                logger.warn('权限不足', {
                    username: req.user.username,
                    required: permissions,
                    has: userPermissions,
                    path: req.path,
                    ip: req.ip
                });
                return sendError(res, 'PERMISSION_DENIED', `需要权限: ${permissions.join(', ')}`);
            }

            // 将用户权限附加到请求对象
            req.userPermissions = userPermissions;
            next();
        } catch (error) {
            logger.error('权限检查失败', { error: error.message });
            return sendError(res, 'SERVER_ERROR', '权限检查失败');
        }
    };
};

/**
 * 检查用户是否可以访问指定资源
 * @param {string} resourceType - 资源类型（folder, file, share等）
 * @param {string} action - 操作类型（view, create, update, delete）
 */
const canAccessResource = (resourceType, action) => {
    return async (req, res, next) => {
        if (!req.user) {
            return sendError(res, 'AUTH_TOKEN_MISSING');
        }

        try {
            const user = await UserModel.findById(req.user.id);
            if (!user) {
                return sendError(res, 'AUTH_USER_NOT_FOUND');
            }

            const userPermissions = user.permissions || [];
            
            // 检查是否有管理所有资源的权限
            const manageAllPermission = `${resourceType}:manage:all`;
            if (userPermissions.includes(manageAllPermission)) {
                req.canManageAll = true;
                return next();
            }

            // 检查是否有操作自己资源的权限
            const ownPermission = `${resourceType}:${action}:own`;
            if (userPermissions.includes(ownPermission)) {
                req.canManageAll = false;
                return next();
            }

            logger.warn('资源访问权限不足', {
                username: req.user.username,
                resourceType,
                action,
                path: req.path
            });

            return sendError(res, 'PERMISSION_DENIED', `需要权限: ${resourceType}:${action}:own`);
        } catch (error) {
            logger.error('资源权限检查失败', { error: error.message });
            return sendError(res, 'SERVER_ERROR', '权限检查失败');
        }
    };
};

/**
 * 检查用户是否拥有某个权限（不阻止请求，只设置标志）
 */
const checkPermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            req.hasPermission = false;
            return next();
        }

        try {
            const user = await UserModel.findById(req.user.id);
            const userPermissions = user?.permissions || [];
            req.hasPermission = userPermissions.includes(permission);
            req.userPermissions = userPermissions;
            next();
        } catch (error) {
            req.hasPermission = false;
            next();
        }
    };
};

module.exports = {
    requirePermission,
    canAccessResource,
    checkPermission,
};
