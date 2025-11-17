const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
    login,
    getUsers,
    createUser,
    updateUser,
    updatePassword,
    deleteUser
} = require('../controllers/userController');

const router = express.Router();

// 登录（不需要认证）
router.post('/login', login);

// 获取所有用户（需要管理员权限）
router.get('/', authenticate, requireAdmin, getUsers);

// 创建用户（需要管理员权限）
router.post('/', authenticate, requireAdmin, createUser);

// 更新用户（需要管理员权限）
router.put('/:id', authenticate, requireAdmin, updateUser);

// 修改密码
router.put('/:id/password', authenticate, updatePassword);

// 删除用户（需要管理员权限）
router.delete('/:id', authenticate, requireAdmin, deleteUser);

module.exports = router;