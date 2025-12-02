const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * 创建速率限制中间件
 */
const createRateLimiter = (options = {}) => {
    return rateLimit({
        windowMs: config.rateLimitWindowMs,
        max: config.rateLimitMaxRequests,
        message: '请求过于频繁，请稍后再试',
        standardHeaders: true, // 返回速率限制信息在 RateLimit-* 头中
        legacyHeaders: false, // 禁用 X-RateLimit-* 头
        skip: (req) => {
            // 跳过健康检查端点
            return req.path === '/health';
        },
        keyGenerator: (req) => {
            // 使用IP地址作为限制键
            return req.ip || req.connection.remoteAddress;
        },
        ...options
    });
};

/**
 * API速率限制
 */
const apiLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests
});

/**
 * 登录速率限制（更严格）
 */
const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 最多5次尝试
    message: '登录尝试过于频繁，请15分钟后再试'
});

/**
 * 文件上传速率限制
 */
const uploadLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 100, // 每小时最多100次上传
    message: '上传过于频繁，请稍后再试'
});

module.exports = {
    createRateLimiter,
    apiLimiter,
    loginLimiter,
    uploadLimiter
};
