# 细粒度权限系统

## 概述

本系统实现了基于权限点的 RBAC（基于角色的访问控制）系统，支持细粒度的权限管理。每个功能都可以单独授权，不再简单地按照管理员和普通用户区分。

## 权限设计原则

### 1. 权限命名规范
权限点采用 `资源:操作:范围` 的命名格式：
- `dashboard:view:own` - 查看自己的仪表盘
- `dashboard:view:all` - 查看所有用户的仪表盘
- `folder:create:own` - 创建自己的文件夹
- `folder:manage:all` - 管理所有文件夹

### 2. 权限分类

#### 仪表盘权限
- `dashboard:view:own` - 查看个人统计
- `dashboard:view:all` - 查看全部用户统计
- `dashboard:view:user` - 查看指定用户统计

#### 文件夹权限
- `folder:view:own` - 查看个人文件夹
- `folder:create:own` - 创建文件夹
- `folder:update:own` - 修改文件夹
- `folder:delete:own` - 删除文件夹
- `folder:manage:all` - 管理所有文件夹

#### 文件权限
- `file:view:own` - 查看个人文件
- `file:upload:own` - 上传文件
- `file:download:own` - 下载文件
- `file:delete:own` - 删除文件
- `file:manage:all` - 管理所有文件

#### 分享权限
- `share:create:own` - 创建分享链接
- `share:view:own` - 查看分享链接
- `share:delete:own` - 删除分享链接
- `share:manage:all` - 管理所有分享

#### 回收站权限
- `recycle:view:own` - 查看回收站
- `recycle:restore:own` - 恢复文件
- `recycle:delete:own` - 永久删除
- `recycle:manage:all` - 管理所有回收站

#### 用户管理权限
- `user:view:list` - 查看用户列表
- `user:create` - 创建用户
- `user:update:own` - 修改个人信息
- `user:update:any` - 修改任意用户
- `user:delete` - 删除用户
- `user:password:own` - 修改个人密码
- `user:password:any` - 修改任意用户密码

#### 权限管理
- `permission:view` - 查看权限配置
- `permission:manage` - 管理用户权限

## 角色预设

系统提供了几个预设角色，方便快速分配权限：

### 1. admin（超级管理员）
拥有所有权限，可以管理整个系统。

### 2. user（普通用户）
只能管理自己的资源：
- 查看和管理自己的文件夹、文件
- 创建和管理自己的分享链接
- 使用回收站
- 修改自己的密码

### 3. manager（部门管理员）
除了普通用户权限外，还可以：
- 查看所有用户的统计信息
- 查看用户列表

### 4. readonly（只读用户）
只能查看和下载，不能修改：
- 查看个人统计
- 查看文件夹和文件
- 下载文件

## 使用方法

### 后端

#### 1. 在路由中使用权限检查

```javascript
const { requirePermission } = require('../middleware/permission');
const { PERMISSIONS } = require('../config/permissions');

// 需要单个权限
router.get('/stats', 
    authenticate, 
    requirePermission(PERMISSIONS.DASHBOARD_VIEW_OWN), 
    async (req, res) => {
        // ...
    }
);

// 需要多个权限之一
router.get('/data', 
    authenticate, 
    requirePermission([
        PERMISSIONS.FILE_VIEW_OWN,
        PERMISSIONS.FILE_MANAGE_ALL
    ], 'any'), 
    async (req, res) => {
        // ...
    }
);

// 需要所有权限
router.post('/admin-action', 
    authenticate, 
    requirePermission([
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.PERMISSION_MANAGE
    ], 'all'), 
    async (req, res) => {
        // ...
    }
);
```

#### 2. 检查资源访问权限

```javascript
const { canAccessResource } = require('../middleware/permission');

router.delete('/file/:id', 
    authenticate, 
    canAccessResource('file', 'delete'),
    async (req, res) => {
        // req.canManageAll 表示是否可以管理所有资源
        if (!req.canManageAll) {
            // 只能删除自己的文件，需要额外检查所有权
        }
    }
);
```

### 前端

#### 1. 使用权限上下文

```jsx
import { usePermissions } from '../contexts/PermissionContext';
import { PERMISSIONS } from '../constants/permissions';

function MyComponent() {
    const { hasPermission, hasAnyPermission } = usePermissions();

    return (
        <div>
            {hasPermission(PERMISSIONS.USER_CREATE) && (
                <Button>创建用户</Button>
            )}
            
            {hasAnyPermission([
                PERMISSIONS.DASHBOARD_VIEW_ALL,
                PERMISSIONS.DASHBOARD_VIEW_USER
            ]) && (
                <AdminDashboard />
            )}
        </div>
    );
}
```

