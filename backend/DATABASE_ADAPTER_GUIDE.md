# 数据库适配器开发指南

## 概述

数据库适配器是一个抽象层，允许应用程序与不同的数据库系统进行交互，而无需修改业务逻辑代码。

## 架构

```
应用代码
   ↓
BaseModel（基础模型）
   ↓
DatabaseManager（数据库管理器）
   ↓
Adapter（适配器）
   ↓
数据库系统
```

## 创建自定义适配器

### 1. 继承BaseAdapter

```javascript
const BaseAdapter = require('./BaseAdapter');

class CustomAdapter extends BaseAdapter {
    constructor(config) {
        super();
        this.config = config;
    }

    async connect() {
        // 实现连接逻辑
    }

    async disconnect() {
        // 实现断开连接逻辑
    }

    // 实现其他必需的方法...
}

module.exports = CustomAdapter;
```

### 2. 实现必需的方法

#### connect()
初始化数据库连接

```javascript
async connect() {
    try {
        // 连接到数据库
        console.log('✅ 数据库已连接');
    } catch (error) {
        console.error('连接失败:', error);
        throw error;
    }
}
```

#### disconnect()
关闭数据库连接

```javascript
async disconnect() {
    try {
        // 关闭连接
        console.log('✅ 数据库已断开');
    } catch (error) {
        console.error('断开连接失败:', error);
        throw error;
    }
}
```

#### findAll(collection)
查询集合中的所有记录

```javascript
async findAll(collection) {
    // 返回所有记录的数组
    return [];
}
```

#### find(collection, query)
根据条件查询记录

```javascript
async find(collection, query) {
    // query 示例: { username: 'admin', role: 'admin' }
    // 返回匹配的记录数组
    return [];
}
```

#### findById(collection, id)
根据ID查询单条记录

```javascript
async findById(collection, id) {
    // 返回匹配的记录或null
    return null;
}
```

#### findOne(collection, query)
根据条件查询单条记录

```javascript
async findOne(collection, query) {
    // 返回第一条匹配的记录或null
    return null;
}
```

#### insert(collection, data)
插入新记录

```javascript
async insert(collection, data) {
    // 返回插入后的记录（包含ID）
    return {
        id: 1,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}
```

#### update(collection, id, data)
更新记录

```javascript
async update(collection, id, data) {
    // 返回更新后的记录
    return {
        id,
        ...data,
        updatedAt: new Date().toISOString()
    };
}
```

#### delete(collection, id)
删除记录

```javascript
async delete(collection, id) {
    // 返回是否删除成功
    return true;
}
```

#### deleteMany(collection, query)
批量删除记录

```javascript
async deleteMany(collection, query) {
    // 返回删除的记录数
    return 0;
}
```

#### transaction(callback)
事务支持（可选）

```javascript
async transaction(callback) {
    // 执行事务
    return await callback();
}
```

## 查询操作符支持

适配器应支持以下查询操作符：

```javascript
// 相等
{ username: 'admin' }

// 不相等
{ role: { $ne: 'admin' } }

// 包含
{ id: { $in: [1, 2, 3] } }

// 大于
{ age: { $gt: 18 } }

// 小于
{ age: { $lt: 65 } }
```

## 注册适配器

在 `DatabaseManager.js` 中注册新适配器：

```javascript
const CustomAdapter = require('./adapters/CustomAdapter');

async initialize() {
    const dbType = this.config.database.type.toLowerCase();

    switch (dbType) {
        case 'custom':
            this.adapter = new CustomAdapter(this.config.database.custom);
            break;
        // ...
    }

    await this.adapter.connect();
}
```

## 配置示例

在 `.env` 中添加配置：

```env
DB_TYPE=custom
CUSTOM_HOST=localhost
CUSTOM_PORT=5432
CUSTOM_USER=user
CUSTOM_PASSWORD=password
CUSTOM_DATABASE=file_share
```

在 `config/index.js` 中添加配置：

