const BaseModel = require('./BaseModel');

/**
 * 文件模型
 */
class FileModel extends BaseModel {
    constructor() {
        super('files');
    }

    /**
     * 根据文件夹ID查询
     */
    async findByFolder(folderId) {
        const files = await this.find({ folderId });
        // 为了兼容前端，添加name字段
        return files.map(file => {
            const result = { ...file };
            // 确保name字段存在
            if (!result.name && result.originalName) {
                result.name = result.originalName;
            }
            // 确保mtime字段存在
            if (!result.mtime && result.uploadTime) {
                result.mtime = result.uploadTime;
            }
            return result;
        });
    }

    /**
     * 根据原始文件名查询
     */
    async findByOriginalName(originalName, folderId) {
        return await this.findOne({ originalName, folderId });
    }

    /**
     * 根据保存的文件名查询
     */
    async findBySavedName(savedName, folderId) {
        return await this.findOne({ savedName, folderId });
    }

    /**
     * 根据文件哈希查询（在指定文件夹中）
     */
    async findByHash(hash, folderId) {
        return await this.findOne({ hash, folderId });
    }

    /**
     * 根据文件哈希查询（在所有文件夹中）
     */
    async findByHashGlobal(hash, owner) {
        return await this.findOne({ hash, owner });
    }

    /**
     * 创建文件记录
     */
    async create(fileData) {
        const uploadTime = new Date().toISOString();
        const record = await this.insert({
            folderId: fileData.folderId,
            originalName: fileData.originalName,
            savedName: fileData.savedName,
            size: fileData.size,
            mimeType: fileData.mimeType,
            owner: fileData.owner,
            hash: fileData.hash || null,   // 文件哈希值（MD5）
            uploadTime: uploadTime,
            name: fileData.originalName,  // 直接存储name字段
            mtime: uploadTime              // 直接存储mtime字段
        });
        
        return record;
    }

    /**
     * 删除文件
     */
    async delete(id, owner) {
        const file = await this.findById(id);
        
        if (!file || file.owner !== owner) {
            throw new Error('无权删除');
        }

        return await super.delete(id);
    }

    /**
     * 批量删除文件
     */
    async batchDelete(filenames, folderId, owner) {
        const files = await this.findByFolder(folderId);
        const toDelete = files.filter(f => 
            filenames.includes(f.savedName) || filenames.includes(f.originalName)
        );

        const deleteIds = toDelete.map(f => f.id);
        const deletedFiles = [];
        const errorFiles = [];

        for (const id of deleteIds) {
            try {
                await this.delete(id, owner);
                const file = toDelete.find(f => f.id === id);
                deletedFiles.push({
                    originalName: file.originalName,
                    savedName: file.savedName
                });
            } catch (error) {
                const file = toDelete.find(f => f.id === id);
                errorFiles.push({
                    filename: file.originalName,
                    error: error.message
                });
            }
        }

        return { deletedFiles, errorFiles };
    }

    /**
     * 根据文件夹删除所有文件
     */
    async deleteByFolder(folderId) {
        return await this.deleteMany({ folderId });
    }
}

module.exports = new FileModel();
