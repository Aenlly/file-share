const express = require('express');
const { authenticate } = require('../middleware/auth');
const { moveFile } = require('../controllers/fileMoveController');

const router = express.Router();

// 移动文件到另一个文件夹
router.post('/:folderId/move', authenticate, moveFile);

module.exports = router;