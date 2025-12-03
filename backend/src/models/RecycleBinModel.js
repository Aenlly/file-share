const BaseModel = require('./BaseModel');

/**
 * 回收站模型
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
            deletedAt: new Date().toISOString(),
            originalFileId: fileRecord.id
        };
        
        // 删除原ID，让回收站生成新ID
        delete recycleBinRecord.id;
        
        return await this.insert(recycleBinRecord);
    }

    /**
     * 查询用户的回收站文件
     */
    async findByOwner(owner) {
        const files = await this.find({ owner });
        
        return files.map(file => {
            const result = { ...file };
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
        
        // 从回收站删除
        await this.delete(recycleBinId);
        
        return restoredFile;
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
