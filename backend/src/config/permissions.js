/**
 * 权限配置
 * 定义系统中所有可用的权限点
 */

// 权限点定义
const PERMISSIONS = {
    // 仪表盘权限
    DASHBOARD_VIEW_OWN: 'dashboard:view:own',           // 查看自己的统计
    DASHBOARD_VIEW_ALL: 'dashboard:view:all',           // 查看所有用户统计
    DASHBOARD_VIEW_USER: 'dashboard:view:user',         // 查看指定用户统计
    
    // 文件夹权限
    FOLDER_VIEW_OWN: 'folder:view:own',                 // 查看自己的文件夹
    FOLDER_CREATE_OWN: 'folder:create:own',             // 创建自己的文件夹
    FOLDER_UPDATE_OWN: 'folder:update:own',             // 修改自己的文件夹
    FOLDER_DELETE_OWN: 'folder:delete:own',             // 删除自己的文件夹
    FOLDER_MANAGE_ALL: 'folder:manage:all',             // 管理所有文件夹
    
    // 文件权限
    FILE_VIEW_OWN: 'file:view:own',                     // 查看自己的文件
    FILE_UPLOAD_OWN: 'file:upload:own',                 // 上传文件到自己的文件夹
    FILE_DOWNLOAD_OWN: 'file:download:own',             // 下载自己的文件
    FILE_DELETE_OWN: 'file:delete:own',                 // 删除自己的文件
    FILE_MANAGE_ALL: 'file:manage:all',                 // 管理所有文件
    
    // 分享权限
    SHARE_CREATE_OWN: 'share:create:own',               // 创建自己的分享链接
    SHARE_VIEW_OWN: 'share:view:own',                   // 查看自己的分享链接
    SHARE_DELETE_OWN: 'share:delete:own',               // 删除自己的分享链接
    SHARE_MANAGE_ALL: 'share:manage:all',               // 管理所有分享链接
    
    // 回收站权限
    RECYCLE_VIEW_OWN: 'recycle:view:own',               // 查看自己的回收站
    RECYCLE_RESTORE_OWN: 'recycle:restore:own',         // 恢复自己的文件
    RECYCLE_DELETE_OWN: 'recycle:delete:own',           // 永久删除自己的文件
    RECYCLE_MANAGE_ALL: 'recycle:manage:all',           // 管理所有回收站
    
    // 用户管理权限
    USER_VIEW_LIST: 'user:view:list',                   // 查看用户列表
    USER_CREATE: 'user:create',                         // 创建用户
    USER_UPDATE_OWN: 'user:update:own',                 // 修改自己的信息
    USER_UPDATE_ANY: 'user:update:any',                 // 修改任意用户信息
    USER_DELETE: 'user:delete',                         // 删除用户
    USER_CHANGE_PASSWORD_OWN: 'user:password:own',      // 修改自己的密码
    USER_CHANGE_PASSWORD_ANY: 'user:password:any',      // 修改任意用户密码
    
    // 权限管理
    PERMISSION_VIEW: 'permission:view',                 // 查看权限配置
    PERMISSION_MANAGE: 'permission:manage',             // 管理用户权限
};

// 角色预设
const ROLE_PRESETS = {
    // 超级管理员 - 拥有所有权限
    admin: Object.values(PERMISSIONS),
    
    // 普通用户 - 只能管理自己的资源
    user: [
        PERMISSIONS.DASHBOARD_VIEW_OWN,
        PERMISSIONS.FOLDER_VIEW_OWN,
        PERMISSIONS.FOLDER_CREATE_OWN,
        PERMISSIONS.FOLDER_UPDATE_OWN,
        PERMISSIONS.FOLDER_DELETE_OWN,
        PERMISSIONS.FILE_VIEW_OWN,
        PERMISSIONS.FILE_UPLOAD_OWN,
        PERMISSIONS.FILE_DOWNLOAD_OWN,
        PERMISSIONS.FILE_DELETE_OWN,
        PERMISSIONS.SHARE_CREATE_OWN,
        PERMISSIONS.SHARE_VIEW_OWN,
        PERMISSIONS.SHARE_DELETE_OWN,
        PERMISSIONS.RECYCLE_VIEW_OWN,
        PERMISSIONS.RECYCLE_RESTORE_OWN,
        PERMISSIONS.RECYCLE_DELETE_OWN,
        PERMISSIONS.USER_UPDATE_OWN,
        PERMISSIONS.USER_CHANGE_PASSWORD_OWN,
    ],
    
    // 部门管理员 - 可以查看统计和管理用户
    manager: [
        PERMISSIONS.DASHBOARD_VIEW_OWN,
        PERMISSIONS.DASHBOARD_VIEW_ALL,
        PERMISSIONS.DASHBOARD_VIEW_USER,
        PERMISSIONS.FOLDER_VIEW_OWN,
        PERMISSIONS.FOLDER_CREATE_OWN,
        PERMISSIONS.FOLDER_UPDATE_OWN,
        PERMISSIONS.FOLDER_DELETE_OWN,
        PERMISSIONS.FILE_VIEW_OWN,
        PERMISSIONS.FILE_UPLOAD_OWN,
        PERMISSIONS.FILE_DOWNLOAD_OWN,
        PERMISSIONS.FILE_DELETE_OWN,
        PERMISSIONS.SHARE_CREATE_OWN,
        PERMISSIONS.SHARE_VIEW_OWN,
        PERMISSIONS.SHARE_DELETE_OWN,
        PERMISSIONS.RECYCLE_VIEW_OWN,
        PERMISSIONS.RECYCLE_RESTORE_OWN,
        PERMISSIONS.RECYCLE_DELETE_OWN,
        PERMISSIONS.USER_VIEW_LIST,
        PERMISSIONS.USER_UPDATE_OWN,
        PERMISSIONS.USER_CHANGE_PASSWORD_OWN,
    ],
    
    // 只读用户 - 只能查看和下载
    readonly: [
        PERMISSIONS.DASHBOARD_VIEW_OWN,
        PERMISSIONS.FOLDER_VIEW_OWN,
        PERMISSIONS.FILE_VIEW_OWN,
        PERMISSIONS.FILE_DOWNLOAD_OWN,
        PERMISSIONS.USER_UPDATE_OWN,
        PERMISSIONS.USER_CHANGE_PASSWORD_OWN,
    ],
};

