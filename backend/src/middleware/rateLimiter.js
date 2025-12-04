const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * 创建速率限制中间件
 * @param {Object} options - 配置选项
 * @param {boolean} options.perEndpoint - 是否按接口独立计算（默认 true）
 */
const createRateLimiter = (options = {}) => {
    const perEndpoint = options.perEndpoint !== false; // 默认为 true
    
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
            const ip = req.ip || req.connection.remoteAddress;
            // 获取用户标识（已认证用户使用用户名，未认证使用IP）
            const userIdentifier = req.user?.username || ip;
            
            if (perEndpoint) {
                // 每个接口独立计算：用户 + 请求方法 + 路径
                // 规范化路径，将数字ID替换为占位符，使同类接口共享限流
                const normalizedPath = req.path.replace(/\/\d+/g, '/:id');
                return `${userIdentifier}:${req.method}:${normalizedPath}`;
            } else {
                // 全局计算：只使用用户标识
                return userIdentifier;
            }
        },
        ...options
    });
};

/**
 * API速率限制（每个接口独立计算）
 * 跳过分片上传相关的 API
 */
const apiLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    perEndpoint: true, // 每个接口独立计算
    skip: (req) => {
        // 跳过健康检查端点
        if (req.path === '/health') return true;
        
        // 跳过分片上传相关的 API（分片上传频率高，不需要限流）
        if (req.path.includes('/chunk/init')) return true;
        if (req.path.includes('/chunk/complete')) return true;
        if (req.path.match(/\/chunk$/)) return true; // 匹配 /chunk 结尾的路径
        
        return false;
    }
});

/**
 * 登录速率限制（更严格）
 * 针对登录接口，防止暴力破解
 */
const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 最多5次尝试
    perEndpoint: false, // 登录接口全局限制（不区分路径）
    message: '登录尝试过于频繁，请15分钟后再试'
});

/**
 * 文件上传速率限制
 * 开发环境跳过限流，生产环境限制每小时1000次
 */
const uploadLimiter = config.nodeEnv === 'development' 
    ? (req, res, next) => next() // 开发环境跳过
    : createRateLimiter({
        windowMs: 60 * 60 * 1000, // 1小时
        max: 1000, // 每小时最多1000次上传
        perEndpoint: true, // 每个文件夹独立计算
        message: '上传过于频繁，请稍后再试'
    });

module.exports = {
    createRateLimiter,
    apiLimiter,
    loginLimiter,
    uploadLimiter
};
