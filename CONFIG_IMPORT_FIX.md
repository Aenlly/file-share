# Config导入错误修复

## 错误信息
```
Cannot read properties of undefined (reading 'database')
```

## 问题原因
config对象导入失败，返回undefined

## 已尝试的修复
1. ✅ 修改导入路径：`require('./config')` → `require('./config/index')`
2. ✅ 添加调试信息

## 排查步骤

### 1. 检查.env文件
确保backend目录下有`.env`文件：
```bash
cd backend
ls -la .env
```

### 2. 检查dotenv包
```bash
cd backend
npm list dotenv
```

如果未安装：
```bash
npm install dotenv
```

### 3. 清除Node.js缓存
```bash
# 删除node_modules
rm -rf node_modules

# 重新安装
npm install

# 或者只清除缓存
npm cache clean --force
```

### 4. 重启服务
```bash
# 停止当前服务
# Ctrl+C

# 重新启动
npm run dev
```

## 临时解决方案

如果问题持续，可以直接在app.js中定义config：

```javascript
// 临时方案：直接定义config
const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
        type: process.env.DB_TYPE || 'json',
        json: {
            dataDir: process.env.JSON_DATA_DIR || './data'
        }
    },
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
    jwtExpiresIn: '7d',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    // ... 其他配置
};
```

## 检查清单
- [ ] .env文件存在
- [ ] dotenv包已安装
- [ ] config/index.js文件存在
- [ ] module.exports正确
- [ ] 清除了缓存
- [ ] 重启了服务

## 调试输出
查看控制台输出：
```
=== Config Import Debug ===
Config: { port: 3000, nodeEnv: 'development', ... }
Config keys: ['port', 'nodeEnv', 'database', ...]
===========================
```

如果显示：
```
Config: undefined
Config keys: undefined
```

说明导入失败，需要检查文件路径和module.exports。
