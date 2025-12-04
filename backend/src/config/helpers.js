/**
 * 配置辅助函数
 * 提供安全的环境变量解析功能
 */

/**
 * 安全的 parseInt，处理 NaN 和空值情况
 * @param {string|number|undefined} value - 要解析的值
 * @param {number} defaultValue - 默认值
 * @returns {number} 解析后的整数或默认值
 */
function safeParseInt(value, defaultValue) {
    // 处理 undefined、null、空字符串
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    
    const parsed = parseInt(value, 10);
    
    // 处理 NaN
    if (isNaN(parsed)) {
        return defaultValue;
    }
    
    return parsed;
}

/**
 * 解析布尔值
 * @param {string|boolean|undefined} value - 要解析的值
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean} 解析后的布尔值
 */
function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    
    if (typeof value === 'boolean') {
        return value;
    }
    
    const str = String(value).toLowerCase();
    return str === 'true' || str === '1' || str === 'yes';
}

/**
 * 解析数组（逗号分隔）
 * @param {string|undefined} value - 要解析的值
 * @param {Array} defaultValue - 默认值
 * @returns {Array} 解析后的数组
 */
function parseArray(value, defaultValue = []) {
    if (!value || typeof value !== 'string') {
        return defaultValue;
    }
    
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

/**
 * 解析文件大小（支持单位：B, KB, MB, GB）
 * @param {string|number|undefined} value - 要解析的值
 * @param {number} defaultValue - 默认值（字节）
 * @returns {number} 字节数
 */
function parseFileSize(value, defaultValue) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    
    // 如果是纯数字，直接返回
    if (typeof value === 'number') {
        return value;
    }
    
    const str = String(value).toUpperCase().trim();
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/);
    
    if (!match) {
        return defaultValue;
    }
    
    const num = parseFloat(match[1]);
    const unit = match[2] || 'B';
    
    const multipliers = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024
    };
    
    return Math.floor(num * multipliers[unit]);
}

/**
 * 解析时间（支持单位：ms, s, m, h, d）
 * @param {string|number|undefined} value - 要解析的值
 * @param {number} defaultValue - 默认值（毫秒）
 * @returns {number} 毫秒数
 */
function parseTime(value, defaultValue) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    
    // 如果是纯数字，直接返回（假设是毫秒）
    if (typeof value === 'number') {
        return value;
    }
    
    const str = String(value).toLowerCase().trim();
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/);
    
    if (!match) {
        return defaultValue;
    }
    
    const num = parseFloat(match[1]);
    const unit = match[2] || 'ms';
    
    const multipliers = {
        'ms': 1,
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };
    
    return Math.floor(num * multipliers[unit]);
}

module.exports = {
    safeParseInt,
    parseBoolean,
    parseArray,
    parseFileSize,
    parseTime
};
