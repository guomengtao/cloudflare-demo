const fs = require('fs');
const path = require('path');

// 命令行输出日志
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// 从输入信息中提取案件ID（支持多种格式）
function extractCaseIdFromInput(input) {
    log('🔍 从输入信息中提取案件ID...');
    
    // 查找案件ID行（新格式："案件ID:"）
    const caseIdMatch = input.match(/案件ID:\s+([^\n]+)/i);
    if (caseIdMatch) {
        const caseId = caseIdMatch[1].trim().toLowerCase();
        log(`🆔 提取到案件ID: ${caseId}`);
        return caseId;
    }
    
    // 查找旧格式："案件 case ID是"
    const oldCaseIdMatch = input.match(/案件 case ID是\s+([^\n]+)/i);
    if (oldCaseIdMatch) {
        const caseId = oldCaseIdMatch[1].trim().toLowerCase();
        log(`🆔 提取到案件ID（旧格式）: ${caseId}`);
        return caseId;
    }
    
    // 如果没有找到明确的案件ID，从URL中提取
    const urlMatch = input.match(/案件URL:\s+([^\n]+)/i);
    if (urlMatch) {
        const url = urlMatch[1].trim();
        const urlParts = url.split('/');
        const caseId = urlParts[urlParts.length - 1].trim().toLowerCase();
        log(`🔗 从URL中提取到案件ID: ${caseId}`);
        return caseId;
    }
    
    // 没有找到案件ID
    log('❌ 未找到案件ID');
    return null;
}

// 清理输入信息，只保留案件相关内容
function cleanInputInfo(input) {
    log('🧹 清理输入信息，只保留案件相关内容...');
    
    // 提取图片部分
    const imagesMatch = input.match(/\[images\]([\s\S]*?)\[text\]/i);
    const images = imagesMatch ? imagesMatch[0] : '';
    
    // 提取文本部分，然后清理文本中的无关内容
    const textMatch = input.match(/\[text\]([\s\S]*)/i);
    let text = textMatch ? textMatch[1] : '';
    
    // 移除网站导航和捐赠相关内容
    text = text.replace(/Case Searches.*?MENU/gsi, '');
    text = text.replace(/The Charley Project.*?Donations/gsi, '');
    text = text.replace(/Donations are accepted.*?Read more here\./gsi, '');
    text = text.replace(/Switch to Light Theme|Switch to Dark Theme|Skip to content|Generic selectors|Exact matches only|Search in title|Search in content|Post Type Selectors|Advanced Search/gsi, '');
    
    // 保留案件信息部分（更通用的正则表达式，匹配从案例标题到调查机构的内容）
    const caseInfoMatch = text.match(/([A-Z][a-z\s\.]*?[A-Z][a-z\s\.]*?Missing Since.*?Investigating Agency.*?)/is);
    const caseInfo = caseInfoMatch ? caseInfoMatch[1] : text;
    
    // 重新组合清理后的信息
    return input.replace(/\[images\]([\s\S]*)/i, `[images]${images}[text]\n${caseInfo}`);
}

// 清理JSON字符串中的控制字符
function cleanJsonString(str) {
    // 移除所有控制字符，只保留可打印字符
    return str.replace(/[\x00-\x1F\x7F]/g, '');
}

