const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

class PreciseCaseUrlExtractor {
    constructor() {
        this.baseUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.apiUrl = 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet';
        this.outputFile = path.join(__dirname, 'case-urls-precise.txt');
        this.progressFile = path.join(__dirname, 'scraping-progress-precise.json');
    }

    async extract() {
        console.log('🚀 开始精确提取案件详情页URL...');
        console.log('📝 目标格式: poster/NCMC/xxxxxx/1 或 es/poster/USNY/xxxxx/1');
        
        try {
            // 方法1: 模拟表单提交获取真实搜索结果
            const formUrls = await this.simulateFormSubmission();
            
            // 方法2: 直接API调用获取案件数据
            const apiUrls = await this.directApiCall();
            
            // 合并结果并去重
            const allUrls = [...new Set([...formUrls, ...apiUrls])];
            
            // 过滤出正确的案件详情页URL
            const caseDetailUrls = allUrls.filter(url => this.isCaseDetailUrl(url));
            
            // 保存结果
            this.saveUrls(caseDetailUrls);
            
            console.log(`🎉 提取完成! 总共找到 ${caseDetailUrls.length} 个案件详情页URL`);
            console.log(`💾 结果已保存: ${this.outputFile}`);
            
            return caseDetailUrls;
            
        } catch (error) {
            console.error('❌ 提取失败:', error.message);
            return [];
        }
    }

    async simulateFormSubmission() {
        const urls = new Set();
        
        console.log('🔍 模拟表单提交获取搜索结果...');
        
        try {
            // 构建表单数据 - 使用空搜索条件获取所有案件
            const formData = {
                action: 'publicSearch',
                search: 'new',
                searchLang: 'es_US',
                LanguageId: 'es_US',
                caseType: 'All',
                subjToSearch: 'child', // 搜索儿童案件
                orderBy: 'MostRecent', // 按最新排序
                firstName: '', // 空姓名 - 获取所有案件
                lastName: '',
                missCity: '', // 空城市
                missState: 'All', // 所有州
                missCountry: 'All', // 所有国家
                zip: '',
                page: 1
            };
            
            // 发送POST请求模拟表单提交
            const response = await axios.post(this.apiUrl, querystring.stringify(formData), {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl,
                    'Origin': 'https://www.missingkids.org'
                }
            });
            
            // 解析API响应，提取案件详情页URL
            if (response.data) {
                const foundUrls = this.extractUrlsFromApiResponse(response.data);
                foundUrls.forEach(url => urls.add(url));
            }
            
        } catch (error) {
            console.log('⚠️ 表单提交失败:', error.message);
        }
        
