# 系统架构文档

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端应用 (React)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Pages (Dashboard, FolderDetail, etc.)               │  │
│  │  Components (Layout, Upload, etc.)                   │  │
│  │  Stores (Zustand - Auth State)                       │  │
│  │  Utils (API Client, Helpers)                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                    后端应用 (Express)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes (User, Folder, Share, File)                 │  │
│  │  Middleware (Auth, RateLimit, ErrorHandler)         │  │
│  │  Models (User, Folder, File, Share)                 │  │
│  │  Controllers (Business Logic)                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  数据库抽象层 (DatabaseManager)                      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  BaseAdapter (Interface)                       │  │  │
│  │  │  ├─ JsonAdapter                                │  │  │
│  │  │  ├─ MongoDbAdapter                             │  │  │
│  │  │  ├─ MysqlAdapter                               │  │  │
│  │  │  └─ PostgresqlAdapter                          │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    数据存储层                                │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │   JSON文件   │   MongoDB    │  MySQL/PG    │            │
│  │   (本地)     │   (NoSQL)    │  (关系型)    │            │
│  └──────────────┴──────────────┴──────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    文件存储系统                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  backend/files/                                      │  │
│  │  ├─ admin/                                           │  │
│  │  ├─ user1/                                           │  │
│  │  └─ user2/                                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 分层架构

### 1. 表现层（Frontend）

**职责：**
- 用户界面展示
- 用户交互处理
- 状态管理
- API调用

**主要组件：**
- Pages：页面组件
- Components：可复用组件
- Stores：全局状态（Zustand）
- Utils：工具函数和API客户端

### 2. 应用层（Backend - Routes & Controllers）

**职责：**
- 请求路由
- 请求验证
- 业务逻辑处理
- 响应格式化

**主要模块：**
- Routes：API路由定义
- Middleware：请求处理中间件
- Controllers：业务逻辑（可选）

### 3. 数据访问层（Models）

**职责：**
- 数据模型定义
- 数据库操作
- 数据验证

**主要模块：**
- BaseModel：基础模型类
- UserModel：用户数据模型
- FolderModel：文件夹数据模型
- FileModel：文件数据模型
- ShareModel：分享数据模型

### 4. 数据库抽象层（Database Adapters）

**职责：**
- 数据库连接管理
- 数据库操作适配
- 数据库特定功能实现

**主要模块：**
- BaseAdapter：适配器基类
- JsonAdapter：JSON文件适配器
- MongoDbAdapter：MongoDB适配器
- MysqlAdapter：MySQL适配器
- PostgresqlAdapter：PostgreSQL适配器

### 5. 数据存储层（Database & File System）

**职责：**
- 数据持久化
- 文件存储

**主要存储：**
- 数据库（JSON/MongoDB/MySQL/PostgreSQL）
- 文件系统（backend/files）

## 数据流

### 用户登录流程

```
1. 用户输入用户名和密码
   ↓
2. 前端调用 POST /api/users/login
   ↓
3. 后端验证用户名和密码
   ↓
4. 生成JWT令牌
   ↓
5. 返回令牌和用户信息
   ↓
6. 前端存储令牌到localStorage
   ↓
7. 后续请求在Authorization头中携带令牌
```

### 文件上传流程

```
1. 用户选择文件
   ↓
2. 前端验证文件大小和类型
   ↓
3. 前端调用 POST /api/folders/{id}/upload
   ↓
4. 后端验证用户权限
   ↓
5. 后端验证文件类型和大小
   ↓
6. 后端保存文件到文件系统
   ↓
7. 后端创建文件记录到数据库
   ↓
8. 返回上传结果
   ↓
9. 前端刷新文件列表
```

### 分享链接流程

```
1. 用户创建分享
   ↓
2. 后端生成唯一访问码
   ↓
3. 后端保存分享记录到数据库
   ↓
4. 返回访问码和过期时间
   ↓
5. 用户分享链接给其他人
   ↓
6. 访客访问链接
   ↓
7. 后端验证访问码和过期时间
   ↓
8. 返回文件列表
   ↓
9. 访客下载文件
```

## 数据库模式

### 用户表 (users)

```javascript
{
  id: Number,              // 用户ID
  username: String,        // 用户名（唯一）
  password: String,        // 密码哈希
  role: String,            // 角色 (admin/user)
  menuPermissions: Array,  // 菜单权限
  createdAt: String,       // 创建时间
  updatedAt: String        // 更新时间
}
```

### 文件夹表 (folders)

