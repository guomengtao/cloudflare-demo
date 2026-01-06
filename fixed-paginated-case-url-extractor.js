const axios = require('axios');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const readline = require('readline');

class FixedPaginatedCaseUrlExtractor {
    constructor() {
        this.baseUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.apiUrl = 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet';
        this.urlsFile = path.join(__dirname, 'case-urls-fixed.txt');
        this.jsonFile = path.join(__dirname, 'case-urls-fixed.json');
        this.progressFile = path.join(__dirname, 'scraping-progress-fixed.json');
        
        // 每页显示的行数（根据API响应，默认是20个案件）
        this.rowsPerPage = 20;
        this.delayBetweenRequests = 2000; // 增加延迟到2秒
        
        // 创建readline接口用于用户交互
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // 会话管理
        this.sessionCookies = [];
        this.requestCount = 0;
    }

    async extractAllCaseUrls() {
        console.log('🔍 开始提取所有案件详情页URL...');
        
        try {
            // 首先获取总页数
            const totalPages = await this.getTotalPages();
            console.log(`📊 总页数: ${totalPages}`);
            
            // 加载进度
            const progress = this.loadProgress();
            let allCaseUrls = progress.caseUrls || [];
            let uniqueUrls = new Set(allCaseUrls); // 使用Set来去重
            
            // 从上次进度继续
            const startPage = progress.lastPage || 1;
            console.log(`🔄 从第 ${startPage} 页开始继续提取...`);
            
            for (let page = startPage; page <= totalPages; page++) {
                console.log(`\n📄 正在提取第 ${page}/${totalPages} 页...`);
                
                try {
                    const pageCaseUrls = await this.extractCaseUrlsFromPage(page);
                    
                    // 检查是否重复
                    const newUrls = pageCaseUrls.filter(url => !uniqueUrls.has(url));
                    
                    if (newUrls.length === 0 && pageCaseUrls.length > 0) {
                        console.log(`⚠️ 第 ${page} 页返回重复数据，跳过该页`);
                        continue;
                    }
                    
                    // 添加到结果集
                    newUrls.forEach(url => uniqueUrls.add(url));
                    allCaseUrls = Array.from(uniqueUrls);
                    
                    console.log(`✅ 第 ${page} 页提取完成，找到 ${pageCaseUrls.length} 个案件URL`);
                    console.log(`📊 新增 ${newUrls.length} 个URL，当前总计: ${allCaseUrls.length} 个案件URL`);
                    console.log(`💾 结果已保存至: ${this.urlsFile} 和 ${this.jsonFile}`);
                    
                    // 显示当前页提取的URL示例（只显示新的）
                    if (newUrls.length > 0) {
                        console.log('\n📋 新增URL示例:');
                        newUrls.slice(0, 5).forEach((url, index) => {
                            console.log(`  ${index + 1}. ${url}`);
                        });
                    }
                    
                    // 保存进度
                    this.saveProgress({
                        lastPage: page,
                        totalPages: totalPages,
                        caseUrls: allCaseUrls
                    });
                    
                    // 保存结果
                    this.saveResults(allCaseUrls);
                    
                    // 如果不是最后一页，询问用户是否继续
                    if (page < totalPages) {
                        const shouldContinue = await this.askForConfirmation(page, totalPages);
                        if (!shouldContinue) {
                            console.log('⏸️ 用户选择停止提取');
                            break;
                        }
                    }
                    
                    // 增加延迟，避免请求过快
                    await this.delay(this.delayBetweenRequests);
                    
                } catch (error) {
                    console.error(`❌ 第 ${page} 页提取失败:`, error.message);
                    // 询问是否继续下一页
                    const shouldContinue = await this.askForConfirmationAfterError(page, totalPages);
                    if (!shouldContinue) {
                        console.log('⏸️ 用户选择停止提取');
                        break;
                    }
                }
            }
            
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

    async getTotalPages() {
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
                rows: this.rowsPerPage,
                _: Date.now() // 添加时间戳防缓存
            };
            
            const response = await axios.get(this.apiUrl, {
                params: params,
                timeout: 30000,
                headers: this.getHeaders()
            });
            
            if (response.data && response.data.totalPages) {
                return response.data.totalPages;
            } else {
                throw new Error('无法获取总页数');
            }
            
        } catch (error) {
            console.error('❌ 获取总页数失败:', error.message);
            throw error;
        }
    }

