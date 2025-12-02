const { getDatabaseManager } = require('../database/DatabaseManager');

/**
 * 基础模型类
 * 提供通用的数据库操作方法
 */
class BaseModel {
    constructor(collectionName) {
        this.collectionName = collectionName;
    }

    /**
     * 获取数据库适配器
     */
    getDb() {
        const manager = getDatabaseManager();
        return manager.getAdapter();
    }

    /**
     * 获取所有记录
     */
    async getAll() {
        return await this.getDb().findAll(this.collectionName);
    }

    /**
     * 根据条件查询
     */
    async find(query) {
        return await this.getDb().find(this.collectionName, query);
    }

    /**
     * 根据ID查询
     */
    async findById(id) {
        return await this.getDb().findById(this.collectionName, id);
    }

    /**
     * 根据条件查询单条
     */
    async findOne(query) {
        return await this.getDb().findOne(this.collectionName, query);
    }

    /**
     * 插入记录
     */
    async insert(data) {
        return await this.getDb().insert(this.collectionName, data);
    }

    /**
     * 更新记录
     */
    async update(id, data) {
        return await this.getDb().update(this.collectionName, id, data);
    }

    /**
     * 删除记录
     */
    async delete(id) {
        return await this.getDb().delete(this.collectionName, id);
    }

    /**
     * 批量删除
     */
    async deleteMany(query) {
        return await this.getDb().deleteMany(this.collectionName, query);
    }

    /**
     * 事务支持
     */
    async transaction(callback) {
        return await this.getDb().transaction(callback);
    }
}

module.exports = BaseModel;
