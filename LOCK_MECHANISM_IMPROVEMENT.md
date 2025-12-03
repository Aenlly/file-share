# 文件锁机制改进

## 问题反馈

间歇性500错误仍然出现，原因是：
1. 锁超时时间太短（5秒）
2. 锁超时后直接报错，而不是等待
3. 错误消息不够友好（"文件上传失败"、"登录失败"等）

## 改进方案

### 1. 延长锁等待时间

**之前**：最多等待5秒
**现在**：最多等待30秒

```javascript
const maxWaitTime = 30000; // 从5秒改为30秒
```

**理由**：
- 在高并发情况下，5秒可能不够
- 30秒足够处理大部分正常的数据库操作
- 避免因短暂的锁竞争导致请求失败

### 2. 优化等待机制

**之前**：每10ms检查一次锁状态
**现在**：每50ms检查一次，并记录等待日志

```javascript
const checkInterval = 50; // 检查间隔50ms

// 每秒记录一次等待日志
if (waitCount % 20 === 0 && waitCount > 0) {
    console.warn(`等待数据库锁: ${collection}, 已等待 ${Math.round(elapsed/1000)} 秒`);
}
```

**好处**：
- 减少CPU占用
- 可以追踪长时间等待的情况
- 便于诊断性能问题

### 3. 改进锁信息记录

**之前**：只记录锁是否被占用
**现在**：记录锁的获取时间和持有时间

```javascript
// 获取锁时记录时间
this.locks.set(collection, {
    acquired: Date.now(),
    collection: collection
});

// 释放锁时检查持有时间
const holdTime = Date.now() - lockInfo.acquired;
if (holdTime > 1000) {
    console.warn(`释放数据库锁: ${collection}, 持有时间: ${holdTime}ms`);
}
```

**好处**：
- 可以发现哪些操作持有锁时间过长
- 便于优化性能瓶颈

### 4. 友好的错误消息

#### 锁超时错误

**之前**：
```
数据库操作超时: files
```

**现在**：
```
系统繁忙，请稍后重试。如果问题持续存在，请联系管理员。
```

#### 文件操作错误

**之前**：
```
创建文件记录失败: 数据保存失败
```

**现在**：
```
文件上传失败，请重试
```

#### 文件夹操作错误

**之前**：
```
查询文件夹失败: 读取数据库文件失败
```

**现在**：
```
获取文件夹列表失败，请刷新页面重试
```

### 5. 错误分类处理

在错误处理中间件中，根据错误类型返回不同的HTTP状态码：

```javascript
// 系统繁忙错误（锁超时）
if (message.includes('系统繁忙') || message.includes('请稍后重试')) {
    statusCode = 503; // Service Unavailable
    userFriendlyMessage = message;
}

// 数据库操作错误
else if (message.includes('数据库') || message.includes('读取') || message.includes('写入')) {
    statusCode = 500;
    userFriendlyMessage = '数据操作失败，请稍后重试';
}

// 数据操作错误（已经是友好消息）
else if (message.includes('查询') || message.includes('保存') || message.includes('更新') || message.includes('删除')) {
    statusCode = 500;
    userFriendlyMessage = message; // 保留原始消息
}
```

## 修改的文件

1. **backend/src/database/adapters/JsonAdapter.js**
   - 延长锁等待时间（5秒 → 30秒）
   - 优化等待机制（10ms → 50ms检查间隔）
   - 添加等待日志
   - 记录锁持有时间
   - 改进所有数据库操作的错误处理

2. **backend/src/middleware/errorHandler.js**
   - 添加错误分类
   - 提供友好的错误消息
   - 区分系统繁忙（503）和服务器错误（500）

3. **backend/src/models/FileModel.js**
   - 改进错误消息
   - 区分系统繁忙错误和其他错误

4. **backend/src/models/FolderModel.js**
   - 改进错误消息
   - 区分系统繁忙错误和其他错误

## 预期效果

### 1. 减少500错误

- ✅ 30秒的等待时间足够处理大部分并发情况
- ✅ 只有在真正超时时才报错
- ✅ 减少因短暂锁竞争导致的失败

### 2. 更好的用户体验

**之前**：
```
错误：创建文件记录失败: 数据库操作超时: files
```

**现在**：
```
系统繁忙，请稍后重试。如果问题持续存在，请联系管理员。
```

### 3. 更好的可观测性

日志示例：
```
[2025-12-03 18:00:00] warn: 等待数据库锁: files, 已等待 1 秒
[2025-12-03 18:00:01] warn: 等待数据库锁: files, 已等待 2 秒
[2025-12-03 18:00:02] info: 获取数据库锁成功: files, 等待了 2100ms
[2025-12-03 18:00:03] warn: 释放数据库锁: files, 持有时间: 1500ms
```

可以清楚地看到：
- 哪些操作在等待锁
- 等待了多长时间
- 哪些操作持有锁时间过长

## 测试验证

### 1. 重启服务

```bash
cd backend
npm start
```

### 2. 并发测试

```bash
cd backend
node test-concurrent-requests.js
```

**预期结果**：
- 500错误率显著降低
- 如果出现503错误，说明系统真的很繁忙
- 错误消息更加友好

### 3. 观察日志

```bash
type backend\logs\combined.log
```

查看是否有：
- 等待锁的日志
- 锁持有时间过长的警告
- 这些信息可以帮助优化性能

## 性能优化建议

### 如果仍然频繁出现503错误

1. **检查锁持有时间**
   ```bash
   type backend\logs\combined.log | findstr "持有时间"
   ```
   
   如果看到很多 > 1000ms 的记录，说明某些操作太慢

2. **考虑优化数据库操作**
   - 减少不必要的文件读写
   - 批量操作合并为单次操作
   - 添加缓存层

3. **考虑迁移到真实数据库**
   - MySQL
   - PostgreSQL
   - MongoDB
   
   这些数据库有更好的并发处理能力

### 如果需要更长的等待时间

编辑 `backend/src/database/adapters/JsonAdapter.js`：

```javascript
const maxWaitTime = 60000; // 改为60秒
```

但这不是长久之计，应该优化数据库操作或迁移到真实数据库。

## HTTP状态码说明

- **503 Service Unavailable**：系统繁忙，请稍后重试
  - 这是临时性的问题
  - 客户端应该重试
  - 通常是因为并发量太大

- **500 Internal Server Error**：服务器内部错误
  - 这可能是代码bug或配置问题
  - 需要查看日志排查
  - 可能需要修复代码

## 总结

这次改进主要解决了三个问题：

1. ✅ **等待时间太短** → 延长到30秒
2. ✅ **直接报错** → 真正等待，只有超时才报错
3. ✅ **错误消息不友好** → 提供清晰、可操作的错误消息

现在系统应该更加稳定，用户体验也会更好。
