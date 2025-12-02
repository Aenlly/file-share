# 快速开始指南

## 5分钟快速启动

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 启动服务器（使用JSON数据库）
```bash
npm start
```

服务器将在 `http://localhost:3000` 启动

### 3. 默认账号
- 用户名：`admin`
- 密码：`admin123`

### 4. 测试API

#### 登录
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

响应：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

#### 创建文件夹
```bash
curl -X POST http://localhost:3000/api/folders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"alias":"我的文件夹"}'
```

#### 获取文件夹列表
```bash
curl http://localhost:3000/api/folders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 切换数据库

### 使用MongoDB

1. 安装MongoDB
2. 修改 `.env`：
```env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/file-share
```
3. 重启服务器

### 使用MySQL

1. 创建数据库：
```sql
CREATE DATABASE file_share;
```

2. 修改 `.env`：
```env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=file_share
```

3. 重启服务器

### 使用PostgreSQL

1. 创建数据库：
```sql
CREATE DATABASE file_share;
```

2. 修改 `.env`：
```env
DB_TYPE=postgresql
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DATABASE=file_share
```

3. 重启服务器

## 前端配置

### 开发环境
```bash
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:3001` 启动

### 生产环境
```bash
npm run build
```

构建后的文件在 `frontend/dist` 目录

## 常见问题

### Q: 如何修改默认管理员密码？
A: 登录后在个人资料页面修改密码

### Q: 如何创建新用户？
A: 使用管理员账号登录，进入用户管理页面创建

### Q: 文件存储在哪里？
A: 默认存储在 `backend/files` 目录

### Q: 如何备份数据？
A: 
- JSON：备份 `backend/data` 目录
- MongoDB：使用 `mongodump`
- MySQL：使用 `mysqldump`
- PostgreSQL：使用 `pg_dump`

### Q: 如何恢复数据？
A: 
- JSON：恢复 `backend/data` 目录
- MongoDB：使用 `mongorestore`
- MySQL：使用 `mysql` 命令
- PostgreSQL：使用 `psql` 命令

## 开发模式

使用nodemon自动重启服务器：

```bash
npm run dev
```

## 生产部署

### 1. 环境配置
```env
NODE_ENV=production
JWT_SECRET=<strong-random-key>
DB_TYPE=postgresql
LOG_LEVEL=warn
CORS_ORIGIN=https://yourdomain.com
```

### 2. 使用PM2管理进程
```bash
npm install -g pm2
pm2 start server.js --name "file-share"
pm2 save
pm2 startup
```

### 3. 使用Nginx反向代理
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. 使用HTTPS
```bash
# 使用Let's Encrypt
sudo certbot certonly --standalone -d yourdomain.com
```

## 监控和日志

### 查看日志
```bash
# 实时查看日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log
```

### 健康检查
```bash
curl http://localhost:3000/health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "database": "json"
}
```

## 性能优化

### 1. 启用缓存
在前端 `.env` 中配置缓存时间

### 2. 使用CDN
将静态文件上传到CDN

### 3. 数据库优化
- 为常用字段创建索引
- 定期清理过期的分享链接
- 定期备份数据库

### 4. 服务器优化
- 增加服务器内存
- 使用SSD存储
- 启用gzip压缩

## 安全建议

1. **修改默认密码**：首次启动后立即修改admin密码
2. **启用HTTPS**：生产环境必须使用HTTPS
3. **定期备份**：每天备份一次数据
4. **监控日志**：定期检查日志文件
5. **更新依赖**：定期更新npm包
6. **限制上传**：根据需要调整文件大小限制

## 获取帮助

- 查看 [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md) 了解升级信息
- 查看 [DATABASE_ADAPTER_GUIDE.md](./DATABASE_ADAPTER_GUIDE.md) 了解数据库适配器
- 查看日志文件获取错误信息
- 检查 `.env` 配置是否正确

## 下一步

- 配置前端环境变量
- 创建用户账号
- 上传文件
- 创建分享链接
- 邀请其他用户
