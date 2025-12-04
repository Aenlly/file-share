# 限流机制重构 - 按接口独立计算

## 问题描述

之前的限流机制是全局的，所有 API 请求共享同一个计数器。这导致：
1. 用户正常使用多个不同功能时容易触发限流
2. 无法针对特定接口设置合理的限流策略
3. 一个接口的频繁请求会影响其他接口的使用

## 解决方案

重构限流机制，使每个接口独立计算请求次数。

## 实现细节

### 1. 核心改进：按用户和接口独立计算

**文件**: `backend/src/middleware/rateLimiter.js`

```javascript
const createRateLimiter = (options = {}) => {
    const perEndpoint = options.perEndpoint !== false; // 默认为 true
    
    return rateLimit({
        // ...
        keyGenerator: (req) => {
            const ip = req.ip || req.connection.remoteAddress;
            // 获取用户标识（已认证用户使用用户名，未认证使用IP）
            const userIdentifier = req.user?.username || ip;
            
            if (perEndpoint) {
                // 每个接口独立计算：用户 + 请求方法 + 路径
                // 规范化路径，将数字ID替换为占位符，使同类接口共享限流
                const normalizedPath = req.path.replace(/\/\d+/g, '/:id');
                return `${userIdentifier}:${req.method}:${normalizedPath}`;
            } else {
                // 全局计算：只使用用户标识
                return userIdentifier;
            }
        },
        ...options
    });
};
```

**关键点**：
- `perEndpoint: true` - 每个接口独立计算（默认）
- `perEndpoint: false` - 全局计算（用于登录等特殊场景）
- **用户隔离**：每个用户有独立的限流计数器，不会互相影响
- **未认证用户**：使用 IP 地址作为标识
- 路径规范化：`/folders/123/files` → `/folders/:id/files`，使同类接口共享限流

### 2. API 限流配置

```javascript
const apiLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,  // 1秒
    max: config.rateLimitMaxRequests,     // 5次
    perEndpoint: true,                    // 每个接口独立计算
    skip: (req) => {
        // 跳过分片上传相关的 API
        if (req.path.includes('/chunk/init')) return true;
        if (req.path.includes('/chunk/complete')) return true;
        if (req.path.match(/\/chunk$/)) return true;
        return false;
    }
});
```

### 3. 登录限流配置

```javascript
const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,  // 15分钟
    max: 5,                     // 最多5次尝试
    perEndpoint: false,         // 全局限制（防止暴力破解）
    message: '登录尝试过于频繁，请15分钟后再试'
});
```

**为什么登录使用全局限制？**
- 防止攻击者通过不同的登录接口绕过限流
- 更严格的安全策略

### 4. 上传限流配置

```javascript
const uploadLimiter = config.nodeEnv === 'development' 
    ? (req, res, next) => next()
    : createRateLimiter({
        windowMs: 60 * 60 * 1000,  // 1小时
        max: 1000,                  // 每小时最多1000次
        perEndpoint: true,          // 每个文件夹独立计算
        message: '上传过于频繁，请稍后再试'
    });
```

## 限流键生成示例

### 按接口独立计算 (perEndpoint: true)

**已认证用户**：

| 用户 | 请求 | 限流键 | 说明 |
|------|------|--------|------|
| user1 | `GET /api/folders` | `user1:GET:/api/folders` | 用户1获取文件夹列表 |
| user1 | `GET /api/folders/123/files` | `user1:GET:/api/folders/:id/files` | 用户1获取文件列表 |
| user1 | `GET /api/folders/456/files` | `user1:GET:/api/folders/:id/files` | 同类接口共享限流 |
| user2 | `GET /api/folders/123/files` | `user2:GET:/api/folders/:id/files` | 用户2独立计数 |
| user1 | `POST /api/folders/123/upload` | `user1:POST:/api/folders/:id/upload` | 用户1上传文件 |

**未认证用户**（使用 IP）：

| IP | 请求 | 限流键 | 说明 |
|------|------|--------|------|
| 192.168.1.1 | `POST /api/users/login` | `192.168.1.1:POST:/api/users/login` | 未登录，使用IP |
| 192.168.1.2 | `POST /api/users/login` | `192.168.1.2:POST:/api/users/login` | 不同IP独立计数 |

### 全局计算 (perEndpoint: false)

**登录限流**（防止暴力破解）：

| 用户/IP | 请求 | 限流键 | 说明 |
|------|------|--------|------|
| 192.168.1.1 | `POST /api/users/login` | `192.168.1.1` | 未登录，使用IP |
| user1 | `POST /api/auth/logout` | `user1` | 已登录，使用用户名 |

## 使用场景对比

### 场景1：多个用户同时使用

**修改前（基于IP的全局限流）**：
```
公司内网（同一IP: 192.168.1.1），1秒内：
- user1: GET /api/folders (1)
- user2: GET /api/folders (2)
- user3: GET /api/folders (3)
- user1: GET /api/folders/1/files (4)
- user2: GET /api/folders/2/files (5)
- user3: GET /api/folders/3/files (6) ❌ 触发限流！
```

