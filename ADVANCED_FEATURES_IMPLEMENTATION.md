# 高级功能实现指南

## 完成时间：2024-12-04

本文档提供审计日志、API文档、缓存机制和单元测试的完整实现指南。

---

## 1. 审计日志系统 ✅

### 已实现文件
- `backend/src/models/AuditLogModel.js` - 审计日志模型
- `backend/src/middleware/auditLog.js` - 审计日志中间件

### 功能特性
- 记录所有关键操作（登录、文件操作、权限变更等）
- 支持按用户、资源、时间范围查询
- 提供统计分析功能
- 自动清理过期日志

### 使用方法

#### 在路由中使用
```javascript
const { auditLog, AuditLogModel } = require('../middleware/auditLog');

// 记录文件上传
router.post('/upload', 
    authenticate, 
    auditLog(AuditLogModel.ACTION_TYPES.FILE_UPLOAD, {
        resourceType: 'file'
    }), 
    async (req, res) => {
        // 处理上传
    }
);

// 记录用户登录
router.post('/login',
    auditLog(AuditLogModel.ACTION_TYPES.USER_LOGIN),
    async (req, res) => {
        // 处理登录
    }
);
```

#### 查询审计日志
```javascript
// 查询用户操作记录
const userLogs = await AuditLogModel.findByUser('admin', {
    limit: 50,
    action: AuditLogModel.ACTION_TYPES.FILE_UPLOAD
});

// 查询时间范围内的日志
const logs = await AuditLogModel.findByDateRange(
    '2024-12-01',
    '2024-12-04',
    { username: 'admin' }
);

// 获取统计信息
const stats = await AuditLogModel.getStatistics({
    startDate: '2024-12-01',
    endDate: '2024-12-04'
});
```

### 创建审计日志查询API

创建 `backend/src/routes/auditLogRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const AuditLogModel = require('../models/AuditLogModel');

// 查询审计日志（仅管理员）
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { 
            startDate, 
            endDate, 
            username, 
            action, 
            limit = 100, 
            offset = 0 
        } = req.query;

        let logs;
        
        if (startDate && endDate) {
            logs = await AuditLogModel.findByDateRange(startDate, endDate, {
                username,
                action,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        } else if (username) {
            logs = await AuditLogModel.findByUser(username, {
                action,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        } else {
            logs = await AuditLogModel.getAll();
            logs = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        }

        res.json({ logs, total: logs.length });
    } catch (error) {
        next(error);
    }
});

// 获取审计日志统计
router.get('/statistics', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { startDate, endDate, username } = req.query;
        
        const stats = await AuditLogModel.getStatistics({
            startDate,
            endDate,
            username
        });

        res.json(stats);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
```

在 `backend/src/app.js` 中注册路由：
```javascript
const auditLogRoutes = require('./routes/auditLogRoutes');
app.use('/api/audit-logs', auditLogRoutes);
```

---

## 2. API 文档（Swagger/OpenAPI）

### 安装依赖
```bash
npm install swagger-jsdoc swagger-ui-express
```

### 创建 Swagger 配置

创建 `backend/src/config/swagger.js`:

```javascript
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '文件分享系统 API',
            version: '2.1.0',
            description: '完整的文件分享系统 REST API 文档',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000/api',
                description: '开发服务器'
            },
            {
                url: 'https://api.example.com/api',
                description: '生产服务器'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        username: { type: 'string' },
                        role: { type: 'string', enum: ['user', 'admin'] },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Folder: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        alias: { type: 'string' },
                        owner: { type: 'string' },
                        parentId: { type: 'integer', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                File: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        originalName: { type: 'string' },
                        savedName: { type: 'string' },
                        size: { type: 'integer' },
                        folderId: { type: 'integer' },
                        hash: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        code: { type: 'string' },
                        error: { type: 'string' }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ['./src/routes/*.js'] // 扫描路由文件中的注释
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
```

### 在 app.js 中集成

