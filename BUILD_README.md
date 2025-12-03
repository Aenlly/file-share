# 构建和打包指南

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端和后端依赖
npm run install:all
```

### 2. 开发模式

```bash
# 同时启动前端和后端开发服务器
npm run dev

# 或分别启动
npm run dev:frontend  # 前端开发服务器 (http://localhost:5173)
npm run dev:backend   # 后端开发服务器 (http://localhost:3000)
```

### 3. 构建发布包

```bash
# 构建完整的发布包（包含所有平台）
npm run build:release
```

这将生成以下文件：
- `release/file-share-windows.zip` - Windows 版本
- `release/file-share-linux.zip` - Linux 版本
- `release/file-share-macos.zip` - macOS 版本

## 构建步骤详解

### 仅构建前端

```bash
cd frontend
npm run build
```

构建产物位于 `frontend/dist/`

### 仅构建后端可执行文件

```bash
cd backend
npm install pkg -g  # 首次需要安装 pkg
npm run build
```

构建产物位于 `backend/dist/`

### 构建特定平台

```bash
cd backend

# Windows
npm run build:win

# Linux
npm run build:linux

# macOS
npm run build:macos
```

## 发布包内容

每个平台的发布包包含：

```
file-share-{platform}/
├── file-share-{platform}.exe/bin  # 可执行文件
├── start.bat/sh                    # 启动脚本
├── .env.example                    # 环境变量模板
├── README.txt                      # 使用说明
├── DEPLOYMENT_GUIDE.md            # 部署指南
├── data/                          # 数据目录
├── files/                         # 文件存储目录
└── logs/                          # 日志目录
```

## 部署说明

### Windows

1. 解压 `file-share-windows.zip`
2. 复制 `.env.example` 为 `.env` 并配置
3. 双击 `start.bat` 启动
4. 访问 http://localhost:3000

### Linux

1. 解压 `file-share-linux.zip`
2. 添加执行权限: `chmod +x file-share-linux start.sh`
3. 复制 `.env.example` 为 `.env` 并配置
4. 运行 `./start.sh`
5. 访问 http://localhost:3000

### macOS

1. 解压 `file-share-macos.zip`
2. 添加执行权限: `chmod +x file-share-macos start.sh`
3. 复制 `.env.example` 为 `.env` 并配置
4. 运行 `./start.sh`
5. 访问 http://localhost:3000

## 配置说明

编辑 `.env` 文件：

```env
# 服务器端口
PORT=3000

# 数据库类型 (json/mongodb/mysql/postgresql)
DB_TYPE=json

# JWT密钥（请修改为随机字符串）
JWT_SECRET=your-secret-key-here

# CORS允许的源
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

## 默认账号

- 用户名: `admin`
- 密码: `admin123`

**⚠️ 首次登录后请立即修改密码！**

## 数据库选项

### JSON 数据库（默认）
- 无需额外配置
- 适合小型部署
- 数据存储在 `data/` 目录

### MongoDB
```env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/file-share
```

### MySQL
```env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=file_share
```

### PostgreSQL
```env
DB_TYPE=postgresql
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DATABASE=file_share
```

## 故障排查

### 端口被占用

```bash
# Windows
netstat -ano | findstr :3000

# Linux/macOS
lsof -i :3000
```

### 权限问题

```bash
# Linux/macOS
chmod +x file-share-linux
chmod -R 755 data/ files/ logs/
```

### 查看日志

```bash
# 实时查看日志
tail -f logs/app.log

# Windows
type logs\app.log
```

## 高级配置

详细的部署和配置说明请查看：
- `DEPLOYMENT_GUIDE.md` - 完整部署指南
- `backend/DATABASE_ADAPTER_GUIDE.md` - 数据库配置指南
- `backend/QUICK_START.md` - 快速开始指南

## 技术栈

### 前端
- React 18
- Ant Design
- React Router
- React Query
- Axios

### 后端
- Node.js
- Express
- JWT 认证
- 多数据库支持
- Winston 日志

## 系统要求

- Node.js 14+ (开发环境)
- 无需 Node.js (生产环境，使用打包的可执行文件)
- 2GB+ RAM
- 10GB+ 磁盘空间

## 更新日志

### v2.0.0
- ✅ 支持打包成独立可执行文件
- ✅ 移动端完全适配
- ✅ 多数据库支持
- ✅ 文件分片上传
- ✅ 子文件夹支持
- ✅ 分享链接管理
- ✅ 用户权限管理

## 许可证

MIT License

## 支持

如有问题，请：
1. 查看日志文件 `logs/app.log`
2. 参考 `DEPLOYMENT_GUIDE.md`
3. 提交 Issue

---

祝使用愉快！🚀
