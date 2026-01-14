const { exec } = require('child_process');

/**
 * 核心配置
 */
const DB_NAME = "cloudflare-demo-db";
const TASK_NAME = "webp_processor";

/**
 * 1. 从 D1 获取当前进度
 * 逻辑：报错则 Reject，没数据返回 null
 */
function getProgress(taskName) {
  return new Promise((resolve, reject) => {
    const query = `SELECT last_id FROM task_progress WHERE task_name = '${taskName}' LIMIT 1`;
    const command = `npx wrangler d1 execute ${DB_NAME} --remote --json --command="${query}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`D1查询命令执行失败: ${error.message}`));
      }

      try {
        // 健壮地寻找 JSON 块，忽略 Wrangler 的其他文本输出
        const jsonMatch = stdout.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (!jsonMatch) {
          return reject(new Error("无法从输出中解析到有效的 JSON 数据"));
        }
        
        const data = JSON.parse(jsonMatch[0]);
        // Wrangler --json 返回的是数组，取第一个元素里的 results
        const rows = data[0]?.results || [];

        if (rows.length > 0) {
          const id = parseInt(rows[0].last_id);
          resolve(isNaN(id) ? null : id);
        } else {
          resolve(null); // 数据库确实没有这条任务的记录
        }
      } catch (e) {
        reject(new Error(`解析 JSON 失败: ${e.message} \n 原始输出: ${stdout}`));
      }
    });
  });
}

/**
 * 2. 更新进度到 D1
 * 逻辑：采用 SQL MAX 保护，确保 last_id 永远只能变大
 */
function updateProgress(taskName, newId) {
  return new Promise((resolve, reject) => {
    // 使用 ON CONFLICT 配合 MAX 函数，防止任何形式的进度倒退
    const query = `
      INSERT INTO task_progress (task_name, last_id, updated_at) 
      VALUES ('${taskName}', ${newId}, CURRENT_TIMESTAMP)
      ON CONFLICT(task_name) DO UPDATE SET 
      last_id = MAX(task_progress.last_id, EXCLUDED.last_id),
      updated_at = CURRENT_TIMESTAMP;
    `;
    const command = `npx wrangler d1 execute ${DB_NAME} --remote --command="${query}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`D1写入失败: ${error.message}`));
      }
      resolve(true);
    });
  });
}

/**
 * 主执行函数
 */
async function main() {
  try {
    // A. 强制禁止手动传入 ID 参数，防止脚本被误调用覆盖数据
    // 我们只允许读取第一个参数作为 taskName（可选）
    const args = process.argv.slice(2);
    const task = args[0] || TASK_NAME;

    // B. 获取进度
    const currentId = await getProgress(task);
    
    let nextId;
    if (currentId === null) {
      // 只有在明确知道数据库没记录时，才从 1 开始
      nextId = 1;
    } else {
      // 正常逻辑：在当前基础上 +1
      nextId = currentId + 1;
    }

    // C. 写入新进度
    await updateProgress(task, nextId);

    // D. 成功输出：这是给下一个调用环节看的唯一标准输出
    process.stdout.write(nextId.toString());

  } catch (err) {
    // E. 熔断保护
    // 所有的错误都会进入这里。我们将错误信息定向到 stderr
    console.error(`\n[FATAL ERROR]: ${err.message}`);
    // 以退出码 1 结束进程。这会让调用此脚本的父进程知道发生了故障。
    process.exit(1);
  }
}

// 启动程序
main();