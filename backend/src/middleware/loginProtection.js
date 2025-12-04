const logger = require('../utils/logger');
const { sendError } = require('../config/errorCodes');

/**
 * 登录失败记录存储
 * key: IP地址 或 用户名
 * value: { count: 失败次数, lastAttempt: 最后尝试时间, lockedUntil: 锁定截止时间 }
 */
const loginAttempts = new Map();

// 配置
const CONFIG = {
    maxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS) || 5,        // 最大尝试次数
    lockDuration: parseInt(process.env.LOGIN_LOCK_DURATION) || 15 * 60 * 1000, // 锁定时长(默认15分钟)
    attemptWindow: parseInt(process.env.LOGIN_ATTEMPT_WINDOW) || 15 * 60 * 1000, // 尝试窗口期(默认15分钟)
    cleanupInterval: 30 * 60 * 1000, // 清理间隔(30分钟)
};

/**
 * 获取客户端IP
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || req.socket?.remoteAddress
        || 'unknown';
}

/**
 * 检查是否被锁定
 */
function isLocked(key) {
    const record = loginAttempts.get(key);
    if (!record) return false;
    
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
        return true;
    }
    
    // 锁定已过期，重置记录
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
        loginAttempts.delete(key);
        return false;
    }
    
    return false;
}

/**
 * 获取剩余锁定时间(秒)
 */
function getRemainingLockTime(key) {
    const record = loginAttempts.get(key);
    if (!record || !record.lockedUntil) return 0;
    
    const remaining = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
}

/**
 * 记录登录失败
 */
function recordFailedAttempt(key) {
    const now = Date.now();
    let record = loginAttempts.get(key);
    
    if (!record) {
        record = { count: 0, lastAttempt: now, lockedUntil: null };
    }
    
    // 如果超过窗口期，重置计数
    if (now - record.lastAttempt > CONFIG.attemptWindow) {
        record.count = 0;
    }
    
    record.count++;
    record.lastAttempt = now;
    
    // 达到最大尝试次数，锁定账户
    if (record.count >= CONFIG.maxAttempts) {
        record.lockedUntil = now + CONFIG.lockDuration;
        logger.warn(`登录保护: ${key} 已被锁定 ${CONFIG.lockDuration / 1000} 秒`);
    }
    
    loginAttempts.set(key, record);
    
    return {
        count: record.count,
        remaining: CONFIG.maxAttempts - record.count,
        locked: record.lockedUntil !== null && now < record.lockedUntil
    };
}

/**
 * 清除登录失败记录(登录成功时调用)
 */
function clearFailedAttempts(key) {
    loginAttempts.delete(key);
}

/**
 * 登录保护中间件
 */
function loginProtectionMiddleware(req, res, next) {
    const ip = getClientIP(req);
    const username = req.body?.username;
    
    // 检查IP是否被锁定
    if (isLocked(ip)) {
        const remaining = getRemainingLockTime(ip);
        logger.warn(`登录保护: IP ${ip} 尝试登录但已被锁定，剩余 ${remaining} 秒`);
        return res.status(200).json({
            success: false,
            code: 'APF902',
            error: `登录尝试过于频繁，请 ${Math.ceil(remaining / 60)} 分钟后再试`,
            retryAfter: remaining
        });
    }
    
    // 检查用户名是否被锁定
    if (username && isLocked(`user:${username}`)) {
        const remaining = getRemainingLockTime(`user:${username}`);
        logger.warn(`登录保护: 用户 ${username} 尝试登录但已被锁定，剩余 ${remaining} 秒`);
        return res.status(200).json({
            success: false,
            code: 'APF902',
            error: `该账户登录尝试过于频繁，请 ${Math.ceil(remaining / 60)} 分钟后再试`,
            retryAfter: remaining
        });
    }
    
    // 将辅助函数附加到请求对象，供路由使用
    req.loginProtection = {
        ip,
        recordFailure: () => {
            const ipResult = recordFailedAttempt(ip);
            if (username) {
                recordFailedAttempt(`user:${username}`);
            }
            return ipResult;
        },
        clearFailures: () => {
            clearFailedAttempts(ip);
            if (username) {
                clearFailedAttempts(`user:${username}`);
            }
        }
    };
    
    next();
}

// 定期清理过期记录
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, record] of loginAttempts.entries()) {
        // 清理超过窗口期且未锁定的记录
        if (!record.lockedUntil && now - record.lastAttempt > CONFIG.attemptWindow) {
            loginAttempts.delete(key);
            cleaned++;
        }
        // 清理已过期的锁定记录
        else if (record.lockedUntil && now > record.lockedUntil) {
            loginAttempts.delete(key);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        logger.info(`登录保护: 清理了 ${cleaned} 条过期记录`);
    }
}, CONFIG.cleanupInterval);

module.exports = {
    loginProtectionMiddleware,
    recordFailedAttempt,
    clearFailedAttempts,
    isLocked,
    getRemainingLockTime
};
