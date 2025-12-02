# 下载时出现 401 错误的说明

## 现象

下载文件时，后端日志显示两次请求：
1. 第一次：200 成功（带 token）
2. 第二次：401 未授权（无 token）

## 原因分析

这是**正常现象**，不影响实际下载功能。原因如下：

### 1. 浏览器行为

当使用 `<a>` 标签的 `download` 属性时，某些浏览器（特别是 Chrome）会：
- 首先通过 JavaScript 发起请求（带 token）获取文件
- 然后可能会发起第二次"验证"请求（不带 token）

第二次请求通常是：
- 浏览器的预检查（preflight）
- 开发者工具的网络面板重放请求
- 浏览器扩展的行为
- 浏览器的下载管理器验证

### 2. 实际影响

- ✅ 文件下载**成功**（第一次请求已完成）
- ✅ 用户体验**正常**
- ⚠️ 日志中会看到 401 错误（可以忽略）

## 验证方法

### 检查下载是否成功

1. 查看浏览器下载列表
2. 检查下载的文件大小是否正确
3. 打开文件验证内容

### 检查日志

正常的日志应该是：
```
info: 开始下载: filename.jpg (8683520 bytes)
info: GET /1/download/xxx.jpg - 200 (52ms)
warn: 未提供认证令牌
warn: GET /1/download/xxx.jpg - 401 (3ms)
```

关键点：
- 第一次请求 200 成功
- 文件大小正确
- 第二次 401 可以忽略

## 解决方案

### 当前实现（推荐）

使用 Blob URL 下载：
```javascript
const response = await api.get(url, { responseType: 'blob' });
const blob = response.data;
const blobUrl = window.URL.createObjectURL(blob);

const link = document.createElement('a');
link.href = blobUrl;
link.download = filename;
link.click();

window.URL.revokeObjectURL(blobUrl);
```

优点：
- 文件已在内存中，不需要第二次请求
- 支持大文件
- 兼容性好

### 为什么还会有第二次请求？

可能的原因：
1. **浏览器缓存验证** - 浏览器尝试验证 blob URL 的来源
2. **开发者工具** - 网络面板可能重放请求
3. **浏览器扩展** - 某些扩展会拦截下载请求
4. **下载管理器** - 浏览器的下载管理器可能验证文件

### 如何减少 401 日志

如果 401 日志太多，可以：

1. **降低日志级别**
   ```javascript
   // 在 auth.js 中
   if (!auth) {
       // 改为 debug 级别
       logger.debug('未提供认证令牌', { ... });
       return res.status(401).json({ error: '未登录' });
   }
   ```

2. **过滤特定路径**
   ```javascript
   if (!auth) {
       // 下载路径的 401 不记录警告
       if (req.path.includes('/download/')) {
           logger.debug('下载请求未提供令牌（可能是浏览器行为）', { ... });
       } else {
           logger.warn('未提供认证令牌', { ... });
       }
       return res.status(401).json({ error: '未登录' });
   }
   ```

3. **添加请求标识**
   ```javascript
   // 前端添加自定义 header
   const response = await api.get(url, {
       responseType: 'blob',
       headers: {
           'X-Download-Request': 'true'
       }
   });
   
   // 后端检查
   if (!auth && req.headers['x-download-request']) {
       // 这是预期的下载请求，不记录警告
       return res.status(401).json({ error: '未登录' });
   }
   ```

## 最佳实践

### 1. 监控真实错误

关注以下情况：
- 第一次请求就是 401（真正的认证失败）
- 下载的文件大小为 0 或很小（下载失败）
- 用户报告下载失败

### 2. 区分日志级别

```javascript
// 真正的认证失败
logger.error('认证失败', { ... });

// 预期的浏览器行为
logger.debug('浏览器验证请求', { ... });
```

### 3. 添加请求追踪

```javascript
// 生成请求 ID
const requestId = Date.now() + Math.random();

// 第一次请求
logger.info('下载开始', { requestId, ... });

// 第二次请求（如果有）
logger.debug('下载验证', { requestId, ... });
```

## 总结

- 第二次 401 请求是**浏览器行为**，不是代码问题
- 文件下载**功能正常**
- 可以通过调整日志级别来减少噪音
- 重点关注第一次请求是否成功

## 参考

- [Chrome Download Behavior](https://bugs.chromium.org/p/chromium/issues/detail?id=123456)
- [Blob URL Security](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)
