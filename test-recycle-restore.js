/**
 * 回收站还原功能测试脚本
 * 测试复杂的文件夹层级删除和还原场景
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
let authToken = '';

// 测试用户凭证
const TEST_USER = {
    username: 'admin',
    password: 'admin123'
};

// 辅助函数：登录
async function login() {
    try {
        const response = await axios.post(`${API_BASE}/users/login`, TEST_USER);
        authToken = response.data.token;
        console.log('✓ 登录成功');
        return true;
    } catch (error) {
        console.error('✗ 登录失败:', error.response?.data || error.message);
        return false;
    }
}

// 辅助函数：创建请求配置
function getConfig() {
    return {
        headers: { Authorization: `Bearer ${authToken}` }
    };
}

// 辅助函数：创建文件夹
async function createFolder(alias, parentId = null) {
    try {
        const response = await axios.post(
            `${API_BASE}/folders`,
            { alias, parentId },
            getConfig()
        );
        console.log(`✓ 创建文件夹: ${alias} (ID: ${response.data.id})`);
        return response.data;
    } catch (error) {
        console.error(`✗ 创建文件夹失败: ${alias}`, error.response?.data || error.message);
        return null;
    }
}

// 辅助函数：上传文件
async function uploadFile(folderId, fileName, content = 'test content') {
    try {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('files', Buffer.from(content), fileName);

        const response = await axios.post(
            `${API_BASE}/folders/${folderId}/upload`,
            form,
            {
                ...getConfig(),
                headers: {
                    ...getConfig().headers,
                    ...form.getHeaders()
                }
            }
        );
        console.log(`✓ 上传文件: ${fileName} 到文件夹 ${folderId}`);
        return response.data;
    } catch (error) {
        console.error(`✗ 上传文件失败: ${fileName}`, error.response?.data || error.message);
        return null;
    }
}

// 辅助函数：删除文件
async function deleteFile(folderId, filename) {
    try {
        const response = await axios.delete(
            `${API_BASE}/folders/${folderId}/file`,
            {
                ...getConfig(),
                data: { filename }
            }
        );
        console.log(`✓ 删除文件: ${filename}`);
        return response.data;
    } catch (error) {
        console.error(`✗ 删除文件失败: ${filename}`, error.response?.data || error.message);
        return null;
    }
}

// 辅助函数：删除文件夹
async function deleteFolder(folderId) {
    try {
        const response = await axios.delete(
            `${API_BASE}/folders/${folderId}`,
            getConfig()
        );
        console.log(`✓ 删除文件夹: ID ${folderId}`);
        return response.data;
    } catch (error) {
        console.error(`✗ 删除文件夹失败: ID ${folderId}`, error.response?.data || error.message);
        return null;
    }
}

// 辅助函数：获取回收站列表
async function getRecycleBin() {
    try {
        const response = await axios.get(
            `${API_BASE}/folders/trash`,
            getConfig()
        );
        console.log(`✓ 获取回收站列表: ${response.data.data.length} 项`);
        return response.data.data;
    } catch (error) {
        console.error('✗ 获取回收站列表失败:', error.response?.data || error.message);
        return [];
    }
}

// 辅助函数：还原项目
async function restoreItem(itemId) {
    try {
        const response = await axios.post(
            `${API_BASE}/folders/trash/restore/${itemId}`,
            {},
            getConfig()
        );
        console.log(`✓ 还原成功: ${response.data.message}`);
        return response.data;
    } catch (error) {
        console.error(`✗ 还原失败: ID ${itemId}`, error.response?.data || error.message);
        return null;
    }
}

// 辅助函数：获取文件夹列表
async function getFolders() {
    try {
        const response = await axios.get(
            `${API_BASE}/folders`,
            getConfig()
        );
        return response.data;
    } catch (error) {
        console.error('✗ 获取文件夹列表失败:', error.response?.data || error.message);
        return [];
    }
}

// 测试场景1：按删除顺序还原
async function testScenario1() {
    console.log('\n========== 测试场景1：按删除顺序还原 ==========\n');

    // 1. 创建结构
    console.log('步骤1: 创建文件夹结构');
    const folder = await createFolder('测试文件夹1');
    if (!folder) return;

    const subFolder = await createFolder('测试子文件夹1', folder.id);
    if (!subFolder) return;

    // 2. 上传文件
    console.log('\n步骤2: 上传文件');
    await uploadFile(subFolder.id, 'fileA.txt', 'Content A');
    await uploadFile(subFolder.id, 'fileB.txt', 'Content B');
    await uploadFile(folder.id, 'fileC.txt', 'Content C');

    // 3. 按顺序删除
    console.log('\n步骤3: 按顺序删除');
    await deleteFile(subFolder.id, 'fileA.txt');
    await new Promise(resolve => setTimeout(resolve, 500));
    await deleteFolder(subFolder.id);
    await new Promise(resolve => setTimeout(resolve, 500));
    await deleteFolder(folder.id);

    // 4. 获取回收站
    console.log('\n步骤4: 查看回收站');
    const recycleBin = await getRecycleBin();
    
    // 5. 按顺序还原
    console.log('\n步骤5: 按删除顺序还原');
    for (const item of recycleBin) {
        await restoreItem(item.id);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 6. 查看结果
    console.log('\n步骤6: 查看还原结果');
    const folders = await getFolders();
    console.log('当前文件夹列表:');
    folders.forEach(f => {
        console.log(`  - ${f.alias} (ID: ${f.id}, 父ID: ${f.parentId || '无'})`);
    });
}

// 测试场景2：逆序还原
async function testScenario2() {
    console.log('\n========== 测试场景2：逆序还原 ==========\n');

    // 1. 创建结构
    console.log('步骤1: 创建文件夹结构');
    const folder = await createFolder('测试文件夹2');
    if (!folder) return;

    const subFolder = await createFolder('测试子文件夹2', folder.id);
    if (!subFolder) return;

    // 2. 上传文件
    console.log('\n步骤2: 上传文件');
    await uploadFile(subFolder.id, 'fileX.txt', 'Content X');
    await uploadFile(subFolder.id, 'fileY.txt', 'Content Y');
    await uploadFile(folder.id, 'fileZ.txt', 'Content Z');

    // 3. 按顺序删除
    console.log('\n步骤3: 按顺序删除');
    await deleteFile(subFolder.id, 'fileX.txt');
    await new Promise(resolve => setTimeout(resolve, 500));
    await deleteFolder(subFolder.id);
    await new Promise(resolve => setTimeout(resolve, 500));
    await deleteFolder(folder.id);

    // 4. 获取回收站
    console.log('\n步骤4: 查看回收站');
    let recycleBin = await getRecycleBin();
    recycleBin = recycleBin.filter(item => 
        item.folderAlias?.includes('测试文件夹2') || 
        item.originalName?.includes('file')
    );

    // 5. 逆序还原
    console.log('\n步骤5: 逆序还原');
    for (let i = recycleBin.length - 1; i >= 0; i--) {
        await restoreItem(recycleBin[i].id);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 6. 查看结果
    console.log('\n步骤6: 查看还原结果');
    const folders = await getFolders();
    console.log('当前文件夹列表:');
    folders.forEach(f => {
        if (f.alias.includes('测试文件夹2')) {
            console.log(`  - ${f.alias} (ID: ${f.id}, 父ID: ${f.parentId || '无'})`);
        }
    });
}

// 主测试函数
async function runTests() {
    console.log('开始测试回收站还原功能\n');

    // 登录
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.error('登录失败，测试终止');
        return;
    }

    try {
        // 运行测试场景
        await testScenario1();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await testScenario2();

        console.log('\n========== 测试完成 ==========\n');
        console.log('请检查：');
        console.log('1. 文件夹是否正确还原');
        console.log('2. 重复的文件夹是否添加了序号');
        console.log('3. 所有文件是否都能找到');
    } catch (error) {
        console.error('测试过程中出错:', error);
    }
}

// 运行测试
runTests().catch(console.error);
