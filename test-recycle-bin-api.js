/**
 * 测试回收站API
 */
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testRecycleBinAPI() {
    try {
        console.log('测试回收站API...\n');

        // 1. 先登录获取token
        console.log('1. 登录...');
        const loginResponse = await axios.post(`${API_BASE}/users/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('✓ 登录成功，获取到token\n');

        // 2. 测试获取回收站列表
        console.log('2. 获取回收站列表...');
        const recycleBinResponse = await axios.get(`${API_BASE}/folders/trash`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✓ API响应状态:', recycleBinResponse.status);
        console.log('✓ 响应数据结构:', JSON.stringify(recycleBinResponse.data, null, 2));
        
        if (recycleBinResponse.data.success && recycleBinResponse.data.data) {
            console.log(`\n✓ 回收站文件数量: ${recycleBinResponse.data.data.length}`);
            
            if (recycleBinResponse.data.data.length > 0) {
                console.log('\n文件列表:');
                recycleBinResponse.data.data.forEach((file, index) => {
                    console.log(`  ${index + 1}. ${file.originalName || file.name} (ID: ${file.id})`);
                });
            }
        } else {
            console.log('✗ 响应格式不正确');
        }

    } catch (error) {
        console.error('✗ 测试失败:', error.message);
        if (error.response) {
            console.error('  状态码:', error.response.status);
            console.error('  响应数据:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testRecycleBinAPI();
