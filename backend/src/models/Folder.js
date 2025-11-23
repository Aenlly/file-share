const fs = require('fs-extra');
const path = require('path');
const { FILES_ROOT } = require('../utils/fileHelpers');

// 确保JSON文件使用UTF-8编码读写
const readJSON_UTF8 = (filename) => {
    const filePath = path.join(__dirname, '../../data', filename);
    if (!fs.existsSync(filePath)) {
        writeJSON_UTF8(filename, []);
        return [];
    }
    try {
        // 先读取为Buffer，然后转换为UTF-8字符串
        const buffer = fs.readFileSync(filePath);
        const data = buffer.toString('utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`读取JSON文件失败: ${filename}`, error);
        return [];
    }
};

const writeJSON_UTF8 = (filename, data) => {
    const filePath = path.join(__dirname, '../../data', filename);
    fs.ensureDirSync(path.dirname(filePath));
    
    // 确保JSON字符串使用UTF-8编码
    const jsonString = JSON.stringify(data, null, 2);
    
    // 使用Buffer确保UTF-8编码
    const buffer = Buffer.from(jsonString, 'utf8');
    fs.writeFileSync(filePath, buffer);
};

class Folder {
    static getAll() {
        return readJSON_UTF8('folders.json');
    }
    
    static findById(id) {
        const folders = this.getAll();
        return folders.find(f => f.id === id);
    }
    
    static findByOwner(owner) {
        const folders = this.getAll();
        return folders.filter(f => f.owner === owner);
    }
    
    static findByParentId(parentId, owner) {
        const folders = this.getAll();
        return folders.filter(f => f.parentId === parentId && f.owner === owner);
    }
    
    static getFolderHierarchy(owner) {
        const folders = this.findByOwner(owner);
        const folderMap = {};
        const rootFolders = [];
        
        // 创建文件夹映射
        folders.forEach(folder => {
            folderMap[folder.id] = { ...folder, children: [] };
        });
        
        // 构建层级结构
        folders.forEach(folder => {
            if (folder.parentId && folderMap[folder.parentId]) {
                folderMap[folder.parentId].children.push(folderMap[folder.id]);
            } else {
                rootFolders.push(folderMap[folder.id]);
            }
        });
        
        return rootFolders;
    }
    
    static create(folderData) {
        const folders = this.getAll();
        
        // 如果有父文件夹，获取父文件夹信息
        let parentPhysicalPath = '';
        if (folderData.parentId) {
            const parentFolder = folders.find(f => f.id === folderData.parentId && f.owner === folderData.owner);
            if (!parentFolder) {
                throw new Error('父文件夹不存在或无权访问');
            }
            parentPhysicalPath = parentFolder.physicalPath + '/';
        } else {
            // 只有根文件夹需要添加用户名前缀
            parentPhysicalPath = folderData.owner + '/';
        }
        
        const physicalPath = `${parentPhysicalPath}${Date.now()}`;
        const fullPath = path.join(FILES_ROOT, physicalPath);
        fs.ensureDirSync(fullPath);
        
        const newFolder = {
            id: Date.now(),
            alias: folderData.alias,
            physicalPath,
            owner: folderData.owner,
            parentId: folderData.parentId || null
        };
        
        folders.push(newFolder);
        writeJSON_UTF8('folders.json', folders);
        
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
        writeJSON_UTF8('folders.json', remainingFolders);
        
        return folder;
    }
}

module.exports = Folder;