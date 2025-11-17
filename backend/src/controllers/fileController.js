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
                const fileSafety = isFileTypeSafe(file.originalname);
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
                        try {
                            // 如果文件名是Buffer，转换为UTF-8字符串
                            if (Buffer.isBuffer(file.originalname)) {
                                originalName = file.originalname.toString('utf8');
                            }
                            // 如果文件名包含非ASCII字符，确保使用UTF-8编码
                            else if (/[^\\x00-\\x7F]/.test(file.originalname)) {
                                // 使用Buffer.from确保UTF-8编码
                                originalName = Buffer.from(file.originalname, 'utf8').toString('utf8');
                            }
                        } catch (e) {
                            console.error('文件名编码转换失败:', e);
                            originalName = file.originalname;
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
                try {
                    // 如果文件名是Buffer，转换为UTF-8字符串
                    if (Buffer.isBuffer(file.originalname)) {
                        originalName = file.originalname.toString('utf8');
                    }
                    // 如果文件名包含非ASCII字符，确保使用UTF-8编码
                    else if (/[^\\x00-\\x7F]/.test(file.originalname)) {
                        // 使用Buffer.from确保UTF-8编码
                        originalName = Buffer.from(file.originalname, 'utf8').toString('utf8');
                    }
                } catch (e) {
                    console.error('文件名编码转换失败:', e);
                    originalName = file.originalname;
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
                const file = File.findByOriginalName(filename, folderId);
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
        // 将分享码转换为大写，与原始版本保持一致
        const upperCode = code.toUpperCase();
        const shares = require('../models/Share').getAll();
        const share = shares.find(s => s.code === upperCode);
        
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
        
        // 获取文件夹中的所有文件，找到匹配的文件
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        const files = fs.existsSync(dirPath) ? fs.readdirSync(dirPath).filter(f => fsNative.statSync(path.join(dirPath, f)).isFile()) : [];
        
        // 查找原始文件名
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
        
        const filePath = path.join(FILES_ROOT, folder.physicalPath, originalFileName);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '文件不存在' });
        }
        
        res.download(filePath, filename);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 下载分享的文件
const downloadSharedFiles = async (req, res) => {
    try {
        const { code } = req.params;
        // 将分享码转换为大写，与原始版本保持一致
        const upperCode = code.toUpperCase();
        const shares = require('../models/Share').getAll();
        const share = shares.find(s => s.code === upperCode);
        
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
        
        const dirPath = path.join(FILES_ROOT, folder.physicalPath);
        
        if (!fs.existsSync(dirPath)) {
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        const files = fs.readdirSync(dirPath);
        if (files.length === 0) {
            return res.status(404).json({ error: '文件夹为空' });
        }
        
        // 如果只有一个文件，直接下载
        if (files.length === 1) {
            const filePath = path.join(dirPath, files[0]);
            return res.download(filePath, files[0]);
        }
        
        // 多个文件，打包成ZIP
        const zip = new JSZip();
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isFile()) {
                const fileContent = fs.readFileSync(filePath);
                zip.file(file, fileContent);
            }
        }
        
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
        const { width = 200, height = 200, token } = req.query;
        
        let user = req.user;
        
        // 如果没有通过认证中间件，尝试从查询参数获取token
        if (!user && token) {
            const jwt = require('jsonwebtoken');
            const SECRET_KEY = 'your-super-secret-key-change-in-production';
            
            try {
                user = jwt.verify(token, SECRET_KEY);
            } catch (err) {
                return res.status(401).json({ error: '无效的令牌' });
            }
        }
        
        if (!user) {
            return res.status(401).json({ error: '未授权' });
        }
        
        // 从文件模型中查找文件
        const file = File.findByOriginalName(filename, parseInt(folderId));
        
        if (!file || file.owner !== user.username) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 获取文件夹信息
        const folder = Folder.findById(file.folderId);
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
        
        if (!fs.existsSync(filePath)) {
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
        
        // 使用jimp生成缩略图
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
        
        const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);
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
        const file = File.findByOriginalName(filename, parseInt(folderId));
        
        if (!file || file.owner !== req.user.username) {
            return res.status(403).json({ error: '无权访问' });
        }
        
        // 获取文件夹信息
        const folder = Folder.findById(file.folderId);
        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }
        
        const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
        
        if (!fs.existsSync(filePath)) {
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
        const fileSafety = isFileTypeSafe(fileName);
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
        const ext = path.extname(fileName);
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
        try {
            // 如果文件名是Buffer，转换为UTF-8字符串
            if (Buffer.isBuffer(fileName)) {
                originalFileName = fileName.toString('utf8');
            }
            // 如果文件名包含非ASCII字符，确保使用UTF-8编码
            else if (/[^\\x00-\\x7F]/.test(fileName)) {
                // 使用Buffer.from确保UTF-8编码
                originalFileName = Buffer.from(fileName, 'utf8').toString('utf8');
            }
        } catch (e) {
            console.error('文件名编码转换失败:', e);
            originalFileName = fileName;
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
        const writeStream = fs.createWriteStream(targetPath);
        
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
        try {
            // 如果文件名是Buffer，转换为UTF-8字符串
            if (Buffer.isBuffer(uploadInfo.originalFileName)) {
                originalFileName = uploadInfo.originalFileName.toString('utf8');
            }
            // 如果文件名包含非ASCII字符，确保使用UTF-8编码
            else if (/[^\\x00-\\x7F]/.test(uploadInfo.originalFileName)) {
                // 使用Buffer.from确保UTF-8编码
                originalFileName = Buffer.from(uploadInfo.originalFileName, 'utf8').toString('utf8');
            }
        } catch (e) {
            console.error('文件名编码转换失败:', e);
            originalFileName = uploadInfo.originalFileName;
        }
        
        // 创建文件记录
        const fileRecord = File.create({
            folderId: parseInt(folderId),
            originalName: originalFileName,
            savedName: uploadInfo.fileName,
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
            savedName: uploadInfo.fileName,
            fileSize: uploadInfo.fileSize
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getFiles,
    uploadFile,
    deleteFile,
    getFilePreview,
    downloadFile,
    downloadSharedFile,
    downloadSharedFiles,
    initChunkUpload,
    uploadChunk,
    completeChunkUpload
};