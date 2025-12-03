# 修改密码接口修复总结

## 问题
前端调用 `PUT /users/:id/password` 但后端只有 `POST /users/:id/change-password`

## 解决方案
修改前端使用已有的后端接口，避免重复代码

## 修改内容

### 前端修改
**UserManagement.jsx**:
```javascript
// 修改前
api.put(`/users/${id}/password`, { password })

// 修改后
api.post(`/users/${id}/change-password`, { newPassword: password })
```

**Profile.jsx**:
```javascript
// 修改前
api.put(`/users/${user.id}/password`, { password })

// 修改后
api.post(`/users/${user.id}/change-password`, { newPassword: password })
```

### 后端优化
**userRoutes.js** - 优化已有接口:
```javascript
// 使 oldPassword 可选，管理员无需提供
if (req.user.role !== 'admin' && oldPassword) {
    // 验证旧密码
}
```

## 接口说明

### POST /users/:id/change-password
**请求**:
```json
{
  "newPassword": "新密码",
  "oldPassword": "旧密码（可选）"
}
```

**权限**:
- 用户只能修改自己的密码
- 管理员可以修改任何用户的密码
- 管理员无需提供旧密码
- 普通用户可选提供旧密码验证

## 需要重启
- ✅ 后端需要重启
- ✅ 前端需要重新编译

## 状态
✅ 已完成修复
✅ 使用已有接口，避免重复代码
✅ 前端已改为POST方法
✅ 参数名已改为newPassword
