const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

const { authenticate } = require('../middleware/auth');
const { canAccessResource } = require('../middleware/permission');
const logger = require('../utils/logger');
const RecycleBinModel = require('../models/RecycleBinModel');
const FolderModel = require('../models/FolderModel');
const FileModel = require('../models/FileModel');
const { FILES_ROOT } = require('../utils/fileHelpers');
const { sendError } = require('../config/errorCodes');

/**
 * 生成唯一的文件夹名称
 * 如果文件夹名已存在，添加序号 (1), (2), (3)...
 */
async function generateUniqueFolderName(baseName, owner, parentId) {
    const existingFolders = await FolderModel.find({ owner, parentId });
    const existingNames = existingFolders.map(f => f.alias);
    
    if (!existingNames.includes(baseName)) {
        return baseName;
    }
    
    let counter = 1;
    let newName = `${baseName}(${counter})`;
    while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName}(${counter})`;
    }
    
    return newName;
}

/**
 * 查找或创建父文件夹
 * 返回父文件夹ID，如果不存在则创建
 */
async function findOrCreateParentFolder(folderInfo, owner) {
    // 如果没有父文件夹信息，返回 null
    if (!folderInfo.folderParentId && !folderInfo.parentFolderPhysicalPath) {
        return null;
    }
    
    // 1. 尝试通过父文件夹ID查找
    if (folderInfo.folderParentId) {
        const parentById = await FolderModel.findById(folderInfo.folderParentId);
        if (parentById && parentById.owner === owner) {
            return parentById.id;
        }
    }
    
    // 2. 尝试通过父文件夹物理路径查找
    if (folderInfo.parentFolderPhysicalPath) {
        const allFolders = await FolderModel.find({ owner });
        const parentByPath = allFolders.find(f => f.physicalPath === folderInfo.parentFolderPhysicalPath);
        if (parentByPath) {
            return parentByPath.id;
        }
        
        // 3. 父文件夹不存在，需要创建
        // 查找回收站中是否有父文件夹的记录
        const allRecycleItems = await RecycleBinModel.find({ owner });
        const parentRecycle = allRecycleItems.find(item => 
            item.itemType === 'folder' && 
            item.folderPhysicalPath === folderInfo.parentFolderPhysicalPath
        );
        
        if (parentRecycle) {
            // 递归创建父文件夹
            const grandParentId = await findOrCreateParentFolder(parentRecycle, owner);
            const parentFolder = await FolderModel.create({
                alias: parentRecycle.folderAlias || folderInfo.parentFolderAlias || '未命名文件夹',
                owner,
                parentId: grandParentId
            });
            logger.info(`自动创建父文件夹: ${parentFolder.alias}, ID=${parentFolder.id}`);
            return parentFolder.id;
        }
    }
    
    return null;
}

/**
 * 查找或创建文件夹
 * 返回 { folder, isNew } - isNew 表示是否是新创建的
 */
async function findOrCreateFolder(folderInfo, owner) {
    // 1. 尝试通过原ID查找
    if (folderInfo.originalFolderId) {
        const existingById = await FolderModel.findById(folderInfo.originalFolderId);
        if (existingById && existingById.owner === owner) {
            return { folder: existingById, isNew: false };
        }
    }
    
    // 2. 尝试通过物理路径查找
    if (folderInfo.folderPhysicalPath) {
        const allFolders = await FolderModel.find({ owner });
        const existingByPath = allFolders.find(f => f.physicalPath === folderInfo.folderPhysicalPath);
        if (existingByPath) {
            return { folder: existingByPath, isNew: false };
        }
    }
    
    // 3. 文件夹不存在，需要创建
    // 先处理父文件夹（递归创建）
    const parentFolderId = await findOrCreateParentFolder(folderInfo, owner);
    
    // 创建新文件夹
    const newFolder = await FolderModel.create({
        alias: folderInfo.folderAlias,
        owner,
        parentId: parentFolderId
    });
    
    logger.info(`自动创建文件夹: ${folderInfo.folderAlias}, ID=${newFolder.id}, 父ID=${parentFolderId}`);
    return { folder: newFolder, isNew: true };
}

/**
 * 获取回收站文件列表
 */
router.get('/', authenticate, canAccessResource('recycle', 'view'), async (req, res, next) => {
    try {
        const files = await RecycleBinModel.findByOwner(req.user.username);
        
        logger.info(`获取回收站文件列表: user=${req.user.username}, count=${files.length}`);
        
        res.json({
            success: true,
            data: files
        });
    } catch (error) {
        logger.error('获取回收站文件列表失败:', error);
        next(error);
    }
});

/**
 * 恢复回收站项目（文件或文件夹）
 */
router.post('/restore/:itemId', authenticate, canAccessResource('recycle', 'restore'), async (req, res, next) => {
    try {
        const itemId = parseInt(req.params.itemId);
        
        const recycleBinItem = await RecycleBinModel.findById(itemId);
        if (!recycleBinItem) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        // 检查权限
        if (!req.canManageAll && recycleBinItem.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        // 根据类型进行不同的还原操作
        if (recycleBinItem.itemType === 'folder') {
            // 还原文件夹
            const { folder, files } = await RecycleBinModel.restoreFolder(itemId);
            
            // 检查文件夹是否已存在
            let targetFolder = null;
            let folderExists = false;
            
            // 1. 尝试通过原ID查找
            if (folder.originalFolderId) {
                targetFolder = await FolderModel.findById(folder.originalFolderId);
                if (targetFolder && targetFolder.owner === folder.owner) {
                    folderExists = true;
                }
            }
            
            // 2. 如果通过ID没找到，尝试通过物理路径查找
            if (!folderExists && folder.folderPhysicalPath) {
                const allFolders = await FolderModel.find({ owner: folder.owner });
                targetFolder = allFolders.find(f => f.physicalPath === folder.folderPhysicalPath);
                if (targetFolder) {
                    folderExists = true;
                }
            }
            
            if (folderExists) {
                // 文件夹已存在，创建一个带序号的新文件夹
                // 使用递归查找或创建父文件夹
                const parentFolderId = await findOrCreateParentFolder(folder, folder.owner);
                
                const uniqueName = await generateUniqueFolderName(
                    folder.folderAlias, 
                    folder.owner, 
                    parentFolderId
                );
                
                const newFolder = await FolderModel.create({
                    alias: uniqueName,
                    owner: folder.owner,
                    parentId: parentFolderId
                });
                
                // 将文件恢复到新文件夹
                for (const file of files) {
                    await FileModel.insert({
                        ...file,
                        folderId: newFolder.id
                    });
                }
                
                logger.info(`文件夹已存在，创建新文件夹: ${uniqueName}, ID=${newFolder.id}, 父ID=${parentFolderId}, 文件数=${files.length}`);
                res.json({ 
                    success: true, 
                    message: `文件夹已恢复为"${uniqueName}"（包含 ${files.length} 个文件）` 
                });
            } else {
                // 文件夹不存在，创建原名称的文件夹
                // 使用递归查找或创建父文件夹
                const parentFolderId = await findOrCreateParentFolder(folder, folder.owner);
                
                const newFolder = await FolderModel.create({
                    alias: folder.folderAlias,
                    owner: folder.owner,
                    parentId: parentFolderId
                });
                
                // 将文件恢复到新文件夹
                for (const file of files) {
                    await FileModel.insert({
                        ...file,
                        folderId: newFolder.id
                    });
                }
                
                logger.info(`恢复文件夹: ${folder.folderAlias}, ID=${newFolder.id}, 父ID=${parentFolderId}, 文件数=${files.length}`);
                res.json({ 
                    success: true, 
                    message: `文件夹已恢复（包含 ${files.length} 个文件）` 
                });
            }
        } else {
            // 还原单个文件
            let targetFolder = null;
            
            // 1. 先尝试通过ID查找文件夹
            targetFolder = await FolderModel.findById(recycleBinItem.folderId);
            
            // 2. 如果通过ID找不到，查找回收站中的文件夹记录
            if (!targetFolder) {
                const allRecycleItems = await RecycleBinModel.find({ owner: recycleBinItem.owner });
                const folderRecycle = allRecycleItems.find(item => 
                    item.itemType === 'folder' && item.originalFolderId === recycleBinItem.folderId
                );
                
                if (folderRecycle) {
                    // 找到了文件夹的回收记录，使用辅助函数查找或创建
                    const result = await findOrCreateFolder(folderRecycle, recycleBinItem.owner);
                    targetFolder = result.folder;
                } else {
                    return sendError(res, 'FOLDER_NOT_FOUND', '原文件夹不存在且无法自动创建');
                }
            }
            
            // 恢复文件
            await FileModel.insert({
                originalName: recycleBinItem.originalName,
                savedName: recycleBinItem.savedName,
                size: recycleBinItem.size,
                mimeType: recycleBinItem.mimeType,
                folderId: targetFolder.id,
                owner: recycleBinItem.owner,
                hash: recycleBinItem.hash
            });

            // 从回收站删除
            await RecycleBinModel.delete(itemId);

            logger.info(`恢复文件: ${recycleBinItem.originalName} 到文件夹 ${targetFolder.id}`);
            res.json({ success: true, message: '文件恢复成功' });
        }
    } catch (error) {
        logger.error('恢复失败:', error);
        next(error);
    }
});

/**
 * 清空回收站
 */
router.delete('/clear', authenticate, canAccessResource('recycle', 'delete'), async (req, res, next) => {
    try {
        const files = await RecycleBinModel.findByOwner(req.user.username);
        
        let deletedCount = 0;
        let errorCount = 0;
        let totalSize = 0;

        const UserModel = require('../models/UserModel');

        for (const file of files) {
            try {
                const folder = await FolderModel.findById(file.folderId);
                if (folder) {
                    const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
                    if (await fs.pathExists(filePath)) {
                        await fs.remove(filePath);
                    }
                }
                
                await RecycleBinModel.delete(file.id);
                totalSize += file.size || 0;
                deletedCount++;
            } catch (error) {
                logger.error(`删除文件失败: ${file.originalName}`, error);
                errorCount++;
            }
        }

        // 减少用户存储使用量
        if (totalSize > 0) {
            await UserModel.decrementStorageUsed(req.user.username, totalSize);
        }

        logger.info(`清空回收站: user=${req.user.username}, 成功=${deletedCount}, 失败=${errorCount}, 释放空间=${totalSize}`);
        
        res.json({ 
            success: true, 
            message: `清空回收站成功，删除 ${deletedCount} 个文件`,
            deletedCount,
            errorCount
        });
    } catch (error) {
        logger.error('清空回收站失败:', error);
        next(error);
    }
});

/**
 * 从回收站永久删除文件
 */
router.delete('/:fileId', authenticate, canAccessResource('recycle', 'delete'), async (req, res, next) => {
    try {
        const fileId = parseInt(req.params.fileId);
        
        const recycleBinFile = await RecycleBinModel.findById(fileId);
        if (!recycleBinFile) {
            return sendError(res, 'FILE_NOT_FOUND');
        }

        // 检查权限
        if (!req.canManageAll && recycleBinFile.owner !== req.user.username) {
            return sendError(res, 'AUTH_FORBIDDEN');
        }

        // 删除物理文件
        const folder = await FolderModel.findById(recycleBinFile.folderId);
        if (folder) {
            const filePath = path.join(FILES_ROOT, folder.physicalPath, recycleBinFile.savedName);
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
                logger.info(`删除物理文件: ${filePath}`);
            }
        }

        // 从回收站删除记录
        await RecycleBinModel.delete(fileId);

        // 减少用户存储使用量
        const UserModel = require('../models/UserModel');
        await UserModel.decrementStorageUsed(recycleBinFile.owner, recycleBinFile.size);

        logger.info(`永久删除文件: ${recycleBinFile.originalName}, size=${recycleBinFile.size}`);
        
        res.json({ success: true, message: '文件已永久删除' });
    } catch (error) {
        logger.error('永久删除文件失败:', error);
        next(error);
    }
});

module.exports = router;
