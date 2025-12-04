# 项目审查报告

## 审查时间：2024-12-04

## 概述

本报告对整个文件分享系统进行了全面的安全性、性能和设计审查，识别潜在的 bug 和不合理设计。

---

## 🔴 严重问题（需要立即修复）

### 1. 默认管理员密码过于简单

**位置**：`backend/src/models/UserModel.js:93-99`

**问题**：
```javascript
await this.create({
    username: 'admin',
    password: 'admin123',  // ❌ 弱密码
    role: 'admin'
});
```

**风险**：
- 默认密码 `admin123` 过于简单，容易被暴力破解
- 生产环境中如果忘记修改，会造成严重安全隐患

**建议**：
1. 首次启动时强制用户设置管理员密码
2. 或使用随机生成的强密码并在日志中显示
3. 添加首次登录后强制修改密码的机制

### 2. JWT Secret 使用默认值

**位置**：`backend/src/config/index.js`

**问题**：
```javascript
jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
```

**风险**：
- 如果生产环境未设置 JWT_SECRET，将使用默认值
- 攻击者可以伪造 JWT 令牌获取任意用户权限

**建议**：
1. 生产环境启动时检查 JWT_SECRET 是否设置
2. 如果未设置，拒绝启动并提示错误
3. 添加启动检查脚本

### 3. 文件路径遍历风险

**位置**：多个文件下载和访问接口

**问题**：
- 虽然有权限检查，但文件名处理可能存在路径遍历风险
- `decodeURIComponent` 后的文件名未进行路径安全检查

**风险**：
- 攻击者可能通过 `../` 等路径遍历符号访问系统文件

**建议**：
```javascript
// 添加路径安全检查函数
function sanitizeFilename(filename) {
    // 移除路径遍历字符
    return filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
}
```

---

## 🟡 重要问题（建议尽快修复）

### 4. 密码强度未验证

**位置**：`backend/src/routes/userRoutes.js`

**问题**：
- 创建用户和修改密码时未验证密码强度
- 允许设置弱密码如 "123"

**建议**：
```javascript
function validatePassword(password) {
    if (password.length < 8) {
        throw new Error('密码长度至少8位');
    }
    if (!/[A-Z]/.test(password)) {
        throw new Error('密码必须包含大写字母');
    }
    if (!/[a-z]/.test(password)) {
        throw new Error('密码必须包含小写字母');
    }
    if (!/[0-9]/.test(password)) {
        throw new Error('密码必须包含数字');
    }
    return true;
}
```

### 5. 文件上传未检查文件类型

**位置**：`backend/src/routes/fileRoutes.js:56`

**问题**：
- 虽然配置了 `dangerousFileTypes`，但上传时未实际检查
- 允许上传任意类型文件，包括可执行文件

**风险**：
- 可能上传恶意脚本或病毒
- 如果文件被直接访问执行，可能造成服务器被攻击

**建议**：
```javascript
// 在上传前检查文件类型
const ext = path.extname(originalName).toLowerCase();
if (config.dangerousFileTypes.includes(ext)) {
    throw new Error(`不允许上传 ${ext} 类型的文件`);
}
```

### 6. 分享链接无访问次数限制

**位置**：`backend/src/routes/guestRoutes.js`（推测）

**问题**：
- 分享链接只有过期时间限制，没有访问次数限制
- 可能被恶意大量访问，消耗服务器资源

**建议**：
- 添加访问次数限制选项
- 添加单IP访问频率限制
- 记录异常访问行为

### 7. 文件删除未真正删除物理文件

**位置**：`backend/src/routes/fileRoutes.js:172`

**问题**：
- 文件移至回收站后，物理文件仍然存在
- 回收站清空后才删除物理文件
- 如果回收站功能有bug，可能导致磁盘空间泄漏

**建议**：
- 添加定期清理过期回收站文件的任务
- 添加磁盘空间监控
- 提供手动清理工具

### 8. 并发上传同名文件可能冲突

**位置**：`backend/src/routes/fileRoutes.js:56-150`

