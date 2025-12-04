require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs-extra');

const config = require('./config/index');
const { getDatabaseManager } = require('./database/DatabaseManager');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const requestIdMiddleware = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimiter');

// 导入路由
const userRoutes = require('./routes/userRoutes');
const folderRoutes = require('./routes/folderRoutes');
const shareRoutes = require('./routes/shareRoutes');
const publicShareRoutes = require('./routes/publicShareRoutes');
const recycleBinRoutes = require('./routes/recycleBinRoutes');

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

        // 请求ID中间件（必须在最前面，确保所有日志都有请求ID）
        app.use(requestIdMiddleware);

        // 安全中间件
        app.use(helmet());

        // CORS配置（支持多个源）
        const allowedOrigins = config.corsOrigin.split(',').map(origin => origin.trim());
        
        // 生产环境的 CORS 配置
        if (config.nodeEnv === 'production') {
            // 生产环境：允许所有源或配置的源
            if (config.corsOrigin === '*' || allowedOrigins.includes('*')) {
                app.use(cors({
                    origin: true,
                    credentials: true,
                    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                    allowedHeaders: ['Content-Type', 'Authorization']
                }));
            } else {
                app.use(cors({
                    origin: function (origin, callback) {
                        // 允许没有 origin 的请求（如直接访问、Postman、同源请求）
                        if (!origin) return callback(null, true);
                        
                        // 检查是否在允许列表中
                        if (allowedOrigins.indexOf(origin) !== -1) {
                            callback(null, true);
                        } else {
                            // 生产环境记录但允许请求
                            logger.warn(`CORS: 未配置的源尝试访问: ${origin}`);
                            callback(null, true); // 允许但记录日志
                        }
                    },
                    credentials: true,
                    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                    allowedHeaders: ['Content-Type', 'Authorization']
                }));
            }
        } else {
            // 开发环境：更宽松的配置
            app.use(cors({
                origin: function (origin, callback) {
                    // 允许没有 origin 的请求
                    if (!origin) return callback(null, true);
                    
                    if (allowedOrigins.indexOf(origin) !== -1) {
                        callback(null, true);
                    } else {
                        logger.warn(`CORS: 未配置的源尝试访问: ${origin}`);
                        callback(null, true); // 开发环境允许所有
                    }
                },
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization']
            }));
        }

        // 请求日志
        app.use(requestLogger);

        // 请求体解析 - 增加限制以支持大文件上传
        const bodyLimit = process.env.BODY_LIMIT || '500mb';
        app.use(express.json({ limit: bodyLimit }));
        app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

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
        app.use('/api/folders/trash', recycleBinRoutes);  // 必须在 folderRoutes 之前
        app.use('/api/folders', folderRoutes);
        app.use('/api/shares', shareRoutes);
        app.use('/api', publicShareRoutes);

        // 404处理
        const { sendError } = require('./config/errorCodes');
        app.use((req, res) => {
            logger.warn(`404 Not Found: ${req.method} ${req.path}`);
            sendError(res, 'RESOURCE_NOT_FOUND', '接口不存在');
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

        // 启动回收站自动清理任务（数据库初始化后）
        const { cleanExpiredTrashFiles } = require('./routes/folderRoutes');
        if (cleanExpiredTrashFiles) {
            // 每天执行一次自动清理
            setInterval(cleanExpiredTrashFiles, 24 * 60 * 60 * 1000);
            // 启动时执行一次
            cleanExpiredTrashFiles().catch(err => {
                logger.error('首次清理回收站失败:', err);
            });
            logger.info('🗑️  回收站自动清理任务已启动（每24小时执行一次）');
        }

        // 全局未捕获异常处理
        process.on('uncaughtException', (error) => {
            logger.error('未捕获的异常:', error);
            logger.error('堆栈:', error.stack);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('未处理的Promise拒绝:', reason);
            logger.error('Promise:', promise);
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
