const bcrypt = require('bcryptjs');
const { readJSON, writeJSON } = require('../utils/fileHelpers');

class User {
    static getAll() {
        return readJSON('users.json');
    }
    
    static findById(id) {
        const users = this.getAll();
        return users.find(u => u.id === id);
    }
    
    static findByUsername(username) {
        const users = this.getAll();
        return users.find(u => u.username === username);
    }
    
    static create(userData) {
        const users = this.getAll();
        
        if (users.some(u => u.username === userData.username)) {
            throw new Error('用户名已存在');
        }
        
        const salt = bcrypt.genSaltSync(10);
        const newUser = {
            id: Date.now(),
            username: userData.username,
            password: bcrypt.hashSync(userData.password, salt),
            role: userData.role,
            menuPermissions: userData.role === 'admin' ? ['manageUsers', 'viewFolders'] : ['viewFolders']
        };
        
        users.push(newUser);
        writeJSON('users.json', users);
        
        const { password, ...safeUser } = newUser;
        return safeUser;
    }
    
    static update(id, userData) {
        const users = this.getAll();
        const userIndex = users.findIndex(u => u.id === id);
        
        if (userIndex === -1) {
            throw new Error('用户不存在');
        }
        
        if (userData.role) {
            users[userIndex].role = userData.role;
            users[userIndex].menuPermissions = userData.role === 'admin' ? ['manageUsers', 'viewFolders'] : ['viewFolders'];
        }
        
        writeJSON('users.json', users);
        
        const { password, ...safeUser } = users[userIndex];
        return safeUser;
    }
    
    static updatePassword(id, password) {
        const users = this.getAll();
        const userIndex = users.findIndex(u => u.id === id);
        
        if (userIndex === -1) {
            throw new Error('用户不存在');
        }
        
        const salt = bcrypt.genSaltSync(10);
        users[userIndex].password = bcrypt.hashSync(password, salt);
        
        writeJSON('users.json', users);
        return { success: true };
    }
    
    static delete(id) {
        const users = this.getAll();
        const userIndex = users.findIndex(u => u.id === id);
        
        if (userIndex === -1) {
            throw new Error('用户不存在');
        }
        
        const deletedUser = users[userIndex];
        users.splice(userIndex, 1);
        writeJSON('users.json', users);
        
        return deletedUser;
    }
    
    static verifyPassword(username, password) {
        const user = this.findByUsername(username);
        if (!user) return null;
        
        if (bcrypt.compareSync(password, user.password)) {
            const { password: pwd, ...safeUser } = user;
            return safeUser;
        }
        
        return null;
    }
    
    static createDefaultAdmin() {
        if (this.getAll().length === 0) {
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync('admin123', salt);
            writeJSON('users.json', [{
                id: 1,
                username: 'admin',
                password: hash,
                role: 'admin',
                menuPermissions: ['manageUsers', 'viewFolders']
            }]);
            console.log('✅ 默认管理员创建成功：admin / admin123');
        }
    }
}

module.exports = User;