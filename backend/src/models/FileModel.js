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
        try {
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
        } catch (error) {
            console.error(`FileModel.findByFolder失败: folderId=${folderId}`, error);
            // 如果是系统繁忙错误，直接抛出
            if (error.message.includes('繁忙') || error.message.includes('重试')) {
                throw error;
            }
            throw new Error(`获取文件列表失败，请刷新页面重试`);
        }
    }



    /**
     * 根据原始文件名查询
     */
    async findByOriginalName(originalName, folderId) {
        try {
            return await this.findOne({ originalName, folderId });
        } catch (error) {
            console.error(`FileModel.findByOriginalName失败: originalName=${originalName}, folderId=${folderId}`, error);
            throw new Error(`查询文件失败: ${error.message}`);
        }
    }

    /**
     * 根据保存的文件名查询
     */
    async findBySavedName(savedName, folderId) {
        try {
            return await this.findOne({ savedName, folderId });
        } catch (error) {
            console.error(`FileModel.findBySavedName失败: savedName=${savedName}, folderId=${folderId}`, error);
            throw new Error(`查询文件失败: ${error.message}`);
        }
    }

    /**
     * 根据文件哈希查询（在指定文件夹中）
     */
    async findByHash(hash, folderId) {
        try {
            return await this.findOne({ hash, folderId });
        } catch (error) {
            console.error(`FileModel.findByHash失败: hash=${hash}, folderId=${folderId}`, error);
            throw new Error(`查询文件失败: ${error.message}`);
        }
    }

    /**
     * 根据文件哈希查询（在所有文件夹中）
     */
    async findByHashGlobal(hash, owner) {
        try {
            return await this.findOne({ hash, owner });
        } catch (error) {
            console.error(`FileModel.findByHashGlobal失败: hash=${hash}, owner=${owner}`, error);
            throw new Error(`查询文件失败: ${error.message}`);
        }
    }

    /**
     * 创建文件记录
     */
    async create(fileData) {
        try {
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
        } catch (error) {
            console.error(`FileModel.create失败: originalName=${fileData.originalName}`, error);
            // 如果是系统繁忙错误，直接抛出
            if (error.message.includes('繁忙') || error.message.includes('重试')) {
                throw error;
            }
            throw new Error(`文件上传失败，请重试`);
        }
    }

    /**
     * 删除文件（物理删除）
     */
    async delete(id, owner) {
        const file = await this.findById(id);
        
        if (!file || file.owner !== owner) {
            throw new Error('无权删除');
        }

        return await super.delete(id);
    }

    /**
     * 批量删除文件（移至回收站）
     */
    async batchMoveToRecycleBin(filenames, folderId, owner) {
        const RecycleBinModel = require('./RecycleBinModel');
        
        const files = await this.findByFolder(folderId);
        const toDelete = files.filter(f => 
            filenames.includes(f.savedName) || filenames.includes(f.originalName)
        );

        const movedFiles = [];
        const errorFiles = [];

        for (const file of toDelete) {
            try {
                if (file.owner !== owner) {
                    throw new Error('无权删除');
                }
                
                // 移至回收站
                await RecycleBinModel.moveToRecycleBin(file);
                
                // 从文件表删除
                await super.delete(file.id);
                
                movedFiles.push({
                    originalName: file.originalName,
                    savedName: file.savedName,
                    deleteType: 'logical'
                });
            } catch (error) {
                errorFiles.push({
                    filename: file.originalName,
                    error: error.message
                });
            }
        }

        return { deletedFiles: movedFiles, errorFiles };
    }

    /**
     * 根据文件夹删除所有文件
     */
    async deleteByFolder(folderId) {
        return await this.deleteMany({ folderId });
    }
}

module.exports = new FileModel();
