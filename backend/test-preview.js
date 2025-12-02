// 简单检查后端日志
const fs = require('fs');
const path = require('path');

console.log('检查后端日志文件...\n');

const logsDir = path.join(__dirname, 'logs');
if (fs.existsSync(logsDir)) {
    const files = fs.readdirSync(logsDir);
    const latestLog = files
        .filter(f => f.startsWith('app-'))
        .sort()
        .reverse()[0];
    
    if (latestLog) {
        const logPath = path.join(logsDir, latestLog);
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n');
        
        // 显示最后50行
        console.log(`最新日志文件: ${latestLog}`);
        console.log('最后50行:\n');
        console.log(lines.slice(-50).join('\n'));
    } else {
        console.log('没有找到日志文件');
    }
} else {
    console.log('logs 目录不存在');
}

console.log('\n\n请检查后端服务器是否正在运行，并查看控制台输出');
console.log('预览路由应该在: GET /api/folders/:id/preview/:filename');
