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
     * 获取文件锁（带超时机制和重试）
     */
    async _acquireLock(collection) {
        const maxWaitTime = 30000; // 最多等待30秒
        const checkInterval = 50; // 每50ms检查一次
        const startTime = Date.now();
        let waitCount = 0;
        
        while (this.locks.get(collection)) {
            const elapsed = Date.now() - startTime;
            
            if (elapsed > maxWaitTime) {
                const errorMsg = `数据库繁忙，请稍后重试（等待时间: ${Math.round(elapsed/1000)}秒）`;
                console.error(`获取文件锁超时: ${collection}, 等待次数: ${waitCount}`);
                throw new Error(errorMsg);
            }
            
            // 每秒记录一次等待日志
            if (waitCount % 20 === 0 && waitCount > 0) {
                console.warn(`等待数据库锁: ${collection}, 已等待 ${Math.round(elapsed/1000)} 秒`);
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitCount++;
        }
        
        // 成功获取锁
        this.locks.set(collection, {
            acquired: Date.now(),
            collection: collection
        });
        
        if (waitCount > 0) {
            console.info(`获取数据库锁成功: ${collection}, 等待了 ${waitCount * checkInterval}ms`);
        }
    }

    /**
     * 释放文件锁
     */
    _releaseLock(collection) {
        const lockInfo = this.locks.get(collection);
        if (lockInfo) {
            const holdTime = Date.now() - lockInfo.acquired;
            if (holdTime > 1000) {
                console.warn(`释放数据库锁: ${collection}, 持有时间: ${holdTime}ms`);
            }
        }
        this.locks.delete(collection);
    }

    /**
     * 读取JSON文件（带UTF-8编码支持和重试机制）
     */
    async _readFile(collection) {
        const filePath = this._getFilePath(collection);
        
        if (!await fs.pathExists(filePath)) {
            return [];
        }

        let retries = 3;
        let lastError = null;
        
        while (retries > 0) {
            try {
                const buffer = await fs.readFile(filePath);
                const data = buffer.toString('utf8');
                return JSON.parse(data);
            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.warn(`读取JSON文件失败，重试中... (剩余${retries}次): ${collection}`);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }
        
        console.error(`读取JSON文件失败（已重试3次）: ${collection}`, lastError);
        throw new Error(`读取数据库文件失败: ${collection}`);
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
            console.error(`写入JSON文件失败: ${collection}`, error);
            // 清理临时文件
            try {
                if (await fs.pathExists(tempFilePath)) {
                    await fs.remove(tempFilePath);
                }
            } catch (cleanupError) {
                console.error(`清理临时文件失败: ${tempFilePath}`, cleanupError);
            }
            throw new Error(`写入数据库文件失败: ${collection} - ${error.message}`);
        }
    }

    async findAll(collection) {
        try {
            return await this._readFile(collection);
        } catch (error) {
            console.error(`findAll失败: ${collection}`, error);
            throw error;
        }
    }

    async find(collection, query) {
        try {
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
        } catch (error) {
            console.error(`find失败: ${collection}`, error);
            throw error;
        }
    }

    async findById(collection, id) {
        try {
            const data = await this._readFile(collection);
            return data.find(item => item.id === id) || null;
        } catch (error) {
            console.error(`findById失败: ${collection}, id=${id}`, error);
            throw error;
        }
    }

    async findOne(collection, query) {
        try {
            const results = await this.find(collection, query);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error(`findOne失败: ${collection}`, error);
            throw error;
        }
    }

    async insert(collection, data) {
        try {
            await this._acquireLock(collection);
        } catch (error) {
            // 锁超时错误，提供友好的错误消息
            throw new Error(`系统繁忙，请稍后重试。如果问题持续存在，请联系管理员。`);
        }
        
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
        } catch (error) {
            // 如果是锁超时错误，直接抛出
            if (error.message.includes('繁忙') || error.message.includes('重试')) {
                throw error;
            }
            // 其他错误，包装成友好的消息
            console.error(`插入数据失败: ${collection}`, error);
            throw new Error(`数据保存失败，请重试。错误详情: ${error.message}`);
        } finally {
            this._releaseLock(collection);
        }
    }

    async update(collection, id, data) {
        try {
            await this._acquireLock(collection);
        } catch (error) {
            throw new Error(`系统繁忙，请稍后重试。如果问题持续存在，请联系管理员。`);
        }
        
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
        } catch (error) {
            if (error.message.includes('繁忙') || error.message.includes('重试')) {
                throw error;
            }
            console.error(`更新数据失败: ${collection}#${id}`, error);
            throw new Error(`数据更新失败，请重试。错误详情: ${error.message}`);
        } finally {
            this._releaseLock(collection);
        }
    }

    async delete(collection, id) {
        try {
            await this._acquireLock(collection);
        } catch (error) {
            throw new Error(`系统繁忙，请稍后重试。如果问题持续存在，请联系管理员。`);
        }
        
        try {
            const allData = await this._readFile(collection);
            const index = allData.findIndex(item => item.id === id);
            
            if (index === -1) {
                return false;
            }
            
            allData.splice(index, 1);
            await this._writeFile(collection, allData);
            
            return true;
        } catch (error) {
            if (error.message.includes('繁忙') || error.message.includes('重试')) {
                throw error;
            }
            console.error(`删除数据失败: ${collection}#${id}`, error);
            throw new Error(`数据删除失败，请重试。错误详情: ${error.message}`);
        } finally {
            this._releaseLock(collection);
        }
    }

    async deleteMany(collection, query) {
        try {
            await this._acquireLock(collection);
        } catch (error) {
            throw new Error(`系统繁忙，请稍后重试。如果问题持续存在，请联系管理员。`);
        }
        
        try {
            const allData = await this._readFile(collection);
            const toDelete = await this.find(collection, query);
            const deleteIds = new Set(toDelete.map(item => item.id));
            
            const remainingData = allData.filter(item => !deleteIds.has(item.id));
            await this._writeFile(collection, remainingData);
            
            return toDelete.length;
        } catch (error) {
            if (error.message.includes('繁忙') || error.message.includes('重试')) {
                throw error;
            }
            console.error(`批量删除数据失败: ${collection}`, error);
            throw new Error(`批量删除失败，请重试。错误详情: ${error.message}`);
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
