# 如何测试500错误修复

## 快速测试步骤

### 1. 重启后端服务

```bash
# 停止当前运行的后端服务（如果有）
# 然后启动

cd backend
npm start
```

### 2. 观察启动日志

确认看到以下信息：
```
✅ 服务器运行在端口 8001
📊 数据库类型: json
🔐 环境: development
🗑️  回收站自动清理任务已启动
```

### 3. 运行并发测试（可选）

在新的终端窗口中运行测试脚本：

```bash
cd backend
node test-concurrent-requests.js
```

测试脚本会：
- 执行200次并发请求
- 测试获取文件夹列表、文件夹详情、文件列表
- 统计成功率和500错误率

**预期结果**：500错误率应该为 0%

### 4. 手动测试

在浏览器中正常使用应用：
1. 登录系统
2. 浏览文件夹
3. 上传文件
4. 删除文件
5. 移动文件
6. 快速切换不同文件夹

**预期结果**：不应该再出现间歇性的500错误

### 5. 检查日志

查看日志文件确认错误被正确记录：

```bash
# 查看错误日志
type backend\logs\error.log

# 查看完整日志
type backend\logs\combined.log
```

**预期结果**：
- 所有请求都有日志记录
- 如果有错误，会有详细的堆栈信息
- 可以看到每个操作的开始和结束日志

## 修复内容总结

### 核心修复

1. **JsonAdapter 文件锁超时**：防止无限等待
2. **文件读取重试机制**：自动重试失败的读取操作
3. **全局异常捕获**：记录所有未捕获的异常
4. **增强错误处理**：所有数据库操作都有完整的错误处理
5. **详细日志记录**：每个关键操作都有日志

### 修复的问题

- ✅ 间歇性500错误
- ✅ 日志中没有错误记录
- ✅ 文件锁竞争导致的超时
- ✅ 数据库读写失败未被捕获
- ✅ 错误信息不明确

## 如果问题仍然存在

### 1. 检查日志

现在所有错误都会被记录，查看 `backend/logs/error.log`：

```bash
type backend\logs\error.log
```

### 2. 增加日志级别

编辑 `.env` 文件：

```env
LOG_LEVEL=debug
```

然后重启服务。

### 3. 检查数据库文件

确认数据库文件没有损坏：

```bash
dir backend\data
```

应该看到：
- folders.json
- files.json
- users.json
- shares.json
- recycle_bin.json

### 4. 清理临时文件

删除所有 `.tmp` 文件：

```bash
del /s backend\data\*.tmp
```

### 5. 考虑迁移到真实数据库

如果并发量很大，JSON文件数据库可能不够用，建议迁移到：
- MySQL
- PostgreSQL
- MongoDB

配置方法参考 `backend/.env.example`

## 性能优化建议

如果系统负载较高，可以考虑：

1. **增加文件锁超时时间**（默认5秒）
   编辑 `backend/src/database/adapters/JsonAdapter.js`：
   ```javascript
   const maxWaitTime = 10000; // 改为10秒
   ```

2. **增加读取重试次数**（默认3次）
   编辑 `backend/src/database/adapters/JsonAdapter.js`：
   ```javascript
   let retries = 5; // 改为5次
   ```

3. **调整重试延迟**（默认100ms）
   编辑 `backend/src/database/adapters/JsonAdapter.js`：
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 200)); // 改为200ms
   ```

## 联系支持

如果问题持续存在，请提供：
1. `backend/logs/error.log` 的内容
2. 出现错误时的操作步骤
3. 浏览器控制台的错误信息
4. 并发测试的结果