// 菜单权限映射
const MENU_PERMISSIONS = {
    dashboard: [PERMISSIONS.DASHBOARD_VIEW_OWN],
    folders: [PERMISSIONS.FOLDER_VIEW_OWN],
    shares: [PERMISSIONS.SHARE_VIEW_OWN],
    recycle: [PERMISSIONS.RECYCLE_VIEW_OWN],
    users: [PERMISSIONS.USER_VIEW_LIST],
};

// 权限分组（用于前端展示）
const PERMISSION_GROUPS = {
    dashboard: {
        label: '仪表盘',
        permissions: [
            { key: PERMISSIONS.DASHBOARD_VIEW_OWN, label: '查看个人统计' },
            { key: PERMISSIONS.DASHBOARD_VIEW_ALL, label: '查看全部统计' },
            { key: PERMISSIONS.DASHBOARD_VIEW_USER, label: '查看指定用户统计' },
        ]
    },
    folder: {
        label: '文件夹管理',
        permissions: [
            { key: PERMISSIONS.FOLDER_VIEW_OWN, label: '查看个人文件夹' },
            { key: PERMISSIONS.FOLDER_CREATE_OWN, label: '创建文件夹' },
            { key: PERMISSIONS.FOLDER_UPDATE_OWN, label: '修改文件夹' },
            { key: PERMISSIONS.FOLDER_DELETE_OWN, label: '删除文件夹' },
            { key: PERMISSIONS.FOLDER_MANAGE_ALL, label: '管理所有文件夹' },
        ]
    },
    file: {
        label: '文件管理',
        permissions: [
            { key: PERMISSIONS.FILE_VIEW_OWN, label: '查看个人文件' },
            { key: PERMISSIONS.FILE_UPLOAD_OWN, label: '上传文件' },
            { key: PERMISSIONS.FILE_DOWNLOAD_OWN, label: '下载文件' },
            { key: PERMISSIONS.FILE_DELETE_OWN, label: '删除文件' },
            { key: PERMISSIONS.FILE_MANAGE_ALL, label: '管理所有文件' },
        ]
    },
    share: {
        label: '分享管理',
        permissions: [
            { key: PERMISSIONS.SHARE_CREATE_OWN, label: '创建分享链接' },
            { key: PERMISSIONS.SHARE_VIEW_OWN, label: '查看分享链接' },
            { key: PERMISSIONS.SHARE_DELETE_OWN, label: '删除分享链接' },
            { key: PERMISSIONS.SHARE_MANAGE_ALL, label: '管理所有分享' },
        ]
    },
    recycle: {
        label: '回收站',
        permissions: [
            { key: PERMISSIONS.RECYCLE_VIEW_OWN, label: '查看回收站' },
            { key: PERMISSIONS.RECYCLE_RESTORE_OWN, label: '恢复文件' },
            { key: PERMISSIONS.RECYCLE_DELETE_OWN, label: '永久删除' },
            { key: PERMISSIONS.RECYCLE_MANAGE_ALL, label: '管理所有回收站' },
        ]
    },
    user: {
        label: '用户管理',
        permissions: [
            { key: PERMISSIONS.USER_VIEW_LIST, label: '查看用户列表' },
            { key: PERMISSIONS.USER_CREATE, label: '创建用户' },
            { key: PERMISSIONS.USER_UPDATE_OWN, label: '修改个人信息' },
            { key: PERMISSIONS.USER_UPDATE_ANY, label: '修改任意用户' },
            { key: PERMISSIONS.USER_DELETE, label: '删除用户' },
            { key: PERMISSIONS.USER_CHANGE_PASSWORD_OWN, label: '修改个人密码' },
            { key: PERMISSIONS.USER_CHANGE_PASSWORD_ANY, label: '修改任意密码' },
        ]
    },
    permission: {
        label: '权限管理',
        permissions: [
            { key: PERMISSIONS.PERMISSION_VIEW, label: '查看权限' },
            { key: PERMISSIONS.PERMISSION_MANAGE, label: '管理权限' },
        ]
    },
};

module.exports = {
    PERMISSIONS,
    ROLE_PRESETS,
    MENU_PERMISSIONS,
    PERMISSION_GROUPS,
};
