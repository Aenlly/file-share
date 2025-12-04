/**
 * 文件名编码/解码工具
 * 统一处理文件名的编码、解码和安全检查
 */

/**
 * 编码文件名（用于存储）
 * 对包含非ASCII字符的文件名进行Base64编码
 * @param {string} filename - 原始文件名
 * @returns {string} 编码后的文件名
 */
function encodeFilename(filename) {
    if (!filename) {
        return '';
    }
    
    // 检查是否包含非ASCII字符
    if (/[^\x00-\x7F]/.test(filename)) {
        // 包含非ASCII字符，使用UTF8前缀标记
        return 'UTF8:' + Buffer.from(filename, 'utf8').toString('base64');
    }
    
    // 纯ASCII字符，直接返回
    return filename;
}

/**
 * 解码文件名（从存储读取）
 * @param {string} encodedFilename - 编码后的文件名
 * @returns {string} 原始文件名
 */
function decodeFilename(encodedFilename) {
    if (!encodedFilename) {
        return '';
    }
    
    // 检查是否是编码格式
    if (encodedFilename.startsWith('UTF8:')) {
        try {
            const base64Part = encodedFilename.substring(5);
            return Buffer.from(base64Part, 'base64').toString('utf8');
        } catch (error) {
            // 解码失败，返回原始字符串
            return encodedFilename;
        }
    }
    
    // 未编码，直接返回
    return encodedFilename;
}

/**
 * 解码URL中的文件名
 * @param {string} urlEncodedFilename - URL编码的文件名
 * @returns {string} 解码后的文件名
 */
function decodeUrlFilename(urlEncodedFilename) {
    if (!urlEncodedFilename) {
        return '';
    }
    
    try {
        return decodeURIComponent(urlEncodedFilename);
    } catch (error) {
        // 解码失败，返回原始字符串
        return urlEncodedFilename;
    }
}

/**
 * 编码文件名用于URL
 * @param {string} filename - 原始文件名
 * @returns {string} URL编码的文件名
 */
function encodeUrlFilename(filename) {
    if (!filename) {
        return '';
    }
    
    return encodeURIComponent(filename);
}

/**
 * 验证文件名安全性（防止路径遍历攻击）
 * @param {string} filename - 文件名
 * @returns {boolean} 是否安全
 */
function isFilenameSafe(filename) {
    if (!filename) {
        return false;
    }
    
    // 检查路径遍历字符
    const dangerousPatterns = [
        /\.\./,           // 父目录引用
        /[\/\\]/,         // 路径分隔符
        /^[.]/,           // 以点开头（隐藏文件）
        /[\x00-\x1f]/,    // 控制字符
        /[<>:"|?*]/       // Windows非法字符
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(filename));
}

/**
 * 清理文件名（移除不安全字符）
 * @param {string} filename - 原始文件名
 * @returns {string} 清理后的文件名
 */
function sanitizeFilename(filename) {
    if (!filename) {
        return '';
    }
    
    // 移除路径分隔符和危险字符
    let cleaned = filename
        .replace(/[\/\\]/g, '_')      // 路径分隔符
        .replace(/\.\./g, '_')        // 父目录引用
        .replace(/[\x00-\x1f]/g, '')  // 控制字符
        .replace(/[<>:"|?*]/g, '_');  // Windows非法字符
    
    // 移除开头的点
    if (cleaned.startsWith('.')) {
        cleaned = '_' + cleaned.substring(1);
    }
    
    return cleaned;
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（包含点，如 .txt）
 */
function getFileExtension(filename) {
    if (!filename) {
        return '';
    }
    
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) {
        return '';
    }
    
    return filename.substring(lastDot).toLowerCase();
}

/**
 * 获取文件名（不含扩展名）
 * @param {string} filename - 文件名
 * @returns {string} 文件名（不含扩展名）
 */
function getBasename(filename) {
    if (!filename) {
        return '';
    }
    
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) {
        return filename;
    }
    
    return filename.substring(0, lastDot);
}

module.exports = {
    encodeFilename,
    decodeFilename,
    decodeUrlFilename,
    encodeUrlFilename,
    isFilenameSafe,
    sanitizeFilename,
    getFileExtension,
    getBasename
};
