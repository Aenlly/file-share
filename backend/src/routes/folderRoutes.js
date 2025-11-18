const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { FILES_ROOT } = require('../utils/fileHelpers');
const {
    getFolders,
    createFolder,
    deleteFolder
} = require('../controllers/folderController');
const {
    getFiles,
    uploadFile,
    deleteFile,
    getFilePreview,
    downloadFile,
    initChunkUpload,
    uploadChunk,
    completeChunkUpload
} = require('../controllers/fileController');

const router = express.Router();

// 配置文件上传
const upload = multer({ 
    dest: path.join(FILES_ROOT, 'temp'),
    limits: {
        fileSize: 500 * 1024 * 1024 // 限制文件大小为500MB
    },
    fileFilter: (req, file, cb) => {
        // 处理文件名编码，确保UTF-8
        try {
            let originalName = file.originalname;
            
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
            
            file.originalname = originalName;
        } catch (e) {
            console.error('文件名编码转换失败:', e);
        }
        
        // 文件类型检查在控制器中进行
        cb(null, true);
    }
});

// 获取用户文件夹
router.get('/', authenticate, getFolders);

// 创建文件夹
router.post('/', authenticate, createFolder);

// 删除文件夹
router.delete('/:id', authenticate, deleteFolder);

// 获取文件夹文件列表
router.get('/:folderId/files', authenticate, getFiles);

// 上传文件（支持单个或多个文件）
router.post('/:folderId/upload', authenticate, upload.array('files', 200), uploadFile); // 最多支持200个文件

// 分块上传初始化
router.post('/:folderId/chunk/init', authenticate, initChunkUpload);

// 上传文件块
router.post('/:folderId/chunk', authenticate, uploadChunk);

// 完成分块上传
router.post('/:folderId/chunk/complete', authenticate, completeChunkUpload);

// 获取图片预览（支持通过查询参数传递token）
router.get('/:folderId/preview/:filename', getFilePreview);

// 下载文件
router.get('/:folderId/download/:filename', authenticate, downloadFile);

// 删除文件
router.delete('/:folderId/file', authenticate, deleteFile);

module.exports = router;