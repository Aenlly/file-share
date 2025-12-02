# 文件分享系统 v2.0

一个现代化的文件分享系统，支持多种数据库类型的无缝切换。采用前后端分离架构，提供完整的文件管理、用户管理和分享功能。

**[English](./README_EN.md) | 中文**

## ✨ 核心特性

### 🗄️ 多数据库支持
- **JSON** - 本地文件存储（默认，无需配置）
- **MongoDB** - NoSQL数据库
- **MySQL** - 关系型数据库
- **PostgreSQL** - 关系型数据库
- **无缝切换** - 只需修改环境变量

### 🔐 安全性
- JWT认证和授权
- 基于角色的访问控制（RBAC）
- 速率限制防止暴力攻击
- 文件类型和大小检查
- 密码bcrypt加密

### 📊 前端功能
- 用户登录和认证
- 用户管理（管理员权限）
  - 创建、编辑、删除用户
  - 修改用户密码
  - 角色权限管理
- 文件夹管理（创建、删除、查看）
- 文件管理（上传、删除、移动）
  - 文件类型限制和安全检查
  - 大文件上传支持（100MB限制）
  - 文件去重机制
- 分享链接管理
  - 生成分享链接
  - 查看所有分享链接
  - 延长有效期（7天、30天或自定义）
  - 禁用分享链接
  - 批量操作支持
- 访客访问（通过访客码访问和下载文件）
- 现代化UI设计（基于Ant Design）

### 后端功能
- JWT认证和授权
- 用户管理（基于JSON本地存储）
- 文件夹和文件管理
  - 用户隔离的文件夹结构
  - 物理路径与用户名关联
- 文件分享功能
  - 时效性控制
  - 访客码生成和验证
- 访客访问控制
- 文件上传下载
  - 文件类型安全检查
  - 文件大小限制
  - 文件去重机制

## 技术栈

### 前端
- React 18
- React Router
- Ant Design
- Axios
- React Query
- Zustand（状态管理）
- Tailwind CSS

### 后端
- Node.js
- Express
- JWT认证
- Multer（文件上传）
- bcrypt（密码加密）
- fs-extra（文件操作）
- JSZip（文件压缩）

## 🚀 快速开始

### 最小化安装（5分钟）

```bash
# 1. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 启动后端（终端1）
cd backend && npm start

# 3. 启动前端（终端2）
cd frontend && npm run dev

# 4. 访问应用
# 前端: http://localhost:3001
# 后端: http://localhost:3000
# 默认账号: admin / admin123
```

### 完整安装指南

详见 [INSTALLATION.md](./INSTALLATION.md)

## 🗄️ 数据库配置

### 使用JSON（默认）
无需额外配置，数据存储在 `backend/data` 目录

### 使用MongoDB
```env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/file-share
```

### 使用MySQL
```env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=file_share
```

### 使用PostgreSQL
```env
DB_TYPE=postgresql
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DATABASE=file_share
```

## 🔑 默认账号

系统会自动创建一个默认管理员账号：
- **用户名：** admin
- **密码：** admin123

⚠️ **首次启动后请立即修改密码！**

## 使用说明

### 用户管理
- 管理员可以创建、编辑和删除用户
- 支持管理员和普通用户两种角色
- 管理员可以修改用户角色和密码
- 用户可以修改自己的密码
- 删除用户时保留其文件夹和文件（仅移除用户访问权限和分享链接）

### 文件夹管理
- 用户可以创建自己的文件夹
- 每个用户的文件夹是独立的，物理路径包含用户名
- 支持删除文件夹（会同时删除文件夹内的所有文件）

### 文件管理
- 支持文件上传（自动添加日期后缀，避免文件名冲突）
- 支持文件删除
- 支持文件在不同文件夹间移动
- 文件去重（基于SHA256哈希值，避免重复上传相同文件）
- 支持强制上传重复文件（文件名会添加特殊标记）
- 文件类型安全检查（限制危险文件类型）
- 大文件上传支持（100MB限制）
- 分块上传功能（200KB每块），支持大文件稳定上传
- 多文件同时上传支持
- 图片预览功能（压缩后显示，保持原始比例）
- 图片下载功能（管理端支持下载原图）

### 分享链接管理
- 用户可以为文件夹生成分享链接
- 分享链接支持自定义有效期（1天、7天、30天或自定义）
- 可以查看所有分享链接及其状态
- 支持延长分享链接的有效期
- 支持禁用分享链接
- 支持批量操作（批量延长有效期、批量删除）
- 分享链接状态显示（有效、即将过期、已过期）
- 访问码区分大小写，包含大小写字母和数字，提高安全性
- 访问码自动去重，避免重复生成

### 访客访问
- 访客可以通过分享链接访问和下载文件
- 支持单个文件下载和整个文件夹打包下载
- 分享链接有时效性控制

## 项目结构

