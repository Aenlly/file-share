const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');

/**
 * 用户模型
 */
class UserModel extends BaseModel {
    constructor() {
        super('users');
    }

    /**
     * 根据用户名查询
     */
    async findByUsername(username) {
        return await this.findOne({ username });
    }

    /**
     * 创建用户
     */
    async create(userData) {
        // 检查用户名是否已存在
        const existing = await this.findByUsername(userData.username);
        if (existing) {
            throw new Error('用户名已存在');
        }

        // 加密密码
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(userData.password, salt);

        // 默认存储配额：10GB
        const defaultStorageQuota = 10 * 1024 * 1024 * 1024; // 10GB in bytes

        // 根据角色分配权限
        const { ROLE_PRESETS } = require('../config/permissions');
        const role = userData.role || 'user';
        const permissions = userData.permissions || ROLE_PRESETS[role] || ROLE_PRESETS.user;

        const newUser = await this.insert({
            username: userData.username,
            password: hashedPassword,
            role: role,
            permissions: permissions,
            menuPermissions: role === 'admin' 
                ? ['manageUsers', 'viewFolders'] 
                : ['viewFolders'],
            storageQuota: userData.storageQuota || defaultStorageQuota,
            storageUsed: 0
        });

        // 返回不包含密码的用户信息
        return this._sanitizeUser(newUser);
    }

    /**
     * 验证密码
     */
    async verifyPassword(username, password) {
        const user = await this.findByUsername(username);
        if (!user) return null;

        if (bcrypt.compareSync(password, user.password)) {
            return this._sanitizeUser(user);
        }

        return null;
    }

    /**
     * 更新密码
     */
    async updatePassword(id, newPassword) {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        return await this.update(id, { password: hashedPassword });
    }

    /**
     * 更新用户角色
     */
    async updateRole(id, role) {
        const { ROLE_PRESETS } = require('../config/permissions');
        const permissions = ROLE_PRESETS[role] || ROLE_PRESETS.user;
        const menuPermissions = role === 'admin' 
            ? ['manageUsers', 'viewFolders'] 
            : ['viewFolders'];

        return await this.update(id, { role, permissions, menuPermissions });
    }

    /**
     * 更新用户存储配额
     */
    async updateStorageQuota(id, storageQuota) {
        return await this.update(id, { storageQuota });
    }

    /**
     * 更新用户已使用存储
     */
    async updateStorageUsed(username, storageUsed) {
        const user = await this.findByUsername(username);
        if (!user) {
            throw new Error('用户不存在');
        }
        return await this.update(user.id, { storageUsed });
    }

    /**
     * 增加用户已使用存储
     */
    async incrementStorageUsed(username, size) {
        const user = await this.findByUsername(username);
        if (!user) {
            throw new Error('用户不存在');
        }
        const newStorageUsed = (user.storageUsed || 0) + size;
        return await this.update(user.id, { storageUsed: newStorageUsed });
    }

    /**
     * 减少用户已使用存储
     */
    async decrementStorageUsed(username, size) {
        const user = await this.findByUsername(username);
        if (!user) {
            throw new Error('用户不存在');
        }
        const newStorageUsed = Math.max(0, (user.storageUsed || 0) - size);
        return await this.update(user.id, { storageUsed: newStorageUsed });
    }

    /**
     * 检查用户存储是否超限
     */
    async checkStorageQuota(username, additionalSize = 0) {
        const user = await this.findByUsername(username);
        if (!user) {
            throw new Error('用户不存在');
        }

        const storageQuota = user.storageQuota || 10 * 1024 * 1024 * 1024; // 默认10GB
        const storageUsed = user.storageUsed || 0;
        const totalUsed = storageUsed + additionalSize;

        return {
            allowed: totalUsed <= storageQuota,
            storageQuota,
            storageUsed,
            storageAvailable: storageQuota - storageUsed,
            additionalSize,
            totalAfterUpload: totalUsed
        };
    }

    /**
     * 创建默认管理员
     */
    async createDefaultAdmin() {
        const users = await this.getAll();
        if (users.length === 0) {
            await this.create({
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                storageQuota: 100 * 1024 * 1024 * 1024 // 管理员默认100GB
            });
            console.log('✅ 默认管理员创建成功：admin / admin123');
        }
    }

    /**
     * 移除敏感信息
     */
    _sanitizeUser(user) {
        const { password, ...safeUser } = user;
        return safeUser;
    }
}

module.exports = new UserModel();
