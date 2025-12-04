require('dotenv').config();

const { safeParseInt } = require('./helpers');

const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * @typedef {Object} DatabaseConfig
 * @property {'json'|'mongodb'|'mysql'|'postgresql'} type - 数据库类型
 * @property {Object} json - JSON数据库配置
 * @property {string} json.dataDir - 数据目录
 * @property {Object} mongodb - MongoDB配置
 * @property {string} mongodb.uri - 连接URI
 * @property {Object} mongodb.options - 连接选项
 * @property {Object} mysql - MySQL配置
 * @property {string} mysql.host - 主机地址
 * @property {number} mysql.port - 端口号
 * @property {string} mysql.user - 用户名
 * @property {string} mysql.password - 密码
 * @property {string} mysql.database - 数据库名
 * @property {number} mysql.connectionLimit - 连接池大小
 * @property {Object} postgresql - PostgreSQL配置
 * @property {string} postgresql.host - 主机地址
 * @property {number} postgresql.port - 端口号
 * @property {string} postgresql.user - 用户名
 * @property {string} postgresql.password - 密码
 * @property {string} postgresql.database - 数据库名
 * @property {number} postgresql.max - 最大连接数
 */

/**
 * @typedef {Object} LogConfig
 * @property {string} level - 日志级别 (error, warn, info, debug)
 * @property {string} dir - 日志目录
 * @property {number} maxSize - 单个日志文件最大大小（字节）
 * @property {number} maxFiles - 每天最多日志文件数
 * @property {number} maxDays - 日志保留天数
 */

/**
 * @typedef {Object} AllowedFileTypes
 * @property {string[]} images - 图片类型
 * @property {string[]} documents - 文档类型
 * @property {string[]} archives - 压缩包类型
 * @property {string[]} media - 媒体类型
 */

/**
 * @typedef {Object} AppConfig
 * @property {number} port - 服务器端口号
 * @property {string} nodeEnv - 运行环境 (development, production)
 * @property {DatabaseConfig} database - 数据库配置
 * @property {string} jwtSecret - JWT密钥
 * @property {string} jwtExpiresIn - JWT过期时间
 * @property {number} maxFileSize - 最大文件大小（字节）
 * @property {string} bodyLimit - Express请求体大小限制
 * @property {AllowedFileTypes} allowedFileTypes - 允许的文件类型
 * @property {string[]} dangerousFileTypes - 危险文件类型
 * @property {number} defaultShareExpireDays - 默认分享过期天数
 * @property {number} shareCodeLength - 分享码长度
 * @property {LogConfig} log - 日志配置
 * @property {string} logLevel - 日志级别（兼容旧配置）
 * @property {number} rateLimitWindowMs - 速率限制时间窗口（毫秒）
 * @property {number} rateLimitMaxRequests - 速率限制最大请求数
 * @property {string} corsOrigin - CORS允许的源
 * @property {number} chunkSize - 分片大小（字节）
 * @property {number} defaultUserQuota - 默认用户存储配额（字节）
 * @property {number} recycleBinRetentionDays - 回收站保留天数
 * @property {number} sessionTimeoutMs - 会话超时时间（毫秒）
 * @property {number} uploadSessionTimeoutMs - 上传会话超时时间（毫秒）
 * @property {number} tempFileCleanupIntervalMs - 临时文件清理间隔（毫秒）
 * @property {number} maxConcurrentUploads - 最大并发上传数
 * @property {number} previewCacheMaxAge - 预览缓存时间（秒）
 * @property {string} filesDir - 文件存储目录
 */

/**
 * 验证配置
 * @param {AppConfig} config - 配置对象
 * @throws {Error} 配置验证失败时抛出错误
 */
