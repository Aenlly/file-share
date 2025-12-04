/**
 * 日志敏感信息过滤工具
 * 用于在记录日志前移除敏感信息
 */

// 敏感字段列表
const SENSITIVE_FIELDS = [
    'password',
    'oldPassword',
    'newPassword',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'privateKey',
    'authorization',
    'cookie',
    'session'
];

// 敏感字段的正则匹配（用于匹配类似 user_password 的字段）
const SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /auth/i
];

/**
 * 检查字段名是否为敏感字段
 */
function isSensitiveField(fieldName) {
    if (!fieldName) return false;
    
    const lowerFieldName = fieldName.toLowerCase();
    
    // 精确匹配
    if (SENSITIVE_FIELDS.includes(lowerFieldName)) {
        return true;
    }
    
    // 模式匹配
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * 清理对象中的敏感信息
 */
function sanitizeObject(obj, depth = 0) {
    // 防止无限递归
    if (depth > 10) return obj;
    
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    // 处理数组
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
    }
    
    // 处理对象
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (isSensitiveField(key)) {
            sanitized[key] = '***REDACTED***';
        } else if (value && typeof value === 'object') {
            sanitized[key] = sanitizeObject(value, depth + 1);
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

/**
 * 清理日志数据
 * @param {any} data - 要清理的数据
 * @returns {any} 清理后的数据
 */
function sanitizeLogData(data) {
    if (!data) return data;
    
    // 如果是字符串，检查是否包含敏感信息
    if (typeof data === 'string') {
        // 简单的密码模式检测
        if (data.includes('password') || data.includes('token')) {
            return '[REDACTED]';
        }
        return data;
    }
    
    // 如果是对象或数组，递归清理
    if (typeof data === 'object') {
        return sanitizeObject(data);
    }
    
    return data;
}

/**
 * 清理请求对象（用于日志记录）
 */
function sanitizeRequest(req) {
    return {
        method: req.method,
        url: req.url,
        path: req.path,
        query: sanitizeObject(req.query),
        body: sanitizeObject(req.body),
        headers: sanitizeHeaders(req.headers),
        ip: req.ip,
        user: req.user ? {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
        } : null
    };
}

/**
 * 清理请求头（移除敏感信息）
 */
function sanitizeHeaders(headers) {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    
    // 移除敏感请求头
    const sensitiveHeaders = [
        'authorization',
        'cookie',
        'x-api-key',
        'x-auth-token'
    ];
    
    sensitiveHeaders.forEach(header => {
        if (sanitized[header]) {
            sanitized[header] = '***REDACTED***';
        }
    });
    
    return sanitized;
}

/**
 * 清理错误对象（用于日志记录）
 */
function sanitizeError(error) {
    if (!error) return null;
    
    return {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
}

module.exports = {
    sanitizeLogData,
    sanitizeRequest,
    sanitizeHeaders,
    sanitizeError,
    isSensitiveField
};
