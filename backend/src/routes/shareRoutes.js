const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
    createShare,
    getShares,
    updateShare,
    deleteShare
} = require('../controllers/shareController');

const router = express.Router();

// 创建分享链接
router.post('/', authenticate, createShare);

// 获取用户分享链接
router.get('/', authenticate, getShares);

// 更新分享链接
router.put('/:id', authenticate, updateShare);

// 删除分享链接
router.delete('/:id', authenticate, deleteShare);

module.exports = router;