/**
 * 测试存储配额检查功能
 * 
 * 使用方法：
 * node test-storage-quota-check.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
let authToken = '';

// 测试用户凭据
const TEST_USER = {
    username: 'testuser',
    password: 'test123'
};

// 辅助函数：格式化存储大小
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 1. 登录获取 token
async function login() {
    try {
        console.log('\n=== 步骤1: 登录 ===');
        const response = await axios.post(`${API_BASE}/auth/login`, TEST_USER);
        authToken = response.data.token;
        console.log('✅ 登录成功');
        console.log('Token:', authToken.substring(0, 20) + '...');
        return true;
    } catch (error) {
        console.error('❌ 登录失败:', error.response?.data || error.message);
        return false;
    }
}

// 2. 获取用户存储信息
async function getStorageInfo() {
    try {
        console.log('\n=== 步骤2: 获取存储信息 ===');
        const response = await axios.get(`${API_BASE}/users/storage`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const info = response.data;
        console.log('✅ 存储信息:');
        console.log(`   配额: ${formatSize(info.storageQuota)}`);
        console.log(`   已使用: ${formatSize(info.storageUsed)}`);
        console.log(`   可用: ${formatSize(info.storageAvailable)}`);
        console.log(`   文件数: ${info.fileCount}`);
        
        return info;
    } catch (error) {
        console.error('❌ 获取存储信息失败:', error.response?.data || error.message);
        return null;
    }
}

// 3. 测试配额检查 - 尝试上传超过配额的文件
async function testQuotaExceeded(folderId, fileSize) {
    try {
        console.log('\n=== 步骤3: 测试配额限制 ===');
        console.log(`尝试初始化上传 ${formatSize(fileSize)} 的文件...`);
        
        const response = await axios.post(
            `${API_BASE}/folders/${folderId}/chunk/init`,
            {
                fileName: 'large-test-file.bin',
                fileSize: fileSize
            },
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );
        
        console.log('❌ 配额检查失败 - 应该被拒绝但成功了');
        console.log('响应:', response.data);
        return false;
    } catch (error) {
        if (error.response?.status === 403 || error.response?.data?.code === 'APF903') {
            console.log('✅ 配额检查正常 - 上传被正确拒绝');
            console.log('错误信息:', error.response.data.error);
            return true;
        } else {
            console.error('❌ 意外错误:', error.response?.data || error.message);
            return false;
        }
    }
}

// 4. 测试正常上传（配额内）
async function testNormalUpload(folderId, fileSize) {
    try {
        console.log('\n=== 步骤4: 测试正常上传 ===');
        console.log(`尝试初始化上传 ${formatSize(fileSize)} 的文件...`);
        
        const response = await axios.post(
            `${API_BASE}/folders/${folderId}/chunk/init`,
            {
                fileName: 'small-test-file.txt',
                fileSize: fileSize
            },
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );
        
        console.log('✅ 正常上传初始化成功');
        console.log('Upload ID:', response.data.uploadId);
        return response.data.uploadId;
    } catch (error) {
        console.error('❌ 上传初始化失败:', error.response?.data || error.message);
        return null;
    }
}

// 5. 获取用户文件夹列表
async function getFolders() {
    try {
        const response = await axios.get(`${API_BASE}/folders`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        return response.data;
    } catch (error) {
        console.error('❌ 获取文件夹失败:', error.response?.data || error.message);
        return [];
    }
}

// 主测试流程
async function runTests() {
    console.log('========================================');
    console.log('   存储配额检查功能测试');
    console.log('========================================');
    
    // 登录
    if (!await login()) {
        console.log('\n❌ 测试失败：无法登录');
        return;
    }
    
    // 获取存储信息
    const storageInfo = await getStorageInfo();
    if (!storageInfo) {
        console.log('\n❌ 测试失败：无法获取存储信息');
        return;
    }
    
    // 获取文件夹
    const folders = await getFolders();
    if (folders.length === 0) {
        console.log('\n❌ 测试失败：没有可用的文件夹');
        console.log('提示：请先创建一个文件夹');
        return;
    }
    
    const testFolderId = folders[0].id;
    console.log(`\n使用文件夹: ${folders[0].alias} (ID: ${testFolderId})`);
    
    // 测试1：尝试上传超过可用空间的文件
    const oversizeFile = storageInfo.storageAvailable + 1024 * 1024; // 超过1MB
    await testQuotaExceeded(testFolderId, oversizeFile);
    
    // 测试2：尝试上传正常大小的文件
    const normalFile = 1024 * 1024; // 1MB
    if (storageInfo.storageAvailable > normalFile) {
        await testNormalUpload(testFolderId, normalFile);
    } else {
        console.log('\n⚠️  跳过正常上传测试：可用空间不足');
    }
    
    // 再次获取存储信息
    await getStorageInfo();
    
    console.log('\n========================================');
    console.log('   测试完成');
    console.log('========================================');
}

// 运行测试
runTests().catch(error => {
    console.error('测试过程中发生错误:', error);
});
