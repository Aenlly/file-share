# MySQL 数据库切换指南

## 概述

本项目已经完整支持 MySQL 数据库，可以通过简单的配置切换从 JSON 文件存储切换到 MySQL。

## 支持的数据库

- ✅ **JSON** - 本地文件存储（默认，无需配置）
- ✅ **MongoDB** - NoSQL 数据库
- ✅ **MySQL** - 关系型数据库
- ✅ **PostgreSQL** - 关系型数据库

## MySQL 安装

### Windows

使用 Chocolatey：
```bash
choco install mysql
```

或从官网下载安装程序：https://dev.mysql.com/downloads/mysql/

### macOS

```bash
brew install mysql
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y mysql-server
```

## 启动 MySQL

### Windows
```bash
net start MySQL80
```

### macOS
```bash
brew services start mysql
```

### Linux
```bash
sudo systemctl start mysql
sudo systemctl enable mysql  # 开机自启
```

## 创建数据库

1. 登录 MySQL：
```bash
mysql -u root -p
```

2. 创建数据库：
```sql
CREATE DATABASE file_share CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. 创建用户（可选，推荐）：
```sql
CREATE USER 'fileshare'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON file_share.* TO 'fileshare'@'localhost';
FLUSH PRIVILEGES;
```

4. 退出：
```sql
EXIT;
```

## 创建数据表

项目需要以下数据表，执行以下 SQL 创建：

```sql
USE file_share;

-- 用户表
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 文件夹表
CREATE TABLE folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alias VARCHAR(255) NOT NULL,
    physicalPath VARCHAR(500) NOT NULL,
    owner VARCHAR(50) NOT NULL,
    parentId INT DEFAULT NULL,
    isDeleted BOOLEAN DEFAULT FALSE,
    deletedAt DATETIME DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_owner (owner),
    INDEX idx_parentId (parentId),
    INDEX idx_isDeleted (isDeleted),
    FOREIGN KEY (parentId) REFERENCES folders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 文件表
CREATE TABLE files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    savedName VARCHAR(255) NOT NULL,
    folderId INT NOT NULL,
    size BIGINT NOT NULL,
    mtime DATETIME NOT NULL,
    hash VARCHAR(64) DEFAULT NULL,
    isDeleted BOOLEAN DEFAULT FALSE,
    deletedAt DATETIME DEFAULT NULL,
    originalFolderId INT DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_folderId (folderId),
    INDEX idx_savedName (savedName),
    INDEX idx_hash (hash),
    INDEX idx_isDeleted (isDeleted),
    FOREIGN KEY (folderId) REFERENCES folders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分享表
