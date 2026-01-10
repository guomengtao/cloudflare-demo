const fs = require('fs');
const path = require('path');

// 读取模板文件
const template = fs.readFileSync('./refactor_template.html', 'utf8');

// 递归查找所有HTML文件，但只处理州、县、市级别（深度不超过3层）
function findCaseFiles(dir, depth = 0, maxDepth = 3) {
    const files = [];
    
    if (depth > maxDepth) return files;
    
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                // 递归查找子目录
                files.push(...findCaseFiles(fullPath, depth + 1, maxDepth));
            } else if (stat.isFile() && item.endsWith('.html') && !item.startsWith('case_')) {
                // 只处理非测试文件
                files.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error.message);
    }
    
    return files;
}

// 解析原始页面内容并提取信息
function parseCaseContent(htmlContent) {
    const result = {
        name: '',
        age: '',
        gender: '',
        height: '',
        weight: '',
        bloodType: '',
        missingDate: '',
        missingLocation: '',
        photoUrl: '',
        caseDetails: '',
        policeContact: '',
        distinctiveFeatures: [],
        timelineEvents: []
    };
    
    try {
        // 提取姓名
        const nameMatch = htmlContent.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (nameMatch) result.name = nameMatch[1].trim();
        
        // 提取年龄
        const ageMatch = htmlContent.match(/当前年龄[^>]*>([^<]+)<\/p>/i) || 
                        htmlContent.match(/\d+岁/i);
        if (ageMatch) result.age = ageMatch[1] ? ageMatch[1].trim() : ageMatch[0];
        
        // 提取性别
        const genderMatch = htmlContent.match(/性别[^>]*>([^<]+)<\/p>/i);
        if (genderMatch) result.gender = genderMatch[1].trim();
        
        // 提取身高
        const heightMatch = htmlContent.match(/身高[^>]*>([^<]+)<\/p>/i);
        if (heightMatch) result.height = heightMatch[1].trim();
        
        // 提取体重
        const weightMatch = htmlContent.match(/体重[^>]*>([^<]+)<\/p>/i);
        if (weightMatch) result.weight = weightMatch[1].trim();
        
        // 提取血型
        const bloodMatch = htmlContent.match(/血型[^>]*>([^<]+)<\/p>/i);
        if (bloodMatch) result.bloodType = bloodMatch[1].trim();
        
        // 提取失踪日期
        const dateMatch = htmlContent.match(/失踪日期[^>]*>([^<]+)<\/p>/i);
        if (dateMatch) result.missingDate = dateMatch[1].trim();
        
        // 提取失踪地点
        const locationMatch = htmlContent.match(/失踪地点[^>]*>([^<]+)<\/p>/i);
        if (locationMatch) result.missingLocation = locationMatch[1].trim();
        
        // 提取照片URL
        const photoMatch = htmlContent.match(/<img[^>]*src="([^"]+)"[^>]*alt="[^"]*案件姓名[^"]*"[^>]*>/i) ||
                          htmlContent.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*object-cover[^"]*"[^>]*>/i);
        if (photoMatch) result.photoUrl = photoMatch[1];
        
        // 提取案件详情
        const detailsMatch = htmlContent.match(/案件详情[^>]*>([\s\S]*?)<\/p>/i);
        if (detailsMatch) result.caseDetails = detailsMatch[1].trim();
        
        // 提取警方联系方式
        const policeMatch = htmlContent.match(/警方联系[^>]*>([\s\S]*?)<\/p>/i);
        if (policeMatch) result.policeContact = policeMatch[1].trim();
        
    } catch (error) {
        console.error('Error parsing HTML:', error);
    }
    
    return result;
}

// 生成重构后的HTML内容
function generateRefactoredHTML(caseData, originalContent) {
    let newHTML = template;
    
    // 替换基本信息
    newHTML = newHTML.replace(/案件标题/g, caseData.name || '失踪案件');
    newHTML = newHTML.replace(/案件姓名/g, caseData.name || '未知姓名');
    newHTML = newHTML.replace(/失踪日期/g, caseData.missingDate || '未知日期');
    newHTML = newHTML.replace(/失踪地点/g, caseData.missingLocation || '未知地点');
    newHTML = newHTML.replace(/年龄/g, caseData.age || '未知');
    newHTML = newHTML.replace(/性别/g, caseData.gender || '未知');
    newHTML = newHTML.replace(/身高/g, caseData.height || '未知');
    newHTML = newHTML.replace(/体重/g, caseData.weight || '未知');
    newHTML = newHTML.replace(/血型/g, caseData.bloodType || '未知');
    
    // 替换照片URL
    if (caseData.photoUrl) {
        newHTML = newHTML.replace(/案件照片URL/g, caseData.photoUrl);
        newHTML = newHTML.replace(/照片URL1/g, caseData.photoUrl);
        newHTML = newHTML.replace(/照片URL2/g, caseData.photoUrl);
    }
    
    // 计算失踪时长
    if (caseData.missingDate) {
        const missingYear = parseInt(caseData.missingDate.match(/\d{4}/)?.[0]);
        if (missingYear) {
            const currentYear = new Date().getFullYear();
            const missingYears = currentYear - missingYear;
            newHTML = newHTML.replace(/失踪时长/g, `${missingYears}年`);
        }
    }
    
    return newHTML;
}

// 主函数
function main() {
    const caseDir = './case';
    const caseFiles = findCaseFiles(caseDir);
    
    console.log(`找到 ${caseFiles.length} 个案件文件需要重构`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const filePath of caseFiles) {
        try {
            console.log(`处理文件: ${filePath}`);
            
            // 读取原始文件内容
            const originalContent = fs.readFileSync(filePath, 'utf8');
            
            // 解析案件信息
            const caseData = parseCaseContent(originalContent);
            
            // 生成重构后的内容
            const refactoredContent = generateRefactoredHTML(caseData, originalContent);
            
            // 备份原始文件
            const backupPath = filePath + '.backup';
            if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(filePath, backupPath);
            }
            
            // 写入重构后的内容
            fs.writeFileSync(filePath, refactoredContent, 'utf8');
            
            processedCount++;
            console.log(`✓ 成功重构: ${path.basename(filePath)}`);
            
        } catch (error) {
            errorCount++;
            console.error(`✗ 处理失败: ${filePath}`, error.message);
        }
    }
    
    console.log(`\n重构完成！`);
    console.log(`成功处理: ${processedCount} 个文件`);
    console.log(`处理失败: ${errorCount} 个文件`);
    
    if (errorCount > 0) {
        console.log('\n注意：部分文件处理失败，原始文件已备份为 .backup 文件');
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = { findCaseFiles, parseCaseContent, generateRefactoredHTML };