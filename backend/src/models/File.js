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
        console.log(`查找文件: originalName=${originalName}, folderId=${folderId}`);
        console.log(`所有文件:`, files.map(f => ({
            id: f.id,
            originalName: f.originalName,
            folderId: f.folderId
        })));
        
        const foundFile = files.find(f => 
            f.originalName === originalName && f.folderId === folderId
        );
        
        if (foundFile) {
            console.log(`找到文件: ${foundFile.originalName}`);
        } else {
            console.log(`未找到文件: originalName=${originalName}, folderId=${folderId}`);
        }
        
        return foundFile;
    }
    
    static findBySavedName(savedName, folderId) {
        const files = this.getAll();
        console.log(`查找文件: savedName=${savedName}, folderId=${folderId}`);
        console.log(`所有文件:`, files.map(f => ({
            id: f.id,
            savedName: f.savedName,
            folderId: f.folderId
        })));
        
        const foundFile = files.find(f => 
            f.savedName === savedName && f.folderId === folderId
        );
        
        if (foundFile) {
            console.log(`找到文件: ${foundFile.savedName}`);
        } else {
            console.log(`未找到文件: savedName=${savedName}, folderId=${folderId}`);
        }
        
        return foundFile;
    }
    
    static create(fileData) {
        const files = this.getAll();
        
        // 确保文件名使用UTF-8编码
        let originalName = fileData.originalName;
        try {
            // 如果文件名是Buffer，转换为UTF-8字符串
            if (Buffer.isBuffer(originalName)) {
                originalName = originalName.toString('utf8');
            }
            // 如果文件名包含非ASCII字符，尝试修复编码
            else if (/[^\\x00-\\x7F]/.test(originalName)) {
                // 检查是否已经是正确的UTF-8
                try {
                    // 尝试将字符串编码为Buffer再解码，验证是否为有效UTF-8
                    const testBuffer = Buffer.from(originalName, 'utf8');
                    const testString = testBuffer.toString('utf8');
                    if (testString === originalName) {
                        // 已经是有效的UTF-8，不需要转换
                        originalName = testString;
                    } else {
                        // 可能是其他编码被错误解释为UTF-8，尝试修复
                        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
                    }
                } catch (e) {
                    // 如果验证失败，尝试修复
                    try {
                        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
                    } catch (e2) {
                        // 如果还是失败，保持原样
                        console.warn('无法修复文件名编码:', originalName);
                    }
                }
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
            // 首先尝试通过保存的名称查找
            let file = files.find(f => 
                f.savedName === savedName && 
                f.folderId === folderId && 
                f.owner === owner
            );
            
            // 如果找不到，尝试通过原始名称查找
            if (!file) {
                file = files.find(f => 
                    f.originalName === savedName && 
                    f.folderId === folderId && 
                    f.owner === owner
                );
            }
            
            // 如果还是找不到，尝试多种方式匹配文件名
            if (!file) {
                // 获取文件夹中的所有文件
                const folderFiles = files.filter(f => 
                    f.folderId === folderId && 
                    f.owner === owner
                );
                
                file = folderFiles.find(f => {
                    // 直接比较
                    if (f.originalName === savedName) return true;
                    
                    // 尝试解码后比较
                    try {
                        if (decodeURIComponent(f.originalName) === savedName) return true;
                    } catch (e) {
                        // 忽略解码错误
                    }
                    
                    // 尝试使用latin1解码
                    try {
                        const decodedName = Buffer.from(f.originalName, 'latin1').toString('utf8');
                        if (decodedName === savedName) return true;
                    } catch (e) {
                        // 忽略解码错误
                    }
                    
                    return false;
                });
            }
            
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