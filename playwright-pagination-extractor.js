const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class PlaywrightPaginationExtractor {
    constructor() {
        this.searchUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.urlsFile = path.join(__dirname, 'case-urls-playwright.txt');
        this.jsonFile = path.join(__dirname, 'case-urls-playwright.json');
        this.progressFile = path.join(__dirname, 'scraping-progress-playwright.json');
        
        // 创建readline接口用于用户交互
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.browser = null;
        this.page = null;
        this.maxPages = 188; // 根据API返回的总页数
    }

    async extractAllCaseUrls() {
        console.log('🔍 开始使用Playwright模拟浏览器点击分页...');
        
        try {
            // 启动浏览器
            await this.launchBrowser();
            
            // 导航到搜索页面
            await this.navigateToSearchPage();
            
            // 等待页面加载完成
            await this.waitForPageLoad();
            
            // 提取所有页面的案件URL
            const allCaseUrls = await this.extractWithRealPagination();
            
            console.log(`\n🎉 提取完成！`);
            console.log(`📊 总计提取到 ${allCaseUrls.length} 个案件详情页URL`);
            console.log(`💾 最终结果已保存至: ${this.urlsFile} 和 ${this.jsonFile}`);
            
            // 关闭浏览器
            await this.closeBrowser();
            
            // 关闭readline接口
            this.rl.close();
            
            return allCaseUrls;
            
        } catch (error) {
            console.error('❌ 提取失败:', error.message);
            
            // 确保资源被正确清理
            if (this.browser) {
                await this.closeBrowser();
            }
            this.rl.close();
            throw error;
        }
    }

    async launchBrowser() {
        console.log('🚀 启动浏览器...');
        this.browser = await chromium.launch({
            headless: true, // 设置为false可以看到浏览器操作
            slowMo: 500 // 减慢操作速度，便于观察
        });
        
        this.page = await this.browser.newPage();
        
        // 设置视口大小
        await this.page.setViewportSize({ width: 1280, height: 720 });
        
        console.log('✅ 浏览器启动成功');
    }

    async navigateToSearchPage() {
        console.log('🌐 导航到搜索页面...');
        await this.page.goto(this.searchUrl, { waitUntil: 'networkidle' });
        console.log('✅ 页面加载完成');
    }

    async waitForPageLoad() {
        console.log('⏳ 等待页面内容加载...');
        
        // 等待搜索结果容器加载
        await this.page.waitForSelector('.search-results-container, .pagination, table', { 
            timeout: 30000 
        });
        
        // 等待分页控件加载
        await this.page.waitForSelector('.pagination', { timeout: 10000 }).catch(() => {
            console.log('⚠️  未找到分页控件，可能只有一页数据');
        });
        
        console.log('✅ 页面内容加载完成');
    }

    async extractWithRealPagination() {
        console.log('\n🔄 开始真实分页提取...');
        
        let allCaseUrls = new Set();
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages && currentPage <= this.maxPages) {
            console.log(`\n📄 正在提取第 ${currentPage} 页...`);
            
            try {
                // 提取当前页面的案件URL
                const pageUrls = await this.extractCurrentPageUrls();
                
                if (pageUrls.length > 0) {
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
                    
                    // 检查是否有下一页
                    const hasNextPage = await this.hasNextPage();
                    
                    if (hasNextPage && currentPage < this.maxPages) {
                        // 询问用户是否继续下一页
                        const shouldContinue = await this.askToContinue(currentPage);
                        if (!shouldContinue) {
                            console.log('⏹️  用户选择停止提取');
                            break;
                        }
                        
                        // 点击下一页按钮
                        await this.clickNextPage();
                        
                        // 等待页面加载
                        await this.waitForNextPageLoad();
                        
                        currentPage++;
                    } else {
                        console.log('📄 已到达最后一页');
                        hasMorePages = false;
                    }
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

    async extractCurrentPageUrls() {
        // 尝试多种选择器来提取案件URL
        const selectors = [
            'a[href*="/poster/"]',
            '.search-results-container a',
            'table a',
            '.result-item a'
        ];
        
        for (const selector of selectors) {
            try {
                const urls = await this.page.$$eval(selector, links => 
                    links.map(link => link.href).filter(href => 
                        href.includes('/poster/') && !href.includes('search')
                    )
                );
                
                if (urls.length > 0) {
                    return [...new Set(urls)]; // 去重
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }
        
        // 如果通过选择器无法提取，尝试从页面文本中提取
        const pageContent = await this.page.content();
        const urlRegex = /https:\/\/www\.missingkids\.org\/(es\/)?poster\/[A-Z0-9-]+\/[A-Z0-9-]+\/\d+/g;
        const matches = pageContent.match(urlRegex) || [];
        
        return [...new Set(matches)]; // 去重
    }

    async hasNextPage() {
        try {
            // 检查是否存在下一页按钮
            const nextButton = await this.page.$('.pagination .page-item.next:not(.disabled)');
            return nextButton !== null;
        } catch (error) {
            return false;
        }
    }

    async clickNextPage() {
        console.log('➡️  点击下一页按钮...');
        
        try {
            // 尝试点击">"按钮
            await this.page.click('.pagination .page-item.next:not(.disabled) .page-link');
            
            // 等待短暂的加载时间
            await this.page.waitForTimeout(1000);
            
            console.log('✅ 下一页按钮点击成功');
        } catch (error) {
            console.error('❌ 点击下一页按钮失败:', error.message);
            throw error;
        }
    }

    async waitForNextPageLoad() {
        console.log('⏳ 等待下一页加载...');
        
        // 等待网络请求完成
        await this.page.waitForLoadState('networkidle');
        
        // 等待页面内容更新
        await this.page.waitForTimeout(2000);
        
        console.log('✅ 下一页加载完成');
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

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔚 浏览器已关闭');
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
}

// 运行
async function main() {
    const extractor = new PlaywrightPaginationExtractor();
    
    console.log('🔧 Playwright分页提取：模拟真实浏览器点击分页按钮');
    
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