        return Array.from(urls);
    }

    async directApiCall() {
        const urls = new Set();
        
        console.log('🔍 直接API调用获取案件数据...');
        
        try {
            // 构建API请求参数
            const params = {
                action: 'publicSearch',
                search: 'new',
                searchLang: 'es_US',
                LanguageId: 'es_US',
                caseType: 'All',
                subjToSearch: 'child',
                orderBy: 'MostRecent',
                page: 1,
                rows: 50 // 获取更多结果
            };
            
            const response = await axios.get(this.apiUrl, {
                params: params,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl
                }
            });
            
            // 解析API响应
            if (response.data) {
                const foundUrls = this.extractUrlsFromApiResponse(response.data);
                foundUrls.forEach(url => urls.add(url));
            }
            
        } catch (error) {
            console.log('⚠️ 直接API调用失败:', error.message);
        }
        
        return Array.from(urls);
    }

    extractUrlsFromApiResponse(data) {
        const urls = [];
        
        try {
            // 尝试解析JSON数据
            let jsonData;
            if (typeof data === 'string') {
                jsonData = JSON.parse(data);
            } else {
                jsonData = data;
            }
            
            // 递归遍历JSON对象，查找案件详情页URL
            this.traverseJsonForCaseUrls(jsonData, urls);
            
        } catch (error) {
            // 如果不是JSON，尝试正则匹配
            console.log('⚠️ JSON解析失败，尝试正则匹配...');
            const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
            this.extractUrlsWithRegex(dataStr, urls);
        }
        
        return urls;
    }

    traverseJsonForCaseUrls(obj, urls) {
        if (!obj || typeof obj !== 'object') return;
        
        if (Array.isArray(obj)) {
            obj.forEach(item => this.traverseJsonForCaseUrls(item, urls));
        } else if (typeof obj === 'object') {
            // 检查当前对象是否包含案件详情页URL
            Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'string' && this.isCaseDetailUrl(value)) {
                    const fullUrl = this.makeAbsoluteUrl(value);
                    urls.push(fullUrl);
                } else {
                    this.traverseJsonForCaseUrls(value, urls);
                }
            });
        }
    }

    extractUrlsWithRegex(dataStr, urls) {
        // 案件详情页URL模式
        const urlPatterns = [
            /\/poster\/(NCMC|AMBER|USNY)\/\d+\/\d+/g, // /poster/NCMC/2073136/1
            /https?:\/\/[^"\s]*\/poster\/(NCMC|AMBER|USNY)\/\d+\/\d+/gi, // 完整URL
            /\/es\/poster\/(NCMC|AMBER|USNY)\/\d+\/\d+/g, // 西班牙语版
            /https?:\/\/[^"\s]*\/es\/poster\/(NCMC|AMBER|USNY)\/\d+\/\d+/gi // 完整西班牙语URL
        ];
        
        urlPatterns.forEach(pattern => {
            const matches = dataStr.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const fullUrl = this.makeAbsoluteUrl(match);
                    if (this.isCaseDetailUrl(fullUrl)) {
                        urls.push(fullUrl);
                    }
                });
            }
        });
    }

    isCaseDetailUrl(url) {
        // 检查URL是否符合案件详情页格式
        const casePatterns = [
            /\/poster\/(NCMC|AMBER|USNY)\/\d+\/\d+/i,
            /\/es\/poster\/(NCMC|AMBER|USNY)\/\d+\/\d+/i
        ];
        
        return casePatterns.some(pattern => pattern.test(url)) && 
               !url.includes('photographs') && // 排除图片URL
               !url.includes('gethelpnow') && // 排除搜索页面
               !url.includes('blog'); // 排除博客页面
    }

    makeAbsoluteUrl(url) {
        if (url.startsWith('http')) {
            return url;
        }
        if (url.startsWith('//')) {
            return 'https:' + url;
        }
        if (url.startsWith('/')) {
            return 'https://www.missingkids.org' + url;
        }
        return 'https://www.missingkids.org/' + url;
    }

    saveUrls(urls) {
        // 过滤和去重
        const filteredUrls = urls.filter(url => 
            url && 
            this.isCaseDetailUrl(url) &&
            !url.includes('photographs') // 确保不是图片URL
        );
        
        const uniqueUrls = [...new Set(filteredUrls)];
        
        // 保存文本格式
        const content = uniqueUrls.join('\n');
        fs.writeFileSync(this.outputFile, content);
        
        // 保存JSON格式
        const jsonContent = {
            timestamp: new Date().toISOString(),
            totalUrls: uniqueUrls.length,
            urls: uniqueUrls
        };
        fs.writeFileSync(
            this.outputFile.replace('.txt', '.json'),
            JSON.stringify(jsonContent, null, 2)
        );
        
        // 保存进度
        const progress = {
            lastRun: new Date().toISOString(),
            totalUrlsFound: uniqueUrls.length,
            urls: uniqueUrls
        };
        fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
        
        // 显示提取的URL示例
        if (uniqueUrls.length > 0) {
            console.log('📋 提取的URL示例:');
            uniqueUrls.slice(0, 3).forEach((url, index) => {
                console.log(`   ${index + 1}. ${url}`);
            });
            if (uniqueUrls.length > 3) {
                console.log(`   ... 还有 ${uniqueUrls.length - 3} 个URL`);
            }
        }
    }
}

// 运行
async function main() {
    const extractor = new PreciseCaseUrlExtractor();
    await extractor.extract();
}

if (require.main === module) {
    main();
}