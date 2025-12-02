const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const DATA_DIR = config.database.json.dataDir;
const FILES_ROOT = path.join(process.cwd(), 'files');

/**
 * 计算文件哈希值
 */
const calculateFileHash = (filePath) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
};

/**
 * 检查文件类型是否安全
 */
const isFileTypeSafe = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    
    // 检查危险文件类型
    if (config.allowedFileTypes.dangerousFileTypes && 
        config.allowedFileTypes.dangerousFileTypes.includes(ext)) {
        return {
            safe: false,
            reason: `不允许上传${ext}类型的文件`
        };
    }
    
    // 检查文件大小
    if (config.maxFileSize && arguments[1] && arguments[1] > config.maxFileSize) {
        return {
            safe: false,
            reason: `文件大小超过限制（最大${config.maxFileSize / 1024 / 1024}MB）`
        };
    }
    
    return { safe: true };
};

/**
 * 读取JSON文件（带UTF-8编码支持）
 */
const readJSON = (filename) => {
    const filePath = path.join(DATA_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const buffer = fs.readFileSync(filePath);
        const data = buffer.toString('utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`读取JSON文件失败: ${filename}`, error);
        return [];
    }
};

/**
 * 写入JSON文件（带UTF-8编码支持）
 */
const writeJSON = (filename, data) => {
    const filePath = path.join(DATA_DIR, filename);
    fs.ensureDirSync(path.dirname(filePath));
    
    try {
        const jsonString = JSON.stringify(data, null, 2);
        const buffer = Buffer.from(jsonString, 'utf8');
        fs.writeFileSync(filePath, buffer);
    } catch (error) {
        console.error(`写入JSON文件失败: ${filename}`, error);
        throw error;
    }
};

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 生成唯一文件名
 */
const generateUniqueFilename = (originalName) => {
    const ext = path.extname(originalName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = crypto.randomUUID().substring(0, 8);
    return `${uuid}_${timestamp}${ext}`;
};

/**
 * 解码文件名（处理Base64编码的UTF-8文件名）
 */
const decodeFilename = (filename) => {
    if (filename.startsWith('UTF8:')) {
        try {
            const base64Part = filename.substring(5);
            const bytes = Buffer.from(base64Part, 'base64');
            return bytes.toString('utf8');
        } catch (e) {
            console.error('文件名解码失败:', e);
            return filename;
        }
    }
    return filename;
};

/**
 * 编码文件名（将UTF-8文件名转换为Base64）
 */
const encodeFilename = (filename) => {
    if (/[^\x00-\x7F]/.test(filename)) {
        try {
            const encoder = new TextEncoder();
            const uint8Array = encoder.encode(filename);
            const base64Name = Buffer.from(uint8Array).toString('base64');
            return 'UTF8:' + base64Name;
        } catch (e) {
            console.error('文件名编码失败:', e);
            return filename;
        }
    }
    return filename;
};

module.exports = {
    DATA_DIR,
    FILES_ROOT,
    calculateFileHash,
    isFileTypeSafe,
    readJSON,
    writeJSON,
    formatFileSize,
    generateUniqueFilename,
    decodeFilename,
    encodeFilename
};
