const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const convertToWebp = require('./webp');

// 获取随机等待时间
function getRandomWaitTime(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 等待指定时间
function wait(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// 格式化路径名称（小写，空格转中线，去引号）
function formatPathName(name) {
  if (!name) return 'unknown';
  return name.toLowerCase().replace(/\s+/g, '-').replace(/['"]/g, '');
}

// 从 jack/ai-cf-to-county.js 复制的图片提取函数
function hasRealImages(htmlContent, returnUrls = false) {
    console.log('调试: hasRealImages 函数被调用');
    console.log('调试: htmlContent 长度:', htmlContent ? htmlContent.length : 0);
    
    if (!htmlContent) {
        console.log('调试: htmlContent 为空');
        return returnUrls ? [] : false;
    }
    
    // 支持多种图片格式
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    // 简化检测逻辑：直接搜索图片URL
    const urlPattern = new RegExp(`https?:\/\/[^\s"']+\.(${imageExtensions.join('|')})[^\s"']*`, 'gi');
    const urlMatches = htmlContent.match(urlPattern) || [];
    console.log('调试: URL 模式匹配到', urlMatches.length, '个图片URL');
    
    // 同时检查 <img> 标签
    const imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const imgMatches = htmlContent.match(imgPattern) || [];
    console.log('调试: <img> 标签匹配到', imgMatches.length, '个');
    
    // 合并所有图片URL
    const allImageUrls = [...urlMatches];
    
    // 提取 <img> 标签中的图片URL
    imgMatches.forEach(imgTag => {
        const srcMatch = imgTag.match(/src="([^"]+)"/i);
        if (srcMatch && srcMatch[1]) {
            allImageUrls.push(srcMatch[1]);
        }
    });
    
    if (allImageUrls.length === 0) {
        return returnUrls ? [] : false;
    }
    
    // 过滤真实的图片URL（排除占位符和无效URL）
    const realImages = allImageUrls.filter(url => {
        if (!url || url.trim() === '') return false;
        
        const lowerUrl = url.toLowerCase();
        
        // 排除占位符图片
        if (lowerUrl.includes('via.placeholder.com') || 
            lowerUrl.includes('placeholder') ||
            lowerUrl.includes('data:image') || // 排除base64图片
            lowerUrl.includes('blank') ||
            lowerUrl.includes('default')) {
            return false;
        }
        
        // 检查是否是有效的图片URL
        return imageExtensions.some(ext => lowerUrl.includes('.' + ext));
    });
    
    // 去重
    const uniqueImages = [...new Set(realImages)];
    
    if (uniqueImages.length === 0) {
        return returnUrls ? [] : false;
    }
    
    if (returnUrls) {
        return uniqueImages;
    }
    
    return true;
}

// 1. 读取和更新状态文件中的ID - 改为从 task-gh-id.js 获取数据
function readAndUpdateStatus(desiredId = null) {
  try {
    // 调用 task-gh-id.js 脚本获取返回值，传递变量名 webp
    const command = desiredId 
      ? `node ${path.join(__dirname, 'task-gh-id.js')} webp ${desiredId}` 
      : `node ${path.join(__dirname, 'task-gh-id.js')} webp`;
    const output = execSync(command, { encoding: 'utf8' }).trim();
    
    // 解析返回的 JSON 数据
    const result = JSON.parse(output);
    
    // 获取 ID 值并转换为数字
    const currentId = parseInt(result.value);
    
    if (!isNaN(currentId)) {
      return currentId;
    }
    
    // 如果解析失败，返回默认ID 1
    return 1;
    
  } catch (error) {
    // 出错时返回默认ID 1
    console.error('获取ID失败:', error.message);
    return 1;
  }
}

// 2. 查询数据库中的案件总数
function getCaseCount() {
  try {
    const sqlQuery = `SELECT COUNT(*) as count FROM missing_persons_cases`;
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command "${sqlQuery}" --json`;
    
    const output = execSync(command, { encoding: 'utf8', timeout: 20000 });
    
    const jsonStart = output.indexOf('[');
    const jsonEnd = output.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      return 0;
    }
    
    const jsonOutput = output.slice(jsonStart, jsonEnd + 1);
    const result = JSON.parse(jsonOutput);
    
    const cases = result[0]?.results || result.results || [];
    
    if (cases.length > 0) {
      return cases[0].count || 0;
    } else {
      return 0;
    }
    
  } catch (error) {
    console.error('getCaseCount 错误:', error.message);
    return 0;
  }
}

// 3. 执行查询获取指定ID的案件数据
function getCaseById(id) {
  try {
    // 使用简单的查询命令，直接在命令行中执行
    const sqlQuery = `SELECT * FROM missing_persons_cases WHERE id = ${id}`;
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command "${sqlQuery}" --json`;
    
    // 执行命令并获取输出
    const output = execSync(command, { encoding: 'utf8', timeout: 20000 });
    
    // 查找JSON数据的开始和结束位置
    const jsonStart = output.indexOf('[');
    const jsonEnd = output.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      return null;
    }
    
    // 提取JSON部分并解析
    const jsonOutput = output.slice(jsonStart, jsonEnd + 1);
    const result = JSON.parse(jsonOutput);
    
    // 获取查询结果
    const cases = result[0]?.results || result.results || [];
    
    if (cases.length > 0) {
      return cases[0];
    } else {
      return null;
    }
    
  } catch (error) {
    console.error('getCaseById 错误:', error.message);
    return null;
  }
}

// 3. 执行数据库更新操作，将case_html长度和图片数量写入missing_persons_info表
function updateMissingPersonsInfo(caseId, completenessScore, imageCount) {
  try {
    // 构建UPDATE SQL语句
    const updateSql = `UPDATE missing_persons_info SET completeness_score = ${completenessScore}, image_count = ${imageCount} WHERE case_id = '${caseId}'`;
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command "${updateSql}" --json`;
    
    // 执行命令并获取输出
    execSync(command, { encoding: 'utf8', timeout: 20000 });
    
    return true;
  } catch (error) {
    return false;
  }
}

// 4. 从missing_persons_info表获取信息
function getMissingPersonsInfo(caseId) {
  try {
    // 构建SELECT SQL语句
    const selectSql = `SELECT missing_city, missing_county, missing_state FROM missing_persons_info WHERE case_id = '${caseId}'`;
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command "${selectSql}" --json`;
    
    // 执行命令并获取输出
    const output = execSync(command, { encoding: 'utf8', timeout: 20000 });
    
    // 查找JSON数据的开始和结束位置
    const jsonStart = output.indexOf('[');
    const jsonEnd = output.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      return null;
    }
    
    // 提取JSON部分并解析
    const jsonOutput = output.slice(jsonStart, jsonEnd + 1);
    const result = JSON.parse(jsonOutput);
    
    // 获取查询结果
    const info = result[0]?.results || result.results || [];
    
    return info.length > 0 ? info[0] : null;
  } catch (error) {
    return null;
  }
}

// 4. 将数据保存到文件 - ID已在状态处理中写入，此函数保留用于可能的扩展
function saveToFile(data, filePath) {
  // 此函数不再修改webp-100.txt文件，只保留用于扩展
  try {
    // 确保目录存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
  } catch (error) {
    // 静默处理错误
  }
}

// 5. 主函数
async function main(startId = null) {
  // 查询数据库中的案件总数
  const totalCases = getCaseCount();
  console.log(`数据库中共有 ${totalCases} 个案件`);
  
  let targetId;
  let caseData;
  
  if (startId) {
    // 使用用户指定的起始ID
    targetId = startId;
    console.log(`使用用户指定的起始ID: ${targetId}`);
    caseData = getCaseById(targetId);
  } else {
    // 读取和更新状态文件中的ID
    targetId = readAndUpdateStatus();
    console.log(`从GitHub变量获取的起始ID: ${targetId}`);
    caseData = getCaseById(targetId);
  }
  
  // 如果没有case_html，查找下一个有case_html的案件
  let attempts = 0;
  const maxAttempts = Math.min(20, totalCases - targetId);
  
  while (!caseData?.case_html && attempts < maxAttempts) {
    attempts++;
    const nextId = targetId + attempts;
    
    // 确保不超过最大案件ID
    if (nextId > totalCases) {
      console.log(`已达到最大案件ID (${totalCases})，未找到有case_html的案件`);
      break;
    }
    
    console.log(`尝试找到有case_html的案件，第${attempts}次尝试，ID: ${nextId}...`);
    
    // 不更新GitHub变量，直接尝试下一个ID
    caseData = getCaseById(nextId);
    
    if (caseData?.case_html) {
      // 如果找到有case_html的案件，更新GitHub变量到这个ID
      readAndUpdateStatus(nextId);
      targetId = nextId;
      console.log(`找到有case_html的案件，ID: ${targetId}`);
      break;
    }
  }
  
  if (!caseData?.case_html) {
    console.log(`在尝试${attempts}次后，未找到有case_html的案件`);
    return;
  }
  
  if (caseData) {
    let completenessScore = 0;
    let imageCount = 0;
    
    // 打印 missing_persons_cases 表中的 case_id 和 case_url
    console.log(`case_id: ${caseData.case_id}`);
    console.log(`case_url: ${caseData.case_url}`);
    
    // 从 missing_persons_info 表获取信息
    let infoData = null;
    if (caseData.case_id) {
      infoData = getMissingPersonsInfo(caseData.case_id);
      if (infoData) {
        console.log(`missing_city: ${infoData.missing_city}`);
        console.log(`missing_county: ${infoData.missing_county}`);
        console.log(`missing_state: ${infoData.missing_state}`);
      }
    }
    
    // 检查case_html是否存在
    if (!caseData.case_html) {
      console.log('未找到case_html内容，跳过处理');
      return;
    }
    
    // 计算case_html字段的字符数长度
    completenessScore = caseData.case_html.length;
    console.log('调试: case_html 长度:', completenessScore);
    
    // 查看case_html的前1000个字符
    console.log('调试: case_html 前1000个字符:', caseData.case_html.substring(0, 1000) + '...');
    
    // 提取 case_html 中的所有图片 URL
    const imageUrls = hasRealImages(caseData.case_html, true);
    imageCount = imageUrls.length;
    
    console.log(`调试: 找到 ${imageCount} 个图片URL`);
    
    // 处理每个图片URL
    if (imageUrls.length > 0) {
      // 只输出图片 URL
      console.log('调试: 图片URL列表:');
      imageUrls.forEach(url => {
        console.log(url);
      });
      
      // 转换图片为 WebP 格式并保存
      if (caseData.case_id) {
        // 准备州、县、城市名称
        let state = 'unknown';
        let county = 'unknown';
        let city = 'unknown';
        
        // 如果有infoData，使用其中的信息
        if (infoData) {
          state = formatPathName(infoData.missing_state);
          county = formatPathName(infoData.missing_county);
          city = formatPathName(infoData.missing_city);
        } else {
          // 否则从case_url中提取信息
          if (caseData.case_url) {
            // 示例：https://charleyproject.org/case/jamal-abdulfaruq
            // 尝试从URL中提取更多信息（如果URL结构包含位置信息）
            // 目前先使用默认值
          }
        }
        
        // 遍历所有图片URL
        for (const url of imageUrls) {
          try {
            // 获取原始文件名
            const urlObj = new URL(url);
            const originalFileName = path.basename(urlObj.pathname);
            const fileNameWithoutExt = path.parse(originalFileName).name;
            const outputFileName = `${fileNameWithoutExt}.webp`;
            
            // 创建输出目录结构
            const outputDir = path.join(__dirname, 'img', state, county, city, caseData.case_id);
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            // 构建输出路径
            const outputPath = path.join(outputDir, outputFileName);
            
            // 调用 convertToWebp 函数转换图片
            await convertToWebp(url, outputPath, { quality: 80 });
            
            // 将转换后的 WebP 文件上传到 B2 存储服务
            const relativeOutputPath = `./img/${state}/${county}/${city}/${caseData.case_id}/${outputFileName}`;
            console.log(`正在上传到 B2 存储: ${relativeOutputPath}`);
            try {
              // 使用 b2-image-manager.js 上传图片到 B2
              execSync(`node ${path.join(__dirname, 'b2-image-manager.js')} -f "${relativeOutputPath}" -c "${caseData.case_id}" -t "profile"`, { encoding: 'utf8' });
              console.log(`✅ B2 上传成功: ${relativeOutputPath}`);
            } catch (error) {
              console.error(`❌ B2 上传失败: ${relativeOutputPath}`, error.message);
            }
            
            // 在转换完成后添加随机等待时间（9-18秒）
            const waitTime = getRandomWaitTime(9, 18);
            console.log(`图片转换完成，等待 ${waitTime} 秒...`);
            await wait(waitTime);
          } catch (error) {
            console.error(`处理图片失败 ${url}: ${error.message}`);
          }
        }
      }
    } else {
      // 如果没有找到图片URL，添加简单提示
      console.log('未找到真实图片URL');
    }
    
    // 更新missing_persons_info表
    if (caseData.case_id) {
      updateMissingPersonsInfo(caseData.case_id, completenessScore, imageCount);
    }
    
    // 保存到文件的功能已在readAndUpdateStatus中完成，此处不再重复调用
    // const outputPath = path.join(__dirname, 'jack', 'webp-100.txt');
    // saveToFile(caseData, outputPath);
  }
}

// 执行主函数
if (require.main === module) {
  // 检查命令行参数是否包含起始ID
  const args = process.argv.slice(2);
  let startId = null;
  
  if (args.length > 0) {
    startId = parseInt(args[0]);
    if (!isNaN(startId)) {
      console.log(`使用命令行指定的起始ID: ${startId}`);
    } else {
      console.log('无效的ID参数，将使用默认起始ID');
      startId = null;
    }
  }
  
  main(startId).catch(error => {
    console.error('程序执行错误:', error.message);
    process.exit(1);
  });
}