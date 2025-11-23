const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('./src/middleware/auth');

console.log('=== 测试认证流程 ===\n');

// 1. 测试JWT token生成和解析
console.log('1. JWT Token 测试:');

// 创建admin用户的token
const adminToken = jwt.sign(
    { id: 1, username: 'admin', role: 'admin' }, 
    SECRET_KEY
);
console.log(`   Admin Token: ${adminToken}`);

// 解析admin token
const decodedAdmin = jwt.verify(adminToken, SECRET_KEY);
console.log(`   解析结果: ${JSON.stringify(decodedAdmin)}`);

// 创建普通用户的token
const userToken = jwt.sign(
    { id: 2, username: 'testuser', role: 'user' }, 
    SECRET_KEY
);
console.log(`   User Token: ${userToken}`);

// 解析user token
const decodedUser = jwt.verify(userToken, SECRET_KEY);
console.log(`   解析结果: ${JSON.stringify(decodedUser)}`);

// 2. 模拟认证中间件
console.log('\n2. 认证中间件测试:');

const simulateAuth = (token) => {
    try {
        const user = jwt.verify(token, SECRET_KEY);
        return { success: true, user };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

const adminAuth = simulateAuth(adminToken);
console.log(`   Admin认证: ${adminAuth.success ? '成功' : '失败'}`);
if (adminAuth.success) {
    console.log(`     用户名: ${adminAuth.user.username}`);
}

const userAuth = simulateAuth(userToken);
console.log(`   User认证: ${userAuth.success ? '成功' : '失败'}`);
if (userAuth.success) {
    console.log(`     用户名: ${userAuth.user.username}`);
}

// 3. 测试文件夹权限过滤
console.log('\n3. 文件夹权限过滤测试:');
const Folder = require('./src/models/Folder');

// 模拟admin用户请求
const adminFolders = Folder.findByOwner('admin');
console.log(`   admin用户看到的文件夹: ${adminFolders.length}个`);
adminFolders.forEach(f => console.log(`     - ${f.alias}(${f.id})`));

// 模拟testuser用户请求
const testUserFolders = Folder.findByOwner('testuser');
console.log(`   testuser用户看到的文件夹: ${testUserFolders.length}个`);
testUserFolders.forEach(f => console.log(`     - ${f.alias}(${f.id})`));

console.log('\n=== 问题诊断 ===');
console.log('如果前端非admin用户看到了t2文件夹，可能的原因:');
console.log('1. 前端localStorage中存储了错误的用户信息');
console.log('2. 前端发送了admin用户的token');
console.log('3. 后端认证中间件被绕过');
console.log('4. 前端使用了缓存的文件夹数据');

console.log('\n=== 建议检查 ===');
console.log('1. 检查浏览器localStorage中的auth-storage内容');
console.log('2. 检查网络请求中Authorization header');
console.log('3. 检查后端日志中的req.user信息');
console.log('4. 清除浏览器缓存重新测试');