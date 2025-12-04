/**
 * 系统自定义错误码定义
 * 格式: APF + 3位数字
 * HTTP状态码统一使用200，业务错误通过code字段区分
 */

const ERROR_CODES = {
    // ========== 认证相关 APF1xx ==========
    AUTH_INVALID_CREDENTIALS: { code: 'APF101', message: '用户名或密码错误' },
    AUTH_TOKEN_MISSING: { code: 'APF102', message: '未提供认证令牌' },
    AUTH_TOKEN_INVALID: { code: 'APF103', message: '认证令牌无效' },
    AUTH_TOKEN_EXPIRED: { code: 'APF104', message: '认证令牌已过期' },
    AUTH_USER_NOT_FOUND: { code: 'APF105', message: '用户不存在' },
    AUTH_PASSWORD_REQUIRED: { code: 'APF106', message: '密码不能为空' },
    AUTH_USERNAME_REQUIRED: { code: 'APF107', message: '用户名和密码不能为空' },
    AUTH_OLD_PASSWORD_WRONG: { code: 'APF108', message: '旧密码错误' },

    // ========== 权限相关 APF2xx ==========
    PERMISSION_DENIED: { code: 'APF201', message: '无权访问' },
    PERMISSION_ADMIN_REQUIRED: { code: 'APF202', message: '需要管理员权限' },
    PERMISSION_OWNER_REQUIRED: { code: 'APF203', message: '只有所有者可以操作' },
    PERMISSION_CANNOT_DELETE_SELF: { code: 'APF204', message: '不能删除自己' },
    PERMISSION_CANNOT_MODIFY: { code: 'APF205', message: '无权修改' },
    PERMISSION_CANNOT_DELETE: { code: 'APF206', message: '无权删除' },

    // ========== 资源相关 APF3xx ==========
    RESOURCE_NOT_FOUND: { code: 'APF301', message: '资源不存在' },
    FOLDER_NOT_FOUND: { code: 'APF302', message: '文件夹不存在' },
    FILE_NOT_FOUND: { code: 'APF303', message: '文件不存在' },
    USER_NOT_FOUND: { code: 'APF304', message: '用户不存在' },
    SHARE_NOT_FOUND: { code: 'APF305', message: '分享不存在' },
    SHARE_EXPIRED: { code: 'APF306', message: '分享链接已过期' },

    // ========== 参数错误 APF4xx ==========
    PARAM_MISSING: { code: 'APF401', message: '缺少必要参数' },
    PARAM_INVALID: { code: 'APF402', message: '参数格式错误' },
    FOLDER_ID_REQUIRED: { code: 'APF403', message: '文件夹ID不能为空' },
    EXPIRE_TIME_REQUIRED: { code: 'APF404', message: '过期时间不能为空' },
    SHARE_IDS_REQUIRED: { code: 'APF405', message: '分享ID列表不能为空' },
    NEW_PASSWORD_REQUIRED: { code: 'APF406', message: '新密码不能为空' },

    // ========== 服务器错误 APF5xx ==========
    SERVER_ERROR: { code: 'APF500', message: '服务器内部错误' },
    DATABASE_ERROR: { code: 'APF501', message: '数据库操作失败' },
    FILE_SYSTEM_ERROR: { code: 'APF502', message: '文件系统错误' },

    // ========== 文件操作 APF6xx ==========
    FILE_UPLOAD_FAILED: { code: 'APF601', message: '文件上传失败' },
    FILE_TOO_LARGE: { code: 'APF602', message: '文件大小超出限制' },
    FILE_TYPE_NOT_ALLOWED: { code: 'APF603', message: '不支持的文件类型' },
    FILE_DELETE_FAILED: { code: 'APF604', message: '文件删除失败' },
    FILE_MOVE_FAILED: { code: 'APF605', message: '文件移动失败' },

    // ========== 分享相关 APF7xx ==========
    SHARE_CREATE_FAILED: { code: 'APF701', message: '创建分享失败' },
    SHARE_CODE_INVALID: { code: 'APF702', message: '分享访问码无效' },

    // ========== 用户相关 APF8xx ==========
    USER_ALREADY_EXISTS: { code: 'APF801', message: '用户名已存在' },
    USER_CREATE_FAILED: { code: 'APF802', message: '创建用户失败' },

    // ========== 系统限制 APF9xx ==========
    RATE_LIMIT_EXCEEDED: { code: 'APF901', message: '请求过于频繁，请稍后再试' },
    SYSTEM_BUSY: { code: 'APF902', message: '系统繁忙，请稍后重试' },
};

/**
 * 创建错误响应
 */
function createErrorResponse(errorKey, customMessage = null) {
    const error = ERROR_CODES[errorKey];
    if (!error) {
        return { success: false, code: 'APF500', error: '未知错误' };
    }
    return {
        success: false,
        code: error.code,
        error: customMessage || error.message
    };
}

/**
 * 发送错误响应（HTTP 200 + 业务错误码）
 */
function sendError(res, errorKey, customMessage = null) {
    const response = createErrorResponse(errorKey, customMessage);
    return res.status(200).json(response);
}

module.exports = {
    ERROR_CODES,
    createErrorResponse,
    sendError
};
