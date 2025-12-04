/**
 * 启动检查工具
 * 在应用启动时检查关键配置和环境
 */

const config = require('../config');
const logger = require('./logger');

/**
 * 检查 JWT Secret 配置
 */
function checkJwtSecret() {
    const defaultSecret = 'dev-secret-key-change-in-production';
    
    if (!config.jwtSecret) {
        logger.error('❌ JWT_SECRET 未配置！');
        throw new Error('JWT_SECRET 环境变量未设置，应用无法启动');
    }
    
    if (config.nodeEnv === 'production' && config.jwtSecret === defaultSecret) {
        logger.error('❌ 生产环境使用了默认的 JWT_SECRET！');
        throw new Error('生产环境必须设置自定义的 JWT_SECRET，不能使用默认值');
    }
    
    if (config.jwtSecret.length < 32) {
        logger.warn('⚠️  JWT_SECRET 长度过短，建议至少32个字符');
    }
    
    logger.info('✅ JWT Secret 配置检查通过');
}

/**
 * 检查数据库配置
 */
function checkDatabaseConfig() {
    if (!config.database || !config.database.type) {
        logger.error('❌ 数据库类型未配置！');
        throw new Error('DB_TYPE 环境变量未设置');
    }
    
    const dbType = config.database.type.toLowerCase();
    
    // 检查各数据库的必要配置
    if (dbType === 'mysql') {
        const mysqlConfig = config.database.mysql;
        if (!mysqlConfig.host || !mysqlConfig.user || !mysqlConfig.database) {
            logger.error('❌ MySQL 配置不完整！');
            throw new Error('MySQL 配置缺少必要参数（host, user, database）');
        }
    } else if (dbType === 'postgresql') {
        const pgConfig = config.database.postgresql;
        if (!pgConfig.host || !pgConfig.user || !pgConfig.database) {
            logger.error('❌ PostgreSQL 配置不完整！');
            throw new Error('PostgreSQL 配置缺少必要参数（host, user, database）');
        }
    } else if (dbType === 'mongodb') {
        const mongoConfig = config.database.mongodb;
        if (!mongoConfig.uri) {
            logger.error('❌ MongoDB 配置不完整！');
            throw new Error('MongoDB 配置缺少 URI');
        }
    }
    
    logger.info(`✅ 数据库配置检查通过（类型: ${dbType}）`);
}

/**
 * 检查文件上传配置
 */
function checkFileUploadConfig() {
    if (!config.maxFileSize || config.maxFileSize <= 0) {
        logger.warn('⚠️  MAX_FILE_SIZE 未配置或无效，使用默认值');
    }
    
    if (!config.dangerousFileTypes || config.dangerousFileTypes.length === 0) {
        logger.warn('⚠️  危险文件类型列表为空，建议配置');
    }
    
    logger.info('✅ 文件上传配置检查通过');
}

/**
 * 检查 CORS 配置
 */
function checkCorsConfig() {
    if (config.nodeEnv === 'production' && config.corsOrigin === '*') {
        logger.warn('⚠️  生产环境 CORS 配置为 *，存在安全风险');
    }
    
    logger.info('✅ CORS 配置检查通过');
}

/**
 * 检查日志配置
 */
function checkLogConfig() {
    if (!config.log || !config.log.dir) {
        logger.warn('⚠️  日志目录未配置，使用默认值');
    }
    
    logger.info('✅ 日志配置检查通过');
}

/**
 * 生成安全建议
 */
function generateSecurityRecommendations() {
    const recommendations = [];
    
    if (config.nodeEnv === 'production') {
        if (config.jwtSecret.length < 64) {
            recommendations.push('建议 JWT_SECRET 长度至少64个字符');
        }
        
        if (!process.env.JWT_SECRET) {
            recommendations.push('建议通过环境变量设置 JWT_SECRET');
        }
        
        if (config.corsOrigin === '*') {
            recommendations.push('建议限制 CORS 允许的源');
        }
    }
    
    return recommendations;
}

/**
 * 执行所有启动检查
 */
function runStartupChecks() {
    logger.info('🔍 开始启动检查...');
    
    try {
        // 必要检查（失败则终止启动）
        checkJwtSecret();
        checkDatabaseConfig();
        
        // 警告检查（失败仅警告）
        checkFileUploadConfig();
        checkCorsConfig();
        checkLogConfig();
        
        // 生成安全建议
        const recommendations = generateSecurityRecommendations();
        if (recommendations.length > 0) {
            logger.info('💡 安全建议:');
            recommendations.forEach(rec => logger.info(`   - ${rec}`));
        }
        
        logger.info('✅ 所有启动检查通过');
        logger.info('');
        
        return true;
    } catch (error) {
        logger.error('❌ 启动检查失败:', error.message);
        logger.error('');
        logger.error('应用无法启动，请修复上述问题后重试');
        return false;
    }
}

module.exports = {
    runStartupChecks,
    checkJwtSecret,
    checkDatabaseConfig,
    checkFileUploadConfig,
    checkCorsConfig,
    checkLogConfig
};
