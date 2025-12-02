const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 认证中间件
 * 验证JWT令牌
 */
const authenticate = (req, res, next) => {
    const auth = req.headers.authorization;
    
    if (!auth) {
        // 下载和预览路径的 401 使用 debug 级别（浏览器可能会发起第二次验证请求）
        const isDownloadOrPreview = req.path.includes('/download/') || req.path.includes('/preview/');
        const logLevel = isDownloadOrPreview ? 'debug' : 'warn';
        const logMessage = isDownloadOrPreview 
            ? '未提供认证令牌（可能是浏览器验证请求）'
            : '未提供认证令牌';
        
        logger[logLevel](logMessage, { 
            path: req.path, 
            ip: req.ip,
            method: req.method,
            referer: req.headers.referer || 'none'
        });
        return res.status(401).json({ error: '未登录' });
    }

    try {
        const token = auth.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: '令牌格式错误' });
        }

        req.user = jwt.verify(token, config.jwtSecret);
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            logger.warn('令牌已过期', { path: req.path, ip: req.ip });
            return res.status(401).json({ error: '令牌已过期' });
        } else if (error.name === 'JsonWebTokenError') {
            logger.warn('令牌无效', { path: req.path, ip: req.ip });
            return res.status(403).json({ error: '令牌无效' });
        }
        
        logger.error('认证错误', { error: error.message });
        return res.status(403).json({ error: '认证失败' });
    }
};

/**
 * 管理员权限中间件
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: '未登录' });
    }

    if (req.user.role !== 'admin') {
        logger.warn('非管理员尝试访问管理员资源', {
            username: req.user.username,
            path: req.path,
            ip: req.ip
        });
        return res.status(403).json({ error: '需要管理员权限' });
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