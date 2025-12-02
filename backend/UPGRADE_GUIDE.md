# 文件分享系统 v2.0 升级指南

## 🎉 新版本特性

### 1. 数据库抽象层
- **支持多种数据库类型**：JSON、MongoDB、MySQL、PostgreSQL
- **无缝切换**：通过环境变量轻松切换数据库
- **统一接口**：所有数据库操作通过统一的适配器接口

### 2. 安全性增强
- **环境变量配置**：敏感信息不再硬编码
- **请求频率限制**：防止暴力攻击
- **安全头部**：使用Helmet添加安全HTTP头
- **改进的认证**：更好的错误处理和日志记录

### 3. 日志系统
- **Winston日志库**：支持多种日志级别
- **文件日志**：自动保存到logs目录
- **请求追踪**：记录所有API请求和响应时间

### 4. 错误处理
- **统一错误处理**：所有错误通过中间件处理
- **详细错误信息**：开发环境显示堆栈跟踪
- **生产环保护**：生产环境隐藏敏感信息

### 5. 代码结构改进
- **模块化设计**：清晰的目录结构
- **基础模型类**：减少代码重复
- **配置管理**：集中式配置管理

## 📦 安装步骤

### 1. 更新依赖
```bash
cd backend
npm install
```

### 2. 配置环境变量
复制 `.env.example` 到 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

### 3. 选择数据库类型

#### 使用JSON（默认，无需额外配置）
```env
DB_TYPE=json
JSON_DATA_DIR=./data
```

#### 使用MongoDB
```env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/file-share
```

#### 使用MySQL
```env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=file_share
```

#### 使用PostgreSQL
```env
DB_TYPE=postgresql
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DATABASE=file_share
```

### 4. 启动服务器
```bash
npm start
```

## 🔄 从v1.0迁移到v2.0

### 数据迁移脚本（可选）
如果需要从JSON迁移到其他数据库，可以创建迁移脚本：

```javascript
// migrate.js
const JsonAdapter = require('./src/database/adapters/JsonAdapter');
const MongoDbAdapter = require('./src/database/adapters/MongoDbAdapter');

async function migrate() {
    const jsonDb = new JsonAdapter({ dataDir: './data' });
    const mongoDb = new MongoDbAdapter({ uri: 'mongodb://localhost:27017/file-share' });
    
    await jsonDb.connect();
    await mongoDb.connect();
    
    // 迁移用户
    const users = await jsonDb.findAll('users');
    for (const user of users) {
        await mongoDb.insert('users', user);
    }
    
    // 迁移文件夹
    const folders = await jsonDb.findAll('folders');
    for (const folder of folders) {
        await mongoDb.insert('folders', folder);
    }
    
    // 迁移文件
    const files = await jsonDb.findAll('files');
    for (const file of files) {
        await mongoDb.insert('files', file);
    }
    
    // 迁移分享
    const shares = await jsonDb.findAll('shares');
    for (const share of shares) {
        await mongoDb.insert('shares', share);
    }
    
    console.log('✅ 数据迁移完成');
}

migrate().catch(console.error);
```

## 📁 新的目录结构

```
backend/
├── src/
│   ├── config/              # 配置管理
│   │   └── index.js
│   ├── database/            # 数据库层
│   │   ├── adapters/        # 数据库适配器
│   │   │   ├── BaseAdapter.js
│   │   │   ├── JsonAdapter.js
│   │   │   ├── MongoDbAdapter.js
│   │   │   ├── MysqlAdapter.js
│   │   │   └── PostgresqlAdapter.js
│   │   └── DatabaseManager.js
│   ├── middleware/          # 中间件
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   └── requestLogger.js
│   ├── models/              # 数据模型
│   │   ├── BaseModel.js
│   │   ├── UserModel.js
│   │   ├── FolderModel.js
│   │   ├── FileModel.js
│   │   └── ShareModel.js
│   ├── routes/              # 路由
│   │   ├── userRoutes.js
│   │   ├── folderRoutes.js
│   │   ├── shareRoutes.js
│   │   ├── fileMoveRoutes.js
│   │   └── publicShareRoutes.js
│   ├── utils/               # 工具函数
│   │   ├── fileHelpers.js
│   │   └── logger.js
│   └── app.js               # 应用入口
├── .env                     # 环境变量
├── .env.example             # 环境变量示例
├── server.js                # 服务器启动文件
└── package.json
```

## 🔐 安全性改进

### 1. JWT密钥管理
```env
# 生产环境必须设置强密钥
JWT_SECRET=your-very-long-and-secure-secret-key-min-32-chars
```

### 2. 速率限制
```env
# 防止暴力攻击
RATE_LIMIT_WINDOW_MS=900000      # 15分钟
RATE_LIMIT_MAX_REQUESTS=100      # 最多100次请求
```

### 3. CORS配置
```env
# 只允许特定域名访问
CORS_ORIGIN=http://localhost:3001
```

## 📊 日志管理

日志文件位置：
- `logs/error.log` - 错误日志
- `logs/combined.log` - 所有日志

日志级别：
- `error` - 错误信息
- `warn` - 警告信息
- `info` - 一般信息
- `debug` - 调试信息

## 🚀 性能优化

### 1. 数据库连接池
- MySQL和PostgreSQL使用连接池
- 自动管理连接生命周期

### 2. 文件锁机制
- JSON适配器使用文件锁防止并发写入
- 确保数据一致性

### 3. 事务支持
- MongoDB和关系型数据库支持事务
- JSON适配器提供基本的事务支持

## 🔧 故障排除

### 问题：无法连接到数据库
**解决方案**：
1. 检查数据库服务是否运行
2. 验证连接字符串是否正确
3. 检查防火墙设置
4. 查看日志文件获取详细错误信息

### 问题：文件上传失败
**解决方案**：
1. 检查`files`目录是否存在且可写
2. 检查磁盘空间是否充足
3. 验证文件大小是否超过限制

### 问题：性能下降
**解决方案**：
1. 检查数据库连接数
2. 查看日志中的慢查询
3. 考虑增加服务器资源

## 📝 API变化

### 新增端点
- `GET /health` - 健康检查

### 改进的错误响应
```json
{
    "error": "错误信息",
    "statusCode": 400
}
```

### 改进的认证错误
- `401` - 未登录或令牌过期
- `403` - 令牌无效或权限不足

## 🎯 最佳实践

### 1. 生产环境配置
```env
NODE_ENV=production
JWT_SECRET=<strong-random-key>
DB_TYPE=postgresql
LOG_LEVEL=warn
```

### 2. 备份策略
- 定期备份数据库
- 定期备份上传的文件
- 保留日志文件用于审计

### 3. 监控
- 监控服务器资源使用
- 监控数据库连接数
- 监控API响应时间

## 📚 更多信息

- [数据库适配器开发指南](./DATABASE_ADAPTER_GUIDE.md)
- [API文档](./API_DOCS.md)
- [故障排除指南](./TROUBLESHOOTING.md)
