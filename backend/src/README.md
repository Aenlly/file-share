# 后端模块化结构

这是文件分享系统后端的模块化重构版本，将原本的单文件server.js拆分为多个模块，提高代码的可维护性和可扩展性。

## 目录结构

```
src/
├── controllers/          # 控制器层
│   ├── userController.js    # 用户相关操作
│   ├── folderController.js  # 文件夹相关操作
│   ├── fileController.js    # 文件相关操作
│   └── shareController.js   # 分享相关操作
├── middleware/           # 中间件
│   └── auth.js         # 认证中间件
├── models/              # 数据模型
│   ├── User.js         # 用户模型
│   ├── Folder.js       # 文件夹模型
│   └── Share.js       # 分享模型
├── routes/             # 路由定义
│   ├── userRoutes.js    # 用户路由
│   ├── folderRoutes.js  # 文件夹路由
│   └── shareRoutes.js  # 分享路由
├── utils/              # 工具函数
│   └── fileHelpers.js  # 文件操作工具
├── app.js             # 应用入口文件
└── README.md          # 本文件
```

## 模块说明

### 控制器 (Controllers)
控制器负责处理HTTP请求和响应，调用相应的模型方法，并返回结果。

- **userController.js**: 处理用户登录、注册、更新、删除等操作
- **folderController.js**: 处理文件夹的创建、删除等操作
- **fileController.js**: 处理文件的上传、下载、删除等操作
- **shareController.js**: 处理分享链接的创建、验证、更新等操作

### 中间件 (Middleware)
中间件提供请求处理过程中的通用功能。

- **auth.js**: 提供JWT认证和权限检查功能

### 模型 (Models)
模型负责数据访问和业务逻辑，封装了对JSON文件的操作。

- **User.js**: 用户数据模型，提供用户CRUD操作
- **Folder.js**: 文件夹数据模型，提供文件夹CRUD操作
- **Share.js**: 分享数据模型，提供分享链接CRUD操作

### 路由 (Routes)
路由定义API端点，并将请求映射到相应的控制器方法。

- **userRoutes.js**: 用户相关API路由
- **folderRoutes.js**: 文件夹相关API路由
- **shareRoutes.js**: 分享相关API路由

### 工具 (Utils)
工具函数提供通用的辅助功能。

- **fileHelpers.js**: 文件操作相关的工具函数，包括JSON读写、文件哈希计算、文件类型检查等

## 使用方法

1. 使用模块化版本启动：
   ```bash
   npm run start:modular
   ```

2. 使用原始版本启动：
   ```bash
   npm start
   ```

## 优势

1. **代码组织**: 按功能模块划分，代码结构更清晰
2. **可维护性**: 每个模块职责单一，易于维护和调试
3. **可扩展性**: 新增功能时只需添加相应的控制器、模型和路由
4. **代码复用**: 通用功能提取为工具函数，减少重复代码
5. **团队协作**: 不同开发者可以并行开发不同模块

## 注意事项

1. 确保所有依赖模块都已正确安装
2. 模块间的依赖关系要清晰，避免循环依赖
3. 保持一致的错误处理方式
4. 定期重构和优化代码结构