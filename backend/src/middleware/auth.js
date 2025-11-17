const jwt = require('jsonwebtoken');

const SECRET_KEY = 'your-super-secret-key-change-in-production';

// 认证中间件
const authenticate = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: '未登录' });
    try {
        const token = auth.split(' ')[1];
        req.user = jwt.verify(token, SECRET_KEY);
        next();
    } catch {
        return res.status(403).json({ error: '令牌无效' });
    }
};

// 管理员权限中间件
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

module.exports = {
    authenticate,
    requireAdmin,
    SECRET_KEY
};