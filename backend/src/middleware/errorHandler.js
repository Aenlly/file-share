const logger = require('../utils/logger');
const config = require('../config');

/**
 * 统一错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
    // 记录错误
    logger.error(`${req.method} ${req.path}`, {
        error: err.message,
        stack: err.stack,
        body: req.body,
        params: req.params
    });

    // 确定HTTP状态码
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message;

    // 特殊错误处理
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = '数据验证失败';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = '未授权';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        message = '禁止访问';
    } else if (err.name === 'NotFoundError') {
        statusCode = 404;
        message = '资源不存在';
    }

    // 生产环境不返回详细错误信息
    const errorResponse = {
        error: config.nodeEnv === 'production' ? '服务器错误' : message,
        statusCode
    };

    // 开发环境返回堆栈跟踪
    if (config.nodeEnv !== 'production') {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