function validateConfig(config) {
    const errors = [];
    const warnings = [];
    
    // 验证 JWT Secret（生产环境）
    if (config.nodeEnv === 'production') {
        if (config.jwtSecret === 'dev-secret-key-change-in-production') {
            errors.push('⚠️  生产环境必须修改 JWT_SECRET，当前使用的是默认值，存在安全风险！');
        }
        
        if (config.jwtSecret.length < 32) {
            warnings.push('⚠️  JWT_SECRET 长度建议至少32个字符');
        }
    }
    
    // 验证端口
    if (config.port < 1 || config.port > 65535) {
        errors.push(`❌ PORT 必须在 1-65535 之间，当前值: ${config.port}`);
    }
    
    // 验证文件大小配置
    if (config.maxFileSize <= 0) {
        errors.push(`❌ MAX_FILE_SIZE 必须大于 0，当前值: ${config.maxFileSize}`);
    }
    
    if (config.maxFileSize > 10 * 1024 * 1024 * 1024) { // 10GB
        warnings.push(`⚠️  MAX_FILE_SIZE 设置过大 (${Math.round(config.maxFileSize / 1024 / 1024 / 1024)}GB)，可能导致内存问题`);
    }
    
    // 验证速率限制
    if (config.rateLimitMaxRequests <= 0) {
        errors.push(`❌ RATE_LIMIT_MAX_REQUESTS 必须大于 0，当前值: ${config.rateLimitMaxRequests}`);
    }
    
    if (config.rateLimitWindowMs <= 0) {
        errors.push(`❌ RATE_LIMIT_WINDOW_MS 必须大于 0，当前值: ${config.rateLimitWindowMs}`);
    }
    
    // 验证存储配额
    if (config.defaultUserQuota <= 0) {
        errors.push(`❌ DEFAULT_USER_QUOTA 必须大于 0，当前值: ${config.defaultUserQuota}`);
    }
    
    // 验证数据库类型
    const validDbTypes = ['json', 'mongodb', 'mysql', 'postgresql'];
    if (!validDbTypes.includes(config.database.type)) {
        errors.push(`❌ DB_TYPE 必须是以下之一: ${validDbTypes.join(', ')}，当前值: ${config.database.type}`);
    }
    
    // 输出警告
    if (warnings.length > 0) {
        console.warn('\n⚠️  配置警告:');
        warnings.forEach(warning => console.warn('  ' + warning));
    }
    
    // 输出错误并抛出异常
    if (errors.length > 0) {
        console.error('\n❌ 配置验证失败:');
        errors.forEach(error => console.error('  ' + error));
        throw new Error('配置验证失败，请检查环境变量配置');
    }
}

/**
 * 应用配置对象
 * @type {AppConfig}
 */
