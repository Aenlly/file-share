const fs = require('fs-extra');
const fsNative = require('fs');
const path = require('path');
const JSZip = require('jszip');
const Jimp = require('jimp');
const Folder = require('../models/Folder');
const File = require('../models/File');
const { calculateFileHash, isFileTypeSafe, FILES_ROOT } = require('../utils/fileHelpers');

// 获取文件夹文件列表
const getFiles = (req, res) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const folders = Folder.findByOwner(req.user.username);
        const folder = folders.find(f => f.id === folderId);
        
        if (!folder) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 从文件模型中获取文件信息
        const files = File.findByFolder(folderId);
        
        // 获取物理文件信息
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const physicalFiles = fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
        
        // 合并文件模型信息和物理文件信息
        const result = files.map(file => {
            const filePath = path.join(dirPath, file.savedName);
            let stats = null;
            
            try {
                stats = fsNative.statSync(filePath);
            } catch (e) {
                // 文件可能已被删除
                console.error('获取文件状态失败:', e);
            }
            
            // 直接使用存储的原始文件名，不再进行转换
            return {
                id: file.id,
                name: file.originalName, // 显示原始文件名
                savedName: file.savedName, // 保存的文件名
                size: stats ? stats.size : file.size,
                mtime: stats ? stats.mtime : file.uploadTime,
                mimeType: file.mimeType,
                uploadTime: file.uploadTime
            };
        }).filter(file => file !== null);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 上传文件（支持单个或多个文件）
const uploadFile = (req, res) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const folders = Folder.findByOwner(req.user.username);
        const folder = folders.find(f => f.id === folderId);
        
        if (!folder) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 检查是否有上传的文件
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '没有上传文件' });
        }
        
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const forceUpload = req.body.force === 'true';
        const uploadedFiles = [];
        const existingFiles = [];
        const errorFiles = [];
        
        // 处理每个上传的文件
        for (const file of req.files) {
            try {
                // 检查文件类型安全性
                // 如果文件名是Base64编码的，先解码再检查
                let filenameForCheck = file.originalname;
                if (filenameForCheck.startsWith('UTF8:')) {
                    try {
                        const base64Part = filenameForCheck.substring(5);
                        const bytes = Buffer.from(base64Part, 'base64');
                        filenameForCheck = bytes.toString('utf8');
                    } catch (e) {
                        console.error('Base64文件名解码失败:', e);
                        // 如果解码失败，使用原始文件名
                    }
                }
                
                const fileSafety = isFileTypeSafe(filenameForCheck);
                if (!fileSafety.safe) {
                    // 删除已上传的文件
                    fs.removeSync(file.path);
                    errorFiles.push({
                        filename: file.originalname,
                        error: fileSafety.reason
                    });
                    continue;
                }
                
                // 使用UUID+时间戳的形式作为保存文件名，避免编码问题
                const ext = path.extname(file.originalname);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const uuid = require('crypto').randomUUID().substring(0, 8);
                const savedName = `${uuid}_${timestamp}${ext}`;
                
                let filePath = path.join(dirPath, savedName);
                
                // 检查文件是否已存在
                if (fs.existsSync(filePath)) {
                    if (forceUpload) {
                        // 如果是强制上传，使用UUID+时间戳确保唯一性
                        const uniqueTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const uniqueUuid = require('crypto').randomUUID().substring(0, 8);
                        const uniqueSavedName = `${uniqueUuid}_${uniqueTimestamp}${ext}`;
                        filePath = path.join(dirPath, uniqueSavedName);
                        
                        // 移动文件到目标目录
                        fs.moveSync(file.path, filePath);
                        
                        // 获取MIME类型
                        const mimeTypes = {
                            '.jpg': 'image/jpeg',
                            '.jpeg': 'image/jpeg',
                            '.png': 'image/png',
                            '.gif': 'image/gif',
                            '.webp': 'image/webp',
                            '.bmp': 'image/bmp',
                            '.pdf': 'application/pdf',
                            '.doc': 'application/msword',
                            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            '.xls': 'application/vnd.ms-excel',
                            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            '.ppt': 'application/vnd.ms-powerpoint',
                            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                            '.txt': 'text/plain',
                            '.zip': 'application/zip',
                            '.rar': 'application/x-rar-compressed',
                            '.7z': 'application/x-7z-compressed',
                            '.mp4': 'video/mp4',
                            '.avi': 'video/x-msvideo',
                            '.mov': 'video/quicktime',
                            '.mp3': 'audio/mpeg',
                            '.wav': 'audio/wav'
                        };
                        
                        const mimeType = mimeTypes[ext] || 'application/octet-stream';
                        
                        // 确保原始文件名使用UTF-8编码
                        let originalName = file.originalname;
                        
                        // 检查是否是Base64编码的文件名（前端发送的）
                        if (originalName.startsWith('UTF8:')) {
                            try {
                                // 提取Base64部分
                                const base64Part = originalName.substring(5);
                                // 使用Node.js的Buffer处理Base64
                                const bytes = Buffer.from(base64Part, 'base64');
                                // 将Buffer转换为UTF-8字符串
                                originalName = bytes.toString('utf8');
                            } catch (e) {
                                console.error('Base64文件名解码失败:', e);
                                // 如果解码失败，使用原始文件名
                                originalName = file.originalname;
                            }
                        } else {
                            // 常规处理
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
                                originalName = file.originalname;
                            }
                        }
                        
                        // 创建文件记录
                        const fileRecord = File.create({
                            folderId: folderId,
                            originalName: originalName,
                            savedName: uniqueSavedName,
                            size: file.size,
                            mimeType: mimeType,
                            owner: req.user.username
                        });
                        
                        uploadedFiles.push({
                            id: fileRecord.id,
                            originalName: originalName,
                            savedName: uniqueSavedName,
                            size: file.size
                        });
                        continue;
                    } else {
                        // 删除已上传的文件
                        fs.removeSync(file.path);
                        existingFiles.push({
                            filename: file.originalname,
                            folderAlias: folder.alias
                        });
                        continue;
                    }
                }
                
                // 移动文件到目标目录
                fs.moveSync(file.path, filePath);
                
                // 获取MIME类型
                const mimeTypes = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.bmp': 'image/bmp',
                    '.pdf': 'application/pdf',
                    '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.xls': 'application/vnd.ms-excel',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.ppt': 'application/vnd.ms-powerpoint',
                    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    '.txt': 'text/plain',
                    '.zip': 'application/zip',
                    '.rar': 'application/x-rar-compressed',
                    '.7z': 'application/x-7z-compressed',
                    '.mp4': 'video/mp4',
                    '.avi': 'video/x-msvideo',
                    '.mov': 'video/quicktime',
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav'
                };
                
                const mimeType = mimeTypes[ext] || 'application/octet-stream';
                
                // 确保原始文件名使用UTF-8编码
                let originalName = file.originalname;
                
                // 检查是否是Base64编码的文件名（前端发送的）
                if (originalName.startsWith('UTF8:')) {
                    try {
                        // 提取Base64部分
                        const base64Part = originalName.substring(5);
                        // 使用Node.js的Buffer处理Base64
                        const bytes = Buffer.from(base64Part, 'base64');
                        // 将Buffer转换为UTF-8字符串
                        originalName = bytes.toString('utf8');
                    } catch (e) {
                        console.error('Base64文件名解码失败:', e);
                        // 如果解码失败，使用原始文件名
                        originalName = file.originalname;
                    }
                } else {
                    // 常规处理
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
                        originalName = file.originalname;
                    }
                }
                
                // 创建文件记录
                const fileRecord = File.create({
                    folderId: folderId,
                    originalName: originalName,
                    savedName: savedName,
                    size: file.size,
                    mimeType: mimeType,
                    owner: req.user.username
                });
                
                uploadedFiles.push({
                    id: fileRecord.id,
                    originalName: originalName,
                    savedName: savedName,
                    size: file.size
                });
            } catch (error) {
                // 删除已上传的文件
                if (fs.existsSync(file.path)) {
                    fs.removeSync(file.path);
                }
                // 确保错误信息中的文件名使用UTF-8编码
                let errorFileName = file.originalname;
                try {
                    // 如果文件名是Buffer，转换为UTF-8字符串
                    if (Buffer.isBuffer(file.originalname)) {
                        errorFileName = file.originalname.toString('utf8');
                    }
                    // 如果文件名包含非ASCII字符，确保使用UTF-8编码
                    else if (/[^\\x00-\\x7F]/.test(file.originalname)) {
                        // 使用Buffer.from确保UTF-8编码
                        errorFileName = Buffer.from(file.originalname, 'utf8').toString('utf8');
                    }
                } catch (e) {
                    console.error('文件名编码转换失败:', e);
                    errorFileName = file.originalname;
                }
                
                errorFiles.push({
                    filename: errorFileName,
                    error: error.message
                });
            }
        }
        
        // 返回结果
        const result = {
            success: uploadedFiles.length > 0,
            uploadedFiles,
            existingFiles,
            errorFiles,
            total: req.files.length
        };
        
        // 如果有文件已存在且不是强制上传，返回409状态码
        if (existingFiles.length > 0 && !forceUpload) {
            return res.status(409).json(result);
        }
        
        // 如果有错误文件，返回400状态码
        if (errorFiles.length > 0 && uploadedFiles.length === 0) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 删除文件（支持单个或批量删除）
