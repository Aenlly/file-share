const BaseModel = require('./BaseModel');
const config = require('../config');

/**
 * 分享模型
 */
class ShareModel extends BaseModel {
    constructor() {
        super('shares');
    }

    /**
     * 根据访问码查询
     */
    async findByCode(code) {
        return await this.findOne({ code });
    }

    /**
     * 根据所有者查询
     */
    async findByOwner(owner) {
        return await this.find({ owner });
    }

    /**
     * 根据文件夹ID查询
     */
    async findByFolderId(folderId) {
        return await this.find({ folderId });
    }

    /**
     * 生成唯一访问码
     */
    _generateAccessCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        
        for (let i = 0; i < config.shareCodeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return code;
    }

    /**
     * 创建分享
     */
    async create(shareData) {
        // 生成唯一访问码
        let code = this._generateAccessCode();
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const existing = await this.findByCode(code);
            if (!existing) {
                break;
            }
            code = this._generateAccessCode();
            attempts++;
        }

        if (attempts >= maxAttempts) {
            throw new Error('无法生成唯一访问码');
        }

        const expireTime = Date.now() + (shareData.expireInMs || 86400000);

        return await this.insert({
            code,
            folderId: shareData.folderId,
            owner: shareData.owner,
            expireTime
        });
    }

    /**
     * 更新分享过期时间
     */
    async updateExpireTime(id, expireInMs) {
        const expireTime = Date.now() + expireInMs;
        return await this.update(id, { expireTime });
    }

    /**
     * 删除所有者的分享
     */
    async deleteByOwner(owner) {
        return await this.deleteMany({ owner });
    }

    /**
     * 删除文件夹的分享
     */
    async deleteByFolderId(folderId) {
        return await this.deleteMany({ folderId });
    }

    /**
     * 获取分享信息（包含文件夹信息）
     */
    async getWithFolderInfo(owner) {
        const shares = await this.findByOwner(owner);
        const FolderModel = require('./FolderModel');
        const folders = await FolderModel.getAll();

        return shares.map(share => {
            const folder = folders.find(f => f.id === share.folderId);
            return {
                ...share,
                folderAlias: folder ? folder.alias : '未知文件夹',
                isExpired: Date.now() > share.expireTime,
                remainingTime: Math.max(0, share.expireTime - Date.now())
            };
        });
    }

    /**
     * 验证分享是否有效
     */
    async validateShare(code) {
        const share = await this.findByCode(code);
        
        if (!share) {
            return { valid: false, reason: '分享链接不存在' };
        }

        if (Date.now() > share.expireTime) {
            return { valid: false, reason: '分享链接已过期' };
        }

        return { valid: true, share };
    }
}

module.exports = new ShareModel();
