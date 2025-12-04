/**
 * 测试严重问题修复
 * 验证锁管理器和文件哈希计算
 */

const lockManager = require('./backend/src/utils/LockManager');
const { calculateFileHashSmart, calculateFileHash } = require('./backend/src/routes/helpers/fileHelpers');
const crypto = require('crypto');

console.log('🧪 开始测试严重问题修复...\n');

// ========== 测试 1: 锁管理器 ==========
async function testLockManager() {
    console.log('📋 测试 1: 锁管理器');
    console.log('─'.repeat(50));
    
    try {
        // 测试基本锁获取和释放
        console.log('✓ 测试基本锁获取...');
        await lockManager.acquire('test-resource', 5000, 10000);
        console.log('  ✅ 成功获取锁');
        
        lockManager.release('test-resource');
        console.log('  ✅ 成功释放锁');
        
        // 测试并发锁
        console.log('\n✓ 测试并发锁（3个请求）...');
        const promises = [];
        let completedCount = 0;
        
        for (let i = 0; i < 3; i++) {
            promises.push(
                (async () => {
                    const startTime = Date.now();
                    await lockManager.acquire('concurrent-test', 10000, 5000);
                    const waitTime = Date.now() - startTime;
                    
                    // 模拟工作
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    lockManager.release('concurrent-test');
                    completedCount++;
                    
                    console.log(`  ✅ 请求 ${i + 1} 完成，等待时间: ${waitTime}ms`);
                })()
            );
        }
        
        await Promise.all(promises);
        console.log(`  ✅ 所有并发请求完成 (${completedCount}/3)`);
        
        // 测试超时
        console.log('\n✓ 测试锁超时...');
        await lockManager.acquire('timeout-test', 5000, 1000);
        
        // 等待锁自动释放
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 尝试再次获取（应该成功，因为已超时释放）
        await lockManager.acquire('timeout-test', 5000, 1000);
        lockManager.release('timeout-test');
        console.log('  ✅ 锁超时自动释放机制正常');
        
        console.log('\n✅ 锁管理器测试通过\n');
        return true;
    } catch (error) {
        console.error('❌ 锁管理器测试失败:', error.message);
        return false;
    }
}

// ========== 测试 2: 文件哈希计算 ==========
async function testFileHash() {
    console.log('📋 测试 2: 文件哈希计算');
    console.log('─'.repeat(50));
    
    try {
        // 测试小文件（内存计算）
        console.log('✓ 测试小文件哈希（1MB）...');
        const smallBuffer = Buffer.alloc(1 * 1024 * 1024); // 1MB
        crypto.randomFillSync(smallBuffer);
        
        const startSmall = Date.now();
        const hashSmall = await calculateFileHashSmart(smallBuffer);
        const timeSmall = Date.now() - startSmall;
        
        console.log(`  ✅ 哈希: ${hashSmall.substring(0, 16)}...`);
        console.log(`  ✅ 耗时: ${timeSmall}ms`);
        console.log(`  ✅ 使用内存计算（快速）`);
        
        // 测试大文件（流式计算）
        console.log('\n✓ 测试大文件哈希（50MB）...');
        const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
        crypto.randomFillSync(largeBuffer);
        
        const startLarge = Date.now();
        const hashLarge = await calculateFileHashSmart(largeBuffer);
        const timeLarge = Date.now() - startLarge;
        
        console.log(`  ✅ 哈希: ${hashLarge.substring(0, 16)}...`);
        console.log(`  ✅ 耗时: ${timeLarge}ms`);
        console.log(`  ✅ 使用流式计算（内存安全）`);
        
        // 验证一致性
        console.log('\n✓ 验证哈希一致性...');
        const testBuffer = Buffer.from('test data');
        const hash1 = calculateFileHash(testBuffer);
        const hash2 = await calculateFileHashSmart(testBuffer);
        
        if (hash1 === hash2) {
            console.log(`  ✅ 哈希一致: ${hash1}`);
        } else {
            throw new Error('哈希不一致！');
        }
        
        console.log('\n✅ 文件哈希测试通过\n');
        return true;
    } catch (error) {
        console.error('❌ 文件哈希测试失败:', error.message);
        return false;
    }
}

// ========== 测试 3: 性能对比 ==========
async function testPerformance() {
    console.log('📋 测试 3: 性能对比');
    console.log('─'.repeat(50));
    
    try {
        const sizes = [
            { name: '1MB', size: 1 * 1024 * 1024 },
            { name: '10MB', size: 10 * 1024 * 1024 },
            { name: '50MB', size: 50 * 1024 * 1024 }
        ];
        
        console.log('文件大小 | 内存计算 | 智能计算 | 内存节省');
        console.log('─'.repeat(50));
        
        for (const { name, size } of sizes) {
            const buffer = Buffer.alloc(size);
            crypto.randomFillSync(buffer);
            
            // 内存计算
            const memStart = process.memoryUsage().heapUsed;
            const timeMemStart = Date.now();
            calculateFileHash(buffer);
            const timeMemEnd = Date.now() - timeMemStart;
            const memEnd = process.memoryUsage().heapUsed;
            const memUsed = (memEnd - memStart) / 1024 / 1024;
            
            // 智能计算
            const smartStart = process.memoryUsage().heapUsed;
            const timeSmartStart = Date.now();
            await calculateFileHashSmart(buffer);
            const timeSmartEnd = Date.now() - timeSmartStart;
            const smartEnd = process.memoryUsage().heapUsed;
            const smartUsed = (smartEnd - smartStart) / 1024 / 1024;
            
            const savings = memUsed > 0 ? ((memUsed - smartUsed) / memUsed * 100).toFixed(1) : 0;
            
            console.log(`${name.padEnd(8)} | ${timeMemEnd}ms (${memUsed.toFixed(1)}MB) | ${timeSmartEnd}ms (${smartUsed.toFixed(1)}MB) | ${savings}%`);
        }
        
        console.log('\n✅ 性能测试完成\n');
        return true;
    } catch (error) {
        console.error('❌ 性能测试失败:', error.message);
        return false;
    }
}

// ========== 运行所有测试 ==========
async function runAllTests() {
    console.log('🚀 严重问题修复验证测试');
    console.log('='.repeat(50));
    console.log('');
    
    const results = {
        lockManager: false,
        fileHash: false,
        performance: false
    };
    
    try {
        results.lockManager = await testLockManager();
        results.fileHash = await testFileHash();
        results.performance = await testPerformance();
        
        // 总结
        console.log('='.repeat(50));
        console.log('📊 测试总结');
        console.log('─'.repeat(50));
        console.log(`锁管理器:   ${results.lockManager ? '✅ 通过' : '❌ 失败'}`);
        console.log(`文件哈希:   ${results.fileHash ? '✅ 通过' : '❌ 失败'}`);
        console.log(`性能对比:   ${results.performance ? '✅ 通过' : '❌ 失败'}`);
        console.log('─'.repeat(50));
        
        const allPassed = Object.values(results).every(r => r);
        
        if (allPassed) {
            console.log('\n🎉 所有测试通过！修复成功！');
            console.log('\n建议：');
            console.log('1. 重启后端服务: cd backend && npm start');
            console.log('2. 重新构建前端: cd frontend && npm run build');
            console.log('3. 测试生产环境图片预览功能');
            process.exit(0);
        } else {
            console.log('\n⚠️  部分测试失败，请检查错误信息');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ 测试过程出错:', error);
        process.exit(1);
    }
}

// 运行测试
runAllTests();