```javascript
database: {
    type: process.env.DB_TYPE || 'json',
    
    custom: {
        host: process.env.CUSTOM_HOST || 'localhost',
        port: parseInt(process.env.CUSTOM_PORT) || 5432,
        user: process.env.CUSTOM_USER || 'user',
        password: process.env.CUSTOM_PASSWORD || '',
        database: process.env.CUSTOM_DATABASE || 'file_share'
    }
}
```

## 测试适配器

```javascript
// test-adapter.js
const CustomAdapter = require('./src/database/adapters/CustomAdapter');

async function testAdapter() {
    const adapter = new CustomAdapter({
        host: 'localhost',
        port: 5432,
        user: 'user',
        password: 'password',
        database: 'test_db'
    });

    try {
        // 连接
        await adapter.connect();
        console.log('✅ 连接成功');

        // 插入
        const user = await adapter.insert('users', {
            username: 'test',
            password: 'test123',
            role: 'user'
        });
        console.log('✅ 插入成功:', user);

        // 查询
        const found = await adapter.findById('users', user.id);
        console.log('✅ 查询成功:', found);

        // 更新
        const updated = await adapter.update('users', user.id, {
            role: 'admin'
        });
        console.log('✅ 更新成功:', updated);

        // 删除
        const deleted = await adapter.delete('users', user.id);
        console.log('✅ 删除成功:', deleted);

        // 断开连接
        await adapter.disconnect();
        console.log('✅ 断开连接成功');
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

testAdapter();
```

## 性能考虑

### 1. 连接池
对于关系型数据库，使用连接池以提高性能：

```javascript
const pool = mysql.createPool({
    connectionLimit: 10,
    host: this.config.host,
    user: this.config.user,
    password: this.config.password,
    database: this.config.database
});
```

### 2. 索引
为常用查询字段创建索引：

```sql
CREATE INDEX idx_username ON users(username);
CREATE INDEX idx_owner ON folders(owner);
CREATE INDEX idx_folderId ON files(folderId);
```

### 3. 缓存
考虑添加缓存层以提高性能：

```javascript
async findById(collection, id) {
    const cacheKey = `${collection}:${id}`;
    
    // 检查缓存
    let cached = this.cache.get(cacheKey);
    if (cached) return cached;
    
    // 从数据库查询
    const result = await this.db.query(...);
    
    // 存储到缓存
    this.cache.set(cacheKey, result, 3600); // 1小时过期
    
    return result;
}
```

## 错误处理

适配器应提供清晰的错误信息：

```javascript
async findById(collection, id) {
    try {
        // 查询逻辑
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error('数据库连接被拒绝');
        } else if (error.code === 'ER_NO_SUCH_TABLE') {
            throw new Error(`表不存在: ${collection}`);
        }
        throw error;
    }
}
```

## 事务支持

对于支持事务的数据库：

```javascript
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
```

## 最佳实践

1. **错误处理**：提供清晰的错误消息
2. **日志记录**：记录重要操作
3. **性能优化**：使用连接池和缓存
4. **安全性**：防止SQL注入和其他攻击
5. **测试**：充分测试适配器功能
6. **文档**：记录配置和使用方法

## 示例：Redis适配器

```javascript
const BaseAdapter = require('./BaseAdapter');
const redis = require('redis');

class RedisAdapter extends BaseAdapter {
    constructor(config) {
        super();
        this.config = config;
        this.client = null;
    }

    async connect() {
        this.client = redis.createClient(this.config);
        await this.client.connect();
        console.log('✅ Redis已连接');
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            console.log('✅ Redis已断开');
        }
    }

    async findAll(collection) {
        const keys = await this.client.keys(`${collection}:*`);
        const results = [];
        
        for (const key of keys) {
            const data = await this.client.get(key);
            results.push(JSON.parse(data));
        }
        
        return results;
    }

    async findById(collection, id) {
        const data = await this.client.get(`${collection}:${id}`);
        return data ? JSON.parse(data) : null;
    }

    async insert(collection, data) {
        const id = Date.now();
        const record = {
            id,
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await this.client.set(
            `${collection}:${id}`,
            JSON.stringify(record)
        );
        
        return record;
    }

    // 实现其他方法...
}

module.exports = RedisAdapter;
```
