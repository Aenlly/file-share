const crypto = require('crypto');
const fs = require('fs-extra');
const FolderModel = require('../../models/FolderModel');

/**
 * 计算文件的 MD5 哈希值（从 Buffer）
 * 注意：仅用于小文件（< 10MB），大文件请使用 calculateFileHashFromStream
 */
function calculateFileHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * 计算文件的 MD5 哈希值（流式处理，适合大文件）
 * @param {string|Buffer} input - 文件路径或 Buffer
 * @returns {Promise<string>} 哈希值
 */
function calculateFileHashFromStream(input) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        
        // 如果是 Buffer，直接计算
        if (Buffer.isBuffer(input)) {
            hash.update(input);
            resolve(hash.digest('hex'));
            return;
        }
        
        // 如果是文件路径，使用流式读取
        const stream = fs.createReadStream(input);
        
        stream.on('data', chunk => {
            hash.update(chunk);
        });
        
        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });
        
        stream.on('error', error => {
            reject(new Error(`计算文件哈希失败: ${error.message}`));
        });
    });
}

/**
 * 智能计算文件哈希（根据大小自动选择方法）
 * @param {Buffer} buffer - 文件 Buffer
 * @param {string} tempFilePath - 临时文件路径（可选）
 * @returns {Promise<string>} 哈希值
 */
async function calculateFileHashSmart(buffer, tempFilePath = null) {
    const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
    const VERY_LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
    
    // 超大文件：使用采样哈希（更快但不够精确）
    if (buffer.length > VERY_LARGE_FILE_THRESHOLD) {
        return calculateSampledHash(buffer);
    }
    
    // 小文件直接从内存计算
    if (buffer.length < LARGE_FILE_THRESHOLD) {
        return calculateFileHash(buffer);
    }
    
    // 大文件：先写入临时文件，再流式计算
    if (!tempFilePath) {
        const os = require('os');
        const path = require('path');
        tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }
    
    try {
        // 写入临时文件
        await fs.writeFile(tempFilePath, buffer);
        
        // 流式计算哈希
        const hash = await calculateFileHashFromStream(tempFilePath);
        
        // 删除临时文件
        await fs.remove(tempFilePath);
        
        return hash;
    } catch (error) {
        // 清理临时文件
        try {
            await fs.remove(tempFilePath);
        } catch (cleanupError) {
            // 忽略清理错误
        }
        throw error;
    }
}

/**
 * 采样哈希：对超大文件进行采样计算（更快）
 * 采样策略：文件头 + 文件中间 + 文件尾 + 文件大小
 * @param {Buffer} buffer - 文件内容
 * @returns {string} 哈希值
 */
function calculateSampledHash(buffer) {
    const hash = crypto.createHash('md5');
    const sampleSize = 1024 * 1024; // 每个采样点 1MB
    
    // 添加文件大小（防止不同大小文件产生相同哈希）
    hash.update(Buffer.from(buffer.length.toString()));
    
    // 采样文件头
    hash.update(buffer.slice(0, Math.min(sampleSize, buffer.length)));
    
    // 采样文件中间
    if (buffer.length > sampleSize * 2) {
        const middleStart = Math.floor(buffer.length / 2) - Math.floor(sampleSize / 2);
        hash.update(buffer.slice(middleStart, middleStart + sampleSize));
    }
    
    // 采样文件尾
    if (buffer.length > sampleSize) {
        hash.update(buffer.slice(-sampleSize));
    }
    
    return hash.digest('hex');
}

/**
 * 检查文件夹是否属于用户（包括子文件夹）
 */
async function isFolderOwnedByUser(folderId, username) {
    const folder = await FolderModel.findById(folderId);
    if (!folder) {
        return false;
    }

    // 检查是否是所有者
    if (folder.owner === username) {
        return true;
    }

    // 检查是否是子文件夹（通过遍历父文件夹链）
    let currentFolder = folder;
    const allFolders = await FolderModel.getAll();

    while (currentFolder.parentId) {
        const parentFolder = allFolders.find(f => f.id === currentFolder.parentId);
        if (!parentFolder) {
            break;
        }

        if (parentFolder.owner === username) {
            return true;
        }

        currentFolder = parentFolder;
    }

    return false;
}

module.exports = {
    calculateFileHash,
    calculateFileHashFromStream,
    calculateFileHashSmart,
    isFolderOwnedByUser
};
