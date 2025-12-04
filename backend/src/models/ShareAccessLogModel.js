const BaseModel = require('./BaseModel');

/**
 * 分享访问日志模型
 * 记录分享链接的访问记录，用于统计活跃分享
 */
class ShareAccessLogModel extends BaseModel {
    constructor() {
        super('shareAccessLogs');
    }

    /**
     * 记录访问日志
     * @param {Object} data - 访问数据
     * @param {string} data.shareCode - 分享访问码
     * @param {number} data.shareId - 分享ID
     * @param {string} data.ip - 访问者IP
     * @param {string} data.deviceId - 设备码（从请求头或cookie获取）
     * @param {string} data.userAgent - 用户代理
     */
    async logAccess(data) {
        const now = Date.now();
        
        return await this.insert({
            shareCode: data.shareCode,
            shareId: data.shareId,
            ip: data.ip,
            deviceId: data.deviceId || 'unknown',
            userAgent: data.userAgent || '',
            accessTime: now
        });
    }

    /**
     * 获取分享在指定天数内的唯一访问者数量
     * @param {string} shareCode - 分享访问码
     * @param {number} days - 天数，默认7天
     * @returns {number} 唯一访问者数量（按IP+设备码去重）
     */
    async getUniqueVisitorCount(shareCode, days = 7) {
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const logs = await this.find({ shareCode });
        
        // 过滤出指定天数内的访问记录
        const recentLogs = logs.filter(log => log.accessTime >= cutoffTime);
        
        // 按 IP + 设备码 去重
        const uniqueVisitors = new Set();
        recentLogs.forEach(log => {
            uniqueVisitors.add(`${log.ip}_${log.deviceId}`);
        });
        
        return uniqueVisitors.size;
    }

    /**
     * 检查分享在指定天数内是否有访问
     * @param {string} shareCode - 分享访问码
     * @param {number} days - 天数，默认7天
     * @returns {boolean} 是否有访问
     */
    async hasRecentAccess(shareCode, days = 7) {
        const count = await this.getUniqueVisitorCount(shareCode, days);
        return count > 0;
    }

    /**
     * 批量检查多个分享的活跃状态
     * @param {Array<string>} shareCodes - 分享访问码数组
     * @param {number} days - 天数，默认7天
     * @returns {Object} { shareCode: uniqueVisitorCount }
     */
    async getActiveShareStats(shareCodes, days = 7) {
        const result = {};
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        // 获取所有访问日志
        const allLogs = await this.getAll();
        
        // 按分享码分组并统计
        for (const code of shareCodes) {
            const logs = allLogs.filter(log => 
                log.shareCode === code && log.accessTime >= cutoffTime
            );
            
            const uniqueVisitors = new Set();
            logs.forEach(log => {
                uniqueVisitors.add(`${log.ip}_${log.deviceId}`);
            });
            
            result[code] = uniqueVisitors.size;
        }
        
        return result;
    }

    /**
     * 获取活跃分享数量（7天内有唯一访问的分享数）
     * @param {Array<Object>} shares - 分享列表
     * @param {number} days - 天数，默认7天
     * @returns {number} 活跃分享数量
     */
    async countActiveShares(shares, days = 7) {
        if (!shares || shares.length === 0) return 0;
        
        const shareCodes = shares.map(s => s.code);
        const stats = await this.getActiveShareStats(shareCodes, days);
        
        // 统计有访问记录的分享数量
        return Object.values(stats).filter(count => count > 0).length;
    }

    /**
     * 清理过期的访问日志（可选，用于定期清理）
     * @param {number} days - 保留天数，默认30天
     */
    async cleanupOldLogs(days = 30) {
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const allLogs = await this.getAll();
        
        let deletedCount = 0;
        for (const log of allLogs) {
            if (log.accessTime < cutoffTime) {
                await this.delete(log.id);
                deletedCount++;
            }
        }
        
        return deletedCount;
    }

    /**
     * 根据分享码删除访问日志
     * @param {string} shareCode - 分享访问码
     */
    async deleteByShareCode(shareCode) {
        return await this.deleteMany({ shareCode });
    }
}

module.exports = new ShareAccessLogModel();
