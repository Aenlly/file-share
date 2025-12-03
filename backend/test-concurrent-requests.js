/**
 * 并发请求测试脚本
 * 用于验证间歇性500错误是否已修复
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8001';
const TEST_USER = {
    username: 'admin',
    password: 'admin123'
};

let authToken = '';

/**
 * 登录获取token
 */
async function login() {
    try {
        const response = await axios.post(`${BASE_URL}/api/users/login`, TEST_USER);
        authToken = response.data.token;
        console.log('✅ 登录成功');
        return true;
    } catch (error) {
        console.error('❌ 登录失败:', error.message);
        return false;
    }
}

/**
 * 获取文件夹列表
 */
async function getFolders() {
    try {
        const response = await axios.get(`${BASE_URL}/api/folders`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        return { success: true, count: response.data.length };
    } catch (error) {
        return { 
            success: false, 
            status: error.response?.status, 
            message: error.response?.data?.error || error.message 
        };
    }
}

/**
 * 获取文件夹详情
 */
async function getFolderDetails(folderId) {
    try {
        const response = await axios.get(`${BASE_URL}/api/folders/${folderId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        return { success: true, folder: response.data };
    } catch (error) {
        return { 
            success: false, 
            status: error.response?.status, 
            message: error.response?.data?.error || error.message 
        };
    }
}

/**
 * 获取文件列表
 */
async function getFiles(folderId) {
    try {
        const response = await axios.get(`${BASE_URL}/api/folders/${folderId}/files`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        return { success: true, count: response.data.length };
    } catch (error) {
        return { 
            success: false, 
            status: error.response?.status, 
            message: error.response?.data?.error || error.message 
        };
    }
}

/**
 * 并发测试
 */
async function runConcurrentTest(testName, testFunc, concurrency = 10, iterations = 5) {
    console.log(`\n🧪 测试: ${testName}`);
    console.log(`   并发数: ${concurrency}, 迭代次数: ${iterations}`);
    
    let totalRequests = 0;
    let successCount = 0;
    let errorCount = 0;
    let error500Count = 0;
    const errors = {};

    for (let i = 0; i < iterations; i++) {
        const promises = [];
        for (let j = 0; j < concurrency; j++) {
            promises.push(testFunc());
            totalRequests++;
        }

        const results = await Promise.all(promises);
        
        results.forEach(result => {
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
                if (result.status === 500) {
                    error500Count++;
                }
                const errorKey = `${result.status}: ${result.message}`;
                errors[errorKey] = (errors[errorKey] || 0) + 1;
            }
        });

        // 短暂延迟，避免过度压力
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 结果统计:`);
    console.log(`   总请求数: ${totalRequests}`);
    console.log(`   成功: ${successCount} (${(successCount/totalRequests*100).toFixed(2)}%)`);
    console.log(`   失败: ${errorCount} (${(errorCount/totalRequests*100).toFixed(2)}%)`);
    console.log(`   500错误: ${error500Count} (${(error500Count/totalRequests*100).toFixed(2)}%)`);

    if (Object.keys(errors).length > 0) {
        console.log(`\n❌ 错误详情:`);
        Object.entries(errors).forEach(([error, count]) => {
            console.log(`   ${error}: ${count}次`);
        });
    }

    return { totalRequests, successCount, errorCount, error500Count };
}

/**
 * 主测试函数
 */
async function main() {
    console.log('🚀 开始并发请求测试\n');
    console.log('=' .repeat(60));

    // 登录
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.error('无法继续测试，登录失败');
        process.exit(1);
    }

    // 获取第一个文件夹ID
    const foldersResult = await getFolders();
    if (!foldersResult.success || foldersResult.count === 0) {
        console.error('无法获取文件夹列表或没有文件夹');
        process.exit(1);
    }

    const folders = await axios.get(`${BASE_URL}/api/folders`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const testFolderId = folders.data[0]?.id;

    if (!testFolderId) {
        console.error('没有可用的测试文件夹');
        process.exit(1);
    }

    console.log(`\n📁 使用测试文件夹ID: ${testFolderId}`);

    // 测试1: 获取文件夹列表
    const test1 = await runConcurrentTest(
        '获取文件夹列表',
        getFolders,
        20,
        10
    );

    // 测试2: 获取文件夹详情
    const test2 = await runConcurrentTest(
        '获取文件夹详情',
        () => getFolderDetails(testFolderId),
        20,
        10
    );

    // 测试3: 获取文件列表
    const test3 = await runConcurrentTest(
        '获取文件列表',
        () => getFiles(testFolderId),
        20,
        10
    );

    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📈 总体测试结果\n');

    const totalRequests = test1.totalRequests + test2.totalRequests + test3.totalRequests;
    const totalSuccess = test1.successCount + test2.successCount + test3.successCount;
    const totalErrors = test1.errorCount + test2.errorCount + test3.errorCount;
    const total500 = test1.error500Count + test2.error500Count + test3.error500Count;

    console.log(`总请求数: ${totalRequests}`);
    console.log(`成功率: ${(totalSuccess/totalRequests*100).toFixed(2)}%`);
    console.log(`失败率: ${(totalErrors/totalRequests*100).toFixed(2)}%`);
    console.log(`500错误率: ${(total500/totalRequests*100).toFixed(2)}%`);

    if (total500 === 0) {
        console.log('\n✅ 测试通过！没有发现500错误');
    } else {
        console.log(`\n⚠️  警告：仍然存在 ${total500} 个500错误`);
    }

    console.log('\n💡 提示: 检查 backend/logs/error.log 查看详细错误日志');
}

// 运行测试
main().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
});
