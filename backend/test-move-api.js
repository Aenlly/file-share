/**
 * 测试文件移动API
 */

const axios = require('axios');

async function testMoveAPI() {
    try {
        console.log('测试文件移动API...\n');

        // 1. 登录获取token
        console.log('1. 登录...');
        const loginResponse = await axios.post('http://localhost:8001/api/users/login', {
            username: 'admin',
            password: 'admin'
        });

        const token = loginResponse.data.token;
        console.log(`✓ 登录成功，token: ${token.substring(0, 20)}...\n`);

        // 2. 创建axios实例，带上token
        const api = axios.create({
            baseURL: 'http://localhost:8001/api',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // 3. 获取所有文件夹
        console.log('2. 获取所有文件夹...');
        const foldersResponse = await api.get('/folders');
        const folders = foldersResponse.data;
        console.log(`✓ 获取到 ${folders.length} 个文件夹`);
        
        if (folders.length < 2) {
            console.log('⚠ 需要至少2个文件夹来测试移动功能');
            console.log('创建测试文件夹...');
            
            const folder1 = await api.post('/folders', { alias: '源文件夹' });
            const folder2 = await api.post('/folders', { alias: '目标文件夹' });
            
            console.log(`✓ 创建了文件夹: ${folder1.data.id}, ${folder2.data.id}\n`);
            
            folders.push(folder1.data);
            folders.push(folder2.data);
        }

        const sourceFolderId = folders[0].id;
        const targetFolderId = folders[1].id;

        console.log(`源文件夹: ${sourceFolderId} (${folders[0].alias})`);
        console.log(`目标文件夹: ${targetFolderId} (${folders[1].alias})\n`);

        // 4. 上传测试文件
        console.log('3. 上传测试文件...');
        const FormData = require('form-data');
        const fs = require('fs');
        
        // 创建临时文件
        const testFile = '/tmp/test.txt';
        fs.writeFileSync(testFile, 'test content');

        const formData = new FormData();
        formData.append('files', fs.createReadStream(testFile));

        const uploadResponse = await api.post(`/folders/${sourceFolderId}/upload`, formData, {
            headers: formData.getHeaders()
        });

        const uploadedFile = uploadResponse.data.uploadedFiles[0];
        console.log(`✓ 上传成功: ${uploadedFile.originalName}\n`);

        // 5. 测试文件移动API
        console.log('4. 测试文件移动API...');
        console.log(`POST /api/folders/${sourceFolderId}/move`);
        console.log(`Body: { filename: "${uploadedFile.originalName}", targetFolderId: ${targetFolderId} }\n`);

        const moveResponse = await api.post(`/folders/${sourceFolderId}/move`, {
            filename: uploadedFile.originalName,
            targetFolderId: targetFolderId
        });

        console.log('✓ 文件移动成功！');
        console.log('响应:', JSON.stringify(moveResponse.data, null, 2));

        // 清理
        fs.unlinkSync(testFile);

    } catch (error) {
        console.error('❌ 测试失败:');
        if (error.response) {
            console.error(`状态码: ${error.response.status}`);
            console.error(`错误: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

testMoveAPI();
