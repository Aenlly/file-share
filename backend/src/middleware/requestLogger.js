const logger = require('../utils/logger');

/**
 * 请求日志中间件
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    // 监听响应完成事件
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
        
        logger[logLevel](
            `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`,
            {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
                ip: req.ip,
                userAgent: req.get('user-agent')
            }
        );
    });

    next();
};

module.exports = requestLogger;
