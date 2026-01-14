const { exec } = require('child_process');

// 配置：只使用D1数据库
const CONFIG = {
  useD1Database: true
};

/**
 * 从 Cloudflare D1 数据库获取进度 ID
 * @param {string} taskName - 任务名称
 * @returns {Promise<number>} 进度 ID
 */
async function getProgressFromD1(taskName) {
  return new Promise((resolve, reject) => {
    try {
      // 使用 wrangler 命令执行 D1 数据库查询
      const query = `SELECT last_id FROM task_progress WHERE task_name = 'webp_processor'`;
      const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="${query}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`D1 查询错误: ${error.message}`);
          resolve(511); // 默认返回 511
          return;
        }
        
        if (stderr) {
          console.error(`D1 查询警告: ${stderr}`);
        }
        
        try {
          // 修复 JSON 格式，添加缺失的逗号
          const fixedStdout = stdout
            .replace(/"results":\s*\[([^\]]*)\]\s*"success"/g, '"results": [$1], "success"')
            .replace(/"success":\s*true\s*"meta"/g, '"success": true, "meta"')
            .replace(/"served_by":\s*"([^"]*)"\s*"served_by_region"/g, '"served_by": "$1", "served_by_region"')
            .replace(/"served_by_region":\s*"([^"]*)"\s*"served_by_colo"/g, '"served_by_region": "$1", "served_by_colo"')
            .replace(/"served_by_colo":\s*"([^"]*)"\s*"served_by_primary"/g, '"served_by_colo": "$1", "served_by_primary"')
            .replace(/"served_by_primary":\s*true\s*"timings"/g, '"served_by_primary": true, "timings"')
            .replace(/"sql_duration_ms":\s*([\d.]+)\s*}/g, '"sql_duration_ms": $1 }')
            .replace(/"timings":\s*\{([^}]*)\}\s*"duration"/g, '"timings": { $1 }, "duration"')
            .replace(/"duration":\s*([\d.]+)\s*"changes"/g, '"duration": $1, "changes"')
            .replace(/"changes":\s*([\d]+)\s*"last_row_id"/g, '"changes": $1, "last_row_id"')
            .replace(/"last_row_id":\s*([\d]+)\s*"changed_db"/g, '"last_row_id": $1, "changed_db"')
            .replace(/"changed_db":\s*false\s*"size_after"/g, '"changed_db": false, "size_after"')
            .replace(/"size_after":\s*([\d]+)\s*"rows_read"/g, '"size_after": $1, "rows_read"')
            .replace(/"rows_read":\s*([\d]+)\s*"rows_written"/g, '"rows_read": $1, "rows_written"')
            .replace(/"rows_written":\s*([\d]+)\s*"total_attempts"/g, '"rows_written": $1, "total_attempts"')
            .replace(/"total_attempts":\s*([\d]+)\s*}/g, '"total_attempts": $1 }');
          
          const result = JSON.parse(fixedStdout);
          if (result[0]?.results && result[0].results.length > 0) {
            const lastId = parseInt(result[0].results[0].last_id);
            resolve(isNaN(lastId) ? 511 : lastId);
          } else {
            resolve(511); // 默认返回 511
          }
        } catch (parseError) {
          console.error(`解析 D1 查询结果错误: ${parseError.message}`);
          console.error(`原始输出: ${stdout}`);
          resolve(511); // 默认返回 511
        }
      });
    } catch (error) {
      console.error(`获取 D1 进度失败: ${error.message}`);
      resolve(511); // 默认返回 511
    }
  });
}

/**
 * 更新 Cloudflare D1 数据库中的进度 ID
 * @param {string} taskName - 任务名称
 * @param {number} newId - 新的进度 ID
 * @returns {Promise<boolean>} 是否成功
 */
async function updateProgressInD1(taskName, newId) {
  return new Promise((resolve, reject) => {
    try {
      // 使用 wrangler 命令执行 D1 数据库更新
      const query = `INSERT OR REPLACE INTO task_progress (task_name, last_id, updated_at) VALUES ('webp_processor', ${newId}, CURRENT_TIMESTAMP)`;
      const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command="${query}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`D1 更新错误: ${error.message}`);
          resolve(false);
          return;
        }
        
        if (stderr) {
          console.error(`D1 更新警告: ${stderr}`);
        }
        
        resolve(true);
      });
    } catch (error) {
      console.error(`更新 D1 进度失败: ${error.message}`);
      resolve(false);
    }
  });
}



/**
 * 主函数
 */
async function main() {
  // 处理命令行参数
  const args = process.argv.slice(2);
  let taskName = 'webp'; // 默认任务名
  let varValue = '1'; // 默认变量值
  
  // 解析参数
  if (args.length >= 1) {
    taskName = args[0];
  }
  
  if (args.length >= 2) {
    // 传入了新值，直接使用该值
    varValue = args[1];
  }
  
  // 获取当前变量值
  let currentValue = null;
  let resultValue;
  
  if (CONFIG.useD1Database) {
    // 从 D1 数据库获取
    const d1Value = await getProgressFromD1('webp_processor');
    
    if (args.length >= 2) {
      // 传入了新值，直接使用该值
      resultValue = varValue;
    } else {
      // 没有传入新值，使用当前值+1或默认值1
      if (d1Value !== 511) {
        // 使用 D1 数据库中的值+1
        resultValue = (parseInt(d1Value) + 1).toString();
      } else {
        // 默认使用1
        resultValue = '1';
      }
    }
    
    // 更新到 D1 数据库
    await updateProgressInD1('webp_processor', parseInt(resultValue));
  } else {
    // 理论上不会执行到这里，因为CONFIG.useD1Database固定为true
    resultValue = '1';
  }
  
  // 返回结果 - 直接输出值
  process.stdout.write(resultValue + '\n');
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('执行主函数时发生错误:', error);
    process.exit(1);
  });
}