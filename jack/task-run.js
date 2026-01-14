const { execSync } = require('child_process');
const path = require('path');
const consola = require('consola');

// 创建自定义日志实例
const logger = consola.create({
  level: process.env.NODE_ENV === 'production' ? 3 : 4,
  formatOptions: {
    date: true,
    colors: true,
    badge: true
  }
});

/**
 * 获取随机等待时间
 * @param {number} min - 最小等待秒数
 * @param {number} max - 最大等待秒数
 * @returns {number} 随机等待秒数
 */
function getRandomWaitTime(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 执行指定的脚本文件
 * @param {string} scriptName - 脚本文件名
 */
function executeScript(scriptName) {
  try {
    // 构建脚本路径
    let scriptPath;
    if (path.isAbsolute(scriptName)) {
      scriptPath = scriptName;
    } else {
      scriptPath = path.join(__dirname, '../', scriptName);
    }
    
    // 检查文件是否存在
    if (!require('fs').existsSync(scriptPath)) {
      logger.error(`脚本文件不存在: ${scriptPath}`);
      return false;
    }
    
    logger.info(`开始执行: ${scriptPath}`);
    execSync(`node ${scriptPath}`, { stdio: 'inherit' });
    logger.success(`执行完成`);
    return true;
  } catch (error) {
    logger.error(`执行失败: ${error.message}`);
    return false;
  }
}

/**
 * 格式化时间显示
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 显示倒计时
 * @param {number} seconds - 倒计时秒数
 * @returns {Promise<void>} 倒计时完成后的Promise
 */
async function showCountdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(logger.level < 3 ? '' : `[${new Date().toLocaleString()}] 下一次执行将在 ${formatTime(i)} 后开始...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
}

/**
 * 主函数
 */
async function main() {
  // 处理命令行参数
  const args = process.argv.slice(2);
  let scriptName = '../orm-run-webp.js'; // 默认执行的脚本文件名
  let count = 0; // 默认无限循环
  let minWait = 9; // 默认最小等待秒数
  let maxWait = 18; // 默认最大等待秒数
  
  // 解析参数
  if (args.length >= 1) {
    // 第一个参数：循环执行的文件名
    if (args[0].endsWith('.js')) {
      scriptName = args[0];
    } else {
      // 保持向后兼容：如果第一个参数不是.js文件，则按旧格式解析
      const parsedCount = parseInt(args[0]);
      if (!isNaN(parsedCount) && parsedCount >= 0) {
        count = parsedCount;
      }
    }
  }
  
  if (args.length >= 2) {
    // 第二个参数
    if (args[0].endsWith('.js')) {
      // 新格式：第一个参数是文件名，第二个参数是执行次数
      const parsedCount = parseInt(args[1]);
      if (!isNaN(parsedCount) && parsedCount >= 0) {
        count = parsedCount;
      }
    } else {
      // 旧格式：第二个参数是最小等待秒数
      const parsedMin = parseInt(args[1]);
      if (!isNaN(parsedMin) && parsedMin > 0) {
        minWait = parsedMin;
      }
    }
  }
  
  if (args.length >= 3) {
    // 第三个参数
    if (args[0].endsWith('.js')) {
      // 新格式：第三个参数是最小等待秒数
      const parsedMin = parseInt(args[2]);
      if (!isNaN(parsedMin) && parsedMin > 0) {
        minWait = parsedMin;
      }
    } else {
      // 旧格式：第三个参数是最大等待秒数
      const parsedMax = parseInt(args[2]);
      if (!isNaN(parsedMax) && parsedMax >= minWait) {
        maxWait = parsedMax;
      }
    }
  }
  
  if (args.length >= 4) {
    // 第四个参数：最大等待秒数
    const parsedMax = parseInt(args[3]);
    if (!isNaN(parsedMax) && parsedMax >= minWait) {
      maxWait = parsedMax;
    }
  }
  
  // 显示启动信息
  logger.start('任务运行器已启动');
  logger.info(`执行脚本: ${scriptName}`);
  logger.info(`执行次数: ${count === 0 ? '无限循环' : count}`);
  logger.info(`等待时间范围: ${minWait} - ${maxWait} 秒`);
  logger.info('按 Ctrl+C 停止任务');
  logger.log(''); // 换行
  
  // 根据执行次数决定循环逻辑
  if (count === 0) {
    // 无限循环执行
    while (true) {
      // 执行任务
      executeScript(scriptName);
      
      // 计算下一次等待时间
      const waitTime = getRandomWaitTime(minWait, maxWait);
      
      // 显示倒计时
      await showCountdown(waitTime);
      
      logger.log(''); // 换行
    }
  } else {
    // 有限次数执行
    for (let i = 0; i < count; i++) {
      logger.info(`执行次数: ${i + 1}/${count}`);
      
      // 执行任务
      executeScript(scriptName);
      
      // 如果不是最后一次执行，添加等待
      if (i < count - 1) {
        // 计算下一次等待时间
        const waitTime = getRandomWaitTime(minWait, maxWait);
        
        // 显示倒计时
        await showCountdown(waitTime);
        
        logger.log(''); // 换行
      }
    }
  }
  
  logger.success('所有任务执行完成');
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    logger.error(`任务运行器错误: ${error.message}`);
    process.exit(1);
  });
}