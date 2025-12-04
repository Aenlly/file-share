const logger = require('./logger');
const { sendError } = require('./apiResponse');

/**
 * 错误类型枚举
 */
const ErrorTypes = {
    VALIDATION: 'VALIDATION_ERROR',
    AUTHENTICATION: 'AUTHENTICATION_ERROR',
    AUTHORIZATION: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    SERVER_ERROR: 'SERVER_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR'
};

/**
 * 自定义应用错误类
 */
class AppError extends Error {
    constructor(message, type = ErrorTypes.SERVER_ERROR, statusCode = 500, errorCode = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = true; // 标记为可预期的错误
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 创建验证错误
 */
function createValidationError(message, errorCode = 'VALIDATION_ERROR') {
    return new AppError(message, ErrorTypes.VALIDATION, 400, errorCode);
}

/**
 * 创建认证错误
 */
function createAuthenticationError(message, errorCode = 'AUTHENTICATION_ERROR') {
    return new AppError(message, ErrorTypes.AUTHENTICATION, 401, errorCode);
}

/**
 * 创建授权错误
 */
function createAuthorizationError(message, errorCode = 'AUTHORIZATION_ERROR') {
    return new AppError(message, ErrorTypes.AUTHORIZATION, 403, errorCode);
}

/**
 * 创建未找到错误
 */
function createNotFoundError(message, errorCode = 'NOT_FOUND') {
    return new AppError(message, ErrorTypes.NOT_FOUND, 404, errorCode);
}

/**
 * 创建冲突错误
 */
function createConflictError(message, errorCode = 'CONFLICT') {
    return new AppError(message, ErrorTypes.CONFLICT, 409, errorCode);
}

/**
 * 创建服务器错误
 */
function createServerError(message, errorCode = 'SERVER_ERROR') {
    return new AppError(message, ErrorTypes.SERVER_ERROR, 500, errorCode);
}

/**
 * 统一错误处理中间件
 */
function errorHandlerMiddleware(err, req, res, next) {
    // 如果响应已发送，交给默认错误处理器
    if (res.headersSent) {
        return next(err);
    }
    
    // 记录错误日志
    if (err.isOperational) {
        // 可预期的错误，记录为 warn
        logger.warn(`${err.type}: ${err.message}`, {
            path: req.path,
            method: req.method,
            user: req.user?.username
        });
    } else {
        // 未预期的错误，记录为 error（包含堆栈）
        logger.error(`未预期的错误: ${err.message}`, {
            path: req.path,
            method: req.method,
            user: req.user?.username,
            stack: err.stack
        });
    }
    
    // 发送错误响应
    if (err instanceof AppError) {
        return sendError(res, err.errorCode || 'SERVER_ERROR', err.message, err.statusCode);
    }
    
    // 处理其他类型的错误
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || '服务器内部错误';
    
    return sendError(res, 'SERVER_ERROR', message, statusCode);
}

/**
 * 异步路由处理器包装器（自动捕获异常）
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} Express 路由处理器
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 尝试执行操作，失败时返回默认值
 * @param {Function} fn - 要执行的函数
 * @param {*} defaultValue - 失败时的默认值
 * @param {string} errorMessage - 错误日志消息
 * @returns {Promise<*>} 执行结果或默认值
 */
async function tryOrDefault(fn, defaultValue, errorMessage = '操作失败') {
    try {
        return await fn();
    } catch (error) {
        logger.error(`${errorMessage}: ${error.message}`);
        return defaultValue;
    }
}

/**
 * 批量执行操作，收集成功和失败的结果
 * @param {Array} items - 要处理的项目数组
 * @param {Function} fn - 处理函数
 * @param {string} itemName - 项目名称（用于日志）
 * @returns {Promise<{success: Array, failed: Array}>} 成功和失败的结果
 */
async function batchExecute(items, fn, itemName = 'item') {
    const success = [];
    const failed = [];
    
    for (const item of items) {
        try {
            const result = await fn(item);
            success.push({ item, result });
        } catch (error) {
            logger.error(`批量操作失败 (${itemName}):`, error);
            failed.push({ item, error: error.message });
        }
    }
    
    return { success, failed };
}

module.exports = {
    ErrorTypes,
    AppError,
    createValidationError,
    createAuthenticationError,
    createAuthorizationError,
    createNotFoundError,
    createConflictError,
    createServerError,
    errorHandlerMiddleware,
    asyncHandler,
    tryOrDefault,
    batchExecute
};
