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

        const newUser = await this.insert({
            username: userData.username,
            password: hashedPassword,
            role: userData.role || 'user',
            menuPermissions: userData.role === 'admin' 
                ? ['manageUsers', 'viewFolders'] 
                : ['viewFolders']
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
        const menuPermissions = role === 'admin' 
            ? ['manageUsers', 'viewFolders'] 
            : ['viewFolders'];

        return await this.update(id, { role, menuPermissions });
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
                role: 'admin'
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