**问题**：
- 虽然使用了哈希检查，但并发上传时可能出现竞态条件
- 两个用户同时上传同名文件，可能导致数据不一致

**建议**：
- 使用数据库事务
- 添加文件名+时间戳的唯一性约束
- 使用分布式锁（如 Redis）

---

## 🟢 优化建议（可以逐步改进）

### 9. 日志敏感信息泄露

**位置**：多处日志记录

**问题**：
- 日志中可能包含用户密码、令牌等敏感信息
- 例如：`logger.info('用户登录', req.body)` 会记录密码

**建议**：
```javascript
// 创建日志过滤函数
function sanitizeLogData(data) {
    const sensitive = ['password', 'token', 'secret'];
    const sanitized = { ...data };
    sensitive.forEach(key => {
        if (sanitized[key]) {
            sanitized[key] = '***';
        }
    });
    return sanitized;
}
```

### 10. 错误信息过于详细

**位置**：多个错误处理

**问题**：
- 某些错误信息暴露了系统内部结构
- 例如：数据库错误直接返回给前端

**建议**：
- 生产环境使用通用错误信息
- 详细错误只记录在日志中
- 区分开发环境和生产环境的错误处理

### 11. 缺少请求大小限制

**位置**：`backend/src/app.js`

**问题**：
- 虽然文件上传有大小限制，但普通 JSON 请求没有限制
- 可能被恶意发送超大 JSON 导致内存溢出

**建议**：
```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

### 12. 缺少 CSRF 保护

**位置**：全局中间件

**问题**：
- 虽然使用了 JWT，但没有 CSRF 保护
- 如果 JWT 存储在 Cookie 中，可能受到 CSRF 攻击

**建议**：
- 如果使用 Cookie 存储 JWT，添加 CSRF Token
- 或确保 JWT 只存储在 localStorage 中
- 添加 SameSite Cookie 属性

### 13. 数据库查询未使用索引优化

**位置**：多个 Model 文件

**问题**：
- JSON 数据库使用全表扫描
- MySQL/PostgreSQL 的索引未在代码中明确说明

**建议**：
- 在 MySQL 设置指南中添加索引创建建议
- 对常用查询字段添加索引
- 添加查询性能监控

### 14. 缺少输入验证中间件

**位置**：多个路由

**问题**：
- 每个路由都手动验证输入
- 代码重复，容易遗漏

**建议**：
- 使用 `express-validator` 或 `joi` 进行统一验证
- 创建可复用的验证规则
- 示例：
```javascript
const { body, validationResult } = require('express-validator');

const validateCreateUser = [
    body('username').isLength({ min: 3, max: 20 }).isAlphanumeric(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['user', 'admin']),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];
```

### 15. 文件哈希计算在内存中进行

**位置**：`backend/src/routes/helpers/fileHelpers.js`

**问题**：
- 大文件的哈希计算会占用大量内存
- 可能导致内存溢出

**建议**：
```javascript
// 使用流式计算哈希
function calculateFileHashStream(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}
```

### 16. 缺少健康检查端点详细信息

**位置**：健康检查接口

**问题**：
- 健康检查只返回简单状态
- 无法了解各个组件的健康状况

**建议**：
```javascript
router.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'unknown',
        disk: 'unknown',
        memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal
        }
    };

    try {
        // 检查数据库连接
        await db.ping();
        health.database = 'ok';
    } catch (error) {
        health.database = 'error';
        health.status = 'degraded';
    }

    res.json(health);
});
```

### 17. 缺少 API 版本控制

**位置**：路由定义

**问题**：
- 所有 API 都在 `/api/` 下，没有版本号
- 未来升级 API 时可能破坏兼容性

**建议**：
```javascript
// 使用版本前缀
app.use('/api/v1', routes);

