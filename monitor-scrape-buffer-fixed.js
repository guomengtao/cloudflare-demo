
const { exec } = require('child_process');

// 监控数据库状态（使用 --json 参数，增加缓冲区）
async function monitorDatabase() {
    return new Promise((resolve) => {
        const command = 'npx wrangler d1 execute cloudflare-demo-db --remote --json --command="SELECT COUNT(*) as total, COUNT(CASE WHEN scraped_content IS NULL OR scraped_content = \'\' THEN 1 END) as pending FROM missing_persons_cases;"';
        
        // 增加缓冲区大小
        const options = {
            maxBuffer: 10 * 1024 * 1024 // 10MB缓冲区
        };
        
        exec(command, options, (error, stdout) => {
            if (error) {
                console.error('监控错误:', error);
            } else {
                try {
                    const result = JSON.parse(stdout);
                    if (result[0] && result[0].results) {
                        const stats = result[0].results[0];
                        console.log('数据库状态监控:');
                        console.log('- 总案件数:', stats.total);
                        console.log('- 待抓取数:', stats.pending);
                        console.log('- 已完成数:', stats.total - stats.pending);
                        console.log('- 完成率:', ((stats.total - stats.pending) / stats.total * 100).toFixed(2) + '%');
                    }
                } catch (e) {
                    console.log('监控数据解析失败');
                }
            }
            resolve();
        });
    });
}

// 每5分钟监控一次
setInterval(monitorDatabase, 5 * 60 * 1000);
monitorDatabase();
