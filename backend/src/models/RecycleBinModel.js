const BaseModel = require('./BaseModel');

/**
 * 回收站模型
 * 支持文件和文件夹的回收
 */
class RecycleBinModel extends BaseModel {
    constructor() {
        super('recycleBin');
    }

    /**
     * 将文件移至回收站
     */
    async moveToRecycleBin(fileRecord) {
        const recycleBinRecord = {
            ...fileRecord,
            itemType: 'file',  // 标记为文件
            deletedAt: new Date().toISOString(),
            originalFileId: fileRecord.id
        };
        
        // 删除原ID，让回收站生成新ID
        delete recycleBinRecord.id;
        
        return await this.insert(recycleBinRecord);
    }

    /**
     * 将文件夹移至回收站
     * @param {Object} folderRecord - 文件夹记录
     * @param {Array} files - 文件夹中的文件列表
     * @param {Object} parentFolder - 父文件夹记录（可选）
     */
    async moveFolderToRecycleBin(folderRecord, files = [], parentFolder = null) {
        const deletedAt = new Date().toISOString();
        const batchId = `folder_${folderRecord.id}_${Date.now()}`;
        
        // 创建文件夹回收记录，保存完整的文件夹信息
        const folderRecycleBinRecord = {
            itemType: 'folder',
            batchId,
            folderId: folderRecord.id,
            folderAlias: folderRecord.alias,
            folderPath: folderRecord.path,
            folderPhysicalPath: folderRecord.physicalPath,  // 保存物理路径
            folderParentId: folderRecord.parentId || null,  // 保存父文件夹ID
            owner: folderRecord.owner,
            fileCount: files.length,
            deletedAt,
            originalFolderId: folderRecord.id
        };
        
        // 如果有父文件夹，记录父文件夹的详细信息
        if (parentFolder) {
            folderRecycleBinRecord.parentFolderAlias = parentFolder.alias;
            folderRecycleBinRecord.parentFolderPhysicalPath = parentFolder.physicalPath;
        }
        
        const folderRecycleRecord = await this.insert(folderRecycleBinRecord);
        
        // 将文件夹中的所有文件也移至回收站，并关联到同一批次
        const fileRecords = [];
        for (const file of files) {
            const fileRecycleBinRecord = {
                ...file,
                itemType: 'file',
                batchId,  // 关联到文件夹删除批次
                parentRecycleId: folderRecycleRecord.id,  // 关联到父文件夹回收记录
                deletedAt,
                originalFileId: file.id
            };
            
            delete fileRecycleBinRecord.id;
            const record = await this.insert(fileRecycleBinRecord);
            fileRecords.push(record);
        }
        
        return {
            folder: folderRecycleRecord,
            files: fileRecords
        };
    }

    /**
     * 查询用户的回收站项目（文件和文件夹）
     * @param {string} owner - 所有者用户名
     * @param {string} itemType - 可选，过滤类型：'file' | 'folder'
     */
    async findByOwner(owner, itemType = null) {
        let items = await this.find({ owner });
        
        // 如果指定了类型，则过滤
        if (itemType) {
            items = items.filter(item => item.itemType === itemType);
        }
        
        // 只返回顶层项目（文件夹或独立文件，不包括文件夹内的文件）
        items = items.filter(item => {
            // 如果是文件夹，直接返回
            if (item.itemType === 'folder') return true;
            // 如果是文件，但没有 parentRecycleId，说明是独立删除的文件
            if (item.itemType === 'file' && !item.parentRecycleId) return true;
            // 其他情况（文件夹内的文件）不显示在列表中
            return false;
        });
        
        return items.map(item => {
            const result = { ...item };
            // 兼容旧数据
            if (!result.name && result.originalName) {
                result.name = result.originalName;
            }
            if (!result.mtime && result.uploadTime) {
                result.mtime = result.uploadTime;
            }
            return result;
        });
    }

    /**
     * 获取文件夹回收记录下的所有文件
     */
    async getFilesInFolderRecycle(parentRecycleId) {
        const files = await this.find({ parentRecycleId });
        return files;
    }

    /**
     * 查询过期的回收站文件（超过30天）
     */
    async findExpired(beforeDate) {
        const files = await this.find({});
        
        return files.filter(file => {
            return file.deletedAt && file.deletedAt < beforeDate;
        });
    }

    /**
     * 从回收站恢复文件
     */
    async restore(recycleBinId) {
        const file = await this.findById(recycleBinId);
        if (!file) {
            throw new Error('回收站文件不存在');
        }
        
        // 返回文件记录（不包含回收站特有字段）
        const restoredFile = { ...file };
        delete restoredFile.deletedAt;
        delete restoredFile.originalFileId;
        delete restoredFile.itemType;
        delete restoredFile.batchId;
        delete restoredFile.parentRecycleId;
        
        // 从回收站删除
        await this.delete(recycleBinId);
        
        return restoredFile;
    }

    /**
     * 从回收站恢复文件夹
     * @param {number} recycleBinId - 回收站中的文件夹ID
     * @returns {Object} 包含文件夹信息和文件列表
     */
    async restoreFolder(recycleBinId) {
        const folderRecord = await this.findById(recycleBinId);
        if (!folderRecord || folderRecord.itemType !== 'folder') {
            throw new Error('回收站文件夹不存在');
        }
        
        // 获取文件夹下的所有文件
        const files = await this.getFilesInFolderRecycle(recycleBinId);
        
        // 清理文件记录中的回收站特有字段
        const restoredFiles = files.map(file => {
            const restored = { ...file };
            delete restored.deletedAt;
            delete restored.originalFileId;
            delete restored.itemType;
            delete restored.batchId;
            delete restored.parentRecycleId;
            return restored;
        });
        
        // 从回收站删除文件夹记录
        await this.delete(recycleBinId);
        
        // 从回收站删除所有文件记录
        for (const file of files) {
            await this.delete(file.id);
        }
        
        return {
            folder: folderRecord,
            files: restoredFiles
        };
    }

    /**
     * 从回收站永久删除
     */
    async permanentDelete(recycleBinId, owner) {
        const file = await this.findById(recycleBinId);
        
        if (!file || file.owner !== owner) {
            throw new Error('无权删除');
        }
        
        return await this.delete(recycleBinId);
    }

    /**
     * 清空用户的回收站
     */
    async clearByOwner(owner) {
        const files = await this.find({ owner });
        const deletedIds = [];
        
        for (const file of files) {
            await this.delete(file.id);
            deletedIds.push(file.id);
        }
        
        return deletedIds;
    }
}

module.exports = new RecycleBinModel();