    async extractCaseUrlsFromPage(page) {
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
                rows: this.rowsPerPage,
                _: Date.now() // 添加时间戳防缓存
            };
            
            const response = await axios.get(this.apiUrl, {
                params: params,
                timeout: 30000,
                headers: this.getHeaders()
            });
            
            // 保存会话cookie
            if (response.headers['set-cookie']) {
                this.sessionCookies = response.headers['set-cookie'];
            }
            
            if (!response.data || !response.data.persons) {
                console.log(`⚠️ 第 ${page} 页无数据`);
                return [];
            }
            
            // 验证数据是否有效
            if (response.data.thisPage !== page) {
                console.log(`⚠️ 第 ${page} 页返回的页码与实际不符: ${response.data.thisPage}`);
            }
            
            const caseUrls = [];
            
            // 从persons数组中提取案件详情页URL
            for (const person of response.data.persons) {
                if (person.orgPrefix && person.caseNumber && person.seqNumber) {
                    // 构建案件详情页URL格式: https://www.missingkids.org/poster/ORG_PREFIX/CASE_NUMBER/SEQ_NUMBER
                    const caseUrl = `https://www.missingkids.org/poster/${person.orgPrefix}/${person.caseNumber}/${person.seqNumber}`;
                    caseUrls.push(caseUrl);
                    
                    // 同时添加西班牙语版本
                    const spanishCaseUrl = `https://www.missingkids.org/es/poster/${person.orgPrefix}/${person.caseNumber}/${person.seqNumber}`;
                    caseUrls.push(spanishCaseUrl);
                }
            }
            
            this.requestCount++;
            console.log(`📊 第 ${page} 页实际返回 ${response.data.persons.length} 个案件数据`);
            
            return [...new Set(caseUrls)]; // 去重
            
        } catch (error) {
            console.error(`❌ 第 ${page} 页提取失败:`, error.message);
            return [];
        }
    }

    getHeaders() {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': this.baseUrl,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        
        // 添加会话cookie
        if (this.sessionCookies.length > 0) {
            headers['Cookie'] = this.sessionCookies.join('; ');
        }
        
        return headers;
    }

    async askForConfirmation(currentPage, totalPages) {
        return new Promise((resolve) => {
            this.rl.question(`\n⏸️ 第 ${currentPage} 页完成，是否继续提取第 ${currentPage + 1}/${totalPages} 页？(y/n, 默认y): `, (answer) => {
                const shouldContinue = answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no';
                if (shouldContinue) {
                    console.log('🔄 继续下一页...');
                }
                resolve(shouldContinue);
            });
        });
    }

    async askForConfirmationAfterError(currentPage, totalPages) {
        return new Promise((resolve) => {
            this.rl.question(`\n⚠️ 第 ${currentPage} 页提取失败，是否继续提取第 ${currentPage + 1}/${totalPages} 页？(y/n, 默认y): `, (answer) => {
                const shouldContinue = answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no';
                if (shouldContinue) {
                    console.log('🔄 继续下一页...');
                }
                resolve(shouldContinue);
            });
        });
    }

    loadProgress() {
        try {
            if (fs.existsSync(this.progressFile)) {
                const progressData = fs.readFileSync(this.progressFile, 'utf8');
                return JSON.parse(progressData);
            }
        } catch (error) {
            console.log('⚠️ 无法加载进度文件，从头开始');
        }
        return { lastPage: 0, totalPages: 0, caseUrls: [] };
    }

    saveProgress(progress) {
        try {
            fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
        } catch (error) {
            console.error('❌ 保存进度失败:', error.message);
        }
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

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 运行
async function main() {
    const extractor = new FixedPaginatedCaseUrlExtractor();
    
    console.log('🔧 修复版本：添加防缓存和会话管理');
    
    const caseUrls = await extractor.extractAllCaseUrls();
    
    console.log('\n📋 提取到的案件详情页URL示例:');
    caseUrls.slice(0, 10).forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });
}

if (require.main === module) {
    main();
}