```javascript
{
  id: Number,              // 文件夹ID
  alias: String,           // 文件夹名称
  physicalPath: String,    // 物理路径
  owner: String,           // 所有者用户名
  parentId: Number|null,   // 父文件夹ID
  createdAt: String,       // 创建时间
  updatedAt: String        // 更新时间
}
```

### 文件表 (files)

```javascript
{
  id: Number,              // 文件ID
  folderId: Number,        // 所属文件夹ID
  originalName: String,    // 原始文件名
  savedName: String,       // 保存的文件名
  size: Number,            // 文件大小（字节）
  mimeType: String,        // MIME类型
  owner: String,           // 所有者用户名
  uploadTime: String,      // 上传时间
  createdAt: String,       // 创建时间
  updatedAt: String        // 更新时间
}
```

### 分享表 (shares)

```javascript
{
  id: Number,              // 分享ID
  code: String,            // 访问码（唯一）
  folderId: Number,        // 文件夹ID
  owner: String,           // 所有者用户名
  expireTime: Number,      // 过期时间戳
  createdAt: String,       // 创建时间
  updatedAt: String        // 更新时间
}
```

## API端点

### 用户管理
- `POST /api/users/login` - 登录
- `GET /api/users` - 获取所有用户（管理员）
- `POST /api/users` - 创建用户（管理员）
- `GET /api/users/me` - 获取当前用户
- `PUT /api/users/:id` - 更新用户
- `POST /api/users/:id/change-password` - 修改密码
- `DELETE /api/users/:id` - 删除用户（管理员）

### 文件夹管理
- `GET /api/folders` - 获取文件夹列表
- `POST /api/folders` - 创建文件夹
- `GET /api/folders/:id` - 获取文件夹详情
- `DELETE /api/folders/:id` - 删除文件夹
- `GET /api/folders/:id/files` - 获取文件夹内文件
- `GET /api/folders/:id/subfolders` - 获取子文件夹

### 文件管理
- `POST /api/folders/:id/upload` - 上传文件
- `DELETE /api/folders/:id/file` - 删除文件
- `GET /api/folders/:id/download/:filename` - 下载文件
- `POST /api/folders/:id/move` - 移动文件

### 分享管理
- `GET /api/shares` - 获取分享列表
- `POST /api/shares` - 创建分享
- `PUT /api/shares/:id` - 更新分享
- `DELETE /api/shares/:id` - 删除分享
- `POST /api/shares/batch/delete` - 批量删除分享
- `POST /api/shares/batch/extend` - 批量延长分享

### 公开分享
- `POST /api/shares/verify` - 验证访问码
- `GET /api/shares/:code/files` - 获取分享文件
- `GET /api/shares/:code/download/:filename` - 下载分享文件
- `GET /api/shares/:code/download-all` - 下载整个分享文件夹
- `GET /api/shares/:code/preview/:filename` - 获取图片预览

### 系统
- `GET /health` - 健康检查

## 安全机制

### 1. 认证
- JWT令牌认证
- 令牌过期时间：7天
- 令牌存储在localStorage

### 2. 授权
- 基于角色的访问控制（RBAC）
- 管理员角色：manageUsers, viewFolders
- 普通用户角色：viewFolders

### 3. 速率限制
- 全局限制：100请求/15分钟
- 登录限制：5次尝试/15分钟
- 上传限制：100次/小时

### 4. 数据验证
- 文件类型检查
- 文件大小限制（100MB）
- 危险文件类型拦截

### 5. 加密
- 密码使用bcrypt加密
- JWT使用HS256算法签名

## 扩展性

### 添加新的数据库适配器

1. 创建新的适配器类继承BaseAdapter
2. 实现所有必需的方法
3. 在DatabaseManager中注册适配器
4. 在.env中配置数据库类型

### 添加新的API端点

1. 创建路由文件
2. 定义路由和处理函数
3. 在app.js中注册路由
4. 添加必要的中间件

### 添加新的中间件

1. 创建中间件文件
2. 实现中间件函数
3. 在app.js中使用中间件

## 性能优化

### 1. 数据库优化
- 使用连接池
- 创建索引
- 避免N+1查询

### 2. 缓存
- 前端缓存API响应
- 后端缓存频繁查询

### 3. 文件优化
- 图片压缩
- 文件分块上传
- CDN加速

### 4. 代码优化
- 异步处理
- 流式传输
- 压缩响应

## 监控和日志

### 日志级别
- error：错误信息
- warn：警告信息
- info：一般信息
- debug：调试信息

### 日志文件
- logs/error.log：错误日志
- logs/combined.log：所有日志

### 监控指标
- API响应时间
- 数据库查询时间
- 文件上传/下载速度
- 错误率
- 用户活跃度
