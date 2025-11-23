const Folder = require('./src/models/Folder');
const User = require('./src/models/User');
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('./src/middleware/auth');

console.log('=== 测试文件夹权限问题 ===\n');

// 1. 查看当前所有文件夹
console.log('1. 所有文件夹:');
const allFolders = Folder.getAll();
allFolders.forEach(folder => {
    console.log(`   - ID: ${folder.id}, 别名: ${folder.alias}, 所有者: ${folder.owner}`);
});

// 2. 查看所有用户
console.log('\n2. 所有用户:');
const allUsers = User.getAll();
allUsers.forEach(user => {
    console.log(`   - 用户名: ${user.username}, 角色: ${user.role}`);
});

// 3. 模拟不同用户获取文件夹
console.log('\n3. 不同用户获取的文件夹:');

// admin用户获取文件夹
const adminFolders = Folder.findByOwner('admin');
console.log(`   admin用户的文件夹: ${adminFolders.length}个`);
adminFolders.forEach(folder => {
    console.log(`     - ${folder.alias}(${folder.id})`);
});

// 创建一个测试用户token
const testUserToken = jwt.sign(
    { id: 2, username: 'testuser', role: 'user' }, 
    SECRET_KEY
);
console.log(`\n   测试用户token: ${testUserToken}`);

// testuser用户获取文件夹
const testUserFolders = Folder.findByOwner('testuser');
console.log(`   testuser用户的文件夹: ${testUserFolders.length}个`);
testUserFolders.forEach(folder => {
    console.log(`     - ${folder.alias}(${folder.id})`);
});

// 4. 检查问题
console.log('\n4. 问题分析:');
console.log('   如果当前登录用户不是admin，但看到了t2(1763478261456)文件夹，');
console.log('   说明后端没有正确过滤用户权限，或者前端认证有问题。');

console.log('\n=== 解决方案 ===');
console.log('1. 确保后端getFolders接口正确使用req.user.username过滤');
console.log('2. 确保前端正确发送认证token');
console.log('3. 确保JWT token正确解析用户信息');