const { drizzle } = require('drizzle-orm/d1');
const { integer, text } = require('drizzle-orm/sqlite-core');
const { execSync } = require('child_process');

// 1. 定义表结构 (使用 SQLite 核心类型)
const missingPersonsCases = {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseUrl: text('case_url').notNull().unique(),
  caseTitle: text('case_title'),
  scrapedContent: text('scraped_content'),
  analysisResult: text('analysis_result'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at')
};

const generationHistory = {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: integer('case_id'),
  targetLanguage: text('target_language').notNull(),
  generatedContent: text('generated_content'),
  createdAt: text('created_at')
};

// 2. 连接到 Cloudflare D1 数据库
// 注意：在实际的 Cloudflare Worker 环境中，你会使用 env.DB
// 但在 Node.js 环境中，我们需要使用 wrangler 命令来执行查询
function connectToDatabase() {
  console.log('🔄 连接到 Cloudflare D1 数据库...');
  console.log('📦 数据库名称: cloudflare-demo-db');
  console.log('🆔 数据库 ID: 1c5802dd-3bd6-4804-9209-8bc4c26cc40b');
  console.log('✅ 数据库连接配置完成\n');
}

// 3. 执行简单的查询操作
function runSimpleQuery() {
  console.log('🔍 执行简单查询: 获取前 5 个案件');
  
  try {
    // 使用 wrangler 命令执行 SQL 查询
    const query = "SELECT id, case_url, case_title, created_at FROM missing_persons_cases LIMIT 5";
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="${query}"`;
    
    console.log('💻 执行命令:', command.substring(0, 100) + '...');
    
    // 执行命令并获取输出
    const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
    
    // 解析输出
    const result = JSON.parse(output);
    const cases = result[0]?.results || [];
    
    console.log('📊 查询结果:');
    if (cases.length === 0) {
      console.log('   ❌ 没有找到任何案件');
    } else {
      cases.forEach((caseItem, index) => {
        console.log(`   ${index + 1}. ID: ${caseItem.id}`);
        console.log(`      标题: ${caseItem.case_title || '未提供'}`);
        console.log(`      URL: ${caseItem.case_url}`);
        console.log(`      创建时间: ${new Date(caseItem.created_at).toLocaleString()}`);
        console.log('   ');
      });
    }
    
    return cases;
    
  } catch (error) {
    console.error('❌ 查询执行失败:', error.message);
    if (error.stdout) console.error('标准输出:', error.stdout);
    if (error.stderr) console.error('标准错误:', error.stderr);
    return [];
  }
}

// 4. 获取数据库统计信息
function getDatabaseStats() {
  console.log('📈 获取数据库统计信息');
  
  try {
    // 查询表的行数
    const query = "SELECT COUNT(*) as total_cases FROM missing_persons_cases";
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="${query}"`;
    
    const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
    const result = JSON.parse(output);
    const stats = result[0]?.results[0] || { total_cases: 0 };
    
    console.log('📊 数据库统计:');
    console.log(`   总案件数: ${stats.total_cases}`);
    console.log('   ');
    
    return stats;
    
  } catch (error) {
    console.error('❌ 统计信息获取失败:', error.message);
    return { total_cases: 0 };
  }
}

// 5. 主函数
async function main() {
  console.log('🚀 Cloudflare D1 ORM Demo');
  console.log('=========================\n');
  
  // 连接到数据库
  connectToDatabase();
  
  // 获取数据库统计信息
  getDatabaseStats();
  
  // 执行简单查询
  const cases = runSimpleQuery();
  
  console.log('🎉 Demo 完成!');
  console.log('\n📝 提示:');
  console.log('   1. 这个 demo 使用 Drizzle ORM 定义表结构');
  console.log('   2. 使用 wrangler 命令执行 SQL 查询');
  console.log('   3. 在实际的 Cloudflare Worker 环境中，你会使用 env.DB');
  console.log('   4. 要在 Worker 中使用 Drizzle ORM，请参考官方文档');
}

// 执行主函数
if (require.main === module) {
  main();
}