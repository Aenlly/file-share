/**
 * 前端权限常量
 * 与后端 backend/src/config/permissions.js 保持一致
 */

export const PERMISSIONS = {
    // 仪表盘权限
    DASHBOARD_VIEW_OWN: 'dashboard:view:own',
    DASHBOARD_VIEW_ALL: 'dashboard:view:all',
    DASHBOARD_VIEW_USER: 'dashboard:view:user',
    
    // 文件夹权限
    FOLDER_VIEW_OWN: 'folder:view:own',
    FOLDER_CREATE_OWN: 'folder:create:own',
    FOLDER_UPDATE_OWN: 'folder:update:own',
    FOLDER_DELETE_OWN: 'folder:delete:own',
    FOLDER_MANAGE_ALL: 'folder:manage:all',
    
    // 文件权限
    FILE_VIEW_OWN: 'file:view:own',
    FILE_UPLOAD_OWN: 'file:upload:own',
    FILE_DOWNLOAD_OWN: 'file:download:own',
    FILE_DELETE_OWN: 'file:delete:own',
    FILE_MANAGE_ALL: 'file:manage:all',
    
    // 分享权限
    SHARE_CREATE_OWN: 'share:create:own',
    SHARE_VIEW_OWN: 'share:view:own',
    SHARE_DELETE_OWN: 'share:delete:own',
    SHARE_MANAGE_ALL: 'share:manage:all',
    
    // 回收站权限
    RECYCLE_VIEW_OWN: 'recycle:view:own',
    RECYCLE_RESTORE_OWN: 'recycle:restore:own',
    RECYCLE_DELETE_OWN: 'recycle:delete:own',
    RECYCLE_MANAGE_ALL: 'recycle:manage:all',
    
    // 用户管理权限
    USER_VIEW_LIST: 'user:view:list',
    USER_CREATE: 'user:create',
    USER_UPDATE_OWN: 'user:update:own',
    USER_UPDATE_ANY: 'user:update:any',
    USER_DELETE: 'user:delete',
    USER_CHANGE_PASSWORD_OWN: 'user:password:own',
    USER_CHANGE_PASSWORD_ANY: 'user:password:any',
    
    // 权限管理
    PERMISSION_VIEW: 'permission:view',
    PERMISSION_MANAGE: 'permission:manage',
};

// 菜单权限映射
export const MENU_PERMISSIONS = {
    dashboard: [PERMISSIONS.DASHBOARD_VIEW_OWN],
    folders: [PERMISSIONS.FOLDER_VIEW_OWN],
    shares: [PERMISSIONS.SHARE_VIEW_OWN],
    recycle: [PERMISSIONS.RECYCLE_VIEW_OWN],
    users: [PERMISSIONS.USER_VIEW_LIST],
    permissions: [PERMISSIONS.PERMISSION_VIEW],
};
