const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { DATA_DIR, FILES_ROOT } = require('./utils/fileHelpers');

// 导入模型
const User = require('./models/User');

// 导入路由
const userRoutes = require('./routes/userRoutes');
const folderRoutes = require('./routes/folderRoutes');
const shareRoutes = require('./routes/shareRoutes');
const fileMoveRoutes = require('./routes/fileMoveRoutes');
const publicShareRoutes = require('./routes/publicShareRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保数据目录存在
[DATA_DIR, FILES_ROOT].forEach(dir => fs.ensureDirSync(dir));

// 创建默认管理员
User.createDefaultAdmin();

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务（用于访客页面）
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// API路由
app.use('/api/users', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/folders', fileMoveRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api', publicShareRoutes);

// 404处理
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;