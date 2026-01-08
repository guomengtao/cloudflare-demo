// 最小的命令行工具：调用Cloudflare AI服务
const dotenv = require('dotenv');
const path = require('path');

// 尝试加载环境变量并添加调试信息
console.log('正在加载环境变量...');
console.log('当前工作目录:', process.cwd());
console.log('.env文件路径:', path.resolve(__dirname, '../.env'));

const result = dotenv.config({ 
  path: path.resolve(__dirname, '../.env'),
  debug: true // 开启debug模式
});

if (result.error) {
  console.error('❌ 加载.env文件失败:', result.error.message);
  process.exit(1);
}

// 默认问题
const DEFAULT_QUESTION = '现在是什么时间？';

// 从环境变量获取Cloudflare配置
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

// 打印加载的环境变量（仅用于调试）
console.log('加载的CLOUDFLARE_API_KEY:', CLOUDFLARE_API_KEY ? '已加载' : '未加载');
console.log('加载的CLOUDFLARE_ACCOUNT_ID:', CLOUDFLARE_ACCOUNT_ID ? '已加载' : '未加载');

// 检查必要的环境变量
if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID) {
    console.error('❌ 缺少必要的Cloudflare环境变量');
    console.error('当前环境变量:', JSON.stringify(process.env, null, 2));
    process.exit(1);
}

// Cloudflare AI API 端点（使用与curl相同的模型）
const AI_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-3b-instruct`;

// 主函数
async function main() {
    try {
        // 获取用户输入的问题，没有则使用默认问题
        const question = process.argv[2] || DEFAULT_QUESTION;
        
        console.log(`🤖 正在向Cloudflare AI提问: "${question}"`);
        
        // 发送请求到Cloudflare AI API（使用与curl相同的请求格式）
        const response = await fetch(AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`
            },
            body: JSON.stringify({
                prompt: question // 使用与curl相同的prompt参数格式
            }),
            timeout: 30000 // 30秒超时
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP错误! 状态码: ${response.status}, 错误信息: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(`API错误: ${JSON.stringify(data.errors)}`);
        }
        
        // 显示AI的回答
        console.log('\n✨ AI回答:');
        console.log(data.result.response);
        
        // 显示使用情况
        console.log('\n📊 使用情况:');
        console.log(`   提示词 tokens: ${data.result.usage.prompt_tokens}`);
        console.log(`   回答 tokens: ${data.result.usage.completion_tokens}`);
        console.log(`   总 tokens: ${data.result.usage.total_tokens}`);
        
    } catch (error) {
        console.error(`❌ 发生错误: ${error.message}`);
        process.exit(1);
    }
}

// 执行主函数
main();