CREATE TABLE shares (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    folderId INT NOT NULL,
    owner VARCHAR(50) NOT NULL,
    expireTime DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_folderId (folderId),
    INDEX idx_owner (owner),
    INDEX idx_expireTime (expireTime),
    FOREIGN KEY (folderId) REFERENCES folders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分享访问日志表
CREATE TABLE share_access_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shareId INT NOT NULL,
    accessTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    ipAddress VARCHAR(45) DEFAULT NULL,
    userAgent TEXT DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shareId (shareId),
    INDEX idx_accessTime (accessTime),
    FOREIGN KEY (shareId) REFERENCES shares(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 回收站表
CREATE TABLE recycle_bin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemType VARCHAR(20) NOT NULL,
    itemId INT NOT NULL,
    itemName VARCHAR(255) NOT NULL,
    owner VARCHAR(50) NOT NULL,
    deletedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    originalData JSON NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_owner (owner),
    INDEX idx_itemType (itemType),
    INDEX idx_deletedAt (deletedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 权限表
CREATE TABLE permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    permission VARCHAR(50) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_permission (userId, permission),
    INDEX idx_userId (userId),
    INDEX idx_permission (permission)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 配置环境变量

在项目根目录的 `.env` 文件中添加或修改以下配置：

```env
# 数据库类型
DB_TYPE=mysql

# MySQL 配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=fileshare
MYSQL_PASSWORD=your_secure_password
MYSQL_DATABASE=file_share
```

## 数据迁移（从 JSON 到 MySQL）

如果你已经在使用 JSON 存储，需要迁移数据到 MySQL：

### 1. 备份现有数据
```bash
# 备份 data 目录
cp -r data data_backup
```

### 2. 导出 JSON 数据并导入 MySQL

创建迁移脚本 `migrate-to-mysql.js`：

```javascript
const fs = require('fs-extra');
const mysql = require('mysql2/promise');

async function migrate() {
    // 连接 MySQL
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'fileshare',
        password: 'your_secure_password',
        database: 'file_share'
    });

    try {
        // 读取 JSON 数据
        const users = await fs.readJson('./data/users.json');
        const folders = await fs.readJson('./data/folders.json');
        const files = await fs.readJson('./data/files.json');
        const shares = await fs.readJson('./data/shares.json');

        // 插入用户
        for (const user of users) {
            await connection.query(
                'INSERT INTO users (id, username, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                [user.id, user.username, user.password, user.role, user.createdAt, user.updatedAt]
            );
        }

        // 插入文件夹
        for (const folder of folders) {
            await connection.query(
                'INSERT INTO folders (id, alias, physicalPath, owner, parentId, isDeleted, deletedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [folder.id, folder.alias, folder.physicalPath, folder.owner, folder.parentId, folder.isDeleted || false, folder.deletedAt, folder.createdAt, folder.updatedAt]
            );
        }

        // 插入文件
        for (const file of files) {
            await connection.query(
                'INSERT INTO files (id, name, savedName, folderId, size, mtime, hash, isDeleted, deletedAt, originalFolderId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [file.id, file.name, file.savedName, file.folderId, file.size, file.mtime, file.hash, file.isDeleted || false, file.deletedAt, file.originalFolderId, file.createdAt, file.updatedAt]
            );
        }

        // 插入分享
        for (const share of shares) {
            await connection.query(
                'INSERT INTO shares (id, code, folderId, owner, expireTime, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [share.id, share.code, share.folderId, share.owner, share.expireTime, share.createdAt, share.updatedAt]
            );
        }

        console.log('✅ 数据迁移完成！');
    } catch (error) {
        console.error('❌ 迁移失败:', error);
    } finally {
        await connection.end();
    }
}

migrate();
```

运行迁移：
```bash
node migrate-to-mysql.js
```

## 启动应用

1. 确保 MySQL 服务正在运行
2. 确保 `.env` 配置正确
3. 重启后端服务：

```bash
cd backend
npm start
```

## 验证

启动后，你应该看到类似的日志：
```
✅ MySQL已连接: localhost:3306
✅ 数据库管理器已初始化，使用mysql适配器
```

## 性能优势

使用 MySQL 相比 JSON 文件存储的优势：

1. **并发性能**：支持高并发读写，无文件锁问题
2. **查询性能**：索引支持，复杂查询更快
3. **数据完整性**：外键约束，事务支持
4. **扩展性**：支持主从复制、分库分表
5. **备份恢复**：成熟的备份工具和策略

## 注意事项

1. **字符集**：使用 `utf8mb4` 支持完整的 Unicode 字符（包括 emoji）
2. **连接池**：MySQL 适配器使用连接池，默认配置在 `backend/src/config/index.js`
3. **索引优化**：根据实际查询需求添加合适的索引
4. **定期备份**：建议设置定期备份策略

## 故障排查

### 连接失败

1. 检查 MySQL 服务是否运行
2. 检查用户名密码是否正确
3. 检查防火墙设置
4. 检查 MySQL 用户权限

### 表不存在

确保已经执行了创建表的 SQL 脚本

### 性能问题

1. 检查是否添加了必要的索引
2. 查看慢查询日志
3. 优化查询语句
4. 调整连接池大小

## 切换回 JSON

如果需要切换回 JSON 存储，只需修改 `.env`：

```env
DB_TYPE=json
```

然后重启服务即可。

## 相关文档

- [README.md](./README.md) - 项目总览
- [INSTALLATION.md](./INSTALLATION.md) - 完整安装指南
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 部署指南
