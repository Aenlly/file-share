const logger = require('../utils/logger');
const config = require('../config');

/**
 * 统一错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
    // 防止重复发送响应
    if (res.headersSent) {
        logger.error('响应已发送，但仍有错误:', err);
        return next(err);
    }

    // 记录完整的错误信息
    logger.error(`[ERROR] ${req.method} ${req.path}`, {
        error: err.message,
        stack: err.stack,
        body: req.body,
        params: req.params,
        query: req.query,
        user: req.user ? req.user.username : 'anonymous'
    });

    // 确定HTTP状态码和错误消息
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || '服务器内部错误';
    let userFriendlyMessage = message;

    // 特殊错误处理
    if (err.name === 'ValidationError') {
        statusCode = 400;
        userFriendlyMessage = '数据验证失败，请检查输入';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        userFriendlyMessage = '未授权，请先登录';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        userFriendlyMessage = '禁止访问，权限不足';
    } else if (err.name === 'NotFoundError') {
        statusCode = 404;
        userFriendlyMessage = '资源不存在';
    } else if (message.includes('系统繁忙') || message.includes('请稍后重试')) {
        // 系统繁忙错误（锁超时等）
        statusCode = 503;
        userFriendlyMessage = message;
    } else if (message.includes('数据库') || message.includes('读取') || message.includes('写入')) {
        // 数据库相关错误
        statusCode = 500;
        userFriendlyMessage = '数据操作失败，请稍后重试';
    } else if (message.includes('查询') || message.includes('保存') || message.includes('更新') || message.includes('删除')) {
        // 数据操作错误
        statusCode = 500;
        userFriendlyMessage = message; // 保留原始消息，因为已经是友好的
    } else if (statusCode === 500) {
        // 其他500错误
        userFriendlyMessage = '服务器内部错误，请稍后重试';
    }

    // 构建错误响应
    const errorResponse = {
        success: false,
        error: userFriendlyMessage,
        statusCode,
        timestamp: new Date().toISOString()
    };

    // 开发环境返回详细信息
    if (config.nodeEnv !== 'production') {
        errorResponse.stack = err.stack;
        errorResponse.originalMessage = err.message;
        errorResponse.details = {
            path: req.path,
            method: req.method,
            user: req.user ? req.user.username : 'anonymous'
        };
    }

    try {
        res.status(statusCode).json(errorResponse);
    } catch (sendError) {
        logger.error('发送错误响应失败:', sendError);
    }
};

module.exports = errorHandler;
