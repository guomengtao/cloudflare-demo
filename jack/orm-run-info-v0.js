// 1. 必须在最顶部加载 dotenv，否则 process.env 是空的
require('dotenv').config(); 

const fetch = require('node-fetch');

// 获取环境变量
const {
  CLOUDFLARE_API_KEY,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_DATABASE_ID
} = process.env;

const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

async function queryD1(sql, params = []) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql, params })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(`D1 接口报错: ${JSON.stringify(data.errors)}`);
    }
    return data.result[0];
  } catch (error) {
    throw new Error(`请求执行失败: ${error.message}`);
  }
}

async function processNextCase() {
  console.log('--- 🚀 开始处理新任务 (API 模式) ---');

  // 验证环境变量是否读取成功
  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID) {
    console.error('❌ 错误: 无法读取环境变量。');
    console.log('当前读取到的配置：', {
      API_KEY: CLOUDFLARE_API_KEY ? '已获取' : '缺失',
      ACCOUNT_ID: CLOUDFLARE_ACCOUNT_ID ? '已获取' : '缺失',
      DATABASE_ID: CLOUDFLARE_DATABASE_ID ? '已获取' : '缺失'
    });
    return;
  }

  try {
    const selectQuery = `
      SELECT id, case_id, case_url, case_title, analysis_result 
      FROM missing_persons_cases 
      WHERE process_code IS NULL 
      LIMIT 1
    `;
    
    const selectResult = await queryD1(selectQuery);
    const targetCase = selectResult?.results?.[0];

    if (!targetCase) {
      console.log('📭 队列为空：没有待处理案件。');
      return null;
    }

    const updateQuery = `UPDATE missing_persons_cases SET process_code = 22, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await queryD1(updateQuery, [targetCase.id]);

    console.log('✅ 任务锁定成功！');
    console.log('--------------------------------------------------');
    console.table({
      '数据库ID': targetCase.id,
      '核心标识': targetCase.case_id,
      '案件标题': targetCase.case_title || '（无标题）'
    });
    console.log(`🔗 URL: ${targetCase.case_url}`);
    console.log('--------------------------------------------------\n');

    return targetCase;

  } catch (error) {
    console.error('❌ 流程出错:', error.message);
  }
}

processNextCase();