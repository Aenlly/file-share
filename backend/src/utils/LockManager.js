const logger = require('./logger');

/**
 * 改进的锁管理器
 * 支持队列、超时自动释放、死锁检测
 */
class LockManager {
    constructor() {
        this.locks = new Map(); // 当前持有的锁
        this.queues = new Map(); // 等待队列
        this.lockTimeouts = new Map(); // 锁超时定时器
    }

    /**
     * 获取锁（支持队列和超时）
     * @param {string} resource - 资源标识
     * @param {number} timeout - 超时时间（毫秒），默认30秒
     * @param {number} maxLockTime - 锁最大持有时间（毫秒），默认60秒
     */
    async acquire(resource, timeout = 30000, maxLockTime = 60000) {
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const attemptAcquire = () => {
                // 检查是否超时
                if (Date.now() - startTime > timeout) {
                    this._removeFromQueue(resource, attemptAcquire);
                    reject(new Error(`获取锁超时: ${resource} (等待时间: ${Math.round(timeout/1000)}秒)`));
                    return;
                }

                // 如果锁可用，立即获取
                if (!this.locks.has(resource)) {
                    this._acquireLock(resource, maxLockTime);
                    resolve();
                } else {
                    // 加入等待队列
                    if (!this.queues.has(resource)) {
                        this.queues.set(resource, []);
                    }
                    this.queues.get(resource).push(attemptAcquire);
                }
            };

            attemptAcquire();
        });
    }

    /**
     * 实际获取锁
     */
    _acquireLock(resource, maxLockTime) {
        const lockInfo = {
            acquired: Date.now(),
            resource: resource
        };
        
        this.locks.set(resource, lockInfo);
        
        // 设置自动释放定时器（防止死锁）
        const timeoutId = setTimeout(() => {
            logger.warn(`锁超时自动释放: ${resource}, 持有时间: ${maxLockTime}ms`);
            this.release(resource);
        }, maxLockTime);
        
        this.lockTimeouts.set(resource, timeoutId);
        
        logger.debug(`获取锁: ${resource}`);
    }

    /**
     * 释放锁
     */
    release(resource) {
        if (!this.locks.has(resource)) {
            logger.warn(`尝试释放不存在的锁: ${resource}`);
            return;
        }

        const lockInfo = this.locks.get(resource);
        const holdTime = Date.now() - lockInfo.acquired;
        
        if (holdTime > 5000) {
            logger.warn(`释放锁: ${resource}, 持有时间: ${holdTime}ms`);
        } else {
            logger.debug(`释放锁: ${resource}, 持有时间: ${holdTime}ms`);
        }

        // 清除超时定时器
        const timeoutId = this.lockTimeouts.get(resource);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.lockTimeouts.delete(resource);
        }

        // 释放锁
        this.locks.delete(resource);

        // 处理等待队列
        this._processQueue(resource);
    }

    /**
     * 处理等待队列
     */
    _processQueue(resource) {
        const queue = this.queues.get(resource);
        if (queue && queue.length > 0) {
            // FIFO: 取出第一个等待者
            const next = queue.shift();
            
            // 如果队列为空，删除队列
            if (queue.length === 0) {
                this.queues.delete(resource);
            }
            
            // 立即尝试获取锁
            setImmediate(() => next());
        }
    }

    /**
     * 从队列中移除
     */
    _removeFromQueue(resource, callback) {
        const queue = this.queues.get(resource);
        if (queue) {
            const index = queue.indexOf(callback);
            if (index > -1) {
                queue.splice(index, 1);
            }
            if (queue.length === 0) {
                this.queues.delete(resource);
            }
        }
    }

    /**
     * 检查锁状态
     */
    isLocked(resource) {
        return this.locks.has(resource);
    }

    /**
     * 获取等待队列长度
     */
    getQueueLength(resource) {
        const queue = this.queues.get(resource);
        return queue ? queue.length : 0;
    }

    /**
     * 获取所有锁的状态（用于调试）
     */
    getStatus() {
        const status = {
            locks: [],
            queues: []
        };

        for (const [resource, lockInfo] of this.locks.entries()) {
            status.locks.push({
                resource,
                holdTime: Date.now() - lockInfo.acquired
            });
        }

        for (const [resource, queue] of this.queues.entries()) {
            status.queues.push({
                resource,
                waiting: queue.length
            });
        }

        return status;
    }

    /**
     * 强制释放所有锁（用于清理）
     */
    releaseAll() {
        logger.warn('强制释放所有锁');
        
        // 清除所有超时定时器
        for (const timeoutId of this.lockTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        
        this.locks.clear();
        this.queues.clear();
        this.lockTimeouts.clear();
    }
}

// 单例模式
const lockManager = new LockManager();

// 进程退出时清理
process.on('exit', () => {
    lockManager.releaseAll();
});

process.on('SIGTERM', () => {
    lockManager.releaseAll();
});

process.on('SIGINT', () => {
    lockManager.releaseAll();
});

module.exports = lockManager;