```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### 在路由中添加文档注释

示例（`backend/src/routes/userRoutes.js`）:

```javascript
/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: 用户登录
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: admin123
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */
router.post('/login', async (req, res) => {
    // 登录逻辑
});
```

访问文档：`http://localhost:3000/api-docs`

---

## 3. 缓存机制（Redis）

### 安装依赖
```bash
npm install redis
```

### 创建缓存工具

创建 `backend/src/utils/cache.js`:

```javascript
const redis = require('redis');
const logger = require('./logger');

class CacheManager {
    constructor() {
        this.client = null;
        this.enabled = process.env.REDIS_ENABLED === 'true';
    }

    async connect() {
        if (!this.enabled) {
            logger.info('缓存未启用');
            return;
        }

        try {
            this.client = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                password: process.env.REDIS_PASSWORD || undefined
            });

            this.client.on('error', (err) => {
                logger.error('Redis 错误:', err);
            });

            await this.client.connect();
            logger.info('✅ Redis 缓存已连接');
        } catch (error) {
            logger.error('Redis 连接失败:', error);
            this.enabled = false;
        }
    }

    async get(key) {
        if (!this.enabled || !this.client) return null;

        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error(`缓存读取失败: ${key}`, error);
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        if (!this.enabled || !this.client) return false;

        try {
            await this.client.setEx(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error(`缓存写入失败: ${key}`, error);
            return false;
        }
    }

    async del(key) {
        if (!this.enabled || !this.client) return false;

        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error(`缓存删除失败: ${key}`, error);
            return false;
        }
    }

    async invalidatePattern(pattern) {
        if (!this.enabled || !this.client) return false;

        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
            return true;
        } catch (error) {
            logger.error(`缓存模式删除失败: ${pattern}`, error);
            return false;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            logger.info('Redis 缓存已断开');
        }
    }
}

const cacheManager = new CacheManager();

module.exports = cacheManager;
```

### 创建缓存中间件

创建 `backend/src/middleware/cache.js`:

```javascript
const cacheManager = require('../utils/cache');

/**
 * 缓存中间件
 */
function cacheMiddleware(options = {}) {
    const { 
        ttl = 3600,  // 默认1小时
        keyGenerator = (req) => `cache:${req.path}:${JSON.stringify(req.query)}`
    } = options;

    return async (req, res, next) => {
        // 只缓存 GET 请求
        if (req.method !== 'GET') {
            return next();
        }

        const key = keyGenerator(req);

        // 尝试从缓存获取
        const cachedData = await cacheManager.get(key);
        if (cachedData) {
            return res.json(cachedData);
        }

        // 保存原始的 json 方法
        const originalJson = res.json.bind(res);

        // 重写 json 方法以缓存响应
        res.json = function(data) {
            // 异步缓存数据
            setImmediate(async () => {
                if (data.success !== false) {
                    await cacheManager.set(key, data, ttl);
                }
            });

            return originalJson(data);
        };

        next();
    };
}

module.exports = { cacheMiddleware, cacheManager };
```

### 使用示例

```javascript
const { cacheMiddleware } = require('../middleware/cache');

// 缓存文件夹列表（5分钟）
router.get('/folders', 
    authenticate, 
    cacheMiddleware({ ttl: 300 }), 
    async (req, res) => {
        // 获取文件夹列表
    }
);

// 缓存用户统计（1分钟）
router.get('/users/stats', 
    authenticate, 
    cacheMiddleware({ ttl: 60 }), 
    async (req, res) => {
        // 获取统计数据
    }
);
```

### 缓存失效

```javascript
const { cacheManager } = require('../middleware/cache');

// 创建文件夹后，清除相关缓存
router.post('/folders', authenticate, async (req, res) => {
    // 创建文件夹
    const folder = await FolderModel.create(req.body);
    
    // 清除缓存
    await cacheManager.invalidatePattern('cache:/folders*');
    
    res.json(folder);
});
```

---

## 4. 单元测试（Jest）

### 安装依赖
```bash
npm install --save-dev jest supertest @types/jest
```

### 配置 Jest

