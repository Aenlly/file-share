const BaseModel = require('./BaseModel');
const path = require('path');
const fs = require('fs-extra');

/**
 * 上传会话模型
 * 用于管理分片上传和断点续传
 */
class UploadSessionModel extends BaseModel {
    constructor() {
        super('upload_sessions');
    }

    /**
     * 创建上传会话
     */
    async createSession(sessionData) {
        const session = await this.insert({
            uploadId: sessionData.uploadId,
            folderId: sessionData.folderId,
            fileName: sessionData.fileName,
            fileSize: sessionData.fileSize,
            fileHash: sessionData.fileHash || null,
            totalChunks: sessionData.totalChunks,
            chunkSize: sessionData.chunkSize,
            uploadedChunks: [],
            status: 'uploading', // uploading, completed, failed, cancelled
            owner: sessionData.owner,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
        });

        return session;
    }

    /**
     * 根据 uploadId 查询会话
     */
    async findByUploadId(uploadId) {
        return await this.findOne({ uploadId });
    }

    /**
     * 更新已上传的分片
     */
    async updateUploadedChunks(uploadId, chunkIndex) {
        const session = await this.findByUploadId(uploadId);
        if (!session) {
            throw new Error('上传会话不存在');
        }

        // 添加分片索引（避免重复）
        if (!session.uploadedChunks.includes(chunkIndex)) {
            session.uploadedChunks.push(chunkIndex);
            session.uploadedChunks.sort((a, b) => a - b);
        }

        // 检查是否完成
        if (session.uploadedChunks.length === session.totalChunks) {
            session.status = 'completed';
        }

        await this.update(session.id, {
            uploadedChunks: session.uploadedChunks,
            status: session.status,
            updatedAt: new Date().toISOString()
        });

        return session;
    }

    /**
     * 获取缺失的分片列表
     */
    async getMissingChunks(uploadId) {
        const session = await this.findByUploadId(uploadId);
        if (!session) {
            throw new Error('上传会话不存在');
        }

        const allChunks = Array.from({ length: session.totalChunks }, (_, i) => i);
        const missingChunks = allChunks.filter(i => !session.uploadedChunks.includes(i));

        return {
            uploadId: session.uploadId,
            totalChunks: session.totalChunks,
            uploadedChunks: session.uploadedChunks.length,
            missingChunks,
            progress: Math.round((session.uploadedChunks.length / session.totalChunks) * 100)
        };
    }

    /**
     * 标记会话为完成
     */
    async completeSession(uploadId) {
        const session = await this.findByUploadId(uploadId);
        if (!session) {
            throw new Error('上传会话不存在');
        }

        await this.update(session.id, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });

        return session;
    }

    /**
     * 取消上传会话
     */
    async cancelSession(uploadId) {
        const session = await this.findByUploadId(uploadId);
        if (!session) {
            throw new Error('上传会话不存在');
        }

        await this.update(session.id, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString()
        });

        return session;
    }

    /**
     * 清理过期的上传会话
     */
    async cleanupExpiredSessions() {
        const now = new Date().toISOString();
        const sessions = await this.find({});
        
        let cleanedCount = 0;
        
        for (const session of sessions) {
            if (session.expiresAt < now && session.status !== 'completed') {
                // 删除临时文件
                try {
                    const tempDir = path.join('./temp/uploads', session.uploadId);
                    if (await fs.pathExists(tempDir)) {
                        await fs.remove(tempDir);
                    }
                } catch (error) {
                    console.error(`清理临时文件失败: ${session.uploadId}`, error);
                }

                // 删除会话记录
                await this.delete(session.id);
                cleanedCount++;
            }
        }

        return cleanedCount;
    }

    /**
     * 获取用户的活跃上传会话
     */
    async getActiveSessionsByOwner(owner) {
        const sessions = await this.find({ owner, status: 'uploading' });
        return sessions.filter(s => new Date(s.expiresAt) > new Date());
    }
}

module.exports = new UploadSessionModel();
