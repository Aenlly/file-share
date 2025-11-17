const express = require('express');
const { verifyShare } = require('../controllers/shareController');
const {
    downloadSharedFile,
    downloadSharedFiles
} = require('../controllers/fileController');

const router = express.Router();

// 验证分享链接（不需要认证）
router.get('/share/:code', verifyShare);

// 下载单个分享文件（不需要认证）
router.get('/share/:code/file/:filename', downloadSharedFile);

// 下载分享的文件（不需要认证）
router.get('/share/:code/download', downloadSharedFiles);

module.exports = router;