// 调用AI接口生成网页内容和分析地理位置
async function generateWebpageWithAI(input, caseId) {
    log(`🤖 调用AI接口生成网页内容和分析地理位置: ${caseId}`);
    
    try {
        const aiEndpoint = 'https://old-haze-afbc.guomengtao.workers.dev/v1/models/gemini-2.5-flash:generateContent';
        
        // 清理输入信息，只保留案件相关内容
        const cleanedInput = cleanInputInfo(input);
        
        // 构建详细的提示词，要求AI同时返回网页和地理位置信息
        const prompt = `请根据以下失踪人员信息完成两项任务：

## 任务1：生成网页内容
生成一个完整的 HTML 网页代码，要求：
1. 生成完整的、可运行的 HTML 文件代码
2. 包含完整的 HTML 结构（html, head, body）
3. 包含响应式 CSS 样式（使用 Tailwind CSS）
4. 设计要专业、简洁，适合失踪人员信息展示
5. 包含必要的元数据和 SEO 优化
6. 支持移动端查看
7. 使用中文内容
8. 包含 AMBER 警报相关元素
9. **必须完整包含所有提供的图片和案件信息**
10. **只保留案件信息，绝对不要包含任何采集网站的导航、捐赠、联系信息等无关内容**
11. **必须添加一个AI专业案件分析栏目**，包含以下6个标准模块：
    - 案件画像概览
    - 时空矛盾点分析
    - 潜在风险因素评分
    - 调查突破口建议
    - 类似案件关联
    - 法律与免责声明
12. **在网页顶部突出显示以下四个关键信息**，使用醒目的样式（如加粗、背景色或边框）：
    - 案件ID: ${caseId}
    - 州: [从案件信息中提取]
    - 县: [从案件信息中提取]
    - 城市: [从案件信息中提取]
13. 包含 面包屑导航 首页 》 州 〉县 》 市

## 任务2：分析地理位置
请从案件信息中提取出案件所属的州（State）、县（County）和城市（City）名称。
**注意：**
- 县名是最重要的字段，请优先确保县名的准确性
- 如果明确提到了县名，请直接使用
- 如果没有明确提到县名，但提供了州和城市信息，请根据州和城市推断出对应的县名
- 必须以 JSON 格式返回这三个字段
- 所有字段必须是小写英文
- 如果信息不完整或无法确定，请将对应字段设为 null

## 输入信息：
${cleanedInput}

## 输出格式要求：
请按照以下格式返回结果，不要添加任何额外内容：
{
  "html": "<完整的HTML代码>",
  "location": {
    "state": "州名（小写英文）",
    "county": "县名（小写英文）",
    "city": "城市名（小写英文）"
  }
}`;

        const response = await fetch(`${aiEndpoint}?key=AIzaSyDmVIE4nAIv4-rhSg89zLTNVsNqOMzMcxY`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            }),
            timeout: 60000 // 60秒超时
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || data.error);
        }
        
        // 提取AI返回的内容
        let aiResponse = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            aiResponse = data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('无效的 API 响应格式');
        }
        
        // 清理控制字符
        aiResponse = cleanJsonString(aiResponse);
        
        // 解析AI返回的JSON内容
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(aiResponse);
        } catch (parseError) {
            // 如果解析失败，尝试提取JSON部分
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                // 清理提取出的JSON部分
                const cleanedJson = cleanJsonString(jsonMatch[0]);
                parsedResponse = JSON.parse(cleanedJson);
            } else {
                throw new Error('无法解析AI返回的JSON格式');
            }
        }
        
        // 验证必要字段
        if (!parsedResponse.html) {
            throw new Error('AI返回的内容中缺少html字段');
        }
        
        if (!parsedResponse.location) {
            throw new Error('AI返回的内容中缺少location字段');
        }
        
        // 提取HTML内容
        let htmlContent = parsedResponse.html;
        // 清理HTML代码，提取纯HTML部分
        htmlContent = extractHtmlCode(htmlContent);
        
        // 提取地理位置信息
        const { state, county, city } = parsedResponse.location;
        
        // 文件名只能是案件ID
        const filename = `${caseId}.html`;
        
        return {
            success: true,
            content: htmlContent,
            filename: filename,
            location: {
                state: state ? state.toLowerCase().trim() : null,
                county: county ? county.toLowerCase().trim().replace(/\s+/g, '-') : null,
                city: city ? city.toLowerCase().trim().replace(/\s+/g, '-') : null
            }
        };
    } catch (error) {
        log(`❌ AI接口调用失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 提取纯HTML代码
function extractHtmlCode(text) {
    // 尝试提取 ```html 代码块
    const htmlBlockMatch = text.match(/```html\n([\s\S]*?)\n```/);
    if (htmlBlockMatch) {
        return htmlBlockMatch[1];
    }
    
    // 尝试提取 ``` 代码块
    const codeBlockMatch = text.match(/```\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1];
    }
    
    // 尝试提取 <!DOCTYPE html> 开头的HTML代码
    const htmlStartMatch = text.match(/<!DOCTYPE html>[\s\S]*/);
    if (htmlStartMatch) {
        return htmlStartMatch[0];
    }
    
    // 尝试提取 <html> 开头的HTML代码
    const htmlTagMatch = text.match(/<html[\s\S]*<\/html>/i);
    if (htmlTagMatch) {
        return htmlTagMatch[0];
    }
    
    // 如果没有代码块标记，返回原始文本
    return text;
}

// 创建三级文件夹结构（州/县/城市，使用小写）
function createFolderStructure(state, county, city) {
    // 确保州、县、城市名是小写且单词间用中线连接
    const stateLower = state ? state.toLowerCase().replace(/\s+/g, '-') : 'unknown';
    const countyLower = county ? county.toLowerCase().replace(/\s+/g, '-') : 'unknown';
    const cityLower = city ? city.toLowerCase().replace(/\s+/g, '-') : 'unknown';
    
    const baseDir = path.join(__dirname, '../case');
    const stateDir = path.join(baseDir, stateLower);
    const countyDir = path.join(stateDir, countyLower);
    const cityDir = path.join(countyDir, cityLower);
    
    try {
        // 创建目录结构，只到城市级别
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
        if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
        if (!fs.existsSync(countyDir)) fs.mkdirSync(countyDir, { recursive: true });
        if (!fs.existsSync(cityDir)) fs.mkdirSync(cityDir, { recursive: true });
        
        log(`📁 创建文件夹结构: case/${stateLower}/${countyLower}/${cityLower}`);
        return cityDir;
    } catch (error) {
        log(`❌ 创建文件夹结构失败: ${error.message}`);
        return baseDir; // 如果失败，使用基础目录
    }
}

// 保存网页文件
function saveWebpageFile(content, folderPath, filename) {
    try {
        const filePath = path.join(folderPath, filename);
        fs.writeFileSync(filePath, content, 'utf8');
        log(`✅ 网页文件已保存: ${filePath}`);
        return filePath;
    } catch (error) {
        log(`❌ 保存网页文件失败: ${error.message}`);
        return null;
    }
}

// 主函数
async function main() {
    log('🚀 启动AI网页生成工具');
    
    // 从命令行参数获取输入信息，如果没有则使用默认信息
    let inputInfo = '';
    if (process.argv.length > 2) {
        // 合并所有命令行参数作为输入信息
        inputInfo = process.argv.slice(2).join(' ');
        log('📥 从命令行接收输入信息');
    } else {
        // 使用新的默认输入信息（Julianna M. Alvarez案例）
        inputInfo = `案件URL: https://charleyproject.org/case/julianna-m-alvarez 
 案件ID: julianna-m-alvarez 
 案件标题: Julianna M. Alvarez &#8211; The Charley Project 
 抓取时间: 2026-01-07T15:22:43.205Z 
 
 [images] 
 https://charleyproject.org/wp-content/uploads/2025/10/alvarez_julianna.jpg 
 https://charleyproject.org/wp-content/uploads/2025/10/alvarez_julianna2.jpg 
 https://charleyproject.org/wp-content/uploads/2025/10/alvarez_julianna3.jpg 
 https://charleyproject.org/wp-content/uploads/2025/10/alvarez_julianna4.jpg 
 https://charleyproject.org/wp-content/uploads/2025/10/alvarez_julianna5.jpg 
 https://charleyproject.org/wp-content/uploads/2025/10/alvarez_julianna6.jpg 
 https://charleyproject.org/wp-content/uploads/2025/10/alvarez_julianna7.jpg 
 
 [text] 
 Julianna M. Alvarez &#8211; The Charley Project Case Searches Advanced Search Alphabetical Cases Chronological Cases Geographical Cases Case Updates Updates Updates Archives Resolved Information About Meaghan Blog Contact Meaghan Credits FAQ Site History Resources State and Local Missing Persons Records Facebook Pages for Missing Persons Legal Criteria Corpus Delicti Copyright Information Terms Switch to Light Theme Switch to Dark Theme Skip to content The Charley Project Generic selectors Exact matches only Search in title Search in content Post Type Selectors case Advanced Search MENU Julianna M. Alvarez Alvarez, circa 2012 Missing Since 05/01/2012 Missing From Las Vegas, Nevada Classification Missing Sex Female Race White Date of Birth 12/03/1991 (34) Age 20 years old Height and Weight 5'9, 140 - 160 pounds Clothing/Jewelry Description A pink tank top and black jeans. Distinguishing Characteristics White female. Brown hair, brown eyes. Alvarez has freckles. She has a tattoo on her back of a red rose with her "Julianna" in cursive. She wears eyeglasses. Her nicknames are Juju and Julie, and she has a slight disability in her left arm preventing it from straightening. Details of Disappearance Alvarez was last seen in the 4200 block of North Las Vegas Boulevard in Las Vegas, Nevada on May 1, 2012. She has never been heard from again. Few details are available in her case. Investigating Agency Las Vegas Metropolitan Police Department 702-828-2907 Source Information Las Vegas Metropolitan Police Department NamUs 3 News Updated 1 time since October 12, 2004. Last updated October 3, 2025; casefile added. Case Searches Advanced Search Alphabetical Cases Chronological Cases Geographical Cases Case Updates Updates Updates Archives Resolved Information About Meaghan Blog Contact Meaghan Credits FAQ Site History Resources State and Local Missing Persons Records Facebook Pages for Missing Persons Legal Criteria Corpus Delicti Copyright Information Terms The Charley Project Donations are accepted but not expected; the site remains free-access to all. The Charley Project is NOT a registered non-profit organization and any donations will NOT be tax-deductible. Help support the Charley Project! For regular users, a $10 voluntary subscription fee is requested. You can contribute using Patreon , PayPal , CashApp , or Venmo . Read more here .`;
        log('📋 使用默认输入信息');
    }
    
    // 提取案件ID
    const caseId = extractCaseIdFromInput(inputInfo);
    
    // 验证案件ID是否存在
    log('🔍 验证必要信息...');
    if (!caseId) {
        log('❌ 案件ID缺失，跳过AI生成');
        console.log(JSON.stringify({ success: false, error: 'Missing case ID' }));
        process.exit(1);
    }
    
    // 生成网页内容和分析地理位置
    log('🎨 生成网页内容和分析地理位置...');
    const result = await generateWebpageWithAI(inputInfo, caseId);
    
    if (!result.success) {
        log(`❌ 网页生成失败: ${result.error}`);
        console.log(JSON.stringify({ success: false, error: result.error }));
        process.exit(1);
    }
    
    // 提取地理位置信息
    const { state, county, city } = result.location;
    
    // 输出AI分析的地理位置信息
    log('📍 AI分析的地理位置信息:');
    log(`   州: ${state || '未知'}`);
    log(`   县: ${county || '未知'}`);
    log(`   城市: ${city || '未知'}`);
    
    // 在命令行输出英文小写的地理位置信息
    console.log(JSON.stringify({
        analysis: {
            state: state,
            county: county,
            city: city
        }
    }));
    
    // 验证地理位置信息是否齐全 - 只要县名存在就继续生成
    if (!county) {
        log('❌ 县名信息缺失，跳过网页生成');
        console.log(JSON.stringify({ 
            success: false, 
            error: 'Missing county information',
            analysis: {
                state: state,
                county: county,
                city: city
            }
        }));
        process.exit(1);
    }
    
    log('✅ 地理位置信息验证通过');
    
    // 创建三级文件夹结构（州/县/城市）
    log('📁 创建保存目录...');
    const folderPath = createFolderStructure(state, county, city);
    
    // 保存网页文件（文件名只能是案件ID，直接放在城市目录下）
    log('💾 保存网页文件...');
    const filePath = saveWebpageFile(result.content, folderPath, result.filename);
    
    if (filePath) {
        log('🎉 网页生成完成！');
        const outputResult = {
            success: true,
            caseId: caseId,
            location: {
                state: state,
                county: county,
                city: city
            },
            filePath: filePath,
            filename: result.filename
        };
        console.log(JSON.stringify(outputResult));
        process.exit(0);
    } else {
        log('❌ 网页保存失败');
        console.log(JSON.stringify({ 
            success: false, 
            error: 'Failed to save webpage',
            analysis: {
                state: state,
                county: county,
                city: city
            }
        }));
        process.exit(1);
    }
}

// 执行主函数
main().catch(error => {
    log(`💥 程序执行出错: ${error.message}`);
    console.log(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
});