const FileModel = require('../models/FileModel');
const RecycleBinModel = require('../models/RecycleBinModel');
const FolderModel = require('../models/FolderModel');
const logger = require('./logger');

/**
 * 存储计算工具
 * 计算用户的存储使用情况
 */

/**
 * 计算用户的总存储使用量（文件夹 + 回收站）
 */
async function calculateUserStorage(username) {
    try {
        // 1. 获取用户所有文件夹
        const folders = await FolderModel.findByOwner(username);
        const folderIds = folders.map(f => f.id);

        // 2. 计算文件夹中的文件大小
        let folderStorage = 0;
        for (const folderId of folderIds) {
            const files = await FileModel.findByFolder(folderId);
            folderStorage += files.reduce((sum, file) => sum + (file.size || 0), 0);
        }

        // 3. 计算回收站中的文件大小
        const recycleBinItems = await RecycleBinModel.findByOwner(username);
        const recycleBinStorage = recycleBinItems.reduce((sum, item) => {
            return sum + (item.size || 0);
        }, 0);

        // 4. 总存储 = 文件夹存储 + 回收站存储
        const totalStorage = folderStorage + recycleBinStorage;

        return {
            totalStorage,
            folderStorage,
            recycleBinStorage,
            fileCount: folderIds.length > 0 ? 
                (await Promise.all(folderIds.map(id => FileModel.findByFolder(id)))).flat().length : 0,
            recycleBinCount: recycleBinItems.length
        };
    } catch (error) {
        logger.error(`计算用户存储失败: ${username}`, error);
        throw error;
    }
}

/**
 * 格式化存储大小
 */
function formatStorageSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i];
}

/**
 * 解析存储大小字符串为字节数
 */
function parseStorageSize(sizeStr) {
    if (typeof sizeStr === 'number') return sizeStr;
    
    const units = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024
    };
    
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
    if (!match) {
        throw new Error('无效的存储大小格式');
    }
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    if (!units[unit]) {
        throw new Error('无效的存储单位');
    }
    
    return Math.floor(value * units[unit]);
}

/**
 * 更新用户存储使用量
 */
async function updateUserStorageUsage(username) {
    try {
        const UserModel = require('../models/UserModel');
        const storageInfo = await calculateUserStorage(username);
        
        await UserModel.updateStorageUsed(username, storageInfo.totalStorage);
        
        logger.info(`更新用户存储: ${username}, 总计: ${formatStorageSize(storageInfo.totalStorage)}`);
        
        return storageInfo;
    } catch (error) {
        logger.error(`更新用户存储失败: ${username}`, error);
        throw error;
    }
}

/**
 * 批量更新所有用户的存储使用量
 */
async function updateAllUsersStorage() {
    try {
        const UserModel = require('../models/UserModel');
        const users = await UserModel.getAll();
        
        const results = [];
        for (const user of users) {
            try {
                const storageInfo = await updateUserStorageUsage(user.username);
                results.push({
                    username: user.username,
                    success: true,
                    storage: storageInfo
                });
            } catch (error) {
                results.push({
                    username: user.username,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    } catch (error) {
        logger.error('批量更新用户存储失败', error);
        throw error;
    }
}

module.exports = {
    calculateUserStorage,
    formatStorageSize,
    parseStorageSize,
    updateUserStorageUsage,
    updateAllUsersStorage
};
