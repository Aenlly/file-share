const BaseAdapter = require('./BaseAdapter');

/**
 * MongoDB数据库适配器
 */
class MongoDbAdapter extends BaseAdapter {
    constructor(config) {
        super();
        this.config = config;
        this.client = null;
        this.db = null;
    }

    async connect() {
        try {
            const { MongoClient } = require('mongodb');
            
            this.client = new MongoClient(this.config.uri, this.config.options);
            await this.client.connect();
            
            // 提取数据库名称
            const dbName = this.config.uri.split('/').pop().split('?')[0] || 'file-share';
            this.db = this.client.db(dbName);
            
            console.log(`✅ MongoDB已连接: ${this.config.uri}`);
        } catch (error) {
            console.error('MongoDB连接失败:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('✅ MongoDB已断开');
        }
    }

    async findAll(collection) {
        const col = this.db.collection(collection);
        return await col.find({}).toArray();
    }

    async find(collection, query) {
        const col = this.db.collection(collection);
        return await col.find(query || {}).toArray();
    }

    async findById(collection, id) {
        const col = this.db.collection(collection);
        return await col.findOne({ id });
    }

    async findOne(collection, query) {
        const col = this.db.collection(collection);
        return await col.findOne(query);
    }

    async insert(collection, data) {
        const col = this.db.collection(collection);
        
        // 生成ID
        const allDocs = await col.find({}).toArray();
        const newId = allDocs.length > 0 
            ? Math.max(...allDocs.map(doc => doc.id || 0)) + 1 
            : 1;
        
        const newRecord = {
            id: newId,
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await col.insertOne(newRecord);
        return newRecord;
    }

    async update(collection, id, data) {
        const col = this.db.collection(collection);
        
        const result = await col.findOneAndUpdate(
            { id },
            {
                $set: {
                    ...data,
                    updatedAt: new Date().toISOString()
                }
            },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            throw new Error(`记录不存在: ${collection}#${id}`);
        }
        
        return result.value;
    }

    async delete(collection, id) {
        const col = this.db.collection(collection);
        const result = await col.deleteOne({ id });
        return result.deletedCount > 0;
    }

    async deleteMany(collection, query) {
        const col = this.db.collection(collection);
        const result = await col.deleteMany(query);
        return result.deletedCount;
    }

    async transaction(callback) {
        const session = this.client.startSession();
        
        try {
            await session.withTransaction(async () => {
                return await callback();
            });
        } finally {
            await session.endSession();
        }
    }
}

module.exports = MongoDbAdapter;
