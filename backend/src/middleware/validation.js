const { sendError } = require('../config/errorCodes');

/**
 * 密码强度验证
 */
function validatePassword(password) {
    const errors = [];
    
    if (!password || password.length < 8) {
        errors.push('密码长度至少8位');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('密码必须包含至少一个大写字母');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('密码必须包含至少一个小写字母');
    }
    
    if (!/[0-9]/.test(password)) {
        errors.push('密码必须包含至少一个数字');
    }
    
    // 可选：特殊字符
    // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    //     errors.push('密码必须包含至少一个特殊字符');
    // }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 文件名安全检查（防止路径遍历）
 */
function sanitizeFilename(filename) {
    if (!filename) return '';
    
    // 移除路径遍历字符
    let safe = filename.replace(/\.\./g, '');
    
    // 移除路径分隔符
    safe = safe.replace(/[\/\\]/g, '');
    
    // 移除特殊字符（保留常见文件名字符）
    safe = safe.replace(/[<>:"|?*\x00-\x1f]/g, '');
    
    return safe;
}

/**
 * 文件类型检查
 */
function validateFileType(filename, config) {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    
    // 检查是否为危险文件类型
    if (config.dangerousFileTypes && config.dangerousFileTypes.includes(ext)) {
        return {
            valid: false,
            error: `不允许上传 ${ext} 类型的文件（安全限制）`
        };
    }
    
    return { valid: true };
}

/**
 * 用户名验证
 */
function validateUsername(username) {
    const errors = [];
    
    if (!username || username.length < 3) {
        errors.push('用户名长度至少3位');
    }
    
    if (username.length > 20) {
        errors.push('用户名长度不能超过20位');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errors.push('用户名只能包含字母、数字和下划线');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 创建用户验证中间件
 */
const validateCreateUser = (req, res, next) => {
    const { username, password, role } = req.body;
    
    // 验证用户名
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        return sendError(res, 'PARAM_INVALID', usernameValidation.errors.join('; '));
    }
    
    // 验证密码
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return sendError(res, 'PARAM_INVALID', passwordValidation.errors.join('; '));
    }
    
    // 验证角色
    if (role && !['user', 'admin'].includes(role)) {
        return sendError(res, 'PARAM_INVALID', '角色必须是 user 或 admin');
    }
    
    next();
};

/**
 * 修改密码验证中间件
 */
const validateChangePassword = (req, res, next) => {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword) {
        return sendError(res, 'PARAM_INVALID', '请提供当前密码');
    }
    
    if (!newPassword) {
        return sendError(res, 'PARAM_INVALID', '请提供新密码');
    }
    
    // 验证新密码强度
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
        return sendError(res, 'PARAM_INVALID', passwordValidation.errors.join('; '));
    }
    
    // 检查新旧密码是否相同
    if (oldPassword === newPassword) {
        return sendError(res, 'PARAM_INVALID', '新密码不能与当前密码相同');
    }
    
    next();
};

/**
 * 文件夹名称验证中间件
 */
const validateFolderName = (req, res, next) => {
    const { alias } = req.body;
    
    if (!alias || alias.trim().length === 0) {
        return sendError(res, 'PARAM_INVALID', '文件夹名称不能为空');
    }
    
    if (alias.length > 255) {
        return sendError(res, 'PARAM_INVALID', '文件夹名称不能超过255个字符');
    }
    
    // 检查是否包含非法字符
    if (/[<>:"|?*\x00-\x1f\/\\]/.test(alias)) {
        return sendError(res, 'PARAM_INVALID', '文件夹名称包含非法字符');
    }
    
    next();
};

/**
 * 分享过期时间验证中间件
 */
const validateShareExpiration = (req, res, next) => {
    const { expireInMs } = req.body;
    
    if (!expireInMs) {
        return sendError(res, 'PARAM_INVALID', '请提供过期时间');
    }
    
    const expireInMsNum = parseInt(expireInMs);
    
    if (isNaN(expireInMsNum) || expireInMsNum <= 0) {
        return sendError(res, 'PARAM_INVALID', '过期时间必须为正数');
    }
    
    // 最长不超过365天
    const maxExpireMs = 365 * 24 * 60 * 60 * 1000;
    if (expireInMsNum > maxExpireMs) {
        return sendError(res, 'PARAM_INVALID', '过期时间不能超过365天');
    }
    
    next();
};

module.exports = {
    validatePassword,
    sanitizeFilename,
    validateFileType,
    validateUsername,
    validateCreateUser,
    validateChangePassword,
    validateFolderName,
    validateShareExpiration
};
