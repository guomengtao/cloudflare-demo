const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// 配置
const DATABASE_ID = "cloudflare-demo-db";
const BATCH_LIMIT = 66; // 提升单次采集数量

// 检查后端API是否可用
async function checkBackendAPI() {
    try {
        const response = await axios.get('http://localhost:8787/api/missing-persons/health', { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// 网页内容解析，重点采集<div id="case">内的内容
function parseCaseContentDirect(html, caseUrl, caseId) {
    // 提取<div id="case">内的内容，使用更可靠的标签计数算法
    const caseStartRegex = /<div\s+id=["']case["'][^>]*>/i;
    const caseStartMatch = html.match(caseStartRegex);
    
    if (!caseStartMatch) {
        // 如果没有找到<div id="case">，则返回整个html
        return html;
    }
    
    const startIndex = caseStartMatch.index + caseStartMatch[0].length;
    
    // 使用正则表达式匹配所有的div开始标签和结束标签
    const divTagsRegex = /<\/?div[^>]*>/gi;
    let match;
    let tagCount = 1; // 已经匹配到一个<div id="case">
    let endIndex = -1;
    let updatedIndex = -1;
    
    // 先找到class="updated"的位置
    const updatedClassRegex = /<[^>]*class=["'][^"']*updated[^"']*["'][^>]*>/i;
    const updatedMatch = html.substring(startIndex).match(updatedClassRegex);
    if (updatedMatch) {
        updatedIndex = startIndex + updatedMatch.index;
    }
    
    // 重置正则表达式的lastIndex
    divTagsRegex.lastIndex = startIndex;
    
    // 遍历所有div标签
    while ((match = divTagsRegex.exec(html)) !== null) {
        const tag = match[0];
        const tagPosition = match.index;
        
        if (/<div[^>]*>/i.test(tag)) {
            // 开始标签，增加计数
            tagCount++;
        } else if (/<\/div\s*>/i.test(tag)) {
            // 结束标签，减少计数
            tagCount--;
            
            // 如果找到了对应的闭合标签，并且包含了class="updated"的内容
            if (tagCount === 0) {
                endIndex = tagPosition;
                
                // 确保包含class="updated"的内容
                if (updatedIndex !== -1 && endIndex > updatedIndex) {
                    break;
                } else if (updatedIndex === -1) {
                    // 如果没有找到class="updated"，也使用这个闭合标签
                    break;
                }
                // 如果class="updated"在这个闭合标签之后，继续寻找
            }
        }
    }
    
    // 如果找到了对应的闭合标签，提取内容
    if (endIndex !== -1) {
        return html.substring(startIndex, endIndex).trim();
    }
    
    // 如果没有找到对应的闭合标签，但找到了class="updated"，返回从开始位置到html结束的内容
    if (updatedIndex !== -1) {
        return html.substring(startIndex).trim();
    }
    
    // 如果都没有找到，返回从开始位置到结束的所有内容
    return html.substring(startIndex).trim();
}

// 直接 HTTP 抓取
async function scrapeWithDirectHTTP(caseUrl, caseId) {
    try {
        console.log(`🌐 正在抓取: ${caseUrl}...`);
        const response = await axios.get(caseUrl, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
        const content = parseCaseContentDirect(response.data, caseUrl, caseId);
        return { success: true, content, caseId, statusCode: 100 };
    } catch (error) {
        console.error(`❌ ${caseUrl} 抓取失败:`, error.message);
        const statusCode = error.response ? error.response.status : 500;
        return { success: false, caseId, statusCode };
    }
}

// 综合抓取入口
async function scrapeWebsiteContent(caseUrl, caseId) {
    const apiAvailable = await checkBackendAPI();
    if (apiAvailable) {
        // ... API 逻辑保持不变 ...
    }
    return await scrapeWithDirectHTTP(caseUrl, caseId);
}

// 批量更新到 D1
async function updateBatchScrapedContent(results) {
    if (!results.length) return;
    console.log(`\n📊 准备写入数据库: ${results.length} 条...`);
    
    let sqlContent = ''; 
    results.forEach((result, index) => {
        console.log(`\n📝 第 ${index+1} 条数据写入详情:`);
        console.log(`   案例ID: ${result.caseId}`);
        
        if (result.success) {
            const escapedContent = result.content.replace(/'/g, "''");
            console.log(`   状态: 采集成功`);
            console.log(`   HTML状态码: 200`);
            console.log(`   内容长度: ${result.content.length} 字符`);
            console.log(`   更新时间: CURRENT_TIMESTAMP`);
            
            sqlContent += `UPDATE missing_persons_cases SET case_html = '${escapedContent}', html_status = 200, updated_at = CURRENT_TIMESTAMP WHERE case_id = '${result.caseId}';\n`;
        } else {
            console.log(`   状态: 采集失败`);
            console.log(`   HTML状态码: ${result.statusCode}`);
            console.log(`   更新时间: CURRENT_TIMESTAMP`);
            
            sqlContent += `UPDATE missing_persons_cases SET html_status = ${result.statusCode}, updated_at = CURRENT_TIMESTAMP WHERE case_id = '${result.caseId}';\n`;
        }
    });

    const tempSqlPath = path.join(__dirname, `temp_batch.sql`);
    fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
    
    const command = `./node_modules/.bin/wrangler d1 execute ${DATABASE_ID} --remote --file="${tempSqlPath}"`;
    
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 30 * 1024 * 1024 }, (error, stdout) => {
            if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
            if (error) {
                console.error(`❌ 数据库写入失败:`, error.message);
                reject(error);
            } else {
                console.log(`\n📋 数据库写入结果:`);
                console.log(`✅ 写入成功！`);
                if (stdout.includes("Rows affected")) {
                    console.log(`   ${stdout.substring(stdout.indexOf("Rows affected"))}`);
                }
                console.log(`   SQL命令执行输出:`);
                console.log(`   ${stdout.replace(/\n/g, "\n   ")}`);
                resolve(true);
            }
        });
    });
}

// 获取待抓取列表
async function getCasesToScrape() {
    // 只选择html_status=0的记录
    const command = `./node_modules/.bin/wrangler d1 execute ${DATABASE_ID} --remote --json --command="SELECT case_url, case_id FROM missing_persons_cases WHERE html_status = 0 ORDER BY id LIMIT ${BATCH_LIMIT};"`;
    return new Promise((resolve) => {
        exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
            if (error) resolve([]);
            else {
                try {
                    const parsed = JSON.parse(stdout);
                    resolve(parsed[0]?.results || []);
                } catch (e) { resolve([]); }
            }
        });
    });
}

// 主循环
async function main() {
    console.log(`🚀 启动冲刺模式 (单次批处理: ${BATCH_LIMIT})`);
    const cases = await getCasesToScrape();
    if (!cases.length) return console.log('✅ 无待处理任务');

    // 批量将选中记录的html_status设置为100
    console.log(`\n🔄 开始处理，将 ${cases.length} 条记录的html_status设置为100...`);
    let updateInProgressSQL = '';
    cases.forEach(caseItem => {
        updateInProgressSQL += `UPDATE missing_persons_cases SET html_status = 100, updated_at = CURRENT_TIMESTAMP WHERE case_id = '${caseItem.case_id}';\n`;
    });
    
    const tempInProgressSqlPath = path.join(__dirname, `temp_in_progress.sql`);
    fs.writeFileSync(tempInProgressSqlPath, updateInProgressSQL, 'utf8');
    
    const inProgressCommand = `./node_modules/.bin/wrangler d1 execute ${DATABASE_ID} --remote --file="${tempInProgressSqlPath}"`;
    
    // 执行更新命令
    await new Promise((resolve, reject) => {
        exec(inProgressCommand, { maxBuffer: 30 * 1024 * 1024 }, (error, stdout) => {
            if (fs.existsSync(tempInProgressSqlPath)) fs.unlinkSync(tempInProgressSqlPath);
            if (error) {
                console.error(`❌ 设置html_status为100失败:`, error.message);
                reject(error);
            } else {
                console.log(`✅ html_status设置为100完成！`);
                resolve(true);
            }
        });
    });

    let results = [];
    for (let i = 0; i < cases.length; i++) {
        console.log(`\n📋 处理第 ${i+1}/${cases.length} 条: ${cases[i].case_id}`);
        console.log(`🔗 网址: ${cases[i].case_url}`);
        const res = await scrapeWebsiteContent(cases[i].case_url, cases[i].case_id);
        results.push(res);
        
        // 显示采集结果
        if (res.success) {
            console.log(`✅ 采集成功: ${res.caseId}`);
            console.log(`📝 内容预览: ${res.content.substring(0, 100)}...`);
        } else {
            console.log(`❌ 采集失败: ${res.caseId}, 状态码: ${res.statusCode}`);
        }
        
        if (i < cases.length - 1) {
            const delay = 1000 + Math.random() * 2000; // 1-3秒随机延迟
            console.log(`⏱️  等待 ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    
    await updateBatchScrapedContent(results);
    console.log('🎉 任务圆满结束');
}

main();