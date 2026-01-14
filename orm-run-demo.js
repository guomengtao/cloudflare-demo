const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. 读取和更新状态文件中的ID - 改为从 webp-100.txt 读取数据
function readAndUpdateStatus() {
  const statusFilePath = path.join(__dirname, 'jack', 'webp-100.txt');
  let currentId = 0;
  let existingContent = '';
  
  try {
    // 检查文件是否存在
    if (fs.existsSync(statusFilePath)) {
      // 读取文件内容
      const content = fs.readFileSync(statusFilePath, 'utf8');
      // 分割成多行
      const lines = content.trim().split('\n');
      
      if (lines.length > 0) {
        // 获取第一行并转换为数字
        const firstLine = lines[0].trim();
        const parsedId = parseInt(firstLine);
        
        if (!isNaN(parsedId)) {
          currentId = parsedId;
        }
        
        // 保留所有旧内容
        existingContent = content.trim();
      }
    }
    
    // ID 加 1
    const newId = currentId + 1;
    
    // 确保目录存在
    const dirPath = path.dirname(statusFilePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // 将新ID写入文件最顶部，保留所有旧内容
    const newContent = `${newId}\n${existingContent}`;
    fs.writeFileSync(statusFilePath, newContent, 'utf8');
    console.log(`✅ 状态文件已更新: ${statusFilePath} -> ID=${newId}`);
    
    return newId;
    
  } catch (error) {
    console.error('❌ 状态文件处理失败:', error.message);
    // 出错时返回默认ID 1
    return 1;
  }
}

// 2. 执行查询获取指定ID的案件数据
function getCaseById(id) {
  console.log(`🔍 查询 ID=${id} 的案件...`);
  
  try {
    // 使用 wrangler 命令执行 SQL 查询 - 添加了用户要求的 case_id 字段
    // 使用单引号包裹SQL查询，避免逗号丢失问题
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command 'SELECT id, case_url, case_id FROM missing_persons_cases WHERE id = ${id}'`;
    
    console.log('💻 执行命令:', command);
    
    // 执行命令并获取输出
    const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
    
    // 解析输出
    const result = JSON.parse(output);
    const cases = result[0]?.results || [];
    
    return cases.length > 0 ? cases[0] : null;
    
  } catch (error) {
    console.error('❌ 查询执行失败:', error.message);
    if (error.stdout) console.error('标准输出:', error.stdout);
    if (error.stderr) console.error('标准错误:', error.stderr);
    return null;
  }
}

// 3. 将数据保存到文件 - ID已在状态处理中写入，此函数保留用于可能的扩展
function saveToFile(data, filePath) {
  try {
    // 确保目录存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // ID已在readAndUpdateStatus函数中写入文件顶部
    console.log(`✅ 数据已保存到: ${filePath}`);
    
  } catch (error) {
    console.error('❌ 文件保存失败:', error.message);
  }
}

// 4. 主函数
async function main() {
  console.log('🚀 运行 ORM WebP 演示');
  console.log('=========================\n');
  
  // 读取和更新状态文件中的ID
  const targetId = readAndUpdateStatus();
  
  // 使用新获取的ID查询案件
  const caseData = getCaseById(targetId);
  
  if (caseData) {
    // 打印查询结果 - 包含用户要求的所有字段
    console.log('📊 查询结果:');
    console.log(`   表 ID: ${caseData.id}`);
    console.log(`   案件 ID: ${caseData.case_id}`);  // 使用查询结果中的case_id字段
    console.log(`   案件 URL: ${caseData.case_url}`);
    
    // 保存到文件 - 只记录id数值，一行一个
    const outputPath = path.join(__dirname, 'jack', 'webp-100.txt');
    saveToFile(caseData, outputPath);
  } else {
    console.log(`❌ 未找到 ID=${targetId} 的案件记录`);
  }
  
  console.log('\n🎉 操作完成!');
}

// 执行主函数
if (require.main === module) {
  main();
}