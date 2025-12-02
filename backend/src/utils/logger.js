const winston = require('winston');
const config = require('../config');

/**
 * 日志系统
 * 支持多种日志级别和输出格式
 */
const logger = winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            const levelUpper = level.toUpperCase();
            if (stack) {
                return `[${timestamp}] ${levelUpper}: ${message}\n${stack}`;
            }
            return `[${timestamp}] ${levelUpper}: ${message}`;
        })
    ),
    transports: [
        // 控制台输出
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, stack }) => {
                    if (stack) {
                        return `[${timestamp}] ${level}: ${message}\n${stack}`;
                    }
                    return `[${timestamp}] ${level}: ${message}`;
                })
            )
        }),
        
        // 错误日志文件
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // 所有日志文件
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// 如果不是生产环境，添加更详细的日志
if (config.nodeEnv !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

module.exports = logger;