**修改后（基于用户+接口）**：
```
公司内网（同一IP），1秒内：
- user1: GET /api/folders (user1:GET:/api/folders = 1/5)
- user2: GET /api/folders (user2:GET:/api/folders = 1/5)
- user3: GET /api/folders (user3:GET:/api/folders = 1/5)
- user1: GET /api/folders/1/files (user1:GET:/api/folders/:id/files = 1/5)
- user2: GET /api/folders/2/files (user2:GET:/api/folders/:id/files = 1/5)
- user3: GET /api/folders/3/files (user3:GET:/api/folders/:id/files = 1/5) ✅ 正常
```

### 场景2：单个用户正常使用多个功能

**修改前（全局限流）**：
```
user1 在1秒内的请求：
- GET /api/folders (1)
- GET /api/folders/1/files (2)
- GET /api/shares (3)
- GET /api/recycle (4)
- GET /api/users/storage (5)
- GET /api/folders/2/files (6) ❌ 触发限流！
```

**修改后（按接口独立）**：
```
user1 在1秒内的请求：
- GET /api/folders (user1:GET:/api/folders = 1/5)
- GET /api/folders/1/files (user1:GET:/api/folders/:id/files = 1/5)
- GET /api/shares (user1:GET:/api/shares = 1/5)
- GET /api/recycle (user1:GET:/api/recycle = 1/5)
- GET /api/users/storage (user1:GET:/api/users/storage = 1/5)
- GET /api/folders/2/files (user1:GET:/api/folders/:id/files = 2/5) ✅ 正常
```

### 场景3：恶意频繁请求单个接口

**修改前和修改后都能有效限制**：
```
user1 在1秒内的请求：
- GET /api/folders/1/files (1)
- GET /api/folders/1/files (2)
- GET /api/folders/1/files (3)
- GET /api/folders/1/files (4)
- GET /api/folders/1/files (5)
- GET /api/folders/1/files (6) ❌ 触发限流！
```

## 配置说明

### 环境变量

```env
# 限流时间窗口（毫秒）
RATE_LIMIT_WINDOW_MS=1000

# 时间窗口内最大请求数
RATE_LIMIT_MAX_REQUESTS=5
```

### 默认配置

- **API 限流**: 1秒内每个接口最多5次请求
- **登录限流**: 15分钟内最多5次登录尝试（全局）
- **上传限流**: 1小时内每个文件夹最多1000次上传（生产环境）

## 优势

### 1. 用户隔离
- **每个用户独立计数**：多个用户不会互相影响
- **解决内网问题**：公司内网多个用户共享IP也不会触发限流
- **公平性**：每个用户都有相同的请求配额

### 2. 更合理的限流策略
- 用户正常使用多个功能不会触发限流
- 只有单个接口频繁请求才会被限制
- 同类接口共享限流（如不同文件夹的文件列表）

### 3. 更好的用户体验
- 减少误判，提高可用性
- 用户可以同时使用多个功能
- 多用户环境下不会相互干扰

### 4. 更灵活的配置
- 可以针对不同接口设置不同的限流策略
- 支持全局限流（如登录）和独立限流（如API）
- 已认证和未认证用户分别处理

### 5. 更有效的防护
- 仍然能有效防止单个接口的恶意请求
- 路径规范化使同类接口共享限流
- 未认证用户使用IP限流，防止匿名攻击

## 测试场景

### 测试1：正常使用多个功能
```bash
# 1秒内请求多个不同接口
curl http://localhost:3000/api/folders
curl http://localhost:3000/api/shares
curl http://localhost:3000/api/recycle
curl http://localhost:3000/api/users/storage
curl http://localhost:3000/api/folders/1/files
curl http://localhost:3000/api/folders/2/files

# 预期：全部成功
```

### 测试2：频繁请求单个接口
```bash
# 1秒内请求同一个接口6次
for i in {1..6}; do
  curl http://localhost:3000/api/folders/1/files
done

# 预期：前5次成功，第6次返回429
```

### 测试3：登录限流
```bash
# 15分钟内尝试登录6次
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
done

# 预期：前5次返回401（密码错误），第6次返回429（限流）
```

## 注意事项

1. **用户识别**：
   - 已认证用户：使用 `req.user.username`
   - 未认证用户：使用 IP 地址
   - 确保认证中间件在限流中间件之前执行

2. **路径规范化**：数字ID会被替换为 `:id`，使同类接口共享限流

3. **开发环境**：上传限流在开发环境下被禁用

4. **分片上传**：分片上传接口不受限流影响

5. **登录安全**：登录接口使用全局限流（基于IP），更严格

6. **内网环境**：多个用户共享IP时，每个用户仍有独立的限流计数器

## 相关文件

- `backend/src/middleware/rateLimiter.js` - 限流中间件
- `backend/src/config/index.js` - 限流配置
- `backend/.env` - 环境变量配置
- `backend/src/app.js` - 限流应用

## 迁移指南

### 对现有代码的影响

**无需修改**：
- 现有的限流中间件调用方式不变
- 配置文件不需要修改
- 环境变量不需要修改

**自动生效**：
- 重启后端服务器后自动生效
- 所有 API 自动切换到按接口独立计算
- 登录接口保持全局限流

### 重启服务器

```bash
cd backend
npm start
```

重启后，新的限流机制立即生效。
