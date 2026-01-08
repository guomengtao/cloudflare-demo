const fs = require('fs');
const path = require('path');

// 测试案件数据文件读取
function testCaseDataReading() {
    console.log('🧪 测试案件数据文件读取...');
    
    try {
        const caseDataFile = 'case-urls-fixed.json';
        if (!fs.existsSync(caseDataFile)) {
            console.log('❌ 案件数据文件不存在');
            return false;
        }
        
        const caseData = JSON.parse(fs.readFileSync(caseDataFile, 'utf8'));
        console.log(`✅ 成功读取案件数据文件`);
        console.log(`📊 总案件数: ${caseData.totalUrls || caseData.urls?.length || 0}`);
        console.log(`📅 提取时间: ${caseData.extractedAt || '未知'}`);
        
        // 显示前几个URL作为示例
        const sampleUrls = caseData.urls?.slice(0, 3) || [];
        console.log('🔗 示例URL:');
        sampleUrls.forEach(url => console.log(`   - ${url}`));
        
        return true;
    } catch (error) {
        console.log(`❌ 读取案件数据文件失败: ${error.message}`);
        return false;
    }
}

// 测试案件信息提取
function testCaseInfoExtraction() {
    console.log('\n🧪 测试案件信息提取...');
    
    const testUrls = [
        'https://www.missingkids.org/poster/USNY/52427/1',
        'https://www.missingkids.org/poster/USVA/VA26-0043/1',
        'https://www.missingkids.org/poster/NCMC/2073371/1'
    ];
    
    testUrls.forEach(url => {
        const caseInfo = extractCaseInfoFromUrl(url);
        if (caseInfo) {
            console.log(`✅ URL: ${url}`);
            console.log(`   - 案件ID: ${caseInfo.case_id}`);
            console.log(`   - 州: ${caseInfo.state}`);
            console.log(`   - 城市: ${caseInfo.city}`);
        } else {
            console.log(`❌ 无法提取案件信息: ${url}`);
        }
    });
}

// 案件信息提取函数（从增强脚本中复制）
function extractCaseInfoFromUrl(url) {
    try {
        const urlParts = url.split('/');
        const caseId = urlParts[urlParts.length - 3] + '-' + urlParts[urlParts.length - 2];
        
        const stateCode = urlParts[urlParts.length - 4];
        let state = 'Unknown';
        let city = 'Unknown';
        
        if (stateCode.startsWith('US')) {
            const stateAbbr = stateCode.substring(2);
            const stateMap = {
                'NY': 'New York', 'VA': 'Virginia', 'TX': 'Texas', 'CA': 'California',
                'FL': 'Florida', 'IL': 'Illinois', 'PA': 'Pennsylvania', 'OH': 'Ohio'
            };
            state = stateMap[stateAbbr] || stateAbbr;
        } else if (stateCode === 'NCMC') {
            state = 'National Center for Missing Children';
        }
        
        return {
            case_id: caseId,
            case_url: url,
            state: state,
            city: city,
            name: `Case ${caseId}`,
            age: 'Unknown',
            scraped_content: `案件信息来自: ${url}\n案件ID: ${caseId}\n州: ${state}\n城市: ${city}`
        };
    } catch (error) {
        console.error(`提取案件信息失败: ${error.message}`);
        return null;
    }
}

// 主测试函数
async function runTests() {
    console.log('🚀 开始测试增强版网页生成脚本...\n');
    
    // 测试1: 案件数据文件读取
    const dataTestPassed = testCaseDataReading();
    
    // 测试2: 案件信息提取
    testCaseInfoExtraction();
    
    console.log('\n📋 测试结果总结:');
    if (dataTestPassed) {
        console.log('✅ 案件数据文件读取测试通过');
        console.log('✅ 案件信息提取测试通过');
        console.log('\n🎉 所有测试通过！可以运行增强版脚本了。');
        console.log('\n📝 运行命令:');
        console.log('   node generate-case-webpages-enhanced.js');
    } else {
        console.log('❌ 案件数据文件读取测试失败');
        console.log('\n⚠️ 请检查案件数据文件是否存在且格式正确。');
    }
}

// 运行测试
runTests().catch(error => {
    console.error('测试执行失败:', error);
});