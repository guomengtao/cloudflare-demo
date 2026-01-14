const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const convertToWebp = require('./webp');

// --- 基础工具函数 ---
function getRandomWaitTime(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wait(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function formatPathName(name) {
  if (!name) return 'unknown';
  return name.toLowerCase().replace(/\s+/g, '-').replace(/['"]/g, '');
}

/**
 * 核心进度获取函数 (只读)
 * 禁止返回默认值，失败则立即熔断退出
 */
function getProgressID() {
  try {
    // 调用子脚本获取当前 ID (不传递额外参数)
    const command = `node ${path.join(__dirname, 'task-gh-id.js')} webp`;
    const output = execSync(command, { encoding: 'utf8', timeout: 15000 }).trim();
    const currentId = parseInt(output);
    
    if (isNaN(currentId)) {
      throw new Error(`子脚本返回了非法 ID: ${output}`);
    }
    return currentId;
  } catch (error) {
    console.error(`[致命错误] 无法获取起始进度，程序熔断: ${error.message}`);
    process.exit(1); // 退出码 1，阻止后续所有逻辑
  }
}

/**
 * 核心进度提交函数 (只写)
 * 只有在业务完全成功后才调用
 */
function commitProgressID(id) {
  try {
    console.log(`[进度同步] 准备提交成功进度至: ${id}`);
    const command = `node ${path.join(__dirname, 'task-gh-id.js')} webp ${id}`;
    execSync(command, { encoding: 'utf8', timeout: 15000 });
    return true;
  } catch (error) {
    console.error(`[警告] 进度写入失败，但业务已完成: ${error.message}`);
    return false;
  }
}

// --- 数据库业务函数 ---

function getCaseById(id) {
  try {
    const sqlQuery = `SELECT * FROM missing_persons_cases WHERE id = ${id}`;
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command "${sqlQuery}" --json`;
    const output = execSync(command, { encoding: 'utf8', timeout: 20000 });
    
    const jsonMatch = output.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const result = JSON.parse(jsonMatch[0]);
    const cases = result[0]?.results || [];
    return cases.length > 0 ? cases[0] : null;
  } catch (error) {
    console.error(`查询案件 ID ${id} 失败:`, error.message);
    return null;
  }
}

function updateMissingPersonsInfo(caseId, completenessScore, imageCount) {
  try {
    const updateSql = `UPDATE missing_persons_info SET completeness_score = ${completenessScore}, image_count = ${imageCount} WHERE case_id = '${caseId}'`;
    execSync(`npx wrangler d1 execute cloudflare-demo-db --remote --command "${updateSql}" --json`, { timeout: 20000 });
    return true;
  } catch (error) {
    return false;
  }
}

function getMissingPersonsInfo(caseId) {
  try {
    const selectSql = `SELECT missing_city, missing_county, missing_state FROM missing_persons_info WHERE case_id = '${caseId}'`;
    const output = execSync(`npx wrangler d1 execute cloudflare-demo-db --remote --command "${selectSql}" --json`, { timeout: 20000 });
    const jsonMatch = output.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const result = JSON.parse(jsonMatch[0]);
    const info = result[0]?.results || [];
    return info.length > 0 ? info[0] : null;
  } catch (error) {
    return null;
  }
}

// --- 图像提取逻辑 ---
function hasRealImages(htmlContent, returnUrls = false) {
    if (!htmlContent) return returnUrls ? [] : false;
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const urlPattern = new RegExp(`https?:\/\/[^\s"']+\.(${imageExtensions.join('|')})[^\s"']*`, 'gi');
    const urlMatches = htmlContent.match(urlPattern) || [];
    
    const imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    let imgMatches;
    const allUrls = [...urlMatches];
    while ((imgMatches = imgPattern.exec(htmlContent)) !== null) {
        if (imgMatches[1]) allUrls.push(imgMatches[1]);
    }

    const realImages = [...new Set(allUrls.filter(url => {
        if (!url) return false;
        const lower = url.toLowerCase();
        return !['placeholder', 'via.placeholder', 'data:image', 'blank', 'default'].some(p => lower.includes(p));
    }))];

    return returnUrls ? realImages : realImages.length > 0;
}

// --- 主函数 ---

async function main(manualId = null) {
  // 1. 获取 ID ( manualId 优先级最高，否则从 D1 拿 )
  let targetId = manualId || getProgressID();
  console.log(`[任务启动] 起始 ID: ${targetId}`);

  // 2. 查找有效案件 (内存跳过逻辑，严禁干预数据库)
  let caseData = getCaseById(targetId);
  let attempts = 0;
  const maxSkip = 20; 

  while (!caseData?.case_html && attempts < maxSkip) {
    attempts++;
    console.log(`[跳过] ID ${targetId} 无有效内容，尝试下一个...`);
    targetId++; 
    caseData = getCaseById(targetId);
  }

  if (!caseData?.case_html) {
    console.log(`[停止] 尝试 ${maxSkip} 次后未发现待处理数据。本次不更新数据库。`);
    return;
  }

  // 3. 开始业务处理
  console.log(`[处理中] 发现有效案件: ${caseData.case_id} (ID: ${targetId})`);
  
  try {
    let completenessScore = caseData.case_html.length;
    const imageUrls = hasRealImages(caseData.case_html, true);
    console.log(`[图像] 找到 ${imageUrls.length} 个待处理 URL`);

    if (imageUrls.length > 0) {
      const infoData = getMissingPersonsInfo(caseData.case_id);
      const state = formatPathName(infoData?.missing_state || 'unknown');
      const county = formatPathName(infoData?.missing_county || 'unknown');
      const city = formatPathName(infoData?.missing_city || 'unknown');

      for (const url of imageUrls) {
        try {
          const urlObj = new URL(url);
          const fileName = path.parse(path.basename(urlObj.pathname)).name + '.webp';
          const outputDir = path.join(__dirname, 'img', state, county, city, caseData.case_id);
          
          if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
          const outputPath = path.join(outputDir, fileName);

          // 转换
          await convertToWebp(url, outputPath, { quality: 80 });

          // 上传 B2
          console.log(`[B2] 正在上传: ${fileName}`);
          execSync(`node ${path.join(__dirname, 'b2-image-manager.js')} -f "${outputPath}" -c "${caseData.case_id}" -t "profile"`);
          
          // 删除本地
          fs.unlinkSync(outputPath);
          
          // 节流
          await wait(getRandomWaitTime(9, 18));
        } catch (imgErr) {
          console.error(`[图片失败] URL: ${url}, 原因: ${imgErr.message}`);
        }
      }
    }

    // 更新 D1 中的 info 统计
    if (caseData.case_id) {
      updateMissingPersonsInfo(caseData.case_id, completenessScore, imageUrls.length);
    }

    // 4. 【唯一权限点】业务全部成功后，更新进度
    if (!manualId) {
        commitProgressID(targetId);
    } else {
        console.log(`[提醒] 手动模式运行，未自动更新 D1 进度。`);
    }

    console.log(`[成功] ID ${targetId} 处理完成`);

  } catch (error) {
    console.error(`[业务崩溃] ID ${targetId} 处理失败:`, error.message);
    process.exit(1); 
  }
}

// 启动
if (require.main === module) {
  const args = process.argv.slice(2);
  const startId = args.length > 0 ? parseInt(args[0]) : null;
  main(isNaN(startId) ? null : startId).catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
  });
}