const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

/**
 * 文件扫描器
 * 提供文件安全检查功能
 */

/**
 * 检查文件魔数（文件头）
 * 验证文件实际类型是否与扩展名匹配
 */
function checkFileMagicNumber(buffer, filename) {
    const ext = path.extname(filename).toLowerCase();
    
    // 常见文件类型的魔数
    const magicNumbers = {
        // 图片
        '.jpg': [[0xFF, 0xD8, 0xFF]],
        '.jpeg': [[0xFF, 0xD8, 0xFF]],
        '.png': [[0x89, 0x50, 0x4E, 0x47]],
        '.gif': [[0x47, 0x49, 0x46, 0x38]],
        '.bmp': [[0x42, 0x4D]],
        '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
        
        // 文档
        '.pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
        '.zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]], // PK
        '.rar': [[0x52, 0x61, 0x72, 0x21]], // Rar!
        '.7z': [[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]],
        
        // Office 文档（新格式，基于 ZIP）
        '.docx': [[0x50, 0x4B, 0x03, 0x04]],
        '.xlsx': [[0x50, 0x4B, 0x03, 0x04]],
        '.pptx': [[0x50, 0x4B, 0x03, 0x04]],
        
        // Office 文档（旧格式）
        '.doc': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
        '.xls': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
        '.ppt': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
        
        // 媒体
        '.mp4': [[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70]],
        '.mp3': [[0x49, 0x44, 0x33], [0xFF, 0xFB]], // ID3 or MPEG
        '.avi': [[0x52, 0x49, 0x46, 0x46]], // RIFF
    };
    
    const expectedMagics = magicNumbers[ext];
    if (!expectedMagics) {
        // 未知类型，允许通过
        return { valid: true, message: '未知文件类型，跳过魔数检查' };
    }
    
    // 检查是否匹配任一魔数
    for (const magic of expectedMagics) {
        let match = true;
        for (let i = 0; i < magic.length; i++) {
            if (buffer[i] !== magic[i]) {
                match = false;
                break;
            }
        }
        if (match) {
            return { valid: true, message: '文件类型验证通过' };
        }
    }
    
    return { 
        valid: false, 
        message: `文件类型不匹配：扩展名为 ${ext}，但文件内容不符合该类型` 
    };
}

/**
 * 检查可疑内容
 * 扫描文件中的危险模式
 */
function checkSuspiciousContent(buffer, filename) {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000)); // 只检查前10KB
    
    // 危险模式列表
    const dangerousPatterns = [
        // 脚本标签
        /<script[\s>]/i,
        // PHP 代码
        /<\?php/i,
        // ASP 代码
        /<%[\s@]/i,
        // 可执行文件标记
        /MZ\x90\x00/,
        // Shell 脚本
        /^#!\/bin\/(bash|sh)/m,
        // PowerShell
        /powershell/i,
        // 命令执行
        /eval\s*\(/i,
        /exec\s*\(/i,
        /system\s*\(/i,
    ];
    
    for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
            return {
                valid: false,
                message: `检测到可疑内容：文件可能包含恶意代码`
            };
        }
    }
    
    return { valid: true, message: '内容检查通过' };
}

/**
 * 检查文件大小异常
 */
function checkFileSizeAnomaly(buffer, filename) {
    const ext = path.extname(filename).toLowerCase();
    const size = buffer.length;
    
    // 某些类型的最小合理大小
    const minSizes = {
        '.jpg': 100,
        '.jpeg': 100,
        '.png': 100,
        '.gif': 100,
        '.pdf': 100,
    };
    
    const minSize = minSizes[ext];
    if (minSize && size < minSize) {
        return {
            valid: false,
            message: `文件大小异常：${ext} 文件通常不应小于 ${minSize} 字节`
        };
    }
    
    return { valid: true, message: '文件大小正常' };
}

/**
 * 综合文件安全扫描
 * @param {Buffer} buffer - 文件内容
 * @param {string} filename - 文件名
 * @returns {Object} { valid: boolean, message: string, details: Array }
 */
async function scanFile(buffer, filename) {
    const results = [];
    
    try {
        // 1. 魔数检查
        const magicCheck = checkFileMagicNumber(buffer, filename);
        results.push({ check: '文件类型验证', ...magicCheck });
        
        // 2. 可疑内容检查
        const contentCheck = checkSuspiciousContent(buffer, filename);
        results.push({ check: '内容安全检查', ...contentCheck });
        
        // 3. 文件大小检查
        const sizeCheck = checkFileSizeAnomaly(buffer, filename);
        results.push({ check: '文件大小检查', ...sizeCheck });
        
        // 判断是否全部通过
        const allValid = results.every(r => r.valid);
        const failedChecks = results.filter(r => !r.valid);
        
        if (!allValid) {
            logger.warn(`文件安全扫描失败: ${filename}`, { failedChecks });
            return {
                valid: false,
                message: failedChecks.map(c => c.message).join('; '),
                details: results
            };
        }
        
        logger.debug(`文件安全扫描通过: ${filename}`);
        return {
            valid: true,
            message: '文件安全扫描通过',
            details: results
        };
        
    } catch (error) {
        logger.error(`文件扫描出错: ${filename}`, error);
        return {
            valid: false,
            message: `文件扫描失败: ${error.message}`,
            details: results
        };
    }
}

/**
 * 快速扫描（仅检查魔数）
 */
function quickScan(buffer, filename) {
    return checkFileMagicNumber(buffer, filename);
}

module.exports = {
    scanFile,
    quickScan,
    checkFileMagicNumber,
    checkSuspiciousContent,
    checkFileSizeAnomaly
};
