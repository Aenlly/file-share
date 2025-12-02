/**
 * 测试文件移动路由是否正确注册
 */

const express = require('express');
const app = express();

// 模拟认证中间件
const authenticate = (req, res, next) => {
    req.user = { username: 'testuser' };
    next();
};

// 创建一个简单的路由来测试
const router = express.Router();

router.post('/:folderId/move', authenticate, (req, res) => {
    res.json({ success: true, message: '文件移动路由正常工作' });
});

app.use('/api/folders', router);

// 测试路由
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`测试服务器运行在端口 ${PORT}`);
    console.log('尝试访问: POST http://localhost:3001/api/folders/1/move');
});
