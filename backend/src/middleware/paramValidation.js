/**
 * 请求参数验证中间件
 * 提供统一的参数验证和错误处理
 */

const { sendError } = require('../config/errorCodes');

/**
 * 验证整数参数
 */
function validateInteger(paramName, options = {}) {
    const { min = 1, max, required = true } = options;
    
    return (req, res, next) => {
        const value = req.params[paramName] || req.query[paramName] || req.body[paramName];
        
        if (!value) {
            if (required) {
                return sendError(res, 'PARAM_MISSING', `${paramName} 参数缺失`);
            }
            return next();
        }
        
        const num = parseInt(value);
        if (isNaN(num)) {
            return sendError(res, 'PARAM_INVALID', `${paramName} 必须是整数`);
        }
        
        if (min !== undefined && num < min) {
            return sendError(res, 'PARAM_INVALID', `${paramName} 必须大于等于 ${min}`);
        }
        
        if (max !== undefined && num > max) {
            return sendError(res, 'PARAM_INVALID', `${paramName} 必须小于等于 ${max}`);
        }
        
        // 转换为整数
        if (req.params[paramName]) req.params[paramName] = num;
        if (req.query[paramName]) req.query[paramName] = num;
        if (req.body[paramName]) req.body[paramName] = num;
        
        next();
    };
}

/**
 * 验证字符串参数
 */
function validateString(paramName, options = {}) {
    const { minLength, maxLength, pattern, required = true } = options;
    
    return (req, res, next) => {
        const value = req.params[paramName] || req.query[paramName] || req.body[paramName];
        
        if (!value || value.trim() === '') {
            if (required) {
                return sendError(res, 'PARAM_MISSING', `${paramName} 参数缺失`);
            }
            return next();
        }
        
        const str = String(value).trim();
        
        if (minLength && str.length < minLength) {
            return sendError(res, 'PARAM_INVALID', `${paramName} 长度必须至少 ${minLength} 个字符`);
        }
        
        if (maxLength && str.length > maxLength) {
            return sendError(res, 'PARAM_INVALID', `${paramName} 长度不能超过 ${maxLength} 个字符`);
        }
        
        if (pattern && !pattern.test(str)) {
            return sendError(res, 'PARAM_INVALID', `${paramName} 格式无效`);
        }
        
        next();
    };
}

/**
 * 验证枚举参数
 */
function validateEnum(paramName, allowedValues, required = true) {
    return (req, res, next) => {
        const value = req.params[paramName] || req.query[paramName] || req.body[paramName];
        
        if (!value) {
            if (required) {
                return sendError(res, 'PARAM_MISSING', `${paramName} 参数缺失`);
            }
            return next();
        }
        
        if (!allowedValues.includes(value)) {
            return sendError(res, 'PARAM_INVALID', 
                `${paramName} 必须是以下值之一: ${allowedValues.join(', ')}`);
        }
        
        next();
    };
}

/**
 * 验证分页参数
 */
function validatePagination(req, res, next) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    if (page < 1) {
        return sendError(res, 'PARAM_INVALID', '页码必须大于0');
    }
    
    if (limit < 1 || limit > 100) {
        return sendError(res, 'PARAM_INVALID', '每页数量必须在1-100之间');
    }
    
    req.pagination = {
        page,
        limit,
        offset: (page - 1) * limit
    };
    
    next();
}

/**
 * 验证排序参数
 */
function validateSort(allowedFields = []) {
    return (req, res, next) => {
        const sortBy = req.query.sortBy;
        const sortOrder = req.query.sortOrder || 'asc';
        
        if (sortBy && allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
            return sendError(res, 'PARAM_INVALID', 
                `排序字段必须是以下之一: ${allowedFields.join(', ')}`);
        }
        
        if (sortOrder && !['asc', 'desc'].includes(sortOrder.toLowerCase())) {
            return sendError(res, 'PARAM_INVALID', '排序顺序必须是 asc 或 desc');
        }
        
        req.sort = {
            sortBy: sortBy || allowedFields[0] || 'id',
            sortOrder: sortOrder.toLowerCase()
        };
        
        next();
    };
}

/**
 * 验证日期参数
 */
function validateDate(paramName, required = false) {
    return (req, res, next) => {
        const value = req.query[paramName] || req.body[paramName];
        
        if (!value) {
            if (required) {
                return sendError(res, 'PARAM_MISSING', `${paramName} 参数缺失`);
            }
            return next();
        }
        
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return sendError(res, 'PARAM_INVALID', `${paramName} 日期格式无效`);
        }
        
        next();
    };
}

/**
 * 验证布尔参数
 */
function validateBoolean(paramName, required = false) {
    return (req, res, next) => {
        const value = req.query[paramName] || req.body[paramName];
        
        if (value === undefined || value === null) {
            if (required) {
                return sendError(res, 'PARAM_MISSING', `${paramName} 参数缺失`);
            }
            return next();
        }
        
        if (typeof value === 'boolean') {
            return next();
        }
        
        if (value === 'true' || value === '1') {
            if (req.query[paramName]) req.query[paramName] = true;
            if (req.body[paramName]) req.body[paramName] = true;
            return next();
        }
        
        if (value === 'false' || value === '0') {
            if (req.query[paramName]) req.query[paramName] = false;
            if (req.body[paramName]) req.body[paramName] = false;
            return next();
        }
        
        return sendError(res, 'PARAM_INVALID', `${paramName} 必须是布尔值`);
    };
}

/**
 * 组合多个验证器
 */
function combineValidators(...validators) {
    return (req, res, next) => {
        let index = 0;
        
        const runNext = (err) => {
            if (err) return next(err);
            
            if (index >= validators.length) {
                return next();
            }
            
            const validator = validators[index++];
            validator(req, res, runNext);
        };
        
        runNext();
    };
}

module.exports = {
    validateInteger,
    validateString,
    validateEnum,
    validatePagination,
    validateSort,
    validateDate,
    validateBoolean,
    combineValidators
};
