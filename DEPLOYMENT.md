# 部署指南

## 📋 目录

1. [本地开发部署](#本地开发部署)
2. [生产环境部署](#生产环境部署)
3. [Docker部署](#docker部署)
4. [云平台部署](#云平台部署)
5. [监控和维护](#监控和维护)

## 本地开发部署

### 快速启动

```bash
# 1. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 启动后端（终端1）
cd backend && npm run dev

# 3. 启动前端（终端2）
cd frontend && npm run dev

# 4. 访问应用
# 前端: http://localhost:3001
# 后端: http://localhost:3000
```

### 版本检查

```bash
cd backend
npm run check
```

## 生产环境部署

### 1. 服务器准备

#### 系统要求
- Ubuntu 20.04 LTS 或更高版本
- 2GB+ RAM
- 10GB+ 磁盘空间
- 稳定的网络连接

#### 安装依赖

```bash
# 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2（进程管理）
sudo npm install -g pm2

# 安装Nginx（反向代理）
sudo apt-get install -y nginx

# 安装PostgreSQL（可选）
sudo apt-get install -y postgresql postgresql-contrib
```

### 2. 应用部署

#### 克隆项目

```bash
cd /opt
sudo git clone <repository-url> file-share
sudo chown -R $USER:$USER file-share
cd file-share
```

#### 安装依赖

```bash
cd backend && npm install --production
cd ../frontend && npm install --production
```

#### 构建前端

```bash
cd frontend
npm run build
```

#### 配置环境变量

```bash
cd backend
cp .env.example .env
nano .env
```

编辑 `.env` 文件：

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-very-long-and-secure-secret-key-here
DB_TYPE=postgresql
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DATABASE=file_share
LOG_LEVEL=warn
CORS_ORIGIN=https://yourdomain.com
```

#### 初始化数据库

```bash
npm run init-db
```

### 3. 使用PM2管理进程

#### 创建PM2配置文件

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'file-share',
    script: './server.js',
    cwd: './backend',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF
```

#### 启动应用

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 监控应用

```bash
pm2 monit
pm2 logs
pm2 status
```

### 4. 配置Nginx反向代理

#### 创建Nginx配置

```bash
sudo nano /etc/nginx/sites-available/file-share
```

```nginx
upstream backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL证书
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/file-share-access.log;
    error_log /var/log/nginx/file-share-error.log;

    # 前端静态文件
    location / {
        root /opt/file-share/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 健康检查
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # 文件上传大小限制
    client_max_body_size 100M;

    # 压缩
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;
    gzip_min_length 1000;
}
```

#### 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/file-share /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. 配置HTTPS

#### 使用Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

#### 自动续期

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 6. 备份和恢复

#### 定期备份

```bash
# 创建备份脚本
cat > /opt/file-share/backup.sh << 'EOF'
#!/bin/bash
cd /opt/file-share/backend
npm run backup
EOF

chmod +x /opt/file-share/backup.sh

# 添加到crontab（每天凌晨2点备份）
crontab -e
# 添加: 0 2 * * * /opt/file-share/backup.sh
```

#### 恢复数据

```bash
# 从备份恢复
cd /opt/file-share/backend
npm run migrate json postgresql
```

## Docker部署

### 1. 创建Dockerfile

#### 后端Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --production

COPY backend/src ./src
COPY backend/server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
```

#### 前端Dockerfile

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 2. Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_TYPE=postgresql
      - PG_HOST=postgres
      - PG_USER=postgres
      - PG_PASSWORD=postgres
      - PG_DATABASE=file_share
    depends_on:
      - postgres
    volumes:
      - ./backend/files:/app/files
      - ./backend/logs:/app/logs
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=file_share
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### 3. 启动Docker

```bash
docker-compose up -d
docker-compose logs -f
```

## 云平台部署

### Heroku部署

```bash
# 1. 安装Heroku CLI
curl https://cli.heroku.com/install.sh | sh

# 2. 登录
heroku login

# 3. 创建应用
heroku create your-app-name

# 4. 配置环境变量
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key
heroku config:set DB_TYPE=postgresql

# 5. 部署
git push heroku main
```

### AWS部署

#### 使用Elastic Beanstalk

```bash
# 1. 安装EB CLI
pip install awsebcli

# 2. 初始化
eb init -p node.js-18 file-share

# 3. 创建环境
eb create production

# 4. 部署
eb deploy
```

#### 使用EC2

```bash
# 1. 启动EC2实例
# 2. 连接到实例
ssh -i your-key.pem ec2-user@your-instance-ip

# 3. 按照生产环境部署步骤进行
```

### 阿里云部署

#### 使用ECS

```bash
# 1. 创建ECS实例
# 2. 连接到实例
ssh root@your-instance-ip

# 3. 按照生产环境部署步骤进行
```

## 监控和维护

### 1. 日志管理

```bash
# 查看应用日志
tail -f backend/logs/combined.log

# 查看错误日志
tail -f backend/logs/error.log

# 查看PM2日志
pm2 logs file-share
```

### 2. 性能监控

```bash
# 使用PM2监控
pm2 monit

# 查看系统资源
top
free -h
df -h
```

### 3. 定期维护

```bash
# 清理旧备份
npm run backup

# 更新依赖
npm update

# 检查系统
npm run check
```

### 4. 安全更新

```bash
# 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 更新Node.js
sudo apt-get install -y nodejs

# 更新npm包
npm audit fix
```

## 故障排除

### 问题：应用无法启动

**解决方案：**
```bash
# 检查日志
pm2 logs file-share

# 检查端口
lsof -i :3000

# 检查环境变量
cat backend/.env
```

### 问题：数据库连接失败

**解决方案：**
```bash
# 检查数据库服务
sudo systemctl status postgresql

# 检查连接字符串
psql -h localhost -U postgres -d file_share

# 查看错误日志
tail -f backend/logs/error.log
```

### 问题：磁盘空间不足

**解决方案：**
```bash
# 检查磁盘使用
df -h

# 清理日志
rm -rf backend/logs/*

# 清理备份
rm -rf backups/*
```

## 性能优化

### 1. 启用缓存

```nginx
# 在Nginx配置中添加
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;

location /api {
    proxy_cache api_cache;
    proxy_cache_valid 200 10m;
}
```

### 2. 启用压缩

```nginx
gzip on;
gzip_types text/plain text/css text/javascript application/json;
gzip_min_length 1000;
```

### 3. 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_folders_owner ON folders(owner);
CREATE INDEX idx_files_folderId ON files(folderId);
CREATE INDEX idx_shares_code ON shares(code);
```

## 备份策略

### 自动备份

```bash
# 每天凌晨2点备份
0 2 * * * /opt/file-share/backend/scripts/backup-data.js

# 每周日凌晨3点完整备份
0 3 * * 0 /opt/file-share/backend/scripts/backup-data.js
```

### 备份验证

```bash
# 定期测试恢复
npm run migrate json postgresql
```

## 监控告警

### 使用Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'file-share'
    static_configs:
      - targets: ['localhost:3000']
```

### 使用Grafana

```bash
# 安装Grafana
sudo apt-get install -y grafana-server

# 启动
sudo systemctl start grafana-server
```

## 总结

- ✅ 本地开发：使用npm run dev
- ✅ 生产环境：使用PM2 + Nginx + PostgreSQL
- ✅ Docker部署：使用docker-compose
- ✅ 云平台：支持Heroku、AWS、阿里云
- ✅ 监控维护：使用PM2、Nginx日志、系统监控

---

**更新日期：** 2024-01-01  
**版本：** 2.0.0
