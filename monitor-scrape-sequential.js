
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 监控数据库状态（使用Wrangler --file模式）
async function monitorDatabase() {
    return new Promise((resolve) => {
        try {
            // 创建SQL文件内容
            const sqlContent = '-- 监控数据库状态\nSELECT COUNT(*) as total, COUNT(CASE WHEN scraped_content IS NULL OR scraped_content = \'\' THEN 1 END) as pending FROM missing_persons_cases;';
            
            // 生成临时SQL文件路径
            const tempSqlPath = path.join(__dirname, \'monitor_\' + Date.now() + \'.sql\');
            
            // 写入SQL文件
            fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
            
            // 使用Wrangler --file模式执行
            const command = 'npx wrangler d1 execute cloudflare-demo-db --remote --json --file="' + tempSqlPath + '"';
            
            // 设置maxBuffer为10MB
            const options = {
                maxBuffer: 10 * 1024 * 1024
            };
            
            exec(command, options, (error, stdout) => {
                // 清理临时文件
                try {
                    if (fs.existsSync(tempSqlPath)) {
                        fs.unlinkSync(tempSqlPath);
                    }
                } catch (cleanupError) {
                    console.warn('清理监控文件时警告:', cleanupError.message);
                }
                
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
        } catch (error) {
            console.error('监控文件操作错误:', error);
            resolve();
        }
    });
}

// 每5分钟监控一次
setInterval(monitorDatabase, 5 * 60 * 1000);
monitorDatabase();
