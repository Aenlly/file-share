/**
 * 数据库适配器基类
 * 定义所有数据库适配器必须实现的接口
 */
class BaseAdapter {
    constructor() {
        if (new.target === BaseAdapter) {
            throw new Error('BaseAdapter是抽象类，不能直接实例化');
        }
    }

    /**
     * 初始化数据库连接
     */
    async connect() {
        throw new Error('connect方法必须被实现');
    }

    /**
     * 关闭数据库连接
     */
    async disconnect() {
        throw new Error('disconnect方法必须被实现');
    }

    /**
     * 查询所有记录
     * @param {string} collection - 集合/表名
     * @returns {Promise<Array>}
     */
    async findAll(collection) {
        throw new Error('findAll方法必须被实现');
    }

    /**
     * 根据条件查询记录
     * @param {string} collection - 集合/表名
     * @param {Object} query - 查询条件
     * @returns {Promise<Array>}
     */
    async find(collection, query) {
        throw new Error('find方法必须被实现');
    }

    /**
     * 根据ID查询单条记录
     * @param {string} collection - 集合/表名
     * @param {number|string} id - 记录ID
     * @returns {Promise<Object|null>}
     */
    async findById(collection, id) {
        throw new Error('findById方法必须被实现');
    }

    /**
     * 根据条件查询单条记录
     * @param {string} collection - 集合/表名
     * @param {Object} query - 查询条件
     * @returns {Promise<Object|null>}
     */
    async findOne(collection, query) {
        throw new Error('findOne方法必须被实现');
    }

    /**
     * 插入记录
     * @param {string} collection - 集合/表名
     * @param {Object} data - 要插入的数据
     * @returns {Promise<Object>} 插入后的记录（包含ID）
     */
    async insert(collection, data) {
        throw new Error('insert方法必须被实现');
    }

    /**
     * 更新记录
     * @param {string} collection - 集合/表名
     * @param {number|string} id - 记录ID
     * @param {Object} data - 要更新的数据
     * @returns {Promise<Object>} 更新后的记录
     */
    async update(collection, id, data) {
        throw new Error('update方法必须被实现');
    }

    /**
     * 删除记录
     * @param {string} collection - 集合/表名
     * @param {number|string} id - 记录ID
     * @returns {Promise<boolean>} 是否删除成功
     */
    async delete(collection, id) {
        throw new Error('delete方法必须被实现');
    }

    /**
     * 根据条件删除多条记录
     * @param {string} collection - 集合/表名
     * @param {Object} query - 查询条件
     * @returns {Promise<number>} 删除的记录数
     */
    async deleteMany(collection, query) {
        throw new Error('deleteMany方法必须被实现');
    }

    /**
     * 事务支持（可选）
     * @param {Function} callback - 事务回调函数
     * @returns {Promise<any>}
     */
    async transaction(callback) {
        // 默认实现：不支持事务，直接执行
        return await callback();
    }
}

module.exports = BaseAdapter;