#### 2. 菜单权限控制

```jsx
import { MENU_PERMISSIONS } from '../constants/permissions';

const menuItems = [
    {
        path: '/dashboard',
        label: '仪表盘',
        permissions: MENU_PERMISSIONS.dashboard
    },
    {
        path: '/users',
        label: '用户管理',
        permissions: MENU_PERMISSIONS.users
    }
];

// 过滤有权限的菜单
const visibleMenus = menuItems.filter(item => 
    hasAnyPermission(item.permissions)
);
```

## API 接口

### 权限管理接口

#### 获取权限定义
```
GET /api/permissions/definitions
```

#### 获取用户权限
```
GET /api/permissions/user/:userId
```

#### 更新用户权限
```
PUT /api/permissions/user/:userId
Body: { permissions: [...] }
```

#### 应用角色预设
```
POST /api/permissions/user/:userId/apply-role
Body: { role: 'admin' | 'user' | 'manager' | 'readonly' }
```

#### 检查权限
```
POST /api/permissions/check
Body: { permission: 'dashboard:view:own' }
或
Body: { permissions: ['dashboard:view:own', 'user:create'] }
```

### 统计接口

#### 获取个人统计
```
GET /api/users/stats
需要权限: dashboard:view:own
```

#### 获取指定用户统计
```
GET /api/users/stats/:username
需要权限: dashboard:view:user
```

#### 获取所有用户统计
```
GET /api/users/stats-all
需要权限: dashboard:view:all
返回: {
    users: [...],
    totals: { totalUsers, totalFiles, totalSize, ... }
}
```

## 迁移现有系统

### 1. 运行权限迁移脚本

```bash
node backend/scripts/migrate-permissions.js
```

这个脚本会：
- 为所有现有用户根据其角色设置默认权限
- 跳过已有权限配置的用户

### 2. 前端集成

在 App.jsx 中添加 PermissionProvider：

```jsx
import { PermissionProvider } from './contexts/PermissionContext';

function App() {
    return (
        <PermissionProvider>
            {/* 其他组件 */}
        </PermissionProvider>
    );
}
```

### 3. 添加权限管理页面

在路由中添加：

```jsx
import PermissionManagement from './pages/PermissionManagement';

<Route path="/permissions" element={<PermissionManagement />} />
```

## 最佳实践

### 1. 最小权限原则
只授予用户完成工作所需的最小权限集。

### 2. 使用角色预设
对于常见的用户类型，使用角色预设快速分配权限。

### 3. 定期审计
定期检查用户权限，移除不再需要的权限。

### 4. 权限分组
将相关权限分组管理，便于理解和维护。

### 5. 文档化
为每个权限点编写清晰的说明文档。

## 扩展权限

如果需要添加新的权限点：

### 1. 后端添加权限定义

在 `backend/src/config/permissions.js` 中：

```javascript
const PERMISSIONS = {
    // ... 现有权限
    NEW_FEATURE_VIEW: 'feature:view:own',
    NEW_FEATURE_MANAGE: 'feature:manage:all',
};

const PERMISSION_GROUPS = {
    // ... 现有分组
    newFeature: {
        label: '新功能',
        permissions: [
            { key: PERMISSIONS.NEW_FEATURE_VIEW, label: '查看新功能' },
            { key: PERMISSIONS.NEW_FEATURE_MANAGE, label: '管理新功能' },
        ]
    }
};
```

### 2. 前端同步权限常量

在 `frontend/src/constants/permissions.js` 中添加相同的权限定义。

### 3. 在路由中使用

```javascript
router.get('/new-feature', 
    authenticate, 
    requirePermission(PERMISSIONS.NEW_FEATURE_VIEW),
    async (req, res) => {
        // ...
    }
);
```

## 注意事项

1. **权限缓存**：前端权限会在登录时加载并缓存，修改权限后需要刷新页面
2. **后端验证**：前端权限检查只是 UI 控制，后端必须进行权限验证
3. **权限继承**：`manage:all` 权限通常包含对应的 `own` 权限
4. **默认拒绝**：没有明确授予的权限默认拒绝访问

## 故障排查

### 用户无法访问某个功能
1. 检查用户是否有对应的权限
2. 检查路由是否正确配置了权限中间件
3. 查看后端日志中的权限检查记录

### 权限更新不生效
1. 前端需要刷新页面重新加载权限
2. 检查后端数据库中的权限是否正确更新
3. 清除浏览器缓存和 localStorage

### 迁移脚本失败
1. 检查数据库连接是否正常
2. 确认用户表结构支持 permissions 字段
3. 查看错误日志获取详细信息
