const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class PaginationClickExtractor {
    constructor() {
        this.searchUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.apiUrl = 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet';
        this.urlsFile = path.join(__dirname, 'case-urls-pagination-click.txt');
        this.jsonFile = path.join(__dirname, 'case-urls-pagination-click.json');
        this.progressFile = path.join(__dirname, 'scraping-progress-pagination-click.json');
        
        // 创建readline接口用于用户交互
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // 会话管理
        this.sessionCookies = [];
        this.currentPage = 1;
        this.maxPages = 188; // 根据API返回的总页数
    }

    async extractAllCaseUrls() {
        console.log('🔍 开始使用分页点击方式提取所有案件详情页URL...');
        
        try {
            // 首先获取会话cookie
            await this.getSessionCookie();
            
            // 获取第一页数据
            const allCaseUrls = await this.extractWithPagination();
            
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

    async extractWithPagination() {
        console.log('\n🔄 开始分页提取...');
        
        let allCaseUrls = new Set();
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages && currentPage <= this.maxPages) {
            console.log(`\n📄 正在提取第 ${currentPage} 页...`);
            
            try {
                // 模拟点击分页按钮的请求
                const pageData = await this.getPageData(currentPage);
                
                if (pageData && pageData.persons && pageData.persons.length > 0) {
                    const pageUrls = this.extractUrlsFromPersons(pageData.persons);
                    console.log(`📊 第 ${currentPage} 页获取到 ${pageUrls.length} 个URL`);
                    
                    // 检查是否有重复数据
                    const newUrls = pageUrls.filter(url => !allCaseUrls.has(url));
                    if (newUrls.length === 0 && pageUrls.length > 0) {
                        console.log('⚠️  检测到重复数据，可能已到达最后一页');
                        hasMorePages = false;
                        break;
                    }
                    
                    // 添加新URL
                    newUrls.forEach(url => allCaseUrls.add(url));
                    console.log(`📊 新增 ${newUrls.length} 个URL，总计: ${allCaseUrls.size}`);
                    
                    // 保存进度
                    this.saveProgress(currentPage, Array.from(allCaseUrls));
                    
                    // 询问用户是否继续下一页
                    if (currentPage < this.maxPages) {
                        const shouldContinue = await this.askToContinue(currentPage);
                        if (!shouldContinue) {
                            console.log('⏹️  用户选择停止提取');
                            break;
                        }
                    }
                    
                    currentPage++;
                    
                    // 延迟避免请求过快
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.log('❌ 未获取到数据，可能已到达最后一页');
                    hasMorePages = false;
                }
                
            } catch (error) {
                console.error(`❌ 第 ${currentPage} 页提取失败:`, error.message);
                
                // 询问用户是否重试或继续
                const shouldRetry = await this.askToRetry(currentPage);
                if (!shouldRetry) {
                    console.log('⏹️  用户选择停止提取');
                    break;
                }
            }
        }
        
        return Array.from(allCaseUrls);
    }

    async getPageData(pageNumber) {
        // 模拟点击分页按钮的请求参数
        const params = {
            action: 'publicSearch',
            search: 'new',
            searchLang: 'es_US',
            LanguageId: 'es_US',
            caseType: 'All',
            subjToSearch: 'child',
            orderBy: 'MostRecent',
            page: pageNumber,
            rows: 20,
            _: Date.now() // 添加时间戳防止缓存
        };
        
        const response = await axios.get(this.apiUrl, {
            params: params,
            timeout: 30000,
            headers: this.getHeaders()
        });
        
        // 验证返回的页码是否正确
        if (response.data && response.data.thisPage !== pageNumber) {
            console.log(`⚠️  请求第 ${pageNumber} 页，但返回第 ${response.data.thisPage} 页数据`);
            
            // 如果返回的是第1页数据，说明可能已经到达最后一页
            if (response.data.thisPage === 1 && pageNumber > 1) {
                return null;
            }
        }
        
        return response.data;
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

    async askToContinue(currentPage) {
        return new Promise((resolve) => {
            this.rl.question(`📋 是否继续提取第 ${currentPage + 1} 页？(y/n, 默认y): `, (answer) => {
                const shouldContinue = answer.toLowerCase() !== 'n';
                resolve(shouldContinue);
            });
        });
    }

    async askToRetry(currentPage) {
        return new Promise((resolve) => {
            this.rl.question(`❌ 第 ${currentPage} 页提取失败，是否重试？(y/n, 默认y): `, (answer) => {
                const shouldRetry = answer.toLowerCase() !== 'n';
                resolve(shouldRetry);
            });
        });
    }

    saveProgress(currentPage, caseUrls) {
        try {
            const progress = {
                lastPage: currentPage,
                totalUrls: caseUrls.length,
                savedAt: new Date().toISOString(),
                urls: caseUrls
            };
            fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
        } catch (error) {
            console.error('❌ 保存进度失败:', error.message);
        }
    }

    loadProgress() {
        try {
            if (fs.existsSync(this.progressFile)) {
                const progress = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
                console.log(`📋 发现进度文件，上次提取到第 ${progress.lastPage} 页，共 ${progress.totalUrls} 个URL`);
                return progress;
            }
        } catch (error) {
            console.error('❌ 加载进度失败:', error.message);
        }
        return null;
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
    const extractor = new PaginationClickExtractor();
    
    console.log('🔧 分页点击方式提取：模拟点击分页按钮获取数据');
    
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