const deleteFile = (req, res) => {
    try {
        const folderId = parseInt(req.params.folderId);
        const { filenames, filename } = req.body;
        
        const folders = Folder.findByOwner(req.user.username);
        const folder = folders.find(f => f.id === folderId);
        
        if (!folder) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 支持单个文件删除（向后兼容）
        const filesToDelete = filenames || [filename];
        
        // 如果是单个文件删除，使用文件名查找
        if (filesToDelete.length === 1 && filename) {
            try {
                let file = File.findByOriginalName(filename, folderId);
                
                // 如果找不到，尝试使用保存的名称查找
                if (!file) {
                    file = File.findBySavedName(filename, folderId);
                }
                
                // 如果还是找不到，尝试直接查找文件
                if (!file) {
                    // 获取文件夹中的所有文件
                    const folderFiles = File.findByFolder(folderId);
                    // 尝试多种方式匹配文件名
                    file = folderFiles.find(f => {
                        // 直接比较
                        if (f.originalName === filename) return true;
                        
                        // 尝试解码后比较
                        try {
                            if (decodeURIComponent(f.originalName) === filename) return true;
                        } catch (e) {
                            // 忽略解码错误
                        }
                        
                        // 尝试使用latin1解码
                        try {
                            const decodedName = Buffer.from(f.originalName, 'latin1').toString('utf8');
                            if (decodedName === filename) return true;
                        } catch (e) {
                            // 忽略解码错误
                        }
                        
                        return false;
                    });
                }
                
                if (!file || file.owner !== req.user.username) {
                    return res.status(404).json({ error: '文件不存在或无权删除' });
                }
                
                File.delete(file.id, req.user.username);
                return res.json({ 
                    success: true,
                    deletedFiles: [filename],
                    total: 1
                });
            } catch (error) {
                return res.status(500).json({ error: error.message });
            }
        }
        
        // 批量删除
        const result = File.batchDelete(filesToDelete, folderId, req.user.username);
        
        res.json({ 
            success: result.deletedFiles.length > 0,
            deletedFiles: result.deletedFiles,
            errorFiles: result.errorFiles,
            total: filesToDelete.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 下载单个分享文件
const downloadSharedFile = (req, res) => {
    try {
        const { code, filename } = req.params;
        // 访问码区分大小写，直接使用原始输入
        const shares = require('../models/Share').getAll();
        const share = shares.find(s => s.code === code);
        
        if (!share) {
            return res.status(404).json({ error: '分享链接不存在' });
        }
        
        if (Date.now() > share.expireTime) {
            return res.status(410).json({ error: '分享链接已过期' });
        }
        
        const folders = Folder.getAll();
        const folder = folders.find(f => f.id === share.folderId);
        
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        // 先从文件模型中查找文件
        const File = require('../models/File');
        let fileRecord = File.findByOriginalName(filename, share.folderId);
        
        // 如果找不到，尝试使用保存的名称查找
        if (!fileRecord) {
            fileRecord = File.findBySavedName(filename, share.folderId);
        }
        
        // 获取文件夹中的所有文件，用于备用查找
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const files = fs.existsSync(dirPath) ? fs.readdirSync(dirPath).filter(f => fsNative.statSync(path.join(dirPath, f)).isFile()) : [];
        
        let filePath;
        let downloadName = filename;
        
        if (fileRecord) {
            // 使用文件模型中的信息
            filePath = path.join(FILES_ROOT, folder.physicalPath, fileRecord.savedName);
            downloadName = fileRecord.originalName;
        } else {
            // 如果文件模型中没有记录，则使用原始方法查找
            let originalFileName = filename;
            for (const file of files) {
                let displayName = file;
                try {
                    // 如果文件名包含非ASCII字符，尝试转换编码
                    if (/[^\\x00-\\x7F]/.test(file)) {
                        displayName = Buffer.from(file, 'latin1').toString('utf8');
                    }
                } catch (e) {
                    // 如果转换失败，使用原始名称
                    console.error('文件名编码转换失败:', e);
                }
                
                if (displayName === filename) {
                    originalFileName = file;
                    break;
                }
            }
            
            if (!originalFileName) {
                return res.status(404).json({ error: '文件不存在' });
            }
            
            filePath = path.join(FILES_ROOT, folder.physicalPath, originalFileName);
        }
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '文件不存在' });
        }
        
        res.download(filePath, downloadName);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 下载分享的文件
const downloadSharedFiles = async (req, res) => {
    try {
        const { code } = req.params;
        const { folderId } = req.query; // 获取可选的folderId参数
        
        // 访问码区分大小写，直接使用原始输入
        const shares = require('../models/Share').getAll();
        const share = shares.find(s => s.code === code);
        
        if (!share) {
            return res.status(404).json({ error: '分享链接不存在' });
        }
        
        if (Date.now() > share.expireTime) {
            return res.status(410).json({ error: '分享链接已过期' });
        }
        
        // 确定要下载的文件夹
        let targetFolderId = folderId || share.folderId;
        const folders = Folder.getAll();
        const folder = folders.find(f => f.id === targetFolderId);
        
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        
        if (!fs.existsSync(dirPath)) {
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        // 递归函数，用于添加文件夹及其子文件夹中的所有文件到ZIP
        const addFilesToZip = (zip, currentFolder, currentPath = '') => {
            console.log(`Processing folder: ${currentFolder.alias}, path: ${currentPath}`);
            const currentDirPath = path.join(FILES_ROOT, currentFolder.physicalPath);
            
            // 获取当前文件夹中的所有文件记录
            const allFiles = File.getAll();
            const folderFiles = allFiles.filter(f => f.folderId === currentFolder.id);
            console.log(`Found ${folderFiles.length} file records in folder`);
            
            // 添加当前文件夹中的所有文件
            for (const fileRecord of folderFiles) {
                const filePath = path.join(currentDirPath, fileRecord.savedName);
                
                if (fs.existsSync(filePath)) {
                    // 使用原始文件名
                    const displayName = fileRecord.originalName;
                    
                    // 添加文件到ZIP，保持相对路径
                    const fileContent = fs.readFileSync(filePath);
                    const relativePath = currentPath ? `${currentPath}/${displayName}` : displayName;
                    console.log(`Adding file to ZIP: ${relativePath}`);
                    zip.file(relativePath, fileContent);
                } else {
                    console.log(`File not found: ${filePath}`);
                }
            }
            
            // 获取所有子文件夹
            const allFolders = Folder.getAll();
            const subFolders = allFolders.filter(f => f.parentId === currentFolder.id);
            console.log(`Found ${subFolders.length} subfolders`);
            
            // 递归处理所有子文件夹
            for (const subFolder of subFolders) {
                const subPath = currentPath ? `${currentPath}/${subFolder.alias}` : subFolder.alias;
                console.log(`Processing subfolder: ${subFolder.alias}`);
                addFilesToZip(zip, subFolder, subPath);
            }
        };
        
        // 检查文件夹是否为空
        const files = fs.readdirSync(dirPath);
        if (files.length === 0) {
            return res.status(404).json({ error: '文件夹为空' });
        }
        
        // 如果只有一个文件且没有子文件夹，直接下载
        const hasSubFolders = folders.some(f => f.parentId === folder.id);
        if (files.length === 1 && !hasSubFolders) {
            const filePath = path.join(dirPath, files[0]);
            return res.download(filePath, files[0]);
        }
        
        // 多个文件或有子文件夹，打包成ZIP
        const zip = new JSZip();
        
        // 添加当前文件夹及其子文件夹中的所有文件
        addFilesToZip(zip, folder);
        
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        const zipFileName = `${folder.alias}.zip`;
        
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${zipFileName}"`
        });
        
        res.send(zipContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取图片预览
const getFilePreview = async (req, res) => {
    try {
        const { folderId, filename } = req.params;
        const { width = 200, height = 200 } = req.query;
        
        console.log(`预览请求: folderId=${folderId}, filename=${filename}`);
        
        // 现在只依赖于请求头中的认证信息，不再从URL参数获取token
        const user = req.user;
        
        if (!user) {
            console.error('用户未授权');
            return res.status(401).json({ error: '未授权' });
        }
        
        console.log(`已验证用户: ${user.username}`);
        
        // 从文件模型中查找文件
        // 先尝试使用保存的名称查找文件
        console.log(`尝试通过savedName查找文件: ${filename}`);
        let file = File.findBySavedName(filename, parseInt(folderId));
        
        // 如果找不到，尝试使用原始名称查找文件
        if (!file) {
            console.log(`尝试通过originalName查找文件: ${filename}`);
            file = File.findByOriginalName(filename, parseInt(folderId));
        }
        
        if (!file) {
            console.log(`在数据库中未找到文件: ${filename}`);
            // 打印所有相关文件记录，用于调试
            const allFiles = File.findByFolder(parseInt(folderId));
            console.log(`文件夹中的所有文件记录:`, allFiles.map(f => ({
                id: f.id,
                originalName: f.originalName,
                savedName: f.savedName
            })));
            
            // 尝试使用模糊匹配
            const fuzzyMatch = allFiles.find(f => {
                // 检查savedName是否包含filename
                if (f.savedName && f.savedName.includes(filename)) {
                    console.log(`模糊匹配找到文件(savedName包含): ${f.originalName}, savedName: ${f.savedName}`);
                    return true;
                }
                
                // 检查originalName是否包含filename
                if (f.originalName && f.originalName.includes(filename)) {
                    console.log(`模糊匹配找到文件(originalName包含): ${f.originalName}, savedName: ${f.savedName}`);
                    return true;
                }
                
                // 检查filename是否包含savedName
                if (f.savedName && filename.includes(f.savedName)) {
                    console.log(`模糊匹配找到文件(filename包含savedName): ${f.originalName}, savedName: ${f.savedName}`);
                    return true;
                }
                
                // 检查filename是否包含originalName
                if (f.originalName && filename.includes(f.originalName)) {
                    console.log(`模糊匹配找到文件(filename包含originalName): ${f.originalName}, savedName: ${f.savedName}`);
                    return true;
                }
                
                return false;
            });
            
            if (fuzzyMatch) {
                file = fuzzyMatch;
            }
        } else {
            console.log(`找到文件: ${file.originalName}, savedName: ${file.savedName}`);
        }
        
        // 如果还是找不到，尝试直接查找文件
        if (!file) {
            // 获取用户的所有文件夹
            const folders = Folder.findByOwner(user.username);
            const folder = folders.find(f => f.id === parseInt(folderId));
            
            if (folder) {
                // 直接在文件夹中查找文件
                const folderPath = path.join(FILES_ROOT, folder.physicalPath);
                const files = fs.readdirSync(folderPath);
                let foundFile = null;
                
                // 尝试多种方式匹配文件名
                for (const f of files) {
                    // 直接比较
                    if (f === filename) {
                        foundFile = f;
                        break;
                    }
                    
                    // 解码后比较
                    try {
                        if (decodeURIComponent(f) === filename) {
                            foundFile = f;
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                    
                    // 尝试使用latin1解码
                    try {
                        const decodedName = Buffer.from(f, 'latin1').toString('utf8');
                        if (decodedName === filename) {
                            foundFile = f;
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                    
                    // 尝试使用binary解码
                    try {
                        const decodedName = Buffer.from(f, 'binary').toString('utf8');
                        if (decodedName === filename) {
                            foundFile = f;
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                }
                
                if (foundFile) {
                    const filePath = path.join(folderPath, foundFile);
                    if (fs.existsSync(filePath)) {
                        // 使用res.download下载文件，使用原始文件名作为下载名
                        // 尝试解码文件名
                        let downloadName = filename;
                        try {
                            downloadName = Buffer.from(filename, 'latin1').toString('utf8');
                        } catch (e) {
                            try {
                                downloadName = Buffer.from(filename, 'binary').toString('utf8');
                            } catch (e2) {
                                // 使用原始名称
                            }
                        }
                        
                        res.download(filePath, downloadName);
                        return;
                    }
                }
            }
        }
        
        // 如果还是找不到，尝试直接查找文件
        if (!file) {
            // 获取用户的所有文件夹
            const folders = Folder.findByOwner(user.username);
            const folder = folders.find(f => f.id === parseInt(folderId));
            
            if (folder) {
                // 直接在文件夹中查找文件
                const folderPath = path.join(FILES_ROOT, folder.physicalPath);
                console.log(`在文件夹中查找文件: ${folderPath}`);
                
                if (!fs.existsSync(folderPath)) {
                    console.error(`文件夹不存在: ${folderPath}`);
                    return res.status(404).json({ error: '文件夹不存在' });
                }
                
                const files = fs.readdirSync(folderPath);
                console.log(`文件夹中的文件: ${files.join(', ')}`);
                let foundFile = null;
                
                // 尝试多种方式匹配文件名
                for (const f of files) {
                    // 直接比较
                    if (f === filename) {
                        foundFile = f;
                        console.log(`通过直接比较找到文件: ${f}`);
                        break;
                    }
                    
                    // 解码后比较
                    try {
                        if (decodeURIComponent(f) === filename) {
                            foundFile = f;
                            console.log(`通过解码比较找到文件: ${f}`);
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                    
                    // 尝试使用latin1解码
                    try {
                        const decodedName = Buffer.from(f, 'latin1').toString('utf8');
                        if (decodedName === filename) {
                            foundFile = f;
                            console.log(`通过latin1解码找到文件: ${f}`);
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                    
                    // 尝试使用binary解码
                    try {
                        const decodedName = Buffer.from(f, 'binary').toString('utf8');
                        if (decodedName === filename) {
                            foundFile = f;
                            console.log(`通过binary解码找到文件: ${f}`);
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                }
                
                if (foundFile) {
                    const filePath = path.join(folderPath, foundFile);
                    console.log(`找到文件路径: ${filePath}`);
                    
                    if (fs.existsSync(filePath)) {
                        // 检查文件是否为图片
                        const ext = path.extname(foundFile).toLowerCase();
                        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
                        console.log(`文件扩展名: ${ext}, 是否为图片: ${imageExtensions.includes(ext)}`);
                        
                        if (imageExtensions.includes(ext)) {
                            // 设置响应头
                            res.setHeader('Content-Type', 'image/jpeg');
                            res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
                            
                            // 使用jimp生成缩略图
                            try {
                                const image = await Jimp.read(filePath);
                                
                                // 获取原始图片尺寸
                                const originalWidth = image.getWidth();
                                const originalHeight = image.getHeight();
                                
                                // 计算缩放比例，保持宽高比
                                const widthRatio = parseInt(width) / originalWidth;
                                const heightRatio = parseInt(height) / originalHeight;
                                const scaleFactor = Math.min(widthRatio, heightRatio, 1); // 不放大图片
                                
                                // 计算新尺寸
                                const newWidth = Math.round(originalWidth * scaleFactor);
                                const newHeight = Math.round(originalHeight * scaleFactor);
                                
                                // 缩放图片，保持宽高比
                                image.resize(newWidth, newHeight);
                                image.quality(70); // 设置更低的压缩质量，减小文件大小
                                
                                const buffer = await image.getBufferAsync('image/jpeg');
                                res.send(buffer);
                                return;
                            } catch (jimpError) {
                                console.error(`Jimp处理图片失败: ${jimpError.message}`);
                                
                                // 如果Jimp无法处理图片，尝试直接返回原始文件
                                try {
                                    const stats = fsNative.statSync(filePath);
                                    if (stats.isFile()) {
                                        // 设置适当的Content-Type
                                        const ext = path.extname(foundFile).toLowerCase();
                                        const mimeTypes = {
                                            '.jpg': 'image/jpeg',
                                            '.jpeg': 'image/jpeg',
                                            '.png': 'image/png',
                                            '.gif': 'image/gif',
                                            '.webp': 'image/webp',
                                            '.bmp': 'image/bmp'
                                        };
                                        
                                        const contentType = mimeTypes[ext] || 'application/octet-stream';
                                        res.setHeader('Content-Type', contentType);
                                        res.setHeader('Cache-Control', 'public, max-age=86400');
                                        
                                        // 直接返回文件内容
                                        const fileBuffer = fsNative.readFileSync(filePath);
                                        res.send(fileBuffer);
                                        return;
                                    }
                                } catch (fsError) {
                                    console.error(`读取原始文件也失败: ${fsError.message}`);
                                }
                                
                                return res.status(500).json({ error: '图片处理失败', details: jimpError.message });
                            }
                        } else {
                            // 如果不是图片文件，返回400错误
                            console.error(`不是图片文件: ${foundFile}, 扩展名: ${ext}`);
                            return res.status(400).json({ error: '不是图片文件' });
                        }
                    } else {
                        console.error(`文件不存在: ${filePath}`);
                        return res.status(404).json({ error: '文件不存在' });
                    }
                } else {
                    console.error(`在文件夹中未找到文件: ${filename}`);
                    return res.status(404).json({ error: '文件不存在' });
                }
            } else {
                console.error(`用户无权访问文件夹: ${folderId}`);
                return res.status(403).json({ error: '无权访问' });
            }
        }
        
        if (!file || file.owner !== user.username) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 获取文件夹信息
        console.log(`查找文件夹ID: ${file.folderId}`);
        const folder = Folder.findById(file.folderId);
        if (!folder) {
            console.error(`文件夹不存在: ${file.folderId}`);
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
        console.log(`文件路径: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
            console.error(`文件不存在: ${filePath}`);
            return res.status(404).json({ error: '文件不存在' });
        }
        
        // 检查文件是否为图片
        const ext = path.extname(file.savedName).toLowerCase();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        
        if (!imageExtensions.includes(ext)) {
            return res.status(400).json({ error: '不是图片文件' });
        }
        
        // 设置响应头
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
        
        // 检查文件大小
        const stats = fsNative.statSync(filePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        console.log(`文件大小: ${fileSizeInMB.toFixed(2)}MB`);
        
        // 如果文件已经是小尺寸（小于5MB），直接返回
        if (fileSizeInMB <= 5) {
            console.log('文件小于5MB，直接返回');
            const ext = path.extname(file.savedName).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.bmp': 'image/bmp'
            };
            
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            
            const fileBuffer = fsNative.readFileSync(filePath);
            res.send(fileBuffer);
            return;
        }
        
        // 使用jimp生成缩略图
        console.log(`尝试读取图片: ${filePath}`);
        let image;
        try {
            // 设置Jimp内存限制
            const Jimp = require('jimp');
            Jimp.setConcurrency(1); // 减少并发处理
            
            image = await Jimp.read(filePath);
            console.log(`图片读取成功，尺寸: ${image.getWidth()}x${image.getHeight()}`);
        } catch (error) {
            console.error(`读取图片失败: ${error.message}`);
            console.error(`错误堆栈: ${error.stack}`);
            
            // 如果Jimp无法处理图片，尝试直接返回原始文件
            try {
                if (stats.isFile()) {
                    // 设置适当的Content-Type
                    const ext = path.extname(file.savedName).toLowerCase();
                    const mimeTypes = {
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.png': 'image/png',
                        '.gif': 'image/gif',
                        '.webp': 'image/webp',
                        '.bmp': 'image/bmp'
                    };
                    
                    const contentType = mimeTypes[ext] || 'application/octet-stream';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    
                    // 直接返回文件内容
                    const fileBuffer = fsNative.readFileSync(filePath);
                    res.send(fileBuffer);
                    return;
                }
            } catch (fsError) {
                console.error(`读取原始文件也失败: ${fsError.message}`);
            }
            
            return res.status(500).json({ error: '图片处理失败', details: error.message });
        }
        
        // 获取原始图片尺寸
        const originalWidth = image.getWidth();
        const originalHeight = image.getHeight();
        
        // 计算缩放比例，保持宽高比
        const widthRatio = parseInt(width) / originalWidth;
        const heightRatio = parseInt(height) / originalHeight;
        let scaleFactor = Math.min(widthRatio, heightRatio, 1); // 不放大图片
        
        // 计算新尺寸
        let newWidth = Math.round(originalWidth * scaleFactor);
        let newHeight = Math.round(originalHeight * scaleFactor);
        
        // 缩放图片，保持宽高比
        image.resize(newWidth, newHeight);
        
        // 设置初始质量
        let quality = 70;
        let buffer = await image.getBufferAsync('image/jpeg');
        
        // 如果压缩后仍然大于5MB，继续降低质量
        while (buffer.length > 5 * 1024 * 1024 && quality > 10) {
            quality -= 10;
            console.log(`压缩质量降至 ${quality}%，当前大小: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
            buffer = await image.getBufferAsync(Jimp.MIME_JPEG, { quality });
        }
        
        // 如果质量已经很低但仍然大于5MB，尝试进一步缩小尺寸
        if (buffer.length > 5 * 1024 * 1024) {
            console.log('质量压缩不足，尝试缩小尺寸');
            scaleFactor *= 0.8; // 每次缩小20%
            
            while (buffer.length > 5 * 1024 * 1024 && scaleFactor > 0.1) {
                newWidth = Math.round(originalWidth * scaleFactor);
                newHeight = Math.round(originalHeight * scaleFactor);
                
                image.resize(newWidth, newHeight);
                buffer = await image.getBufferAsync(Jimp.MIME_JPEG, { quality: 70 });
                
                console.log(`缩小尺寸至 ${newWidth}x${newHeight}，当前大小: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
                scaleFactor *= 0.8;
            }
        }
        
        console.log(`最终图片大小: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 下载文件
const downloadFile = (req, res) => {
    try {
        const { folderId, filename } = req.params;
        
        // 从文件模型中查找文件
        // 先尝试使用保存的名称查找文件
        console.log(`尝试通过savedName查找文件: ${filename}`);
        let file = File.findBySavedName(filename, parseInt(folderId));
        
        // 如果找不到，尝试使用原始名称查找文件
        if (!file) {
            console.log(`尝试通过originalName查找文件: ${filename}`);
            file = File.findByOriginalName(filename, parseInt(folderId));
        }
        
        if (!file) {
            console.log(`在数据库中未找到文件: ${filename}`);
            // 打印所有相关文件记录，用于调试
            const allFiles = File.findByFolder(parseInt(folderId));
            console.log(`文件夹中的所有文件记录:`, allFiles.map(f => ({
                id: f.id,
                originalName: f.originalName,
                savedName: f.savedName
            })));
            
            // 尝试使用模糊匹配
            const fuzzyMatch = allFiles.find(f => {
                // 检查savedName是否包含filename
                if (f.savedName && f.savedName.includes(filename)) {
                    console.log(`模糊匹配找到文件(savedName包含): ${f.originalName}, savedName: ${f.savedName}`);
                    return true;
                }
                
                // 检查originalName是否包含filename
                if (f.originalName && f.originalName.includes(filename)) {
                    console.log(`模糊匹配找到文件(originalName包含): ${f.originalName}, savedName: ${f.savedName}`);
                    return true;
                }
                
                // 检查filename是否包含savedName
                if (f.savedName && filename.includes(f.savedName)) {
                    console.log(`模糊匹配找到文件(filename包含savedName): ${f.originalName}, savedName: ${f.savedName}`);
                    return true;
                }
                
                // 检查filename是否包含originalName
                if (f.originalName && filename.includes(f.originalName)) {
                    console.log(`模糊匹配找到文件(filename包含originalName): ${f.originalName}, savedName: ${f.savedName}`);
                    return true;
                }
                
                return false;
            });
            
            if (fuzzyMatch) {
                file = fuzzyMatch;
            }
        } else {
            console.log(`找到文件: ${file.originalName}, savedName: ${file.savedName}`);
        }
        
        // 如果还是找不到，尝试直接查找文件
        if (!file) {
            // 获取用户的所有文件夹
            const folders = Folder.findByOwner(user.username);
            const folder = folders.find(f => f.id === parseInt(folderId));
            
            if (folder) {
                // 直接在文件夹中查找文件
                const folderPath = path.join(FILES_ROOT, folder.physicalPath);
                const files = fs.readdirSync(folderPath);
                let foundFile = null;
                
                // 尝试多种方式匹配文件名
                for (const f of files) {
                    // 直接比较
                    if (f === filename) {
                        foundFile = f;
                        break;
                    }
                    
                    // 解码后比较
                    try {
                        if (decodeURIComponent(f) === filename) {
                            foundFile = f;
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                    
                    // 尝试使用latin1解码
                    try {
                        const decodedName = Buffer.from(f, 'latin1').toString('utf8');
                        if (decodedName === filename) {
                            foundFile = f;
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                    
                    // 尝试使用binary解码
                    try {
                        const decodedName = Buffer.from(f, 'binary').toString('utf8');
                        if (decodedName === filename) {
                            foundFile = f;
                            break;
                        }
                    } catch (e) {
                        // 忽略解码错误
                    }
                }
                
                if (foundFile) {
                    const filePath = path.join(folderPath, foundFile);
                    if (fs.existsSync(filePath)) {
                        // 使用res.download下载文件，使用原始文件名作为下载名
                        // 尝试解码文件名
                        let downloadName = filename;
                        try {
                            downloadName = Buffer.from(filename, 'latin1').toString('utf8');
                        } catch (e) {
                            try {
                                downloadName = Buffer.from(filename, 'binary').toString('utf8');
                            } catch (e2) {
                                // 使用原始名称
                            }
                        }
                        
                        res.download(filePath, downloadName);
                        return;
                    }
                }
            }
        }
        
        if (!file || file.owner !== req.user.username) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 获取文件夹信息
        console.log(`查找文件夹ID: ${file.folderId}`);
        const folder = Folder.findById(file.folderId);
        if (!folder) {
            console.error(`文件夹不存在: ${file.folderId}`);
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
        console.log(`文件路径: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
            console.error(`文件不存在: ${filePath}`);
            return res.status(404).json({ error: '文件不存在' });
        }
        
        // 使用res.download下载文件，使用原始文件名作为下载名
        res.download(filePath, file.originalName);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 分块上传初始化
const initChunkUpload = (req, res) => {
    try {
        const { folderId } = req.params;
        const { fileName, fileSize } = req.body;
        
        const folders = Folder.findByOwner(req.user.username);
        const folder = folders.find(f => f.id === parseInt(folderId));
        
        if (!folder) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 检查文件类型安全性
        // 如果文件名是Base64编码的，先解码再检查
        let filenameForCheck = fileName;
        if (filenameForCheck.startsWith('UTF8:')) {
            try {
                const base64Part = filenameForCheck.substring(5);
                const bytes = Buffer.from(base64Part, 'base64');
                filenameForCheck = bytes.toString('utf8');
            } catch (e) {
                console.error('Base64文件名解码失败:', e);
                // 如果解码失败，使用原始文件名
            }
        }
        
        const fileSafety = isFileTypeSafe(filenameForCheck);
        if (!fileSafety.safe) {
            return res.status(400).json({ error: fileSafety.reason });
        }
        
        // 检查文件大小（限制为2GB）
        const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
        const size = parseInt(fileSize);
        if (size > MAX_FILE_SIZE) {
            return res.status(400).json({ error: `文件大小超过限制 (${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB)` });
        }
        
        // 使用UUID+时间戳的形式作为保存文件名，避免编码问题
        // 确保使用解码后的文件名来获取扩展名
        const ext = path.extname(filenameForCheck);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const uuid = require('crypto').randomUUID().substring(0, 8);
        const savedFileName = `${uuid}_${timestamp}${ext}`;
        
        // 生成唯一的上传ID
        const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 创建临时目录存储分块
        const tempDir = path.join(FILES_ROOT, 'temp', uploadId);
        fs.ensureDirSync(tempDir);
        
        // 确保原始文件名使用UTF-8编码
        let originalFileName = fileName;
        
        // 检查是否是Base64编码的文件名（前端发送的）
        if (fileName.startsWith('UTF8:')) {
            try {
                // 提取Base64部分
                const base64Part = fileName.substring(5);
                // 使用Node.js的Buffer处理Base64
                const bytes = Buffer.from(base64Part, 'base64');
                // 将Buffer转换为UTF-8字符串
                originalFileName = bytes.toString('utf8');
            } catch (e) {
                console.error('Base64文件名解码失败:', e);
                // 如果解码失败，使用原始文件名
                originalFileName = fileName;
            }
        } else {
            // 常规处理
            try {
                // 如果文件名是Buffer，转换为UTF-8字符串
                if (Buffer.isBuffer(fileName)) {
                    originalFileName = fileName.toString('utf8');
                }
                // 如果文件名包含非ASCII字符，尝试修复编码
                else if (/[^\\x00-\\x7F]/.test(fileName)) {
                    // 检查是否已经是正确的UTF-8
                    try {
                        // 尝试将字符串编码为Buffer再解码，验证是否为有效UTF-8
                        const testBuffer = Buffer.from(fileName, 'utf8');
                        const testString = testBuffer.toString('utf8');
                        if (testString === fileName) {
                            // 已经是有效的UTF-8，不需要转换
                            originalFileName = testString;
                        } else {
                            // 可能是其他编码被错误解释为UTF-8，尝试修复
                            originalFileName = Buffer.from(fileName, 'latin1').toString('utf8');
                        }
                    } catch (e) {
                        // 如果验证失败，尝试修复
                        try {
                            originalFileName = Buffer.from(fileName, 'latin1').toString('utf8');
                        } catch (e2) {
                            // 如果还是失败，保持原样
                            console.warn('无法修复文件名编码:', fileName);
                        }
                    }
                }
            } catch (e) {
                console.error('文件名编码转换失败:', e);
                originalFileName = fileName;
            }
        }
        
        // 保存上传信息
        const uploadInfo = {
            uploadId,
            folderId: parseInt(folderId),
            fileName: savedFileName, // 使用转换后的文件名
            originalFileName: originalFileName, // 保留原始文件名
            fileSize: size,
            chunkSize: 200 * 1024, // 200KB per chunk
            totalChunks: Math.ceil(size / (200 * 1024)),
            uploadedChunks: 0,
            status: 'initialized'
        };
        
        fs.writeFileSync(
            path.join(tempDir, 'info.json'),
            JSON.stringify(uploadInfo, null, 2)
        );
        
        res.json({
            uploadId,
            chunkSize: uploadInfo.chunkSize,
            totalChunks: uploadInfo.totalChunks
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 上传文件块
const uploadChunk = (req, res) => {
    try {
        const { folderId } = req.params;
        const { uploadId, chunkIndex, chunk } = req.body;
        
        // 验证上传ID
        const tempDir = path.join(FILES_ROOT, 'temp', uploadId);
        const infoPath = path.join(tempDir, 'info.json');
        
        if (!fs.existsSync(infoPath)) {
            return res.status(404).json({ error: '上传会话不存在' });
        }
        
        const uploadInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        
        // 验证文件夹权限
        const folders = Folder.findByOwner(req.user.username);
        const folder = folders.find(f => f.id === parseInt(folderId));
        
        if (!folder || folder.id !== uploadInfo.folderId) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 保存分块
        const chunkPath = path.join(tempDir, `chunk-${chunkIndex}`);
        
        // 如果chunk是Base64编码的，先解码
        let chunkData;
        if (typeof chunk === 'string' && chunk.startsWith('data:')) {
            // 处理data URL格式
            const base64Data = chunk.split(',')[1];
            chunkData = Buffer.from(base64Data, 'base64');
        } else if (typeof chunk === 'string') {
            // 处理纯Base64格式
            chunkData = Buffer.from(chunk, 'base64');
        } else {
            // 处理二进制数据
            chunkData = chunk;
        }
        
        fs.writeFileSync(chunkPath, chunkData);
        
        // 更新上传信息
        uploadInfo.uploadedChunks++;
        fs.writeFileSync(infoPath, JSON.stringify(uploadInfo, null, 2));
        
        res.json({ 
            success: true, 
            uploadedChunks: uploadInfo.uploadedChunks,
            totalChunks: uploadInfo.totalChunks
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 完成分块上传
const completeChunkUpload = (req, res) => {
    try {
        const { folderId } = req.params;
        const { uploadId } = req.body;
        
        // 验证上传ID
        const tempDir = path.join(FILES_ROOT, 'temp', uploadId);
        const infoPath = path.join(tempDir, 'info.json');
        
        if (!fs.existsSync(infoPath)) {
            return res.status(404).json({ error: '上传会话不存在' });
        }
        
        const uploadInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        
        // 验证文件夹权限
        const folders = Folder.findByOwner(req.user.username);
        const folder = folders.find(f => f.id === parseInt(folderId));
        
        if (!folder || folder.id !== uploadInfo.folderId) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 检查所有分块是否已上传
        if (uploadInfo.uploadedChunks !== uploadInfo.totalChunks) {
            return res.status(400).json({ error: '还有分块未上传' });
        }
        
        // 合并分块
        const targetPath = path.join(FILES_ROOT, folder.physicalPath, uploadInfo.fileName);
        
        // 检查文件是否已存在，如果存在则生成新的唯一文件名
        let finalFileName = uploadInfo.fileName;
        let finalTargetPath = targetPath;
        
        if (fs.existsSync(targetPath)) {
            // 文件已存在，生成新的唯一文件名
            const ext = path.extname(uploadInfo.fileName);
            const baseName = path.basename(uploadInfo.fileName, ext);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const uuid = require('crypto').randomUUID().substring(0, 8);
            finalFileName = `${baseName}_${uuid}_${timestamp}${ext}`;
            finalTargetPath = path.join(FILES_ROOT, folder.physicalPath, finalFileName);
            console.log(`文件已存在，生成新文件名: ${finalFileName}`);
        }
        
        const writeStream = fs.createWriteStream(finalTargetPath);
        
        for (let i = 0; i < uploadInfo.totalChunks; i++) {
            const chunkPath = path.join(tempDir, `chunk-${i}`);
            const chunkData = fs.readFileSync(chunkPath);
            writeStream.write(chunkData);
        }
        
        writeStream.end();
        
        // 获取MIME类型
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.7z': 'application/x-7z-compressed',
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav'
        };
        
        const ext = path.extname(uploadInfo.fileName).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        // 确保原始文件名使用UTF-8编码
        let originalFileName = uploadInfo.originalFileName;
        
        // 检查是否是Base64编码的文件名（前端发送的）
        if (uploadInfo.originalFileName.startsWith('UTF8:')) {
            try {
                // 提取Base64部分
                const base64Part = uploadInfo.originalFileName.substring(5);
                // 使用Node.js的Buffer处理Base64
                const bytes = Buffer.from(base64Part, 'base64');
                // 将Buffer转换为UTF-8字符串
                originalFileName = bytes.toString('utf8');
            } catch (e) {
                console.error('Base64文件名解码失败:', e);
                // 如果解码失败，使用原始文件名
                originalFileName = uploadInfo.originalFileName;
            }
        } else {
            // 常规处理
            try {
                // 如果文件名是Buffer，转换为UTF-8字符串
                if (Buffer.isBuffer(uploadInfo.originalFileName)) {
                    originalFileName = uploadInfo.originalFileName.toString('utf8');
                }
                // 如果文件名包含非ASCII字符，尝试修复编码
                else if (/[^\\x00-\\x7F]/.test(uploadInfo.originalFileName)) {
                    // 检查是否已经是正确的UTF-8
                    try {
                        // 尝试将字符串编码为Buffer再解码，验证是否为有效UTF-8
                        const testBuffer = Buffer.from(uploadInfo.originalFileName, 'utf8');
                        const testString = testBuffer.toString('utf8');
                        if (testString === uploadInfo.originalFileName) {
                            // 已经是有效的UTF-8，不需要转换
                            originalFileName = testString;
                        } else {
                            // 可能是其他编码被错误解释为UTF-8，尝试修复
                            originalFileName = Buffer.from(uploadInfo.originalFileName, 'latin1').toString('utf8');
                        }
                    } catch (e) {
                        // 如果验证失败，尝试修复
                        try {
                            originalFileName = Buffer.from(uploadInfo.originalFileName, 'latin1').toString('utf8');
                        } catch (e2) {
                            // 如果还是失败，保持原样
                            console.warn('无法修复文件名编码:', uploadInfo.originalFileName);
                        }
                    }
                }
            } catch (e) {
                console.error('文件名编码转换失败:', e);
                originalFileName = uploadInfo.originalFileName;
            }
        }
        
        // 创建文件记录
        const fileRecord = File.create({
            folderId: parseInt(folderId),
            originalName: originalFileName,
            savedName: finalFileName,
            size: uploadInfo.fileSize,
            mimeType: mimeType,
            owner: req.user.username
        });
        
        // 清理临时文件
        fs.removeSync(tempDir);
        
        res.json({ 
            success: true, 
            id: fileRecord.id,
            fileName: uploadInfo.originalFileName,
            savedName: finalFileName,
            fileSize: uploadInfo.fileSize
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 通过文件ID获取图片预览
const getFilePreviewById = async (req, res) => {
    try {
        const { folderId, fileId } = req.params;
        const { width = 200, height = 200 } = req.query;
        
        console.log(`通过ID预览请求: folderId=${folderId}, fileId=${fileId}`);
        
        // 现在只依赖于请求头中的认证信息，不再从URL参数获取token
        const user = req.user;
        
        if (!user) {
            console.error('用户未授权');
            return res.status(401).json({ error: '未授权' });
        }
        
        console.log(`已验证用户: ${user.username}`);
        
        // 通过ID查找文件
        console.log(`通过ID查找文件: ${fileId}`);
        const file = File.findById(parseInt(fileId));
        
        if (!file) {
            console.error(`通过ID未找到文件: ${fileId}`);
            return res.status(404).json({ error: '文件不存在' });
        }
        
        // 检查文件是否属于该文件夹和用户
        if (file.folderId !== parseInt(folderId) || file.owner !== user.username) {
            console.error(`文件不属于该文件夹或用户: folderId=${file.folderId}, owner=${file.owner}`);
            return res.status(403).json({ error: '无权访问' });
        }
        
        console.log(`找到文件: ${file.originalName}, savedName: ${file.savedName}`);
        
        // 获取文件夹信息
        const folder = Folder.findById(file.folderId);
        if (!folder) {
            console.error(`文件夹不存在: ${file.folderId}`);
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
        console.log(`文件路径: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
            console.error(`文件不存在: ${filePath}`);
            return res.status(404).json({ error: '文件不存在' });
        }
        
        // 检查文件是否为图片
        const ext = path.extname(file.savedName).toLowerCase();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        
        if (!imageExtensions.includes(ext)) {
            return res.status(400).json({ error: '不是图片文件' });
        }
        
        // 设置响应头
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
        
        // 检查文件大小
        const stats = fsNative.statSync(filePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        console.log(`文件大小: ${fileSizeInMB.toFixed(2)}MB`);
        
        // 如果文件已经是小尺寸（小于5MB），直接返回
        if (fileSizeInMB <= 5) {
            console.log('文件小于5MB，直接返回');
            const ext = path.extname(file.savedName).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.bmp': 'image/bmp'
            };
            
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            
            const fileBuffer = fsNative.readFileSync(filePath);
            res.send(fileBuffer);
            return;
        }
        
        // 使用jimp生成缩略图
        console.log(`尝试读取图片: ${filePath}`);
        let image;
        try {
            // 设置Jimp内存限制
            const Jimp = require('jimp');
            Jimp.setConcurrency(1); // 减少并发处理
            
            image = await Jimp.read(filePath);
            console.log(`图片读取成功，尺寸: ${image.getWidth()}x${image.getHeight()}`);
        } catch (error) {
            console.error(`读取图片失败: ${error.message}`);
            console.error(`错误堆栈: ${error.stack}`);
            
            // 如果Jimp无法处理图片，尝试直接返回原始文件
            try {
                if (stats.isFile()) {
                    // 设置适当的Content-Type
                    const ext = path.extname(file.savedName).toLowerCase();
                    const mimeTypes = {
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.png': 'image/png',
                        '.gif': 'image/gif',
                        '.webp': 'image/webp',
                        '.bmp': 'image/bmp'
                    };
                    
                    const contentType = mimeTypes[ext] || 'application/octet-stream';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    
                    // 直接返回文件内容
                    const fileBuffer = fsNative.readFileSync(filePath);
                    res.send(fileBuffer);
                    return;
                }
            } catch (fsError) {
                console.error(`读取原始文件也失败: ${fsError.message}`);
            }
            
            return res.status(500).json({ error: '图片处理失败', details: error.message });
        }
        
        // 获取原始图片尺寸
        const originalWidth = image.getWidth();
        const originalHeight = image.getHeight();
        
        // 计算缩放比例，保持宽高比
        const widthRatio = parseInt(width) / originalWidth;
        const heightRatio = parseInt(height) / originalHeight;
        let scaleFactor = Math.min(widthRatio, heightRatio, 1); // 不放大图片
        
        // 计算新尺寸
        let newWidth = Math.round(originalWidth * scaleFactor);
        let newHeight = Math.round(originalHeight * scaleFactor);
        
        // 缩放图片，保持宽高比
        image.resize(newWidth, newHeight);
        
        // 设置初始质量
        let quality = 70;
        let buffer = await image.getBufferAsync('image/jpeg');
        
        // 如果压缩后仍然大于5MB，继续降低质量
        while (buffer.length > 5 * 1024 * 1024 && quality > 10) {
            quality -= 10;
            console.log(`压缩质量降至 ${quality}%，当前大小: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
            buffer = await image.getBufferAsync(Jimp.MIME_JPEG, { quality });
        }
        
        // 如果质量已经很低但仍然大于5MB，尝试进一步缩小尺寸
        if (buffer.length > 5 * 1024 * 1024) {
            console.log('质量压缩不足，尝试缩小尺寸');
            scaleFactor *= 0.8; // 每次缩小20%
            
            while (buffer.length > 5 * 1024 * 1024 && scaleFactor > 0.1) {
                newWidth = Math.round(originalWidth * scaleFactor);
                newHeight = Math.round(originalHeight * scaleFactor);
                
                image.resize(newWidth, newHeight);
                buffer = await image.getBufferAsync(Jimp.MIME_JPEG, { quality: 70 });
                
                console.log(`缩小尺寸至 ${newWidth}x${newHeight}，当前大小: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
                scaleFactor *= 0.8;
            }
        }
        
        console.log(`最终图片大小: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getFiles,
    uploadFile,
    deleteFile,
    getFilePreview,
    getFilePreviewById,
    downloadFile,
    downloadSharedFile,
    downloadSharedFiles,
    initChunkUpload,
    uploadChunk,
    completeChunkUpload
};