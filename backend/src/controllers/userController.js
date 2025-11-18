const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Share = require('../models/Share');
const { SECRET_KEY } = require('../middleware/auth');

// 用户登录
const login = (req, res) => {
    const { username, password } = req.body;
    const users = User.getAll();
    const user = users.find(u => u.username === username);

    if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );
        const { password: pwd, ...safeUser } = user;
        return res.json({ success: true, token, user: safeUser });
    }
    res.status(401).json({ success: false, message: '用户名或密码错误' });
};

// 获取所有用户
const getUsers = (req, res) => {
    try {
        const users = User.getAll();
        res.json(users.map(({ password, ...u }) => u));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 创建用户
const createUser = (req, res) => {
    try {
        const { username, password, role } = req.body;
        const user = User.create({ username, password, role });
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 更新用户
const updateUser = (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;
        
        // 不允许修改自己的角色
        if (userId === req.user.id) {
            return res.status(403).json({ error: '不能修改自己的角色' });
        }
        
        const user = User.update(userId, { role });
        res.json(user);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

// 修改用户密码
const updatePassword = (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { password } = req.body;
        
        // 只有管理员或用户本人可以修改密码
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ error: '无权限' });
        }
        
        const result = User.updatePassword(userId, password);
        res.json(result);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

// 删除用户
const deleteUser = (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // 不允许删除自己
        if (userId === req.user.id) {
            return res.status(403).json({ error: '不能删除自己' });
        }
        
        const deletedUser = User.delete(userId);
        
        // 删除用户的所有分享链接（文件夹和文件保留）
        Share.deleteByOwner(deletedUser.username);
        
        res.json({ success: true, message: '用户已删除' });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

module.exports = {
    login,
    getUsers,
    createUser,
    updateUser,
    updatePassword,
    deleteUser
};