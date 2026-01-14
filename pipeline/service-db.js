const { execSync } = require('child_process');

const serviceDb = {
  // 获取当前进度ID
  fetchCurrentProgress: (taskName) => {
    try {
      const sql = `SELECT last_id FROM task_progress WHERE task_name = '${taskName}'`;
      const command = `wrangler d1 execute cloudflare-demo-db --remote --command "${sql}" --json`;
      const output = execSync(command, { encoding: 'utf8', timeout: 60000 });
      
      // 解析 JSON
      const jsonMatch = output.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('D1 查询结果解析失败');
      const data = JSON.parse(jsonMatch[0]);
      const result = data[0]?.results || [];
      
      if (result.length === 0) throw new Error("CRITICAL: 找不到任务进度记录");
      
      const id = parseInt(result[0].last_id);
      if (isNaN(id)) throw new Error("CRITICAL: 无法从数据库获取合法进度 ID");
      return id;
    } catch (error) {
      throw new Error(`CRITICAL: 无法从数据库获取进度 ID: ${error.message}`);
    }
  },
  
  // 提交进度ID（直接操作，不再求人）
  commitProgress: (taskName, newId) => {
    try {
      // 1. 构造 SQL
      const sql = `UPDATE task_progress SET last_id = ${newId} WHERE task_name = '${taskName}'`;
      
      // 2. 直接调用 wrangler (这是 service-db 的本职工作)
      const command = `wrangler d1 execute cloudflare-demo-db --remote --command "${sql}"`;
      
      console.log(`[数据库写入] 正在更新任务 ${taskName} 的进度为 ${newId}...`);
      execSync(command, { encoding: 'utf8', timeout: 60000 });
      
      return true;
    } catch (error) {
      // 这里的报错会非常清晰：是 SQL 错了还是网络断了
      throw new Error(`CRITICAL: 进度提交失败(D1错误): ${error.message}`);
    }
  },
  
  // 一次性更新统计信息和进度（极致提速）
  finishTask: (caseId, score, imgCount, taskName, nextId) => {
    const sql = [
      `UPDATE missing_persons_info SET completeness_score = ${score}, image_count = ${imgCount} WHERE case_id = '${caseId}'`,
      `UPDATE task_progress SET last_id = ${nextId} WHERE task_name = '${taskName}'`
    ].join('; '); // 用分号连接多条 SQL

    const command = `wrangler d1 execute cloudflare-demo-db --remote --command "${sql}"`;
    
    console.log(`[原子提交] 正在合并更新统计与进度...`);
    execSync(command, { timeout: 60000 }); // 增加超时时间到60秒
  },
  
  // 关键需求：获取案件详情（包含路径和 HTML）
  getCaseDetail: (id) => {
    try {
      // 使用 JOIN 关联两张表，一次性把 HTML 和 url_path 拿出来
      const sql = `
          SELECT a.case_id, a.case_html, b.url_path
          FROM missing_persons_cases a
          LEFT JOIN missing_persons_info b ON a.case_id = b.case_id
          WHERE a.id = ${id}
      `;
      const command = `wrangler d1 execute cloudflare-demo-db --remote --command "${sql}" --json`;
      const output = execSync(command, { encoding: 'utf8', timeout: 60000 });
      
      // 解析 JSON
      const jsonMatch = output.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('D1 查询结果解析失败');
      const data = JSON.parse(jsonMatch[0]);
      const result = data[0]?.results || [];
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new Error(`获取案件详情失败: ${error.message}`);
    }
  },
  
  // 获取案件信息
  getMissingPersonsInfo: (caseId) => {
    try {
      const selectSql = `SELECT missing_city, missing_county, missing_state, url_path FROM missing_persons_info WHERE case_id = '${caseId}'`;
      const command = `wrangler d1 execute cloudflare-demo-db --remote --command "${selectSql}" --json`;
      const output = execSync(command, { encoding: 'utf8', timeout: 60000 });
      const jsonMatch = output.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const result = JSON.parse(jsonMatch[0]);
      const info = result[0]?.results || [];
      return info.length > 0 ? info[0] : null;
    } catch (error) {
      return null;
    }
  },
  
  // 更新案件统计信息
  updateMissingPersonsInfo: (caseId, completenessScore, imageCount) => {
    try {
      const updateSql = `UPDATE missing_persons_info SET completeness_score = ${completenessScore}, image_count = ${imageCount} WHERE case_id = '${caseId}'`;
      const command = `wrangler d1 execute cloudflare-demo-db --remote --command "${updateSql}" --json`;
      execSync(command, { encoding: 'utf8', timeout: 60000 });
      return true;
    } catch (error) {
      return false;
    }
  }
};

// 独立测试：node pipeline/service-db.js 607
if (require.main === module) {
  const testId = process.argv[2] || 607;
  try {
    const result = serviceDb.getCaseDetail(testId);
    console.log('测试结果:', result);
  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

module.exports = serviceDb;