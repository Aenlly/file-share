const JsonAdapter = require('./adapters/JsonAdapter');
const MongoDbAdapter = require('./adapters/MongoDbAdapter');
const MysqlAdapter = require('./adapters/MysqlAdapter');
const PostgresqlAdapter = require('./adapters/PostgresqlAdapter');

/**
 * 数据库管理器
 * 负责初始化和管理数据库适配器
 */
class DatabaseManager {
    constructor(config) {
        if (!config) {
            throw new Error('DatabaseManager: config is required');
        }
        if (!config.database) {
            throw new Error('DatabaseManager: config.database is required');
        }
        this.config = config;
        this.adapter = null;
    }

    /**
     * 初始化数据库适配器
     */
    async initialize() {
        const dbType = this.config.database.type.toLowerCase();

        switch (dbType) {
            case 'json':
                this.adapter = new JsonAdapter(this.config.database.json);
                break;
            
            case 'mongodb':
                this.adapter = new MongoDbAdapter(this.config.database.mongodb);
                break;
            
            case 'mysql':
                this.adapter = new MysqlAdapter(this.config.database.mysql);
                break;
            
            case 'postgresql':
                this.adapter = new PostgresqlAdapter(this.config.database.postgresql);
                break;
            
            default:
                throw new Error(`不支持的数据库类型: ${dbType}`);
        }

        await this.adapter.connect();
        const logger = require('../utils/logger');
        logger.info(`数据库管理器已初始化，使用${dbType}适配器`);
    }

    /**
     * 获取适配器
     */
    getAdapter() {
        if (!this.adapter) {
            throw new Error('数据库管理器未初始化');
        }
        return this.adapter;
    }

    /**
     * 关闭数据库连接
     */
    async close() {
        if (this.adapter) {
            await this.adapter.disconnect();
        }
    }
}

// 单例模式
let instance = null;

/**
 * 获取或创建数据库管理器实例
 */
function getDatabaseManager(config) {
    if (!instance && config) {
        instance = new DatabaseManager(config);
    } else if (!instance) {
        throw new Error('DatabaseManager: config is required for first initialization');
    }
    return instance;
}

module.exports = {
    DatabaseManager,
    getDatabaseManager
};
