const BaseAdapter = require('./BaseAdapter');

/**
 * MySQL数据库适配器
 */
class MysqlAdapter extends BaseAdapter {
    constructor(config) {
        super();
        this.config = config;
        this.pool = null;
    }

    async connect() {
        try {
            const mysql = require('mysql2/promise');
            
            this.pool = mysql.createPool(this.config);
            
            // 测试连接
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            
            console.log(`✅ MySQL已连接: ${this.config.host}:${this.config.port}`);
        } catch (error) {
            console.error('MySQL连接失败:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            console.log('✅ MySQL已断开');
        }
    }

    /**
     * 获取表名（将集合名转换为表名）
     */
    _getTableName(collection) {
        return collection;
    }

    /**
     * 构建WHERE子句
     */
    _buildWhereClause(query) {
        if (!query || Object.keys(query).length === 0) {
            return { sql: '', values: [] };
        }

        const conditions = [];
        const values = [];

        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object' && value !== null) {
                if (value.$ne !== undefined) {
                    conditions.push(`${key} != ?`);
                    values.push(value.$ne);
                } else if (value.$in !== undefined) {
                    const placeholders = value.$in.map(() => '?').join(',');
                    conditions.push(`${key} IN (${placeholders})`);
                    values.push(...value.$in);
                } else if (value.$gt !== undefined) {
                    conditions.push(`${key} > ?`);
                    values.push(value.$gt);
                } else if (value.$lt !== undefined) {
                    conditions.push(`${key} < ?`);
                    values.push(value.$lt);
                }
            } else {
                conditions.push(`${key} = ?`);
                values.push(value);
            }
        }

        return {
            sql: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
            values
        };
    }

    async findAll(collection) {
        const tableName = this._getTableName(collection);
        const connection = await this.pool.getConnection();
        
        try {
            const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
            return rows;
        } finally {
            connection.release();
        }
    }

    async find(collection, query) {
        const tableName = this._getTableName(collection);
        const { sql: whereClause, values } = this._buildWhereClause(query);
        const connection = await this.pool.getConnection();
        
        try {
            const [rows] = await connection.query(
                `SELECT * FROM ${tableName} ${whereClause}`,
                values
            );
            return rows;
        } finally {
            connection.release();
        }
    }

    async findById(collection, id) {
        const tableName = this._getTableName(collection);
        const connection = await this.pool.getConnection();
        
        try {
            const [rows] = await connection.query(
                `SELECT * FROM ${tableName} WHERE id = ?`,
                [id]
            );
            return rows.length > 0 ? rows[0] : null;
        } finally {
            connection.release();
        }
    }

    async findOne(collection, query) {
        const results = await this.find(collection, query);
        return results.length > 0 ? results[0] : null;
    }

    async insert(collection, data) {
        const tableName = this._getTableName(collection);
        const connection = await this.pool.getConnection();
        
        try {
            const now = new Date().toISOString();
            const insertData = {
                ...data,
                createdAt: now,
                updatedAt: now
            };

            const columns = Object.keys(insertData);
            const placeholders = columns.map(() => '?').join(',');
            const values = columns.map(col => insertData[col]);

            const [result] = await connection.query(
                `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`,
                values
            );

            return {
                id: result.insertId,
                ...insertData
            };
        } finally {
            connection.release();
        }
    }

    async update(collection, id, data) {
        const tableName = this._getTableName(collection);
        const connection = await this.pool.getConnection();
        
        try {
            const updateData = {
                ...data,
                updatedAt: new Date().toISOString()
            };

            const setClause = Object.keys(updateData)
                .map(key => `${key} = ?`)
                .join(',');
            const values = [...Object.values(updateData), id];

            await connection.query(
                `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
                values
            );

            return await this.findById(collection, id);
        } finally {
            connection.release();
        }
    }

    async delete(collection, id) {
        const tableName = this._getTableName(collection);
        const connection = await this.pool.getConnection();
        
        try {
            const [result] = await connection.query(
                `DELETE FROM ${tableName} WHERE id = ?`,
                [id]
            );
            return result.affectedRows > 0;
        } finally {
            connection.release();
        }
    }

    async deleteMany(collection, query) {
        const tableName = this._getTableName(collection);
        const { sql: whereClause, values } = this._buildWhereClause(query);
        const connection = await this.pool.getConnection();
        
        try {
            const [result] = await connection.query(
                `DELETE FROM ${tableName} ${whereClause}`,
                values
            );
            return result.affectedRows;
        } finally {
            connection.release();
        }
    }

    async transaction(callback) {
        const connection = await this.pool.getConnection();
        
        try {
            await connection.beginTransaction();
            const result = await callback();
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = MysqlAdapter;
