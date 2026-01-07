const { exec } = require('child_process');

console.log('测试Wrangler命令输出格式...\n');

// 测试1: 不使用 --json 参数
console.log('=== 测试1: 不使用 --json 参数 ===');
exec('npx wrangler d1 execute cloudflare-demo-db --remote --command="SELECT COUNT(*) as total FROM missing_persons_cases;"', (error, stdout, stderr) => {
    console.log('原始输出:');
    console.log('----------------------------------------');
    console.log(stdout);
    console.log('----------------------------------------');
    console.log('输出长度:', stdout.length);
    console.log('前100字符:', stdout.substring(0, 100));
    
    // 测试2: 使用 --json 参数
    console.log('\n=== 测试2: 使用 --json 参数 ===');
    exec('npx wrangler d1 execute cloudflare-demo-db --remote --json --command="SELECT COUNT(*) as total FROM missing_persons_cases;"', (error2, stdout2, stderr2) => {
        console.log('JSON输出:');
        console.log('----------------------------------------');
        console.log(stdout2);
        console.log('----------------------------------------');
        console.log('输出长度:', stdout2.length);
        console.log('前100字符:', stdout2.substring(0, 100));
        
        // 测试解析
        console.log('\n=== 测试解析结果 ===');
        try {
            const result1 = JSON.parse(stdout);
            console.log('✅ 测试1解析成功');
        } catch (e1) {
            console.log('❌ 测试1解析失败:', e1.message);
            
            // 尝试提取JSON
            const jsonStart = stdout.indexOf('[');
            if (jsonStart !== -1) {
                try {
                    const cleanJson = stdout.substring(jsonStart);
                    const result = JSON.parse(cleanJson);
                    console.log('✅ 提取后解析成功');
                } catch (e2) {
                    console.log('❌ 提取后解析也失败');
                }
            }
        }
        
        try {
            const result2 = JSON.parse(stdout2);
            console.log('✅ 测试2解析成功');
        } catch (e3) {
            console.log('❌ 测试2解析失败:', e3.message);
        }
        
        console.log('\n=== 建议 ===');
        console.log('请运行修复版脚本: node auto-scrape-cases-final.js');
    });
});