const BaseModel = require('./BaseModel');

/**
 * 审计日志模型
 * 记录用户的关键操作
 */
class AuditLogModel extends BaseModel {
    constructor() {
        super('audit_logs');
    }

    /**
     * 操作类型枚举
     */
    static ACTION_TYPES = {
        // 用户操作
        USER_LOGIN: 'user.login',
        USER_LOGOUT: 'user.logout',
        USER_CREATE: 'user.create',
        USER_UPDATE: 'user.update',
        USER_DELETE: 'user.delete',
        USER_PASSWORD_CHANGE: 'user.password_change',
        
        // 文件操作
        FILE_UPLOAD: 'file.upload',
        FILE_DOWNLOAD: 'file.download',
        FILE_DELETE: 'file.delete',
        FILE_MOVE: 'file.move',
        FILE_RESTORE: 'file.restore',
        
        // 文件夹操作
        FOLDER_CREATE: 'folder.create',
        FOLDER_DELETE: 'folder.delete',
        FOLDER_UPDATE: 'folder.update',
        
        // 分享操作
        SHARE_CREATE: 'share.create',
        SHARE_DELETE: 'share.delete',
        SHARE_ACCESS: 'share.access',
        SHARE_UPDATE: 'share.update',
        
        // 权限操作
        PERMISSION_GRANT: 'permission.grant',
        PERMISSION_REVOKE: 'permission.revoke',
        
        // 系统操作
        SYSTEM_CONFIG_CHANGE: 'system.config_change',
        SYSTEM_BACKUP: 'system.backup',
        SYSTEM_RESTORE: 'system.restore'
    };

    /**
     * 记录审计日志
     */
    async log(logData) {
        const {
            action,          // 操作类型
            userId,          // 用户ID
            username,        // 用户名
            resourceType,    // 资源类型（file, folder, user等）
            resourceId,      // 资源ID
            resourceName,    // 资源名称
            details,         // 详细信息（JSON对象）
            ipAddress,       // IP地址
            userAgent,       // 用户代理
            status,          // 状态（success, failed）
            errorMessage     // 错误信息（如果失败）
        } = logData;

        const log = await this.insert({
            action,
            userId: userId || null,
            username: username || 'anonymous',
            resourceType: resourceType || null,
            resourceId: resourceId || null,
            resourceName: resourceName || null,
            details: details || {},
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            status: status || 'success',
            errorMessage: errorMessage || null
        });

        return log;
    }

    /**
     * 查询用户的审计日志
     */
    async findByUser(username, options = {}) {
        const { limit = 100, offset = 0, action = null } = options;
        
        let logs = await this.find({ username });
        
        // 按操作类型过滤
        if (action) {
            logs = logs.filter(log => log.action === action);
        }
        
        // 按时间倒序排序
        logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 分页
        return logs.slice(offset, offset + limit);
    }

    /**
     * 查询资源的审计日志
     */
    async findByResource(resourceType, resourceId, options = {}) {
        const { limit = 100, offset = 0 } = options;
        
        let logs = await this.find({ resourceType, resourceId });
        
        // 按时间倒序排序
        logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 分页
        return logs.slice(offset, offset + limit);
    }

    /**
     * 查询指定时间范围的审计日志
     */
    async findByDateRange(startDate, endDate, options = {}) {
        const { limit = 100, offset = 0, action = null, username = null } = options;
        
        let logs = await this.getAll();
        
        // 时间范围过滤
        logs = logs.filter(log => {
            const logDate = new Date(log.createdAt);
            return logDate >= new Date(startDate) && logDate <= new Date(endDate);
        });
        
        // 按操作类型过滤
        if (action) {
            logs = logs.filter(log => log.action === action);
        }
        
        // 按用户过滤
        if (username) {
            logs = logs.filter(log => log.username === username);
        }
        
        // 按时间倒序排序
        logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 分页
        return logs.slice(offset, offset + limit);
    }

    /**
     * 获取审计日志统计
     */
    async getStatistics(options = {}) {
        const { startDate, endDate, username = null } = options;
        
        let logs = await this.getAll();
        
        // 时间范围过滤
        if (startDate && endDate) {
            logs = logs.filter(log => {
                const logDate = new Date(log.createdAt);
                return logDate >= new Date(startDate) && logDate <= new Date(endDate);
            });
        }
        
        // 按用户过滤
        if (username) {
            logs = logs.filter(log => log.username === username);
        }
        
        // 统计
        const stats = {
            total: logs.length,
            byAction: {},
            byUser: {},
            byStatus: {
                success: 0,
                failed: 0
            },
            byDate: {}
        };
        
        logs.forEach(log => {
            // 按操作类型统计
            stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
            
            // 按用户统计
            stats.byUser[log.username] = (stats.byUser[log.username] || 0) + 1;
            
            // 按状态统计
            stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
            
            // 按日期统计
            const date = new Date(log.createdAt).toISOString().split('T')[0];
            stats.byDate[date] = (stats.byDate[date] || 0) + 1;
        });
        
        return stats;
    }

    /**
     * 清理旧的审计日志
     */
    async cleanup(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const logs = await this.getAll();
        let deletedCount = 0;
        
        for (const log of logs) {
            if (new Date(log.createdAt) < cutoffDate) {
                await this.delete(log.id);
                deletedCount++;
            }
        }
        
        return deletedCount;
    }
}

module.exports = new AuditLogModel();
