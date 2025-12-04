const BaseModel = require('./BaseModel');

/**
 * 上传会话模型
 * 用于存储分片上传的会话信息
 */
class UploadSessionModel extends BaseModel {
    constructor() {
        super('uploadSessions');
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
            owner: sessionData.owner,
            chunks: JSON.stringify([]), // 存储为 JSON 字符串
            totalChunks: sessionData.totalChunks || 0,
            uploadedChunks: 0,
            status: 'active', // active, completed, expired
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
        });
        
        return session;
    }

    /**
     * 根据 uploadId 查询会话
     */
    async findByUploadId(uploadId) {
        const session = await this.findOne({ uploadId });
        if (session && session.chunks) {
            // 解析 chunks JSON
            try {
                session.chunks = JSON.parse(session.chunks);
            } catch (error) {
                session.chunks = [];
            }
        }
        return session;
    }

    /**
     * 更新会话的分片数据
     */
    async updateChunks(uploadId, chunkIndex, chunkData) {
        const session = await this.findByUploadId(uploadId);
        if (!session) {
            throw new Error('上传会话不存在');
        }

        // 更新分片数据
        session.chunks[chunkIndex] = chunkData;
        session.uploadedChunks = session.chunks.filter(c => c).length;

        await this.update(session.id, {
            chunks: JSON.stringify(session.chunks),
            uploadedChunks: session.uploadedChunks
        });

        return session;
    }

    /**
     * 标记会话为已完成
     */
    async markCompleted(uploadId) {
        const session = await this.findByUploadId(uploadId);
        if (!session) {
            throw new Error('上传会话不存在');
        }

        await this.update(session.id, {
            status: 'completed'
        });

        return session;
    }

    /**
     * 删除会话
     */
    async deleteSession(uploadId) {
        const session = await this.findByUploadId(uploadId);
        if (session) {
            await this.delete(session.id);
        }
    }

    /**
     * 清理过期会话
     */
    async cleanExpiredSessions() {
        const now = new Date().toISOString();
        const sessions = await this.find({});
        
        let cleanedCount = 0;
        for (const session of sessions) {
            if (session.expiresAt < now || session.status === 'completed') {
                await this.delete(session.id);
                cleanedCount++;
            }
        }

        return cleanedCount;
    }

    /**
     * 获取用户的活跃会话
     */
    async findActiveByOwner(owner) {
        const sessions = await this.find({ owner, status: 'active' });
        return sessions.map(session => {
            if (session.chunks) {
                try {
                    session.chunks = JSON.parse(session.chunks);
                } catch (error) {
                    session.chunks = [];
                }
            }
            return session;
        });
    }
}

module.exports = new UploadSessionModel();
