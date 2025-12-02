/**
 * 测试路由是否正确注册
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

// 测试路由
router.get('/', authenticate, (req, res) => {
    res.json({ message: '获取所有文件夹' });
});

router.post('/', authenticate, (req, res) => {
    res.json({ message: '创建文件夹' });
});

router.get('/:folderId/files', authenticate, (req, res) => {
    res.json({ message: '获取文件夹内的文件' });
});

router.post('/:folderId/upload', authenticate, (req, res) => {
    res.json({ message: '上传文件' });
});

router.delete('/:folderId/file', authenticate, (req, res) => {
    res.json({ message: '删除文件' });
});

router.get('/:folderId/download/:filename', authenticate, (req, res) => {
    res.json({ message: '下载文件' });
});

router.post('/:folderId/move', authenticate, (req, res) => {
    res.json({ success: true, message: '文件移动成功' });
});

router.get('/:folderId', authenticate, (req, res) => {
    res.json({ message: '获取文件夹详情' });
});

router.delete('/:folderId', authenticate, (req, res) => {
    res.json({ message: '删除文件夹' });
});

router.get('/:folderId/subfolders', authenticate, (req, res) => {
    res.json({ message: '获取子文件夹' });
});

// 注册路由
app.use('/api/folders', router);

// 启动测试服务器
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`测试服务器运行在端口 ${PORT}`);
    console.log('');
    console.log('测试路由：');
    console.log('  GET    http://localhost:3001/api/folders');
    console.log('  POST   http://localhost:3001/api/folders');
    console.log('  GET    http://localhost:3001/api/folders/1/files');
    console.log('  POST   http://localhost:3001/api/folders/1/upload');
    console.log('  DELETE http://localhost:3001/api/folders/1/file');
    console.log('  GET    http://localhost:3001/api/folders/1/download/test.txt');
    console.log('  POST   http://localhost:3001/api/folders/1/move');
    console.log('  GET    http://localhost:3001/api/folders/1');
    console.log('  DELETE http://localhost:3001/api/folders/1');
    console.log('  GET    http://localhost:3001/api/folders/1/subfolders');
});
