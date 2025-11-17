const fs = require('fs-extra');
const path = require('path');
const { readJSON, writeJSON, FILES_ROOT } = require('../utils/fileHelpers');

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

class File {
    static getAll() {
        return readJSON_UTF8('files.json');
    }
    
    static findById(id) {
        const files = this.getAll();
        return files.find(f => f.id === id);
    }
    
    static findByFolder(folderId) {
        const files = this.getAll();
        return files.filter(f => f.folderId === folderId);
    }
    
    static findByOriginalName(originalName, folderId) {
        const files = this.getAll();
        return files.find(f => 
            f.originalName === originalName && f.folderId === folderId
        );
    }
    
    static findBySavedName(savedName, folderId) {
        const files = this.getAll();
        return files.find(f => 
            f.savedName === savedName && f.folderId === folderId
        );
    }
    
    static create(fileData) {
        const files = this.getAll();
        
        // 确保文件名使用UTF-8编码
        let originalName = fileData.originalName;
        try {
            // 如果文件名是Buffer，转换为UTF-8字符串
            if (Buffer.isBuffer(fileData.originalName)) {
                originalName = fileData.originalName.toString('utf8');
            }
            // 如果文件名包含非ASCII字符，确保使用UTF-8编码
            else if (/[^\\x00-\\x7F]/.test(fileData.originalName)) {
                // 使用Buffer.from确保UTF-8编码
                originalName = Buffer.from(fileData.originalName, 'utf8').toString('utf8');
            }
        } catch (e) {
            console.error('文件名编码转换失败:', e);
            originalName = fileData.originalName;
        }
        
        const newFile = {
            id: Date.now(),
            folderId: fileData.folderId,
            originalName: originalName,
            savedName: fileData.savedName,
            size: fileData.size,
            mimeType: fileData.mimeType || 'application/octet-stream',
            uploadTime: new Date().toISOString(),
            owner: fileData.owner
        };
        
        files.push(newFile);
        writeJSON_UTF8('files.json', files);
        
        return newFile;
    }
    
    static delete(id, owner) {
        const files = this.getAll();
        const file = files.find(f => f.id === id && f.owner === owner);
        
        if (!file) {
            throw new Error('无权删除');
        }
        
        // 删除物理文件
        const folder = require('./Folder').findById(file.folderId);
        if (folder) {
            const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
            if (fs.existsSync(filePath)) {
                fs.removeSync(filePath);
            }
        }
        
        // 从列表中删除
        const remainingFiles = files.filter(f => f.id !== id);
        writeJSON_UTF8('files.json', remainingFiles);
        
        return file;
    }
    
    static deleteBySavedName(savedName, folderId, owner) {
        const files = this.getAll();
        const file = files.find(f => 
            f.savedName === savedName && 
            f.folderId === folderId && 
            f.owner === owner
        );
        
        if (!file) {
            throw new Error('文件不存在或无权删除');
        }
        
        // 删除物理文件
        const folder = require('./Folder').findById(file.folderId);
        if (folder) {
            const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
            if (fs.existsSync(filePath)) {
                fs.removeSync(filePath);
            }
        }
        
        // 从列表中删除
        const remainingFiles = files.filter(f => f.id !== file.id);
        writeJSON_UTF8('files.json', remainingFiles);
        
        return file;
    }
    
    static batchDelete(savedNames, folderId, owner) {
        const files = this.getAll();
        const filesToDelete = [];
        const errorFiles = [];
        
        for (const savedName of savedNames) {
            const file = files.find(f => 
                f.savedName === savedName && 
                f.folderId === folderId && 
                f.owner === owner
            );
            
            if (!file) {
                errorFiles.push({
                    filename: savedName,
                    error: '文件不存在或无权删除'
                });
                continue;
            }
            
            try {
                // 删除物理文件
                const folder = require('./Folder').findById(file.folderId);
                if (folder) {
                    const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
                    if (fs.existsSync(filePath)) {
                        fs.removeSync(filePath);
                    }
                }
                
                filesToDelete.push(file);
            } catch (error) {
                errorFiles.push({
                    filename: savedName,
                    error: error.message
                });
            }
        }
        
        // 从列表中删除
        const remainingFiles = files.filter(f => 
            !filesToDelete.some(df => df.id === f.id)
        );
        writeJSON_UTF8('files.json', remainingFiles);
        
        return {
            deletedFiles: filesToDelete.map(f => f.originalName),
            errorFiles
        };
    }
    
    static update(id, updateData, owner) {
        const files = this.getAll();
        const fileIndex = files.findIndex(f => f.id === id && f.owner === owner);
        
        if (fileIndex === -1) {
            throw new Error('文件不存在或无权修改');
        }
        
        // 更新文件信息
        files[fileIndex] = { ...files[fileIndex], ...updateData };
        writeJSON_UTF8('files.json', files);
        
        return files[fileIndex];
    }
}

module.exports = File;