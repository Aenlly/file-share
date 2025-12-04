const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 发送错误响应（HTTP 200 + 业务错误码）
 */
const sendAuthError = (res, code, message) => {
    return res.status(200).json({
        success: false,
        code,
        error: message
    });
};

/**
 * 认证中间件
 * 验证JWT令牌
 */
const authenticate = (req, res, next) => {
    const auth = req.headers.authorization;
    
    if (!auth) {
        const isDownloadOrPreview = req.path.includes('/download/') || req.path.includes('/preview/');
        const logLevel = isDownloadOrPreview ? 'debug' : 'warn';
        logger[logLevel]('未提供认证令牌', { path: req.path, ip: req.ip });
        return sendAuthError(res, 'APF102', '未登录');
    }

    try {
        const token = auth.split(' ')[1];
        if (!token) {
            return sendAuthError(res, 'APF103', '令牌格式错误');
        }

        req.user = jwt.verify(token, config.jwtSecret);
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            logger.warn('令牌已过期', { path: req.path, ip: req.ip });
            return sendAuthError(res, 'APF104', '令牌已过期，请重新登录');
        } else if (error.name === 'JsonWebTokenError') {
            logger.warn('令牌无效', { path: req.path, ip: req.ip });
            return sendAuthError(res, 'APF103', '令牌无效');
        }
        
        logger.error('认证错误', { error: error.message });
        return sendAuthError(res, 'APF103', '认证失败');
    }
};

/**
 * 管理员权限中间件
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return sendAuthError(res, 'APF102', '未登录');
    }

    if (req.user.role !== 'admin') {
        logger.warn('非管理员尝试访问管理员资源', {
            username: req.user.username,
            path: req.path,
            ip: req.ip
        });
        return sendAuthError(res, 'APF202', '需要管理员权限');
    }

    next();
};

/**
 * 生成JWT令牌
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
    );
};

module.exports = {
    authenticate,
    requireAdmin,
    generateToken
};
