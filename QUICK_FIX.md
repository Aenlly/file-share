# 快速修复指南

## 问题：浏览器白屏 + 401 Unauthorized

### 症状
- 浏览器显示白屏
- 控制台错误：`TypeError: Cannot read properties of undefined (reading 'substring')`
- 登录请求返回401错误

### 快速修复（3步）

#### 1️⃣ 更新前端环境变量
编辑 `frontend/.env.development`，添加API基础URL：

```env
VITE_BASE_URL=http://localhost:3001
VITE_API_BASE=http://localhost:3000/api
```

#### 2️⃣ 重启前端服务
```bash
cd frontend
npm run dev
```

#### 3️⃣ 清除浏览器缓存
- 按 F12 打开开发者工具
- 清除缓存和Cookies
- 刷新页面（Ctrl+R 或 Cmd+R）

### 验证修复
✅ 页面正常加载  
✅ 登录成功  
✅ 文件列表显示  
✅ 图片预览功能正常  

---

## 技术细节

### 修复的代码变更

**文件：`frontend/src/pages/FolderDetail.jsx`**

```javascript
// 修复前：会在filename为undefined时崩溃
const isImageFile = (filename) => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return imageExtensions.includes(ext);
};

// 修复后：添加null/undefined检查
const isImageFile = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return false;
  }
  const ext = filename.substring(lastDotIndex).toLowerCase();
  return imageExtensions.includes(ext);
};
```

**文件：`frontend/.env.development`**

```env
# 添加API基础URL配置
VITE_API_BASE=http://localhost:3000/api
```

---

## 常见问题

### Q: 修复后仍然显示白屏？
A: 
1. 确保后端服务运行在3000端口：`cd backend && npm start`
2. 检查浏览器控制台是否有其他错误
3. 尝试硬刷新：Ctrl+Shift+R（Windows）或 Cmd+Shift+R（Mac）

### Q: 登录仍然返回401？
A:
1. 确认`VITE_API_BASE`配置正确
2. 检查后端是否正常运行
3. 查看后端日志：`backend/logs/error.log`

### Q: 文件列表显示但没有预览按钮？
A:
这是正常的，只有图片文件才会显示预览按钮。检查文件扩展名是否为：
- .jpg, .jpeg, .png, .gif, .webp, .bmp

---

## 完整启动流程

```bash
# 终端1：启动后端
cd backend
npm start

# 终端2：启动前端
cd frontend
npm run dev

# 浏览器访问
http://localhost:8001

# 登录
用户名：admin
密码：admin123
```

---

**修复状态：** ✅ 完成  
**最后更新：** 2024-01-01
