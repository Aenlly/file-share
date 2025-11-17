const { readJSON, writeJSON } = require('../utils/fileHelpers');

class Share {
    static getAll() {
        return readJSON('shares.json');
    }
    
    static findByCode(code) {
        const shares = this.getAll();
        return shares.find(s => s.code === code);
    }
    
    static findByOwner(owner) {
        const shares = this.getAll();
        return shares.filter(s => s.owner === owner);
    }
    
    static findByFolderId(folderId) {
        const shares = this.getAll();
        return shares.filter(s => s.folderId === folderId);
    }
    
    static create(shareData) {
        const shares = this.getAll();
        
        // 生成随机访问码
        const code = Math.random().toString(36).substr(2, 6).toUpperCase();
        const expireTime = Date.now() + (shareData.expireInMs || 86400000); // 默认24小时
        
        const newShare = {
            id: Date.now(),
            code,
            folderId: shareData.folderId,
            owner: shareData.owner,
            expireTime
        };
        
        shares.push(newShare);
        writeJSON('shares.json', shares);
        
        return { code, expireTime: new Date(expireTime).toISOString() };
    }
    
    static update(id, updateData) {
        const shares = this.getAll();
        const shareIndex = shares.findIndex(s => s.id === id);
        
        if (shareIndex === -1) {
            throw new Error('分享链接不存在');
        }
        
        if (updateData.expireInMs) {
            shares[shareIndex].expireTime = Date.now() + updateData.expireInMs;
        }
        
        writeJSON('shares.json', shares);
        
        return {
            expireTime: new Date(shares[shareIndex].expireTime).toISOString()
        };
    }
    
    static delete(id) {
        const shares = this.getAll();
        const shareIndex = shares.findIndex(s => s.id === id);
        
        if (shareIndex === -1) {
            throw new Error('分享链接不存在');
        }
        
        shares.splice(shareIndex, 1);
        writeJSON('shares.json', shares);
        
        return true;
    }
    
    static deleteByOwner(owner) {
        const shares = this.getAll();
        const remainingShares = shares.filter(s => s.owner !== owner);
        writeJSON('shares.json', remainingShares);
        return true;
    }
    
    static deleteByFolderId(folderId) {
        const shares = this.getAll();
        const remainingShares = shares.filter(s => s.folderId !== folderId);
        writeJSON('shares.json', remainingShares);
        return true;
    }
    
    static getWithFolderInfo(owner) {
        const shares = this.findByOwner(owner);
        const folders = readJSON('folders.json');
        
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
}

module.exports = Share;