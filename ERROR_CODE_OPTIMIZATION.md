# 错误码优化 - 业务错误与HTTP错误分离

## 问题
原始实现使用HTTP错误码（404、403等）来表示业务逻辑错误，导致：
1. 客户端误认为是URL不存在（404）
2. 无法区分真正的HTTP错误和业务错误
3. 错误信息不够清晰

## 解决方案
所有业务逻辑错误统一返回 **HTTP 200** 状态码，在响应体中使用自定义错误码（code字段）来区分具体的业务错误。

## 响应格式

### 成功响应
```json
{
    "success": true,
    "message": "操作成功",
    "data": { ... }
}
```

### 失败响应
```json
{
    "success": false,
    "code": "ERROR_CODE",
    "error": "错误描述信息"
}
```

## 自定义错误码

### 文件移动操作
| 错误码 | 说明 | HTTP状态码 |
|--------|------|----------|
| `MISSING_PARAMS` | 缺少必要参数 | 200 |
| `SOURCE_FOLDER_NOT_FOUND` | 源文件夹不存在 | 200 |
| `SOURCE_FOLDER_FORBIDDEN` | 无权访问源文件夹 | 200 |
| `TARGET_FOLDER_NOT_FOUND` | 目标文件夹不存在 | 200 |
| `TARGET_FOLDER_FORBIDDEN` | 无权访问目标文件夹 | 200 |
| `FILE_NOT_FOUND` | 文件不存在 | 200 |
| `FILE_PHYSICAL_NOT_FOUND` | 文件物理路径不存在 | 200 |

### 文件删除操作
| 错误码 | 说明 | HTTP状态码 |
|--------|------|----------|
| `FOLDER_NOT_FOUND` | 文件夹不存在 | 200 |
| `FOLDER_FORBIDDEN` | 无权访问文件夹 | 200 |

### 文件下载操作
| 错误码 | 说明 | HTTP状态码 |
|--------|------|----------|
| `FOLDER_NOT_FOUND` | 文件夹不存在 | 200 |
| `FOLDER_FORBIDDEN` | 无权访问文件夹 | 200 |
| `FILE_NOT_FOUND` | 文件不存在 | 200 |
| `FILE_PHYSICAL_NOT_FOUND` | 文件物理路径不存在 | 200 |

## 修改的文件

### `backend/src/routes/folderRoutes.js`

#### 文件移动操作
```javascript
// 修改前
return res.status(404).json({ error: '目标文件夹不存在' });

// 修改后
return res.status(200).json({ 
    success: false, 
    code: 'TARGET_FOLDER_NOT_FOUND',
    error: '目标文件夹不存在' 
});
```

#### 文件删除操作
```javascript
// 修改前
return res.status(404).json({ error: '文件夹不存在' });

// 修改后
return res.status(200).json({ 
    success: false, 
    code: 'FOLDER_NOT_FOUND',
    error: '文件夹不存在' 
});
```

#### 文件下载操作
```javascript
// 修改前
return res.status(404).json({ error: '文件不存在' });

// 修改后
return res.status(200).json({ 
    success: false, 
    code: 'FILE_NOT_FOUND',
    error: '文件不存在' 
});
```

## 前端处理

### 原始处理方式
```javascript
// ❌ 错误的方式
if (error.response?.status === 404) {
    // 无法区分是URL不存在还是业务错误
}
```

### 改进后的处理方式
```javascript
// ✅ 正确的方式
if (error.response?.data?.success === false) {
    const code = error.response.data.code;
    const message = error.response.data.error;
    
    switch(code) {
        case 'TARGET_FOLDER_NOT_FOUND':
            // 处理目标文件夹不存在
            break;
        case 'TARGET_FOLDER_FORBIDDEN':
            // 处理无权访问目标文件夹
            break;
        // ... 其他错误码
    }
}
```

## 优势

1. **清晰的错误区分**
   - HTTP 200 = 请求成功处理
   - 自定义 code = 具体的业务错误

2. **避免误导**
   - 不会误认为是URL不存在
   - 不会误认为是权限问题（403）

3. **更好的可维护性**
   - 错误码集中管理
   - 易于扩展新的错误类型

4. **更好的用户体验**
   - 前端可以显示更准确的错误提示
   - 可以根据错误码采取不同的处理策略

## 完成状态

✅ **文件移动操作** - 所有错误码已优化
✅ **文件删除操作** - 所有错误码已优化
✅ **文件下载操作** - 所有错误码已优化

## 相关文档

- `MOVE_FILE_COMPLETE.md` - 文件移动功能完整修复
- `FILE_NAMING_CONVENTION.md` - 文件命名约定
