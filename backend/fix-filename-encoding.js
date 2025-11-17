const fs = require('fs');
const path = require('path');

// 读取files.json文件
const filePath = path.join(__dirname, 'data/files.json');

try {
    // 读取文件内容
    const buffer = fs.readFileSync(filePath);
    const data = buffer.toString('utf8');
    const files = JSON.parse(data);
    
    // 修复每个文件的originalName
    const fixedFiles = files.map(file => {
        // 如果文件名包含乱码字符，尝试修复
        if (file.originalName && /[\u00c0-\u00ff]/.test(file.originalName)) {
            // 将乱码字符转换为正确的UTF-8编码
            try {
                // 使用latin1编码读取，然后转换为utf8
                const fixedName = Buffer.from(file.originalName, 'latin1').toString('utf8');
                file.originalName = fixedName;
                console.log(`修复文件名: ${file.originalName} -> ${fixedName}`);
            } catch (e) {
                console.error(`修复文件名失败: ${file.originalName}`, e);
            }
        }
        return file;
    });
    
    // 写回文件，确保使用UTF-8编码
    const jsonString = JSON.stringify(fixedFiles, null, 2);
    const bufferOut = Buffer.from(jsonString, 'utf8');
    fs.writeFileSync(filePath, bufferOut);
    
    console.log('文件名修复完成');
} catch (error) {
    console.error('修复文件名失败:', error);
}