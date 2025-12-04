/**
 * 文件名编码处理工具
 * 统一处理文件名的编码和解码
 */

/**
 * 编码文件名（用于传输）
 * @param {string} filename - 原始文件名
 * @returns {string} 编码后的文件名
 */
function encodeFilename(filename) {
    if (!filename) return '';
    
    try {
        // 检查是否包含非ASCII字符
        if (/[^\x00-\x7F]/.test(filename)) {
            // 包含非ASCII字符，使用UTF8前缀标记
            return 'UTF8:' + Buffer.from(filename, 'utf8').toString('base64');
        }
        
        // 纯ASCII字符，直接返回
        return filename;
    } catch (error) {
        console.error('文件名编码失败:', error);
        return filename;
    }
}

/**
 * 解码文件名（从传输格式）
 * @param {string} encodedFilename - 编码的文件名
 * @returns {string} 解码后的文件名
 */
function decodeFilename(encodedFilename) {
    if (!encodedFilename) return '';
    
    try {
        // 检查是否有UTF8前缀
        if (encodedFilename.startsWith('UTF8:')) {
            const base64Part = encodedFilename.substring(5);
            return Buffer.from(base64Part, 'base64').toString('utf8');
        }
        
        // 没有前缀，直接返回
        return encodedFilename;
    } catch (error) {
        console.error('文件名解码失败:', error);
        return encodedFilename;
    }
}

/**
 * 规范化文件名（统一处理）
 * @param {string} filename - 文件名
 * @returns {string} 规范化后的文件名
 */
function normalizeFilename(filename) {
    if (!filename) return '';
    
    // 1. 先解码（如果已编码）
    let normalized = decodeFilename(filename);
    
    // 2. 移除路径分隔符（安全检查）
    normalized = normalized.replace(/[\/\\]/g, '_');
    
    // 3. 移除控制字符
    normalized = normalized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // 4. 限制长度（保留扩展名）
    const maxLength = 255;
    if (normalized.length > maxLength) {
        const ext = normalized.substring(normalized.lastIndexOf('.'));
        const nameWithoutExt = normalized.substring(0, normalized.lastIndexOf('.'));
        normalized = nameWithoutExt.substring(0, maxLength - ext.length) + ext;
    }
    
    return normalized;
}

/**
 * 检查文件名是否安全
 * @param {string} filename - 文件名
 * @returns {Object} { safe: boolean, reason: string }
 */
function isFilenameSafe(filename) {
    if (!filename) {
        return { safe: false, reason: '文件名为空' };
    }
    
    // 检查路径遍历
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return { safe: false, reason: '文件名包含非法路径字符' };
    }
    
    // 检查控制字符
    if (/[\x00-\x1F\x7F]/.test(filename)) {
        return { safe: false, reason: '文件名包含控制字符' };
    }
    
    // 检查长度
    if (filename.length > 255) {
        return { safe: false, reason: '文件名过长' };
    }
    
    // 检查保留名称（Windows）
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                          'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                          'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.') || filename.length);
    if (reservedNames.includes(nameWithoutExt.toUpperCase())) {
        return { safe: false, reason: '文件名使用了系统保留名称' };
    }
    
    return { safe: true, reason: '' };
}

/**
 * 批量处理文件名
 * @param {Array<string>} filenames - 文件名数组
 * @returns {Array<Object>} 处理结果
 */
function batchNormalizeFilenames(filenames) {
    return filenames.map(filename => {
        const normalized = normalizeFilename(filename);
        const safetyCheck = isFilenameSafe(normalized);
        
        return {
            original: filename,
            normalized,
            safe: safetyCheck.safe,
            reason: safetyCheck.reason
        };
    });
}

module.exports = {
    encodeFilename,
    decodeFilename,
    normalizeFilename,
    isFilenameSafe,
    batchNormalizeFilenames
};