在 `package.json` 中添加:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/database/**",
      "!src/config/**"
    ],
    "testMatch": [
      "**/__tests__/**/*.js",
      "**/*.test.js"
    ]
  }
}
```

### 创建测试文件

#### 测试用户模型

创建 `backend/src/models/__tests__/UserModel.test.js`:

```javascript
const UserModel = require('../UserModel');

describe('UserModel', () => {
    describe('create', () => {
        it('应该创建新用户', async () => {
            const userData = {
                username: 'testuser',
                password: 'Test123456',
                role: 'user'
            };

            const user = await UserModel.create(userData);

            expect(user).toHaveProperty('id');
            expect(user.username).toBe('testuser');
            expect(user.role).toBe('user');
            expect(user).not.toHaveProperty('password');
        });

        it('应该拒绝重复的用户名', async () => {
            const userData = {
                username: 'duplicate',
                password: 'Test123456'
            };

            await UserModel.create(userData);

            await expect(UserModel.create(userData))
                .rejects
                .toThrow('用户名已存在');
        });
    });

    describe('verifyPassword', () => {
        it('应该验证正确的密码', async () => {
            await UserModel.create({
                username: 'testauth',
                password: 'Test123456'
            });

            const user = await UserModel.verifyPassword('testauth', 'Test123456');

            expect(user).not.toBeNull();
            expect(user.username).toBe('testauth');
        });

        it('应该拒绝错误的密码', async () => {
            const user = await UserModel.verifyPassword('testauth', 'wrongpassword');

            expect(user).toBeNull();
        });
    });
});
```

#### 测试API端点

创建 `backend/src/routes/__tests__/userRoutes.test.js`:

```javascript
const request = require('supertest');
const app = require('../../app');

describe('User API', () => {
    let authToken;

    beforeAll(async () => {
        // 登录获取token
        const response = await request(app)
            .post('/api/users/login')
            .send({
                username: 'admin',
                password: 'admin123'
            });

        authToken = response.body.token;
    });

    describe('POST /api/users', () => {
        it('应该创建新用户（管理员）', async () => {
            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    username: 'newuser',
                    password: 'Test123456',
                    role: 'user'
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body.username).toBe('newuser');
        });

        it('应该拒绝弱密码', async () => {
            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    username: 'weakpass',
                    password: '123',
                    role: 'user'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('密码');
        });
    });

    describe('GET /api/users', () => {
        it('应该返回用户列表（管理员）', async () => {
            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('应该拒绝未认证的请求', async () => {
            const response = await request(app)
                .get('/api/users');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('APF102');
        });
    });
});
```

### 运行测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

---

## 部署清单

### 1. 审计日志
- [ ] 创建 AuditLogModel
- [ ] 创建审计日志中间件
- [ ] 在关键路由中添加审计日志
- [ ] 创建审计日志查询API
- [ ] 设置定期清理任务

### 2. API 文档
- [ ] 安装 swagger 依赖
- [ ] 配置 Swagger
- [ ] 在所有路由添加文档注释
- [ ] 测试文档访问

### 3. 缓存机制
- [ ] 安装 Redis
- [ ] 创建缓存管理器
- [ ] 创建缓存中间件
- [ ] 在高频API添加缓存
- [ ] 实现缓存失效策略

### 4. 单元测试
- [ ] 安装 Jest
- [ ] 配置测试环境
- [ ] 编写模型测试
- [ ] 编写API测试
- [ ] 达到70%以上覆盖率

---

## 环境变量配置

```env
# Redis 缓存
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# 审计日志
AUDIT_LOG_RETENTION_DAYS=90

# API 文档
API_DOCS_ENABLED=true
```

---

## 总结

本文档提供了4个高级功能的完整实现框架：

1. **审计日志** - 已实现核心功能，可直接使用
2. **API 文档** - 提供完整配置和示例
3. **缓存机制** - 提供 Redis 集成方案
4. **单元测试** - 提供测试框架和示例

所有功能都是模块化的，可以根据需要逐步实施。
