const axios = require('axios');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const readline = require('readline');

class FormBasedCaseUrlExtractor {
    constructor() {
        this.searchUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.apiUrl = 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet';
        this.urlsFile = path.join(__dirname, 'case-urls-form-based.txt');
        this.jsonFile = path.join(__dirname, 'case-urls-form-based.json');
        this.progressFile = path.join(__dirname, 'scraping-progress-form-based.json');
        
        // 创建readline接口用于用户交互
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // 会话管理
        this.sessionCookies = [];
    }

    async extractAllCaseUrls() {
        console.log('🔍 开始使用表单方式提取所有案件详情页URL...');
        
        try {
            // 首先获取会话cookie
            await this.getSessionCookie();
            
            // 尝试不同的方法来获取数据
            const allCaseUrls = await this.tryMultipleApproaches();
            
            console.log(`\n🎉 提取完成！`);
            console.log(`📊 总计提取到 ${allCaseUrls.length} 个案件详情页URL`);
            console.log(`💾 最终结果已保存至: ${this.urlsFile} 和 ${this.jsonFile}`);
            
            // 关闭readline接口
            this.rl.close();
            
            return allCaseUrls;
            
        } catch (error) {
            console.error('❌ 提取失败:', error.message);
            this.rl.close();
            throw error;
        }
    }

    async getSessionCookie() {
        console.log('🔐 获取会话cookie...');
        
        try {
            const response = await axios.get(this.searchUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
                }
            });
            
