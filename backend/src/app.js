require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs-extra');

const config = require('./config');
const { getDatabaseManager } = require('./database/DatabaseManager');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimiter');

// 导入路由
const userRoutes = require('./routes/userRoutes');
const folderRoutes = require('./routes/folderRoutes');
const shareRoutes = require('./routes/shareRoutes');
const publicShareRoutes = require('./routes/publicShareRoutes');

const app = express();

/**
 * 初始化应用
 */
async function initializeApp() {
    try {
        // 初始化数据库
        const dbManager = getDatabaseManager(config);
        await dbManager.initialize();

        // 确保必要的目录存在
        await fs.ensureDir(config.database.json.dataDir);
        await fs.ensureDir('files');
        await fs.ensureDir('logs');

        // 创建默认管理员
        const UserModel = require('./models/UserModel');
        await UserModel.createDefaultAdmin();

        // 安全中间件
        app.use(helmet());

        // CORS配置（支持多个源）
        const allowedOrigins = config.corsOrigin.split(',').map(origin => origin.trim());
        app.use(cors({
            origin: function (origin, callback) {
                // 允许没有 origin 的请求（如 Postman）
                if (!origin) return callback(null, true);
                
                if (allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true
        }));

        // 请求日志
        app.use(requestLogger);

        // 请求体解析
        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ limit: '50mb', extended: true }));

        // 速率限制
        app.use('/api/', apiLimiter);

        // 静态文件服务
        app.use(express.static(path.join(__dirname, '../../frontend/public')));

        // 健康检查端点
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                database: config.database.type
            });
        });

        // API路由
        app.use('/api/users', userRoutes);
        app.use('/api/folders', folderRoutes);
        app.use('/api/shares', shareRoutes);
        app.use('/api', publicShareRoutes);

        // 404处理
        app.use((req, res) => {
            logger.warn(`404 Not Found: ${req.method} ${req.path}`);
            res.status(404).json({ error: '接口不存在' });
        });

        // 错误处理中间件（必须在最后）
        app.use(errorHandler);

        // 启动服务器
        const PORT = config.port;
        app.listen(PORT, () => {
            logger.info(`✅ 服务器运行在端口 ${PORT}`);
            logger.info(`📊 数据库类型: ${config.database.type}`);
            logger.info(`🔐 环境: ${config.nodeEnv}`);
        });

        // 优雅关闭
        process.on('SIGTERM', async () => {
            logger.info('收到SIGTERM信号，开始优雅关闭...');
            await dbManager.close();
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            logger.info('收到SIGINT信号，开始优雅关闭...');
            await dbManager.close();
            process.exit(0);
        });

    } catch (error) {
        logger.error('应用初始化失败:', error);
        process.exit(1);
    }
}

// 启动应用
initializeApp();

module.exports = app;
