const axios = require('axios');
const fs = require('fs');

async function debugPagination() {
    console.log('🔍 调试API分页机制...');
    
    const apiUrl = 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet';
    
    // 测试不同的分页参数
    const testPages = [1, 2, 3, 4];
    
    for (const page of testPages) {
        console.log(`\n=== 测试第 ${page} 页 ===`);
        
        try {
            const params = {
                action: 'publicSearch',
                search: 'new',
                searchLang: 'es_US',
                LanguageId: 'es_US',
                caseType: 'All',
                subjToSearch: 'child',
                orderBy: 'MostRecent',
                page: page,
                rows: 20,
                _: Date.now()
            };
            
            const response = await axios.get(apiUrl, {
                params: params,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (response.data) {
                console.log(`📊 返回页码: ${response.data.thisPage}`);
                console.log(`📊 总页数: ${response.data.totalPages}`);
                console.log(`📊 总记录数: ${response.data.totalRecords}`);
                console.log(`📊 返回案件数: ${response.data.persons ? response.data.persons.length : 0}`);
                
                // 显示前几个案件的caseNumber用于比较
                if (response.data.persons && response.data.persons.length > 0) {
                    console.log('📋 前5个案件的caseNumber:');
                    response.data.persons.slice(0, 5).forEach((person, index) => {
                        console.log(`  ${index + 1}. ${person.caseNumber} (${person.orgPrefix})`);
                    });
                }
                
                // 检查是否与第一页相同
                if (page > 1) {
                    const firstPageResponse = await axios.get(apiUrl, {
                        params: { ...params, page: 1 },
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    });
                    
                    if (firstPageResponse.data.persons && response.data.persons) {
                        const firstPageCaseNumbers = firstPageResponse.data.persons.map(p => p.caseNumber);
                        const currentPageCaseNumbers = response.data.persons.map(p => p.caseNumber);
                        
                        const isSameData = JSON.stringify(firstPageCaseNumbers) === JSON.stringify(currentPageCaseNumbers);
                        console.log(`🔍 与第1页数据相同: ${isSameData}`);
                    }
                }
            }
            
            // 延迟1秒避免请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ 第 ${page} 页测试失败:`, error.message);
        }
    }
    
    console.log('\n=== 测试其他分页参数 ===');
    
    // 测试使用不同的orderBy参数
    const orderByOptions = ['MostRecent', 'OldestFirst', 'Alphabetical'];
    
    for (const orderBy of orderByOptions) {
        console.log(`\n🔍 测试排序方式: ${orderBy}`);
        
        try {
            const params = {
                action: 'publicSearch',
                search: 'new',
                searchLang: 'es_US',
                LanguageId: 'es_US',
                caseType: 'All',
                subjToSearch: 'child',
                orderBy: orderBy,
                page: 2, // 测试第2页
                rows: 20,
                _: Date.now()
            };
            
            const response = await axios.get(apiUrl, {
                params: params,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (response.data) {
                console.log(`📊 返回页码: ${response.data.thisPage}`);
                console.log(`📊 返回案件数: ${response.data.persons ? response.data.persons.length : 0}`);
                
                if (response.data.persons && response.data.persons.length > 0) {
                    console.log('📋 前3个案件的caseNumber:');
                    response.data.persons.slice(0, 3).forEach((person, index) => {
                        console.log(`  ${index + 1}. ${person.caseNumber} (${person.orgPrefix})`);
                    });
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ 排序方式 ${orderBy} 测试失败:`, error.message);
        }
    }
}

// 运行调试
debugPagination().catch(console.error);