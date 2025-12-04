/**
 * 测试回收站层级还原功能
 * 验证子文件夹能正确还原到父文件夹下
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
let authToken = '';

const TEST_USER = {
    username: 'admin',
    password: 'admin123'
};

function getConfig() {
    return {
        headers: { Authorization: `Bearer ${authToken}` }
    };
}

async function login() {
    try {
        const response = await axios.post(`${API_BASE}/users/login`, TEST_USER);
        authToken = response.data.token;
        console.log('✓ 登录成功\n');
        return true;
    } catch (error) {
        console.error('✗ 登录失败:', error.response?.data || error.message);
        return false;
    }
}

async function createFolder(alias, parentId = null) {
    try {
        const response = await axios.post(
            `${API_BASE}/folders`,
            { alias, parentId },
            getConfig()
        );
        console.log(`✓ 创建文件夹: ${alias} (ID: ${response.data.id}, 父ID: ${parentId || '无'})`);
        return response.data;
    } catch (error) {
        console.error(`✗ 创建文件夹失败: ${alias}`, error.response?.data || error.message);
        return null;
    }
}

async function deleteFolder(folderId, name) {
    try {
        await axios.delete(`${API_BASE}/folders/${folderId}`, getConfig());
        console.log(`✓ 删除文件夹: ${name} (ID: ${folderId})`);
        return true;
    } catch (error) {
        console.error(`✗ 删除文件夹失败: ${name}`, error.response?.data || error.message);
        return false;
    }
}

async function getRecycleBin() {
    try {
        const response = await axios.get(`${API_BASE}/folders/trash`, getConfig());
        return response.data.data;
    } catch (error) {
        console.error('✗ 获取回收站失败:', error.response?.data || error.message);
        return [];
    }
}

async function restoreItem(itemId, name) {
    try {
        const response = await axios.post(
            `${API_BASE}/folders/trash/restore/${itemId}`,
            {},
            getConfig()
        );
        console.log(`✓ 还原成功: ${name} - ${response.data.message}`);
        return true;
    } catch (error) {
        console.error(`✗ 还原失败: ${name}`, error.response?.data || error.message);
        return false;
    }
}

async function getFolders() {
    try {
        const response = await axios.get(`${API_BASE}/folders`, getConfig());
        return response.data;
    } catch (error) {
        console.error('✗ 获取文件夹列表失败:', error.response?.data || error.message);
        return [];
    }
}

function displayFolderTree(folders) {
    const folderMap = {};
    folders.forEach(f => {
        folderMap[f.id] = { ...f, children: [] };
    });

    const roots = [];
    folders.forEach(f => {
        if (f.parentId && folderMap[f.parentId]) {
            folderMap[f.parentId].children.push(folderMap[f.id]);
        } else {
            roots.push(folderMap[f.id]);
        }
    });

    function printTree(folder, indent = '') {
        console.log(`${indent}${folder.alias} (ID: ${folder.id})`);
        folder.children.forEach(child => {
            printTree(child, indent + '  └── ');
        });
    }

    console.log('\n当前文件夹结构:');
    roots.forEach(root => printTree(root));
}

// 测试场景1：两层结构
async function testTwoLevelHierarchy() {
    console.log('========== 测试场景1：两层结构 ==========\n');

    // 1. 创建结构
    console.log('步骤1: 创建文件夹结构');
    const parent = await createFolder('父文件夹');
    if (!parent) return;

    const child = await createFolder('子文件夹', parent.id);
    if (!child) return;

    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. 删除
    console.log('\n步骤2: 删除文件夹');
    await deleteFolder(child.id, '子文件夹');
    await new Promise(resolve => setTimeout(resolve, 500));
    await deleteFolder(parent.id, '父文件夹');
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. 还原子文件夹
    console.log('\n步骤3: 还原子文件夹');
    const recycleBin = await getRecycleBin();
    const childItem = recycleBin.find(item => item.folderAlias === '子文件夹');
    if (childItem) {
        await restoreItem(childItem.id, '子文件夹');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. 查看结果
    console.log('\n步骤4: 查看结果');
    const folders = await getFolders();
    const testFolders = folders.filter(f => 
        f.alias === '父文件夹' || f.alias === '子文件夹'
    );
    displayFolderTree(testFolders);

    // 5. 验证
    const restoredChild = testFolders.find(f => f.alias === '子文件夹');
    const restoredParent = testFolders.find(f => f.alias === '父文件夹');
    
    console.log('\n验证结果:');
    if (restoredParent) {
        console.log('✓ 父文件夹已自动创建');
    } else {
        console.log('✗ 父文件夹未创建');
    }
    
    if (restoredChild && restoredChild.parentId === restoredParent?.id) {
        console.log('✓ 子文件夹正确还原到父文件夹下');
    } else {
        console.log('✗ 子文件夹层级关系错误');
        console.log(`  子文件夹的 parentId: ${restoredChild?.parentId}`);
        console.log(`  父文件夹的 id: ${restoredParent?.id}`);
    }
}

// 测试场景2：三层结构
async function testThreeLevelHierarchy() {
    console.log('\n\n========== 测试场景2：三层结构 ==========\n');

    // 1. 创建结构
    console.log('步骤1: 创建三层文件夹结构');
    const level1 = await createFolder('一级文件夹');
    if (!level1) return;

    const level2 = await createFolder('二级文件夹', level1.id);
    if (!level2) return;

    const level3 = await createFolder('三级文件夹', level2.id);
    if (!level3) return;

    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. 删除
    console.log('\n步骤2: 从底层开始删除');
    await deleteFolder(level3.id, '三级文件夹');
    await new Promise(resolve => setTimeout(resolve, 500));
    await deleteFolder(level2.id, '二级文件夹');
    await new Promise(resolve => setTimeout(resolve, 500));
    await deleteFolder(level1.id, '一级文件夹');
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. 还原最底层
    console.log('\n步骤3: 还原三级文件夹');
    const recycleBin = await getRecycleBin();
    const level3Item = recycleBin.find(item => item.folderAlias === '三级文件夹');
    if (level3Item) {
        await restoreItem(level3Item.id, '三级文件夹');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. 查看结果
    console.log('\n步骤4: 查看结果');
    const folders = await getFolders();
    const testFolders = folders.filter(f => 
        f.alias.includes('级文件夹')
    );
    displayFolderTree(testFolders);

    // 5. 验证
    const restored1 = testFolders.find(f => f.alias === '一级文件夹');
    const restored2 = testFolders.find(f => f.alias === '二级文件夹');
    const restored3 = testFolders.find(f => f.alias === '三级文件夹');
    
    console.log('\n验证结果:');
    if (restored1 && restored2 && restored3) {
        console.log('✓ 所有层级的文件夹都已创建');
        
        if (restored2.parentId === restored1.id && restored3.parentId === restored2.id) {
            console.log('✓ 三层层级关系正确');
        } else {
            console.log('✗ 层级关系错误');
            console.log(`  一级 ID: ${restored1.id}`);
            console.log(`  二级 parentId: ${restored2.parentId} (应该是 ${restored1.id})`);
            console.log(`  三级 parentId: ${restored3.parentId} (应该是 ${restored2.id})`);
        }
    } else {
        console.log('✗ 部分文件夹未创建');
    }
}

// 主测试函数
async function runTests() {
    console.log('开始测试回收站层级还原功能\n');

    const loginSuccess = await login();
    if (!loginSuccess) {
        console.error('登录失败，测试终止');
        return;
    }

    try {
        await testTwoLevelHierarchy();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await testThreeLevelHierarchy();

        console.log('\n\n========== 测试完成 ==========\n');
    } catch (error) {
        console.error('测试过程中出错:', error);
    }
}

runTests().catch(console.error);