// 或使用请求头版本控制
app.use((req, res, next) => {
    const version = req.headers['api-version'] || 'v1';
    req.apiVersion = version;
    next();
});
```

### 18. 分享码生成可能重复

**位置**：`backend/src/models/ShareModel.js`

**问题**：
- 虽然概率很低，但随机生成的分享码可能重复
- 没有重试机制

**建议**：
```javascript
async generateUniqueCode() {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        const code = this._generateRandomCode();
        const existing = await this.findByCode(code);
        if (!existing) {
            return code;
        }
        attempts++;
    }
    
    throw new Error('无法生成唯一分享码');
}
```

### 19. 缺少用户操作审计日志

**位置**：全局

**问题**：
- 没有完整的用户操作审计日志
- 无法追踪谁在什么时间做了什么操作

**建议**：
- 创建 AuditLog 模型
- 记录关键操作：登录、文件上传/下载/删除、权限变更等
- 提供审计日志查询接口

### 20. 前端敏感信息暴露

**位置**：前端代码

**问题**：
- API 基础 URL 可能暴露内部网络结构
- 错误信息可能包含敏感信息

**建议**：
- 使用环境变量配置 API URL
- 前端错误处理统一化
- 生产环境移除 console.log

---

## 📊 性能优化建议

### 21. 缺少缓存机制

**建议**：
- 使用 Redis 缓存用户信息、文件夹列表等
- 缓存分享链接验证结果
- 设置合理的缓存过期时间

### 22. 数据库连接池配置

**建议**：
- MySQL/PostgreSQL 连接池大小根据并发量调整
- 添加连接池监控
- 设置连接超时和重试机制

### 23. 静态资源缓存

**建议**：
- 前端静态资源添加 CDN
- 设置合理的 Cache-Control 头
- 使用文件指纹（hash）实现长期缓存

---

## 🔒 安全加固建议

### 24. 添加安全响应头

**建议**：
```javascript
// 使用 helmet 中间件
const helmet = require('helmet');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
```

### 25. 实施内容安全策略（CSP）

**建议**：
- 限制可执行脚本的来源
- 防止 XSS 攻击
- 添加 CSP 报告端点

### 26. 添加 IP 黑名单功能

**建议**：
- 记录异常访问行为
- 自动封禁恶意 IP
- 提供手动封禁/解封接口

---

## 📝 代码质量建议

### 27. 添加单元测试

**建议**：
- 使用 Jest 或 Mocha 编写单元测试
- 测试覆盖率至少 70%
- 关键功能（认证、文件操作）100% 覆盖

### 28. 添加 API 文档

**建议**：
- 使用 Swagger/OpenAPI 生成 API 文档
- 包含请求/响应示例
- 包含错误码说明

### 29. 代码规范统一

**建议**：
- 使用 ESLint 统一代码风格
- 添加 Prettier 格式化
- 配置 Git hooks 自动检查

### 30. 添加类型检查

**建议**：
- 考虑迁移到 TypeScript
- 或使用 JSDoc 添加类型注释
- 使用 VS Code 的类型检查功能

---

## 🎯 优先级建议

### 立即修复（本周内）
1. ✅ 默认管理员密码问题
2. ✅ JWT Secret 检查
3. ✅ 文件路径遍历风险
4. ✅ 文件类型检查

### 近期修复（本月内）
5. 密码强度验证
6. 分享链接访问限制
7. 输入验证中间件
8. 日志敏感信息过滤

### 长期优化（下个版本）
9. 缓存机制
10. 审计日志
11. API 版本控制
12. 单元测试

---

## 总结

项目整体架构合理，代码质量良好，但存在一些安全隐患和性能优化空间。建议按优先级逐步修复和优化。

**优点**：
- ✅ 使用了 JWT 认证
- ✅ 实现了权限控制
- ✅ 支持多种数据库
- ✅ 有完善的错误处理
- ✅ 实现了限流机制

**需要改进**：
- ❌ 默认密码过于简单
- ❌ 缺少输入验证
- ❌ 缺少文件类型检查
- ❌ 缺少审计日志
- ❌ 缺少单元测试

**风险评估**：
- 🔴 高风险：2 个
- 🟡 中风险：6 个
- 🟢 低风险：22 个
