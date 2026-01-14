const dns = require('dns');

console.log('🔍 验证 Backblaze B2 端点地址');
console.log('='.repeat(50));

// 测试不同的端点格式
const endpoints = [
    's3.us-east-005.backblazeb2.com',
    's3.us-east-001.backblazeb2.com',
    's3.us-west-001.backblazeb2.com',
    's3.us-west-002.backblazeb2.com',
    's3.us-west-004.backblazeb2.com',
    's3.eu-central-003.backblazeb2.com',
    's3.ap-southeast-002.backblazeb2.com'
];

async function testEndpoint(endpoint) {
    return new Promise((resolve) => {
        const hostname = endpoint.replace('s3.', '');
        
        dns.lookup(hostname, (err, address) => {
            if (err) {
                console.log(`❌ ${endpoint} - DNS 解析失败: ${err.message}`);
                resolve(false);
            } else {
                console.log(`✅ ${endpoint} - DNS 解析成功: ${address}`);
                resolve(true);
            }
        });
    });
}

async function main() {
    console.log('\n🌐 测试端点 DNS 解析...\n');
    
    let workingEndpoints = [];
    
    for (const endpoint of endpoints) {
        const isWorking = await testEndpoint(endpoint);
        if (isWorking) {
            workingEndpoints.push(endpoint);
        }
    }
    
    console.log('\n📋 结果总结:');
    if (workingEndpoints.length > 0) {
        console.log('✅ 可用的端点:');
        workingEndpoints.forEach(ep => console.log(`   - ${ep}`));
        
        console.log('\n💡 建议:');
        console.log('   1. 使用第一个可用的端点更新 .env 文件');
        console.log('   2. 重新测试连接');
    } else {
        console.log('❌ 所有端点都无法解析');
        console.log('💡 请检查网络连接或 DNS 设置');
    }
}

main();