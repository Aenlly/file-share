# 安装指南

## 系统要求

- Node.js >= 16.0.0
- npm >= 6.0.0
- 磁盘空间 >= 1GB（用于文件存储）

### 可选要求

根据选择的数据库类型：

- **MongoDB**: MongoDB >= 4.0
- **MySQL**: MySQL >= 5.7 或 MariaDB >= 10.3
- **PostgreSQL**: PostgreSQL >= 10

## 完整安装步骤

### 1. 克隆或下载项目

```bash
git clone <repository-url>
cd file-share
```

### 2. 安装后端依赖

```bash
cd backend
npm install
```

### 3. 配置后端环境

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，根据需要修改配置：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置（选择一种）
DB_TYPE=json

# JWT配置
JWT_SECRET=your-secret-key-change-in-production

# 其他配置...
```

### 4. 安装前端依赖

```bash
cd ../frontend
npm install
```

### 5. 配置前端环境

编辑 `frontend/.env.development`：

```env
VITE_BASE_URL=http://localhost:3001
```

编辑 `frontend/.env.production`：

```env
VITE_BASE_URL=https://yourdomain.com
```

### 6. 启动应用

#### 开发环境

终端1 - 启动后端：
```bash
cd backend
npm start
```

终端2 - 启动前端：
```bash
cd frontend
npm run dev
```

访问 `http://localhost:3001`

#### 生产环境

构建前端：
```bash
cd frontend
npm run build
```

启动后端（生产模式）：
```bash
cd backend
NODE_ENV=production npm start
```

## 数据库安装

### JSON（默认，无需安装）

JSON数据库已内置，无需额外安装。数据存储在 `backend/data` 目录。

### MongoDB

#### 安装MongoDB

**Windows:**
```bash
# 使用Chocolatey
choco install mongodb-community

# 或从官网下载安装程序
# https://www.mongodb.com/try/download/community
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
```

**Linux (Ubuntu):**
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

#### 启动MongoDB

```bash
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

#### 配置应用

编辑 `backend/.env`：

```env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/file-share
```

### MySQL

#### 安装MySQL

**Windows:**
```bash
# 使用Chocolatey
choco install mysql

# 或从官网下载安装程序
# https://dev.mysql.com/downloads/mysql/
```

**macOS:**
```bash
brew install mysql
```

**Linux (Ubuntu):**
```bash
sudo apt-get update
sudo apt-get install -y mysql-server
```

#### 启动MySQL

```bash
# Windows
net start MySQL80

# macOS
brew services start mysql

# Linux
sudo systemctl start mysql
```

#### 创建数据库

```bash
mysql -u root -p
```

```sql
CREATE DATABASE file_share;
EXIT;
```

#### 配置应用

编辑 `backend/.env`：

```env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=file_share
```

### PostgreSQL

#### 安装PostgreSQL

**Windows:**
```bash
# 使用Chocolatey
choco install postgresql

# 或从官网下载安装程序
# https://www.postgresql.org/download/windows/
```

**macOS:**
```bash
brew install postgresql
```

**Linux (Ubuntu):**
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
```

#### 启动PostgreSQL

```bash
# Windows
net start postgresql-x64-15

# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

#### 创建数据库

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE file_share;
\q
```

#### 配置应用

编辑 `backend/.env`：

```env
DB_TYPE=postgresql
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DATABASE=file_share
```

## Docker安装（可选）

### 使用Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
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

  frontend:
    build: ./frontend
    ports:
      - "3001:80"
    depends_on:
      - backend

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=file_share
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

启动：

```bash
docker-compose up -d
```

## 验证安装

### 检查后端

```bash
curl http://localhost:3000/health
```

应返回：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "database": "json"
}
```

### 检查前端

访问 `http://localhost:3001`，应看到登录页面

### 测试登录

使用默认账号：
- 用户名：`admin`
- 密码：`admin123`

## 故障排除

### 问题：端口已被占用

**解决方案：**
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或修改 .env 中的 PORT
```

### 问题：数据库连接失败

**解决方案：**
1. 检查数据库服务是否运行
2. 验证连接字符串是否正确
3. 检查防火墙设置
4. 查看日志文件获取详细错误

### 问题：npm install 失败

**解决方案：**
```bash
# 清除npm缓存
npm cache clean --force

# 删除node_modules和package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 问题：文件上传失败

**解决方案：**
1. 检查 `backend/files` 目录是否存在且可写
2. 检查磁盘空间是否充足
3. 检查文件大小是否超过限制

## 下一步

1. 修改默认管理员密码
2. 创建用户账号
3. 配置HTTPS（生产环境）
4. 设置备份策略
5. 配置监控和告警

详见 [QUICK_START.md](./backend/QUICK_START.md)