            if (response.headers['set-cookie']) {
                this.sessionCookies = response.headers['set-cookie'];
                console.log('✅ 会话cookie获取成功');
            }
            
        } catch (error) {
            console.error('❌ 获取会话cookie失败:', error.message);
        }
    }

    async tryMultipleApproaches() {
        console.log('\n🔄 尝试多种提取方法...');
        
        let allCaseUrls = new Set();
        
        // 方法1: 尝试使用不同的rows参数获取更多数据
        console.log('\n📋 方法1: 尝试获取更多行数据');
        const method1Urls = await this.tryLargeRows();
        method1Urls.forEach(url => allCaseUrls.add(url));
        console.log(`📊 方法1获取到 ${method1Urls.length} 个URL`);
        
        // 方法2: 尝试使用不同的搜索条件
        console.log('\n📋 方法2: 尝试不同的搜索条件');
        const method2Urls = await this.tryDifferentSearchConditions();
        method2Urls.forEach(url => allCaseUrls.add(url));
        console.log(`📊 方法2获取到 ${method2Urls.length} 个URL，总计: ${allCaseUrls.size}`);
        
        // 方法3: 尝试使用不同的caseType
        console.log('\n📋 方法3: 尝试不同的案件类型');
        const method3Urls = await this.tryDifferentCaseTypes();
        method3Urls.forEach(url => allCaseUrls.add(url));
        console.log(`📊 方法3获取到 ${method3Urls.length} 个URL，总计: ${allCaseUrls.size}`);
        
        return Array.from(allCaseUrls);
    }

    async tryLargeRows() {
        try {
            const params = {
                action: 'publicSearch',
                search: 'new',
                searchLang: 'es_US',
                LanguageId: 'es_US',
                caseType: 'All',
                subjToSearch: 'child',
                orderBy: 'MostRecent',
                page: 1,
                rows: 1000, // 尝试获取更多行
                _: Date.now()
            };
            
            const response = await axios.get(this.apiUrl, {
                params: params,
                timeout: 30000,
                headers: this.getHeaders()
            });
            
            if (response.data && response.data.persons) {
                console.log(`📊 尝试获取1000行，实际返回: ${response.data.persons.length} 个案件`);
                return this.extractUrlsFromPersons(response.data.persons);
            }
            
        } catch (error) {
            console.error('❌ 方法1失败:', error.message);
        }
        
        return [];
    }

    async tryDifferentSearchConditions() {
        const conditions = [
            { search: 'new', subjToSearch: 'child' },
            { search: 'all', subjToSearch: 'child' },
            { search: 'new', subjToSearch: 'all' },
            { search: 'all', subjToSearch: 'all' }
        ];
        
        let allUrls = [];
        
        for (const condition of conditions) {
            try {
                const params = {
                    action: 'publicSearch',
                    searchLang: 'es_US',
                    LanguageId: 'es_US',
                    caseType: 'All',
                    orderBy: 'MostRecent',
                    page: 1,
                    rows: 100,
                    _: Date.now(),
                    ...condition
                };
                
                const response = await axios.get(this.apiUrl, {
                    params: params,
                    timeout: 30000,
                    headers: this.getHeaders()
                });
                
                if (response.data && response.data.persons) {
                    const urls = this.extractUrlsFromPersons(response.data.persons);
                    console.log(`📊 条件 ${JSON.stringify(condition)}: ${urls.length} 个URL`);
                    allUrls = allUrls.concat(urls);
                    
                    // 延迟避免请求过快
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`❌ 条件 ${JSON.stringify(condition)} 失败:`, error.message);
            }
        }
        
        return [...new Set(allUrls)]; // 去重
    }

    async tryDifferentCaseTypes() {
        const caseTypes = ['All', 'Missing', 'Endangered', 'Family'];
        
        let allUrls = [];
        
        for (const caseType of caseTypes) {
            try {
                const params = {
                    action: 'publicSearch',
                    search: 'new',
                    searchLang: 'es_US',
                    LanguageId: 'es_US',
                    caseType: caseType,
                    subjToSearch: 'child',
                    orderBy: 'MostRecent',
                    page: 1,
                    rows: 100,
                    _: Date.now()
                };
                
                const response = await axios.get(this.apiUrl, {
                    params: params,
                    timeout: 30000,
                    headers: this.getHeaders()
                });
                
                if (response.data && response.data.persons) {
                    const urls = this.extractUrlsFromPersons(response.data.persons);
                    console.log(`📊 案件类型 ${caseType}: ${urls.length} 个URL`);
                    allUrls = allUrls.concat(urls);
                    
                    // 延迟避免请求过快
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`❌ 案件类型 ${caseType} 失败:`, error.message);
            }
        }
        
        return [...new Set(allUrls)]; // 去重
    }

    extractUrlsFromPersons(persons) {
        const caseUrls = [];
        
        for (const person of persons) {
            if (person.orgPrefix && person.caseNumber && person.seqNumber) {
                // 构建案件详情页URL格式
                const caseUrl = `https://www.missingkids.org/poster/${person.orgPrefix}/${person.caseNumber}/${person.seqNumber}`;
                caseUrls.push(caseUrl);
                
                // 同时添加西班牙语版本
                const spanishCaseUrl = `https://www.missingkids.org/es/poster/${person.orgPrefix}/${person.caseNumber}/${person.seqNumber}`;
                caseUrls.push(spanishCaseUrl);
            }
        }
        
        return [...new Set(caseUrls)]; // 去重
    }

    getHeaders() {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': this.searchUrl,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
        };
        
        // 添加会话cookie
        if (this.sessionCookies.length > 0) {
            headers['Cookie'] = this.sessionCookies.join('; ');
        }
        
        return headers;
    }

    saveResults(caseUrls) {
        try {
            // 保存为TXT文件（每行一个URL）
            fs.writeFileSync(this.urlsFile, caseUrls.join('\n'));
            
            // 保存为JSON文件（包含更多信息）
            const resultData = {
                totalUrls: caseUrls.length,
                extractedAt: new Date().toISOString(),
                urls: caseUrls
            };
            fs.writeFileSync(this.jsonFile, JSON.stringify(resultData, null, 2));
        } catch (error) {
            console.error('❌ 保存结果失败:', error.message);
        }
    }
}

// 运行
async function main() {
    const extractor = new FormBasedCaseUrlExtractor();
    
    console.log('🔧 表单方式提取：尝试多种方法绕过分页限制');
    
    const caseUrls = await extractor.extractAllCaseUrls();
    
    // 保存结果
    extractor.saveResults(caseUrls);
    
    console.log('\n📋 提取到的案件详情页URL示例:');
    caseUrls.slice(0, 10).forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });
}

if (require.main === module) {
    main();
}