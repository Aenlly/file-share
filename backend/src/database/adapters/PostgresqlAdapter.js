const BaseAdapter = require('./BaseAdapter');

/**
 * PostgreSQL数据库适配器
 */
class PostgresqlAdapter extends BaseAdapter {
    constructor(config) {
        super();
        this.config = config;
        this.pool = null;
    }

    async connect() {
        try {
            const { Pool } = require('pg');
            
            this.pool = new Pool(this.config);
            
            // 测试连接
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            const logger = require('../../utils/logger');
            logger.info(`PostgreSQL已连接: ${this.config.host}:${this.config.port}`);
        } catch (error) {
            console.error('PostgreSQL连接失败:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            const logger = require('../../utils/logger');
            logger.info('PostgreSQL已断开');
        }
    }

    /**
     * 获取表名
     */
    _getTableName(collection) {
        return collection;
    }

    /**
     * 构建WHERE子句
     */
    _buildWhereClause(query) {
        if (!query || Object.keys(query).length === 0) {
            return { sql: '', values: [], paramCount: 0 };
        }

        const conditions = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object' && value !== null) {
                if (value.$ne !== undefined) {
                    conditions.push(`${key} != $${paramCount}`);
                    values.push(value.$ne);
                    paramCount++;
                } else if (value.$in !== undefined) {
                    const placeholders = value.$in.map(() => `$${paramCount++}`).join(',');
                    conditions.push(`${key} IN (${placeholders})`);
                    values.push(...value.$in);
                } else if (value.$gt !== undefined) {
                    conditions.push(`${key} > $${paramCount}`);
                    values.push(value.$gt);
                    paramCount++;
                } else if (value.$lt !== undefined) {
                    conditions.push(`${key} < $${paramCount}`);
                    values.push(value.$lt);
                    paramCount++;
                }
            } else {
                conditions.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        return {
            sql: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
            values,
            paramCount
        };
    }

    async findAll(collection) {
        const tableName = this._getTableName(collection);
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`SELECT * FROM ${tableName}`);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async find(collection, query) {
        const tableName = this._getTableName(collection);
        const { sql: whereClause, values } = this._buildWhereClause(query);
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `SELECT * FROM ${tableName} ${whereClause}`,
                values
            );
            return result.rows;
        } finally {
            client.release();
        }
    }

    async findById(collection, id) {
        const tableName = this._getTableName(collection);
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `SELECT * FROM ${tableName} WHERE id = $1`,
                [id]
            );
            return result.rows.length > 0 ? result.rows[0] : null;
        } finally {
            client.release();
        }
    }

    async findOne(collection, query) {
        const results = await this.find(collection, query);
        return results.length > 0 ? results[0] : null;
    }

    async insert(collection, data) {
        const tableName = this._getTableName(collection);
        const client = await this.pool.connect();
        
        try {
            const now = new Date().toISOString();
            const insertData = {
                ...data,
                createdAt: now,
                updatedAt: now
            };

            const columns = Object.keys(insertData);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
            const values = columns.map(col => insertData[col]);

            const result = await client.query(
                `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`,
                values
            );

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async update(collection, id, data) {
        const tableName = this._getTableName(collection);
        const client = await this.pool.connect();
        
        try {
            const updateData = {
                ...data,
                updatedAt: new Date().toISOString()
            };

            const columns = Object.keys(updateData);
            const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(',');
            const values = [...Object.values(updateData), id];

            const result = await client.query(
                `UPDATE ${tableName} SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                throw new Error(`记录不存在: ${collection}#${id}`);
            }

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async delete(collection, id) {
        const tableName = this._getTableName(collection);
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `DELETE FROM ${tableName} WHERE id = $1`,
                [id]
            );
            return result.rowCount > 0;
        } finally {
            client.release();
        }
    }

    async deleteMany(collection, query) {
        const tableName = this._getTableName(collection);
        const { sql: whereClause, values } = this._buildWhereClause(query);
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `DELETE FROM ${tableName} ${whereClause}`,
                values
            );
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    async transaction(callback) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            const result = await callback();
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = PostgresqlAdapter;
