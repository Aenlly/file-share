const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const FILES_ROOT = path.join(__dirname, '../../files');

// 读取JSON文件
const readJSON = (filename) => {
    const fullPath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fullPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch {
        return [];
    }
};

// 写入JSON文件
const writeJSON = (filename, data) => {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
};

// 计算文件哈希值
const calculateFileHash = (filePath) => {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
};

// 检查文件类型是否安全
const isFileTypeSafe = (filename) => {
    // 危险文件扩展名黑名单
    const dangerousExtensions = [
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.app', '.deb', '.pkg', '.dmg',
        '.msi', '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.sh', '.ps1', '.vb', '.wsf', '.reg'
    ];
    
    // 安全文件扩展名白名单
    const safeExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', // 图片
        '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', // 视频
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', // 音频
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', // 文档
        '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', // 文本
        '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', // 压缩文件
        '.iso', '.img' // 镜像文件
    ];
    
    const fileExtension = path.extname(filename).toLowerCase();
    
    // 如果在黑名单中，直接拒绝
    if (dangerousExtensions.includes(fileExtension)) {
        return { safe: false, reason: '文件类型在危险文件黑名单中' };
    }
    
    // 如果在白名单中，允许
    if (safeExtensions.includes(fileExtension)) {
        return { safe: true };
    }
    
    // 不在白名单中的文件，根据MIME类型进一步检查
    return { safe: false, reason: '文件类型不在安全文件白名单中' };
};

module.exports = {
    readJSON,
    writeJSON,
    calculateFileHash,
    isFileTypeSafe,
    DATA_DIR,
    FILES_ROOT
};