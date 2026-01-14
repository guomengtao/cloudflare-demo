const runSingleCycle = require('./processor');
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

// 等待指定时间
function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// 获取随机等待时间
function getRandomWaitTime(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 显示倒计时
async function showCountdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    // 清除当前行并移动到行首
    if (process.stdout && process.stdout.isTTY && typeof process.stdout.clearLine === 'function') {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
    }
    process.stdout.write(logger.level < 3 ? '' : `[${new Date().toLocaleString()}] 下一次执行将在 ${i} 秒后开始...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  // 清除倒计时
  if (process.stdout && process.stdout.isTTY && typeof process.stdout.clearLine === 'function') {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
  }
}

async function start() {
  let cycleCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  let noImagesCount = 0;
  
  // 默认配置
  const defaultMinWait = 9;
  const defaultMaxWait = 18;
  const errorWaitTime = 15;
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  let minWait = defaultMinWait;
  let maxWait = defaultMaxWait;
  let maxCycles = Infinity; // 默认无限循环
  
  if (args.length >= 1) {
    const parsedMin = parseInt(args[0]);
    if (!isNaN(parsedMin) && parsedMin > 0) {
      minWait = parsedMin;
    }
  }
  
  if (args.length >= 2) {
    const parsedMax = parseInt(args[1]);
    if (!isNaN(parsedMax) && parsedMax >= minWait) {
      maxWait = parsedMax;
    }
  }
  
  if (args.length >= 3) {
    const parsedCycles = parseInt(args[2]);
    if (!isNaN(parsedCycles) && parsedCycles > 0) {
      maxCycles = parsedCycles;
    }
  }
  
  logger.start('=== 流水线任务启动 ===');
  logger.info(`等待时间范围: ${minWait} - ${maxWait} 秒`);
  logger.info('按 Ctrl+C 停止任务');
  logger.log('');
  
  while (cycleCount < maxCycles) {
    cycleCount++;
    logger.info(`=== 轮次: ${cycleCount}/${maxCycles} ===`);
    
    try {
      const result = await runSingleCycle();
      
      // 更新统计信息
      switch (result.status) {
        case 'success':
          successCount++;
          break;
        case 'skipped':
          skipCount++;
          break;
        case 'no_images':
          noImagesCount++;
          break;
      }
      
      logger.success(`✅ 轮次 ${cycleCount} 完成: ID ${result.id} [${result.status}]`);
      logger.info(`📊 当前统计 - 成功: ${successCount}, 跳过: ${skipCount}, 无图片: ${noImagesCount}, 错误: ${errorCount}`);
      
      // 成功后的等待（最后一轮不需要等待）
      if (cycleCount < maxCycles) {
        const waitTime = getRandomWaitTime(minWait, maxWait);
        logger.info(`等待 ${waitTime} 秒后开始下一轮...`);
        await showCountdown(waitTime);
      }
      
    } catch (err) {
      errorCount++;
      logger.error(`🚨 轮次 ${cycleCount} 失败: ${err.message}`);
      logger.info(`📊 当前统计 - 成功: ${successCount}, 跳过: ${skipCount}, 无图片: ${noImagesCount}, 错误: ${errorCount}`);
      
      // 错误后的等待（最后一轮不需要等待）
      if (cycleCount < maxCycles) {
        logger.info(`等待 ${errorWaitTime} 秒后重试...`);
        await showCountdown(errorWaitTime);
      }
    }
    
    logger.log(''); // 换行
  }
  
  logger.success('=== 流水线任务全部完成 ===');
  logger.info(`📊 最终统计 - 成功: ${successCount}, 跳过: ${skipCount}, 无图片: ${noImagesCount}, 错误: ${errorCount}`);
  logger.info(`总共执行了 ${cycleCount} 轮次`);
}

// 启动程序
if (require.main === module) {
  start().catch(error => {
    logger.error(`🚨 流水线致命错误: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  });
}