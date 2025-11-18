const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// 读取JSON文件
const readJSON = (filename) => {
    const fullPath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fullPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch {
        return [];
    }
};

// 写入JSON文件
const writeJSON = (filename, data) => {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
};

// 修复文件名编码
function fixFilenameEncoding(filename) {
    // 如果文件名只包含ASCII字符，直接返回
    if (!/[^\x00-\x7F]/.test(filename)) {
        return filename;
    }
    
    // 尝试修复编码
    try {
        // 检查是否已经是正确的UTF-8
        const testBuffer = Buffer.from(filename, 'utf8');
        const testString = testBuffer.toString('utf8');
        if (testString === filename) {
            return filename;
        }
    } catch (e) {
        // 继续尝试修复
    }
    
    // 尝试使用latin1解码，然后用utf8编码
    try {
        const fixed = Buffer.from(filename, 'latin1').toString('utf8');
        console.log(`尝试修复: ${filename} -> ${fixed}`);
        return fixed;
    } catch (e) {
        // 如果失败，尝试其他编码方式
        try {
            const fixed = Buffer.from(filename, 'binary').toString('utf8');
            console.log(`尝试修复: ${filename} -> ${fixed}`);
            return fixed;
        } catch (e2) {
            // 如果还是失败，返回原始文件名
            console.warn('无法修复文件名编码:', filename);
            return filename;
        }
    }
}

// 修复files.json中的文件名
function fixFilesJson() {
    const files = readJSON('files.json');
    let fixedCount = 0;
    
    files.forEach(file => {
        const originalName = file.originalName;
        const fixedName = fixFilenameEncoding(originalName);
        
        if (originalName !== fixedName) {
            console.log(`修复文件名: ${originalName} -> ${fixedName}`);
            file.originalName = fixedName;
            fixedCount++;
        }
    });
    
    if (fixedCount > 0) {
        writeJSON('files.json', files);
        console.log(`已修复 ${fixedCount} 个文件名`);
    } else {
        console.log('没有需要修复的文件名');
    }
}

// 执行修复
console.log('开始修复文件名编码...');
fixFilesJson();
console.log('修复完成');