const configObject = {
    // 服务器配置
    port: process.env.PORT || 3000,
    nodeEnv: nodeEnv,
    
    // 数据库配置
    database: {
        type: process.env.DB_TYPE || 'json', // json, mongodb, mysql, postgresql
        
        // JSON配置
        json: {
            dataDir: process.env.JSON_DATA_DIR || './data'
        },
        
        // MongoDB配置
        mongodb: {
            uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/file-share',
            options: {
                useNewUrlParser: true,
                useUnifiedTopology: true
            }
        },
        
        // MySQL配置
        mysql: {
            host: process.env.MYSQL_HOST || 'localhost',
            port: safeParseInt(process.env.MYSQL_PORT, 3306),
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'file_share',
            connectionLimit: 10
        },
        
        // PostgreSQL配置
        postgresql: {
            host: process.env.PG_HOST || 'localhost',
            port: safeParseInt(process.env.PG_PORT, 5432),
            user: process.env.PG_USER || 'postgres',
            password: process.env.PG_PASSWORD || '',
            database: process.env.PG_DATABASE || 'file_share',
            max: 10
        }
    },
    
    // JWT配置
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    jwtExpiresIn: '7d',
    
    // 文件上传配置
    maxFileSizeBytes: safeParseInt(process.env.MAX_FILE_SIZE, 524288000), // 最大文件大小：500MB = 524288000字节
    maxFileSize: safeParseInt(process.env.MAX_FILE_SIZE, 524288000), // 兼容旧代码：最大文件大小（字节）
    bodyLimit: process.env.BODY_LIMIT || '500mb', // Express请求体大小限制（字符串格式，如 '500mb'）
    allowedFileTypes: {
        images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
        documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'],
        archives: ['.zip', '.rar', '.7z'],
        media: ['.mp4', '.avi', '.mov', '.mp3', '.wav']
    },
    dangerousFileTypes: ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar', '.app', '.dmg', '.deb', '.rpm'],
    
    // 分享链接配置
    defaultShareExpireDays: safeParseInt(process.env.DEFAULT_SHARE_EXPIRE_DAYS, 7),
    shareCodeLength: 6,
    
    // 日志配置
    log: {
        level: process.env.LOG_LEVEL || 'info', // 日志级别：error, warn, info, debug
        dir: process.env.LOG_DIR || './logs', // 日志目录路径
        maxSizeBytes: safeParseInt(process.env.LOG_FILE_MAX_SIZE, 20 * 1024 * 1024), // 单个日志文件最大大小：20MB = 20971520字节
        maxSize: safeParseInt(process.env.LOG_MAX_SIZE, 20 * 1024 * 1024), // 兼容旧代码：单个日志文件最大大小（字节）
        maxFilesPerDay: safeParseInt(process.env.LOG_MAX_FILES_PER_DAY, 10), // 每天最多日志文件数：10个
        maxFiles: safeParseInt(process.env.LOG_MAX_FILES, 10), // 兼容旧代码：每天最多日志文件数
        retentionDays: safeParseInt(process.env.LOG_RETENTION_DAYS, 30), // 日志保留天数：30天
        maxDays: safeParseInt(process.env.LOG_MAX_DAYS, 30), // 兼容旧代码：日志保留天数
    },
    logLevel: process.env.LOG_LEVEL || 'info', // 兼容旧配置
    
    // 安全配置 - 速率限制（类似 Sentinel 的限流策略）
    rateLimitWindowMs: safeParseInt(process.env.RATE_LIMIT_WINDOW_MS, 900000), // 速率限制时间窗口：15分钟 = 900000毫秒
    rateLimitMaxRequests: safeParseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100), // 时间窗口内最大请求数：100次
    
    // CORS配置
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    
    // 分片上传配置
    chunkSizeBytes: safeParseInt(process.env.CHUNK_SIZE, 20 * 1024 * 1024), // 分片大小：20MB = 20971520字节
    chunkSize: safeParseInt(process.env.CHUNK_SIZE, 20 * 1024 * 1024), // 兼容旧代码：分片大小（字节）
    
    // 存储配额配置
    defaultUserQuotaBytes: safeParseInt(process.env.DEFAULT_USER_QUOTA, 10 * 1024 * 1024 * 1024), // 默认用户存储配额：10GB = 10737418240字节
    defaultUserQuota: safeParseInt(process.env.DEFAULT_USER_QUOTA, 10 * 1024 * 1024 * 1024), // 兼容旧代码：默认用户存储配额（字节）
    
    // 回收站配置
    recycleBinRetentionDays: safeParseInt(process.env.RECYCLE_BIN_RETENTION_DAYS, 30), // 回收站文件保留天数：30天
    
    // 会话配置
    sessionTimeoutMs: safeParseInt(process.env.SESSION_TIMEOUT_MS, 3600000), // 会话超时时间：1小时 = 3600000毫秒
    uploadSessionTimeoutMs: safeParseInt(process.env.UPLOAD_SESSION_TIMEOUT_MS, 3600000), // 上传会话超时时间：1小时 = 3600000毫秒
    
    // 临时文件清理配置
    tempFileCleanupIntervalMs: safeParseInt(process.env.TEMP_FILE_CLEANUP_INTERVAL_MS, 3600000), // 临时文件清理间隔：1小时 = 3600000毫秒
    
    // 性能配置
    maxConcurrentUploads: safeParseInt(process.env.MAX_CONCURRENT_UPLOADS, 5), // 最大并发上传数：5个
    
    // 缓存配置
    previewCacheMaxAgeSeconds: safeParseInt(process.env.PREVIEW_CACHE_MAX_AGE, 3600), // 预览缓存时间：1小时 = 3600秒
    previewCacheMaxAge: safeParseInt(process.env.PREVIEW_CACHE_MAX_AGE, 3600), // 兼容旧代码：预览缓存时间（秒）
    
    // 目录配置
    filesDir: process.env.FILES_DIR || './files', // 文件存储目录
};

// 验证配置
validateConfig(configObject);

/**
 * 导出应用配置
 * @type {AppConfig}
 */
module.exports = configObject;
