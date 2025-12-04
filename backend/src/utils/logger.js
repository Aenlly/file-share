const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 日志配置
const logConfig = config.log || {
    level: config.logLevel || 'info',
    dir: './logs',
    maxSize: 20 * 1024 * 1024, // 20MB
    maxFiles: 10,
    maxDays: 30
};

// 确保日志目录存在
const logDir = path.resolve(logConfig.dir);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 请求ID存储（使用 AsyncLocalStorage 实现上下文传递）
const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

/**
 * 获取当前请求ID
 */
function getRequestId() {
    const store = asyncLocalStorage.getStore();
    return store?.requestId || '-';
}

/**
 * 设置请求上下文
 */
function runWithRequestId(requestId, callback) {
    return asyncLocalStorage.run({ requestId }, callback);
}

/**
 * 生成请求ID
 */
function generateRequestId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
}

/**
 * 获取当前日期字符串 YYYY-MM-DD
 */
function getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}


/**
 * 自定义日期+大小分片 Transport
 */
class DailyRotateFileTransport extends winston.transports.File {
    constructor(options) {
        const dateStr = getDateString();
        const baseName = options.baseName || 'app';
        const filename = path.join(logDir, `${dateStr}-${baseName}-0.log`);
        
        super({
            ...options,
            filename,
            maxsize: logConfig.maxSize,
        });
        
        this.baseName = baseName;
        this.currentDate = dateStr;
        this.currentIndex = 0;
        this.logDir = logDir;
        this.maxSize = logConfig.maxSize;
        this.maxFiles = logConfig.maxFiles;
        
        // 启动时检查当前日期的日志文件
        this._initCurrentFile();
    }
    
    /**
     * 初始化当前文件（找到最新的分片）
     */
    _initCurrentFile() {
        const dateStr = getDateString();
        let index = 0;
        
        // 找到当天最新的日志文件
        while (index < this.maxFiles) {
            const filename = path.join(this.logDir, `${dateStr}-${this.baseName}-${index}.log`);
            if (fs.existsSync(filename)) {
                const stats = fs.statSync(filename);
                if (stats.size < this.maxSize) {
                    // 文件未满，使用这个文件
                    this.filename = filename;
                    this.currentIndex = index;
                    break;
                }
                index++;
            } else {
                // 文件不存在，创建新文件
                this.filename = filename;
                this.currentIndex = index;
                break;
            }
        }
        
        // 如果超过最大分片数，使用最后一个
        if (index >= this.maxFiles) {
            this.currentIndex = this.maxFiles - 1;
            this.filename = path.join(this.logDir, `${dateStr}-${this.baseName}-${this.currentIndex}.log`);
        }
        
        this.currentDate = dateStr;
    }
    
    /**
     * 检查是否需要轮转
     */
    _checkRotation() {
        const dateStr = getDateString();
        
        // 日期变化，重置索引
        if (dateStr !== this.currentDate) {
            this.currentDate = dateStr;
            this.currentIndex = 0;
            this.filename = path.join(this.logDir, `${dateStr}-${this.baseName}-0.log`);
            return;
        }
        
        // 检查文件大小
        if (fs.existsSync(this.filename)) {
            const stats = fs.statSync(this.filename);
            if (stats.size >= this.maxSize && this.currentIndex < this.maxFiles - 1) {
                this.currentIndex++;
                this.filename = path.join(this.logDir, `${dateStr}-${this.baseName}-${this.currentIndex}.log`);
            }
        }
    }
    
    log(info, callback) {
        this._checkRotation();
        super.log(info, callback);
    }
}


/**
 * 自定义日志格式（包含请求ID）
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const requestId = getRequestId();
        const levelUpper = level.toUpperCase().padEnd(5);
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        
        if (stack) {
            return `[${timestamp}] [${requestId}] ${levelUpper}: ${message}${metaStr}\n${stack}`;
        }
        return `[${timestamp}] [${requestId}] ${levelUpper}: ${message}${metaStr}`;
    })
);

/**
 * 控制台格式（带颜色）
 */
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        const requestId = getRequestId();
        const reqIdStr = requestId !== '-' ? `[${requestId}] ` : '';
        
        if (stack) {
            return `[${timestamp}] ${reqIdStr}${level}: ${message}\n${stack}`;
        }
        return `[${timestamp}] ${reqIdStr}${level}: ${message}`;
    })
);

/**
 * 创建 Logger 实例
 */
const logger = winston.createLogger({
    level: logConfig.level,
    format: logFormat,
    transports: [
        // 控制台输出
        new winston.transports.Console({
            format: consoleFormat
        }),
        
        // 综合日志（按日期+大小分片）
        new DailyRotateFileTransport({
            baseName: 'combined',
            level: 'info'
        }),
        
        // 错误日志（按日期+大小分片）
        new DailyRotateFileTransport({
            baseName: 'error',
            level: 'error'
        })
    ]
});

/**
 * 清理过期日志文件
 */
function cleanupOldLogs() {
    const maxDays = logConfig.maxDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDays);
    
    try {
        const files = fs.readdirSync(logDir);
        
        files.forEach(file => {
            // 匹配日志文件名格式: YYYY-MM-DD-xxx-N.log
            const match = file.match(/^(\d{4}-\d{2}-\d{2})-\w+-\d+\.log$/);
            if (match) {
                const fileDate = new Date(match[1]);
                if (fileDate < cutoffDate) {
                    const filePath = path.join(logDir, file);
                    fs.unlinkSync(filePath);
                    console.log(`[Logger] 清理过期日志: ${file}`);
                }
            }
        });
    } catch (error) {
        console.error('[Logger] 清理日志失败:', error.message);
    }
}

// 启动时清理一次过期日志
cleanupOldLogs();

// 每天凌晨清理一次
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

// 导出
module.exports = logger;
module.exports.getRequestId = getRequestId;
module.exports.runWithRequestId = runWithRequestId;
module.exports.generateRequestId = generateRequestId;
module.exports.asyncLocalStorage = asyncLocalStorage;