```
file-share/
├── backend/                 # 后端代码
│   ├── data/               # 数据存储目录
│   │   ├── users.json      # 用户数据
│   │   ├── folders.json    # 文件夹数据
│   │   └── shares.json     # 分享链接数据
│   ├── package.json
│   └── server.js           # 后端主文件
├── frontend/               # 前端代码
│   ├── public/
│   │   └── share.html      # 访客访问页面
│   ├── src/
│   │   ├── api/            # API接口定义
│   │   ├── components/     # React组件
│   │   │   └── Layout.jsx  # 布局组件
│   │   ├── pages/          # 页面组件
│   │   │   ├── Dashboard.jsx      # 仪表盘
│   │   │   ├── FolderDetail.jsx  # 文件夹详情
│   │   │   ├── GuestAccess.jsx   # 访客访问
│   │   │   ├── Login.jsx         # 登录页
│   │   │   ├── Profile.jsx       # 个人资料
│   │   │   ├── ShareManagement.jsx # 分享管理
│   │   │   └── UserManagement.jsx # 用户管理
│   │   ├── stores/         # 状态管理
│   │   │   └── authStore.js # 认证状态
│   │   ├── utils/          # 工具函数
│   │   │   └── api.js     # API请求封装
│   │   ├── App.jsx         # 主应用组件
│   │   ├── main.jsx        # 入口文件
│   │   └── index.css       # 样式文件
│   ├── package.json
│   └── vite.config.js      # Vite配置
├── files/                  # 文件存储目录
│   ├── admin/              # 管理员文件
│   └── [username]/        # 各用户文件目录
└── README.md
```

## 系统架构

### 数据流
1. **用户认证流程**
   - 用户登录 → JWT令牌生成 → 前端存储令牌 → 后续请求携带令牌
   - 使用Zustand管理全局认证状态

2. **文件管理流程**
   - 文件上传 → 类型检查 → 大小验证 → 去重检测 → 存储到用户目录
   - 文件删除 → 从物理目录移除 → 更新数据库记录

3. **分享链接流程**
   - 生成分享 → 创建唯一访问码 → 设置有效期 → 存储到数据库
   - 访客访问 → 验证访问码 → 检查有效期 → 提供文件访问

### 安全机制
1. **文件安全**
   - 文件类型白名单和黑名单
   - 文件大小限制（100MB）
   - 危险文件类型拦截

2. **访问控制**
   - JWT令牌认证
   - 用户权限分级（管理员/普通用户）
   - 用户数据隔离

3. **分享安全**
   - 访问码随机生成
   - 时效性控制
   - 访客权限限制

## 注意事项

1. 本项目使用JSON文件进行数据存储，适合小型应用和演示
2. 生产环境建议使用数据库（如MongoDB、MySQL等）
3. 文件存储在本地文件系统中，生产环境建议使用云存储
4. 默认JWT密钥为简单字符串，生产环境请更换为更安全的密钥
5. 删除用户时不会删除其文件夹和文件，仅移除用户访问权限

## 开发说明

如需修改或扩展功能，请参考以下文件：

- 后端API：`backend/server.js`
- 前端路由：`frontend/src/App.jsx`
- 状态管理：`frontend/src/stores/authStore.js`
- API请求：`frontend/src/utils/api.js`
- 分享管理：`frontend/src/pages/ShareManagement.jsx`
- 用户管理：`frontend/src/pages/UserManagement.jsx`

## 📚 文档

| 文档 | 说明 |
|------|------|
| [QUICK_START.md](./backend/QUICK_START.md) | 5分钟快速开始 |
| [INSTALLATION.md](./INSTALLATION.md) | 详细安装指南 |
| [UPGRADE_GUIDE.md](./backend/UPGRADE_GUIDE.md) | v1.0升级到v2.0 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统架构详解 |
| [DATABASE_ADAPTER_GUIDE.md](./backend/DATABASE_ADAPTER_GUIDE.md) | 数据库适配器开发 |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | 项目总结 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日志 |

## 📋 版本更新记录

### v2.0.0 (2024-01-01)

#### 🎉 新增功能
- ✅ 数据库抽象层（支持JSON/MongoDB/MySQL/PostgreSQL）
- ✅ 日志系统（Winston）
- ✅ 速率限制（express-rate-limit）
- ✅ 安全HTTP头（Helmet）
- ✅ 统一错误处理
- ✅ 环境变量配置

#### 🔧 改进
- ✅ 模块化代码结构
- ✅ 改进的文件名编码处理
- ✅ 改进的并发处理
- ✅ 改进的错误消息

#### 📚 文档
- ✅ 升级指南
- ✅ 数据库适配器开发指南
- ✅ 快速开始指南
- ✅ 架构文档

详见 [CHANGELOG.md](./CHANGELOG.md)

### v1.2.0
- 优化访问码系统
  - 访问码区分大小写，提高安全性
  - 访问码包含大小写字母和数字，增加组合数量
  - 访问码自动去重，避免重复生成
- 增强文件上传功能
  - 实现分块上传（200KB每块），支持大文件稳定上传
  - 多文件同时上传支持
  - 图片预览功能（压缩后显示，保持原始比例）
  - 图片下载功能（管理端支持下载原图）
- 修复前端访问码验证问题
  - 修复接口成功但前端显示"访问码无效或已过期"的问题
  - 优化访问码验证流程

### v1.1.0
- 新增分享链接管理功能
  - 查看所有分享链接
  - 延长分享链接有效期
  - 自定义过期时间
  - 禁用分享链接
  - 批量操作支持
- 优化文件上传功能
  - 添加文件类型安全检查
  - 支持大文件上传（100MB）
  - 改进文件去重机制
- 改进用户管理
  - 支持删除用户（保留文件）
  - 优化文件夹物理路径（使用用户名）
- 修复认证相关问题
  - 统一API认证机制
  - 优化路由权限控制

### v1.0.0
- 基础文件分享功能
- 用户认证和授权
- 文件夹和文件管理
- 访客分享功能