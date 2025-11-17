const fs = require('fs-extra');
const path = require('path');
const { readJSON, writeJSON, FILES_ROOT } = require('../utils/fileHelpers');

class Folder {
    static getAll() {
        return readJSON('folders.json');
    }
    
    static findById(id) {
        const folders = this.getAll();
        return folders.find(f => f.id === id);
    }
    
    static findByOwner(owner) {
        const folders = this.getAll();
        return folders.filter(f => f.owner === owner);
    }
    
    static create(folderData) {
        const folders = this.getAll();
        
        const physicalPath = `${folderData.owner}/${Date.now()}`;
        const fullPath = path.join(FILES_ROOT, physicalPath);
        fs.ensureDirSync(fullPath);
        
        const newFolder = {
            id: Date.now(),
            alias: folderData.alias,
            physicalPath,
            owner: folderData.owner
        };
        
        folders.push(newFolder);
        writeJSON('folders.json', folders);
        
        return newFolder;
    }
    
    static delete(id, owner) {
        const folders = this.getAll();
        const folder = folders.find(f => f.id === id && f.owner === owner);
        
        if (!folder) {
            throw new Error('无权删除');
        }
        
        // 删除物理文件夹
        const folderPath = path.join(FILES_ROOT, folder.physicalPath);
        if (fs.existsSync(folderPath)) {
            fs.removeSync(folderPath);
        }
        
        // 从列表中删除
        const remainingFolders = folders.filter(f => f.id !== id);
        writeJSON('folders.json', remainingFolders);
        
        return folder;
    }
}

module.exports = Folder;