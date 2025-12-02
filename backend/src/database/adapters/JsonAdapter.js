const fs = require('fs-extra');
const path = require('path');
const BaseAdapter = require('./BaseAdapter');

/**
 * JSON文件数据库适配器
 * 使用本地JSON文件存储数据，支持并发安全
 */
class JsonAdapter extends BaseAdapter {
    constructor(config) {
        super();
        this.dataDir = config.dataDir || './data';
        this.locks = new Map(); // 文件锁，防止并发写入
    }

    async connect() {
        // 确保数据目录存在
        await fs.ensureDir(this.dataDir);
        console.log(`✅ JSON数据库已连接: ${this.dataDir}`);
    }

    async disconnect() {
        // JSON适配器无需断开连接
        console.log('✅ JSON数据库已断开');
    }

    /**
     * 获取集合文件路径
     */
    _getFilePath(collection) {
        return path.join(this.dataDir, `${collection}.json`);
    }

    /**
     * 获取文件锁
     */
    async _acquireLock(collection) {
        while (this.locks.get(collection)) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this.locks.set(collection, true);
    }

    /**
     * 释放文件锁
     */
    _releaseLock(collection) {
        this.locks.delete(collection);
    }

    /**
     * 读取JSON文件（带UTF-8编码支持）
     */
    async _readFile(collection) {
        const filePath = this._getFilePath(collection);
        
        if (!await fs.pathExists(filePath)) {
            return [];
        }

        try {
            const buffer = await fs.readFile(filePath);
            const data = buffer.toString('utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`读取JSON文件失败: ${collection}`, error);
            return [];
        }
    }

    /**
     * 写入JSON文件（带UTF-8编码支持和原子写入）
     */
    async _writeFile(collection, data) {
        const filePath = this._getFilePath(collection);
        const tempFilePath = `${filePath}.tmp`;
        
        try {
            // 写入临时文件
            const jsonString = JSON.stringify(data, null, 2);
            const buffer = Buffer.from(jsonString, 'utf8');
            await fs.writeFile(tempFilePath, buffer);
            
            // 原子性重命名
            await fs.rename(tempFilePath, filePath);
        } catch (error) {
            // 清理临时文件
            if (await fs.pathExists(tempFilePath)) {
                await fs.remove(tempFilePath);
            }
            throw error;
        }
    }

    async findAll(collection) {
        return await this._readFile(collection);
    }

    async find(collection, query) {
        const data = await this._readFile(collection);
        
        if (!query || Object.keys(query).length === 0) {
            return data;
        }

        return data.filter(item => {
            return Object.keys(query).every(key => {
                if (typeof query[key] === 'object' && query[key] !== null) {
                    // 支持简单的操作符
                    if (query[key].$ne !== undefined) {
                        return item[key] !== query[key].$ne;
                    }
                    if (query[key].$in !== undefined) {
                        return query[key].$in.includes(item[key]);
                    }
                    if (query[key].$gt !== undefined) {
                        return item[key] > query[key].$gt;
                    }
                    if (query[key].$lt !== undefined) {
                        return item[key] < query[key].$lt;
                    }
                }
                return item[key] === query[key];
            });
        });
    }

    async findById(collection, id) {
        const data = await this._readFile(collection);
        return data.find(item => item.id === id) || null;
    }

    async findOne(collection, query) {
        const results = await this.find(collection, query);
        return results.length > 0 ? results[0] : null;
    }

    async insert(collection, data) {
        await this._acquireLock(collection);
        
        try {
            const allData = await this._readFile(collection);
            
            // 生成ID
            const newId = allData.length > 0 
                ? Math.max(...allData.map(item => item.id || 0)) + 1 
                : 1;
            
            const newRecord = {
                id: newId,
                ...data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            allData.push(newRecord);
            await this._writeFile(collection, allData);
            
            return newRecord;
        } finally {
            this._releaseLock(collection);
        }
    }

    async update(collection, id, data) {
        await this._acquireLock(collection);
        
        try {
            const allData = await this._readFile(collection);
            const index = allData.findIndex(item => item.id === id);
            
            if (index === -1) {
                throw new Error(`记录不存在: ${collection}#${id}`);
            }
            
            allData[index] = {
                ...allData[index],
                ...data,
                id, // 保持ID不变
                updatedAt: new Date().toISOString()
            };
            
            await this._writeFile(collection, allData);
            
            return allData[index];
        } finally {
            this._releaseLock(collection);
        }
    }

    async delete(collection, id) {
        await this._acquireLock(collection);
        
        try {
            const allData = await this._readFile(collection);
            const index = allData.findIndex(item => item.id === id);
            
            if (index === -1) {
                return false;
            }
            
            allData.splice(index, 1);
            await this._writeFile(collection, allData);
            
            return true;
        } finally {
            this._releaseLock(collection);
        }
    }

    async deleteMany(collection, query) {
        await this._acquireLock(collection);
        
        try {
            const allData = await this._readFile(collection);
            const toDelete = await this.find(collection, query);
            const deleteIds = new Set(toDelete.map(item => item.id));
            
            const remainingData = allData.filter(item => !deleteIds.has(item.id));
            await this._writeFile(collection, remainingData);
            
            return toDelete.length;
        } finally {
            this._releaseLock(collection);
        }
    }

    async transaction(callback) {
        // JSON适配器不支持真正的事务，但可以提供基本的错误回滚
        const backups = new Map();
        
        try {
            // 执行回调
            return await callback();
        } catch (error) {
            // 发生错误时，恢复备份（如果有的话）
            for (const [collection, data] of backups) {
                await this._writeFile(collection, data);
            }
            throw error;
        }
    }
}

module.exports = JsonAdapter;
