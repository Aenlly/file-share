const logger = require('../utils/logger');
const config = require('../config');
const { ERROR_CODES } = require('../config/errorCodes');

/**
 * 统一错误处理中间件
 * 将所有错误转换为统一的APF错误码格式，HTTP状态码统一为200
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

    // 确定APF错误码
    let errorCode = 'APF999'; // 默认未知错误
    let message = err.message || '服务器内部错误';

    // 特殊错误处理 - 映射到APF错误码
    if (err.name === 'ValidationError') {
        errorCode = 'APF400';
        message = '数据验证失败，请检查输入';
    } else if (err.name === 'UnauthorizedError') {
        errorCode = 'APF100';
        message = '未授权，请先登录';
    } else if (err.name === 'ForbiddenError') {
        errorCode = 'APF103';
        message = '禁止访问，权限不足';
    } else if (err.name === 'NotFoundError') {
        errorCode = 'APF404';
        message = '资源不存在';
    } else if (message.includes('系统繁忙') || message.includes('请稍后重试')) {
        // 系统繁忙错误（锁超时等）
        errorCode = 'APF503';
        message = message;
    } else if (message.includes('数据库') || message.includes('读取') || message.includes('写入')) {
        // 数据库相关错误
        errorCode = 'APF500';
        message = '数据操作失败，请稍后重试';
    } else if (message.includes('查询') || message.includes('保存') || message.includes('更新') || message.includes('删除')) {
        // 数据操作错误
        errorCode = 'APF500';
        message = message; // 保留原始消息，因为已经是友好的
    } else {
        // 其他未分类错误
        errorCode = 'APF999';
        message = '服务器内部错误，请稍后重试';
    }

    // 构建统一的错误响应格式
    const errorResponse = {
        success: false,
        code: errorCode,
        message: message,
        timestamp: new Date().toISOString()
    };

    // 开发环境返回详细信息
    if (config.nodeEnv !== 'production') {
        errorResponse.debug = {
            stack: err.stack,
            originalMessage: err.message,
            errorName: err.name,
            path: req.path,
            method: req.method,
            user: req.user ? req.user.username : 'anonymous'
        };
    }

    try {
        // 统一返回200状态码，错误信息在响应体中
        res.status(200).json(errorResponse);
    } catch (sendError) {
        logger.error('发送错误响应失败:', sendError);
    }
};

module.exports = errorHandler;
