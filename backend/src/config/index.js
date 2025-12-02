require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
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
            port: parseInt(process.env.MYSQL_PORT) || 3306,
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'file_share',
            connectionLimit: 10
        },
        
        // PostgreSQL配置
        postgresql: {
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT) || 5432,
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
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
    allowedFileTypes: {
        images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
        documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'],
        archives: ['.zip', '.rar', '.7z'],
        media: ['.mp4', '.avi', '.mov', '.mp3', '.wav']
    },
    dangerousFileTypes: ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar', '.app', '.dmg', '.deb', '.rpm'],
    
    // 分享链接配置
    defaultShareExpireDays: parseInt(process.env.DEFAULT_SHARE_EXPIRE_DAYS) || 7,
    shareCodeLength: 6,
    
    // 日志配置
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // 安全配置
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15分钟
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (nodeEnv === 'development' ? 1000 : 100),
    
    // CORS配置
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    
    // 分片上传配置
    chunkSize: 200 * 1024, // 200KB
    
    // 缓存配置
    previewCacheMaxAge: 3600, // 1小时
};
