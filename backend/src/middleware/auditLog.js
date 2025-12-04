const AuditLogModel = require('../models/AuditLogModel');
const logger = require('../utils/logger');

/**
 * 审计日志中间件
 * 自动记录关键操作
 */
function auditLog(action, options = {}) {
    return async (req, res, next) => {
        // 保存原始的 json 方法
        const originalJson = res.json.bind(res);
        
        // 重写 json 方法以捕获响应
        res.json = function(data) {
            // 异步记录审计日志（不阻塞响应）
            setImmediate(async () => {
                try {
                    const logData = {
                        action,
                        userId: req.user?.id || null,
                        username: req.user?.username || 'anonymous',
                        resourceType: options.resourceType || extractResourceType(req),
                        resourceId: options.resourceId || extractResourceId(req),
                        resourceName: options.resourceName || extractResourceName(req, data),
                        details: {
                            method: req.method,
                            path: req.path,
                            query: req.query,
                            body: sanitizeBody(req.body),
                            response: sanitizeResponse(data)
                        },
                        ipAddress: req.ip || req.connection.remoteAddress,
                        userAgent: req.headers['user-agent'],
                        status: data.success === false ? 'failed' : 'success',
                        errorMessage: data.error || null
                    };
                    
                    await AuditLogModel.log(logData);
                } catch (error) {
                    logger.error('记录审计日志失败:', error);
                }
            });
            
            // 调用原始的 json 方法
            return originalJson(data);
        };
        
        next();
    };
}

/**
 * 从请求中提取资源类型
 */
function extractResourceType(req) {
    if (req.path.includes('/files')) return 'file';
    if (req.path.includes('/folders')) return 'folder';
    if (req.path.includes('/users')) return 'user';
    if (req.path.includes('/shares')) return 'share';
    return null;
}

/**
 * 从请求中提取资源ID
 */
function extractResourceId(req) {
    // 从路径参数中提取ID
    return req.params.id || req.params.folderId || req.params.fileId || req.params.shareId || null;
}

/**
 * 从请求和响应中提取资源名称
 */
function extractResourceName(req, data) {
    return req.body?.name || req.body?.alias || req.body?.fileName || data?.name || data?.fileName || null;
}

/**
 * 清理请求体（移除敏感信息）
 */
function sanitizeBody(body) {
    if (!body) return null;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'oldPassword', 'newPassword', 'token', 'secret'];
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '***';
        }
    });
    
    return sanitized;
}

/**
 * 清理响应数据（移除敏感信息）
 */
function sanitizeResponse(data) {
    if (!data) return null;
    
    // 只保留关键信息
    return {
        success: data.success,
        code: data.code,
        message: data.message || data.error
    };
}

module.exports = {
    auditLog,
    AuditLogModel
};
