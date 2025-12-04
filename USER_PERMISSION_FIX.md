# 用户权限修复

## 问题描述

新建用户查看回收站时出现"权限不足"错误。

### 根本原因

用户创建时只设置了 `menuPermissions` 字段（用于前端菜单显示），但没有设置 `permissions` 字段（用于后端权限检查）。

## 问题分析

### 1. 权限检查流程

回收站路由使用 `canAccessResource('recycle', 'view')` 中间件：

```javascript
router.get('/', authenticate, canAccessResource('recycle', 'view'), async (req, res, next) => {
    // ...
})
```

### 2. 权限中间件逻辑

`canAccessResource` 中间件检查用户是否有以下权限之一：
- `recycle:manage:all` - 管理所有回收站
- `recycle:view:own` - 查看自己的回收站

```javascript
const userPermissions = user.permissions || [];

// 检查管理所有资源的权限
if (userPermissions.includes('recycle:manage:all')) {
    return next();
}

// 检查操作自己资源的权限
if (userPermissions.includes('recycle:view:own')) {
    return next();
}

// 权限不足
return sendError(res, 'PERMISSION_DENIED');
```

### 3. 问题所在

旧的用户创建代码：
```javascript
const newUser = await this.insert({
    username: userData.username,
    password: hashedPassword,
    role: userData.role || 'user',
    menuPermissions: ['viewFolders'],  // ❌ 只设置了菜单权限
    // permissions: ???                 // ❌ 缺少权限字段
});
```

## 修复方案

### 1. 修复用户创建逻辑

**文件**: `backend/src/models/UserModel.js`

```javascript
async create(userData) {
    // ...
    
    // 根据角色分配权限
    const { ROLE_PRESETS } = require('../config/permissions');
    const role = userData.role || 'user';
    const permissions = userData.permissions || ROLE_PRESETS[role] || ROLE_PRESETS.user;

    const newUser = await this.insert({
        username: userData.username,
        password: hashedPassword,
        role: role,
        permissions: permissions,  // ✅ 自动分配权限
        menuPermissions: role === 'admin' 
            ? ['manageUsers', 'viewFolders'] 
            : ['viewFolders'],
        storageQuota: userData.storageQuota || defaultStorageQuota,
        storageUsed: 0
    });

    return this._sanitizeUser(newUser);
}
```

### 2. 修复角色更新逻辑

```javascript
async updateRole(id, role) {
    const { ROLE_PRESETS } = require('../config/permissions');
    const permissions = ROLE_PRESETS[role] || ROLE_PRESETS.user;
    const menuPermissions = role === 'admin' 
        ? ['manageUsers', 'viewFolders'] 
        : ['viewFolders'];

    return await this.update(id, { role, permissions, menuPermissions });
}
```

### 3. 修复现有用户

运行修复脚本为现有用户分配权限：

```bash
node fix-user-permissions.js
```

脚本功能：
- 读取所有用户数据
- 检查每个用户是否有 `permissions` 字段
- 根据用户角色自动分配对应的权限
- 保存更新后的数据

## 权限预设

### 普通用户 (user)
```javascript
[
    'dashboard:view:own',
    'folder:view:own', 'folder:create:own', 'folder:update:own', 'folder:delete:own',
    'file:view:own', 'file:upload:own', 'file:download:own', 'file:delete:own',
    'share:create:own', 'share:view:own', 'share:delete:own',
    'recycle:view:own', 'recycle:restore:own', 'recycle:delete:own',  // ✅ 包含回收站权限
    'user:update:own', 'user:password:own'
]
```

### 管理员 (admin)
```javascript
[
    // 所有权限，包括:
    'recycle:manage:all',  // 管理所有回收站
    // ...
]
```

## 测试步骤

### 1. 修复现有用户
```bash
node fix-user-permissions.js
```

### 2. 重启后端服务器
```bash
cd backend
npm start
```

### 3. 测试回收站访问

1. 使用普通用户登录
2. 访问回收站页面
3. 应该能正常查看自己的回收站文件

### 4. 创建新用户测试

1. 以管理员身份创建新用户
2. 使用新用户登录
3. 访问回收站页面
4. 应该能正常访问

## 验证权限

### 检查用户权限

查看 `backend/data/users.json`，确认用户有 `permissions` 字段：

```json
{
  "id": 2,
  "username": "testuser",
  "role": "user",
  "permissions": [
    "dashboard:view:own",
    "folder:view:own",
    "folder:create:own",
    "folder:update:own",
    "folder:delete:own",
    "file:view:own",
    "file:upload:own",
    "file:download:own",
    "file:delete:own",
    "share:create:own",
    "share:view:own",
    "share:delete:own",
    "recycle:view:own",
    "recycle:restore:own",
    "recycle:delete:own",
    "user:update:own",
    "user:password:own"
  ],
  "menuPermissions": ["viewFolders"]
}
```

## 相关文件

- `backend/src/models/UserModel.js` - 用户模型（创建和更新逻辑）
- `backend/src/middleware/permission.js` - 权限检查中间件
- `backend/src/config/permissions.js` - 权限定义和角色预设
- `backend/src/routes/recycleBinRoutes.js` - 回收站路由
- `fix-user-permissions.js` - 权限修复脚本

## 注意事项

1. **备份数据**：运行修复脚本前建议备份 `backend/data/users.json`
2. **重启服务器**：修复后需要重启后端服务器
3. **新用户**：修复后创建的新用户会自动分配正确的权限
4. **角色变更**：更改用户角色时会自动更新权限
