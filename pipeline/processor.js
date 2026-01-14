const db = require('./service-db');
const img = require('./service-image');
const b2 = require('./service-b2');

// 获取随机等待时间
function getRandomWaitTime(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 等待指定时间
function wait(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function runSingleCycle(manualId = null) {
  const TASK = 'webp_processor';
  let currentId;

  try {
    // 1. 获取进度
    console.log('[步骤1] 获取当前进度...');
    currentId = manualId || db.fetchCurrentProgress(TASK);
    console.log(`[步骤1] 当前进度 ID: ${currentId}`);

    // 2. 获取案件数据（核心：包含 url_path）
    console.log('[步骤2] 获取案件详情...');
    const caseData = db.getCaseDetail(currentId);
    if (!caseData) {
      console.log(`[步骤2] ID ${currentId} 无案件数据，跳过处理`);
      // 即使没有有效内容，也更新进度，避免卡在同一个ID
      db.commitProgress(TASK, currentId);
      return { status: 'skipped', id: currentId };
    }
    console.log(`[步骤2] 找到有效案件: ${caseData.case_id}`);
    
    // --- 强制熔断检查 --- 
    if (!caseData.url_path) {
      console.error(`[步骤2] 路径熔断: ID ${currentId} 缺少 url_path，停止本轮任务！`);
      throw new Error(`[路径熔断] ID ${currentId} 缺少 url_path`);
    }

    // 3. 提取图片
    console.log('[步骤3] 提取图片URL...');
    const urls = img.extractUrls(caseData.case_html);
    console.log(`[步骤3] 找到 ${urls.length} 个待处理图片`);

    // 4. 处理并上传
    if (urls.length > 0) {
      console.log('[步骤4] 开始处理并上传图片...');
      for (const url of urls) {
        try {
          console.log(`[步骤4] 处理图片: ${url}`);
          // 转换图片，使用caseData中的url_path
          const localPath = await img.convert(url, caseData);
          // 上传到B2，使用caseData中的url_path
          await b2.upload(localPath, caseData.case_id);
          // 清理本地文件
          img.cleanup(localPath);
          console.log(`[步骤4] 图片处理完成: ${url}`);
          
          // 节流
          await wait(getRandomWaitTime(9, 18));
        } catch (imgError) {
          console.error(`[步骤4] 图片处理失败: ${url} - ${imgError.message}`);
          // 如果是url_path相关错误，执行熔断，停止继续上传
          if (imgError.message.includes('url_path不存在')) {
            console.error(`[步骤4] 检测到url_path错误，触发熔断，停止继续上传`);
            break; // 停止处理当前案件的剩余图片
          }
        }
      }
    }

    // 更新案件统计信息
    console.log('[步骤5] 更新案件统计信息...');
    const completenessScore = caseData.case_html.length;
    try {
      db.updateMissingPersonsInfo(caseData.case_id, completenessScore, urls.length);
    } catch (err) {
      console.error('[步骤5] 更新统计信息失败:', err.message);
      // 继续执行，不中断流程
    }

    // 6. 提交进度
    console.log('[步骤6] 提交进度...');
    try {
      db.commitProgress(TASK, currentId);
    } catch (err) {
      console.error('[步骤6] 更新进度失败:', err.message);
      // 继续执行，不中断流程
    }
    
    console.log(`[成功] ID ${currentId} 处理完成`);
    return { status: 'success', id: currentId };

  } catch (error) {
    console.error(`[处理器错误] ID ${currentId || '未知'} 处理失败: ${error.message}`);
    throw error; // 抛出错误，让控制器层处理
  }
}

module.exports = runSingleCycle;

// 独立测试：node pipeline/processor.js 607
if (require.main === module) {
  const manualId = process.argv[2] ? parseInt(process.argv[2]) : null;
  runSingleCycle(manualId)
    .then(result => {
      console.log('测试结果:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('测试失败:', error.message);
      process.exit(1);
    });
}