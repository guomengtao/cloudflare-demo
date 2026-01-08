const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 记录已处理案件ID的文件
const PROCESSED_CASES_FILE = 'processed-cases.txt';
const LOG_FILE = 'webpage-generation.log';

// 获取已处理的案件ID列表
function getProcessedCaseIds() {
    try {
        if (fs.existsSync(PROCESSED_CASES_FILE)) {
            const content = fs.readFileSync(PROCESSED_CASES_FILE, 'utf8');
            return new Set(content.split('\n').filter(line => line.trim()));
        }
    } catch (error) {
        console.error('读取已处理案件文件失败:', error);
    }
    return new Set();
}

// 记录已处理的案件ID
function recordProcessedCaseId(caseId) {
    try {
        fs.appendFileSync(PROCESSED_CASES_FILE, caseId + '\n', 'utf8');
    } catch (error) {
        console.error('记录案件ID失败:', error);
    }
}

// 记录日志
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    try {
        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (error) {
        console.error('记录日志失败:', error);
    }
}

// 等待函数（带倒计时显示）
function wait(seconds) {
    return new Promise((resolve) => {
        log(`等待 ${seconds} 秒...`);
        let remaining = seconds;
        
        const interval = setInterval(() => {
            process.stdout.write(`\r⏰ 倒计时: ${remaining} 秒   `);
            remaining--;
            
            if (remaining < 0) {
                clearInterval(interval);
                process.stdout.write('\r✅ 等待完成!           \n');
                resolve();
            }
        }, 1000);
    });
}

// 随机等待5-15秒
async function randomWait() {
    const seconds = Math.floor(Math.random() * 11) + 5; // 5-15秒
    await wait(seconds);
}

// 从数据库获取案件信息（模拟数据库查询）
async function getCaseFromDatabase() {
    try {
        // 这里模拟从数据库查询案件信息
        // 实际应用中应该替换为真实的数据库查询
        const cases = await getCasesToScrape();
        if (cases && cases.length > 0) {
            return cases[0]; // 每次只取一条
        }
        return null;
    } catch (error) {
        log(`数据库查询失败: ${error.message}`);
        return null;
    }
}

// 获取需要处理的案件（模拟数据库查询）
async function getCasesToScrape() {
    try {
        // 这里应该替换为真实的数据库查询
        // 模拟返回一些案件数据
        return [
            {
                case_id: 'randolph-alger',
                case_url: 'https://www.missingkids.org/poster/NCMC/2073371/15284/screen',
                state: 'Idaho',
                city: 'Monteview',
                scraped_content: '案件内容...'
            }
        ];
    } catch (error) {
        log(`获取案件列表失败: ${error.message}`);
        return [];
    }
}

// 调用AI接口生成网页内容
async function generateWebpageWithAI(caseData) {
    try {
        log(`调用AI接口生成网页内容: ${caseData.case_id}`);
        
        // 使用新的有效API接口
        const aiEndpoint = 'https://old-haze-afbc.guomengtao.workers.dev/v1/models/gemini-2.5-flash:generateContent';
        
        // 限制案件内容长度，避免请求过大
        const contentPreview = caseData.scraped_content 
            ? caseData.scraped_content.substring(0, 2000) + (caseData.scraped_content.length > 2000 ? '...' : '')
            : '无详细信息';
        
        // 构建详细的提示词
        const prompt = `请根据以下失踪人员信息生成一个完整的 HTML 网页代码：

失踪人员信息：
- 案件ID: ${caseData.case_id}
- 姓名: ${caseData.name || '未知'}
- 年龄: ${caseData.age || '未知'}
- 失踪地点: ${caseData.city || '未知'}, ${caseData.state || '未知州'}
- 案件URL: ${caseData.case_url || '无'}
- 案件内容预览: ${contentPreview}

网页要求：
1. 生成完整的、可运行的 HTML 文件代码
2. 包含完整的 HTML 结构（html, head, body）
3. 包含响应式 CSS 样式（使用 Tailwind CSS）
4. 设计要专业、简洁，适合失踪人员信息展示
5. 包含必要的元数据和 SEO 优化
6. 支持移动端查看
7. 使用中文内容
8. 包含 AMBER 警报相关元素

请直接返回完整的 HTML 代码，不要额外的解释文字。`;

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
            timeout: 30000 // 30秒超时
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || data.error);
        }
        
        // 提取生成的HTML内容
        let htmlContent = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            htmlContent = data.candidates[0].content.parts[0].text;
            // 清理HTML代码，提取纯HTML部分
            htmlContent = extractHtmlCode(htmlContent);
        } else {
            throw new Error('无效的 API 响应格式');
        }
        
        // 直接返回生成的HTML内容
        return {
            success: true,
            content: htmlContent,
            filename: generateFilename(caseData)
        };
    } catch (error) {
        log(`AI接口调用失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 提取纯HTML代码（增强版）
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
    
    // 如果没有代码块标记，返回原始文本
    return text;
}

// 生成文件名（使用小写case_id）
function generateFilename(caseData) {
    const state = (caseData.state || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const city = (caseData.city || 'unknown').toLowerCase().replace(/\s+/g, '-');
    return `${caseData.case_id}-${city}-${state}.html`; // 使用小写case_id-城市-州.html格式
}

// 生成网页模板（使用Tailwind CSS）
function generateWebpageTemplate(caseData) {
    const caseId = caseData.case_id;
    const state = caseData.state || 'Unknown';
    const city = caseData.city || 'Unknown';
    
    // 解析案件内容获取详细信息
    const caseInfo = parseCaseContent(caseData.scraped_content);
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${caseInfo.name || caseId} 失踪 - AMBER警报 | ${caseInfo.age || '未知年龄'}在${state}州${city}失踪</title>
    <meta name="description" content="${caseInfo.name || caseId}, ${caseInfo.age || '未知年龄'}, AMBER警报案件，在${state}州${city}市失踪。如有线索请立即联系警方。">
    <meta name="keywords" content="${caseInfo.name || caseId}, AMBER警报, 失踪儿童, ${city}失踪, ${state}州, ${caseId}">
    
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    animation: {
                        'pulse-amber': 'pulse 2s infinite',
                        'bounce-gentle': 'bounce 1s infinite',
                        'fade-in': 'fadeIn 0.5s ease-in-out',
                        'slide-up': 'slideUp 0.6s ease-out'
                    },
                    keyframes: {
                        fadeIn: {
                            '0%': { opacity: '0', transform: 'translateY(10px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' }
                        },
                        slideUp: {
                            '0%': { opacity: '0', transform: 'translateY(20px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' }
                        }
                    }
                }
            }
        }
    </script>
    
    <!-- Font Awesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Schema.org 结构化数据 -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "${caseInfo.name || caseId.toUpperCase()}",
        "description": "${caseInfo.age || '未知年龄'}, AMBER警报案件，在${state}州${city}市失踪",
        ${caseInfo.birthDate ? `"birthDate": "${caseInfo.birthDate}",` : ''}
        "gender": "${caseInfo.gender || 'Unknown'}",
        ${caseInfo.height ? `"height": "${caseInfo.height}",` : ''}
        ${caseInfo.weight ? `"weight": "${caseInfo.weight}",` : ''}
        ${caseInfo.eyeColor ? `"eyeColor": "${caseInfo.eyeColor}",` : ''}
        ${caseInfo.hairColor ? `"hairColor": "${caseInfo.hairColor}",` : ''}
        "missingSince": "${caseInfo.missingSince || new Date().toISOString().split('T')[0]}",
        "missingLocation": {
            "@type": "Place",
            "name": "${city}市, ${state}州"
        },
        "identifier": "${caseId}",
        ${caseInfo.images && caseInfo.images.length > 0 ? `"image": ${JSON.stringify(caseInfo.images)},` : ''}
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": "${caseData.case_url || '#'}"
        }
    }
    </script>
    
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        .gradient-amber {
            background: linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f97316 100%);
        }
        
        .gradient-blue {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
        }
        
        .glass-effect {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .hover-lift {
            transition: all 0.3s ease;
        }
        
        .hover-lift:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
.photo-gallery img {
            transition: all 0.3s ease;
        }
        
        .photo-gallery img:hover {
            transform: scale(1.05);
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
<!-- AMBER警报横幅 -->
    <div class="gradient-amber text-white py-4 text-center font-bold text-lg animate-pulse-amber">
        <div class="container mx-auto px-4">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            AMBER警报 - 如有线索请立即联系警方
            <i class="fas fa-exclamation-triangle ml-2"></i>
</div>
    </div>
    
    <!-- 导航栏 -->
    <nav class="gradient-blue text-white py-4 fixed w-full top-0 z-50 shadow-lg glass-effect">
        <div class="container mx-auto px-4">
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-2">
                    <i class="fas fa-search-location text-2xl"></i>
                    <span class="text-xl font-bold">失踪人口案件信息中心</span>
                </div>
                <div class="flex space-x-4">
                    <a href="#" class="hover:text-blue-200 transition-colors">
                        <i class="fas fa-home mr-1"></i>首页
                    </a>
                    <a href="#" class="hover:text-blue-200 transition-colors">
                        <i class="fas fa-info-circle mr-1"></i>关于
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <!-- 英雄区域 -->
    <section class="gradient-amber text-white pt-24 pb-16 animate-fade-in">
        <div class="container mx-auto px-4 text-center">
            <div class="max-w-4xl mx-auto">
                <h1 class="text-4xl md:text-5xl font-bold mb-4 animate-slide-up">
                    ${caseInfo.name || caseId}
                    <span class="inline-block bg-red-600 text-white px-4 py-1 rounded-full text-sm md:text-base ml-2 animate-bounce-gentle">
                        <i class="fas fa-bell mr-1"></i>AMBER警报
                    </span>
                </h1>
                <p class="text-xl md:text-2xl opacity-90 mb-6 animate-slide-up" style="animation-delay: 0.2s">
                    ${caseInfo.age || '未知年龄'}在${state}州${city}市失踪
                </p>
                <div class="flex flex-wrap justify-center gap-4 animate-slide-up" style="animation-delay: 0.4s">
                    <div class="bg-red-600/50 px-4 py-2 rounded-lg">
                        <i class="fas fa-map-marker-alt mr-2"></i>失踪地点: ${city}, ${state}
                    </div>
                    <div class="bg-red-600/50 px-4 py-2 rounded-lg">
                        <i class="fas fa-clock mr-2"></i>紧急状态: 活跃中
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 主要内容区域 -->
    <main class="container mx-auto px-4 py-8">
        <!-- 案件信息卡片 -->
<div class="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8 hover-lift animate-fade-in">
            <div class="flex items-center mb-6">
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <i class="fas fa-user text-blue-600 text-xl"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-800">失踪儿童信息</h2>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-signature text-blue-500 mr-2"></i>
                        <span class="font-semibold text-gray-700">姓名</span>
                    </div>
                    <p class="text-lg font-medium text-gray-900">${caseInfo.name || caseId}</p>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-birthday-cake text-blue-500 mr-2"></i>
                        <span class="font-semibold text-gray-700">年龄</span>
                    </div>
                    <p class="text-lg font-medium text-gray-900">${caseInfo.age || '未知'}</p>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-venus-mars text-blue-500 mr-2"></i>
<span class="font-semibold text-gray-700">性别</span>
                    </div>
                    <p class="text-lg font-medium text-gray-900">${caseInfo.gender || '未知'}</p>
                </div>
                
                ${caseInfo.height ? `
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-ruler-vertical text-blue-500 mr-2"></i>
                        <span class="font-semibold text-gray-700">身高</span>
                    </div>
                    <p class="text-lg font-medium text-gray-900">${caseInfo.height}</p>
                </div>
                ` : ''}
                
                ${caseInfo.weight ? `
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-weight text-blue-500 mr-2"></i>
                        <span class="font-semibold text-gray-700">体重</span>
                    </div>
                    <p class="text-lg font-medium text-gray-900">${caseInfo.weight}</p>
                </div>
                ` : ''}
                
                ${caseInfo.eyeColor ? `
<div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-eye text-blue-500 mr-2"></i>
                        <span class="font-semibold text-gray-700">眼睛颜色</span>
                    </div>
                    <p class="text-lg font-medium text-gray-900">${caseInfo.eyeColor}</p>
                </div>
                ` : ''}
                
                ${caseInfo.hairColor ? `
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-cut text-blue-500 mr-2"></i>
                        <span class="font-semibold text-gray-700">头发颜色</span>
                    </div>
                    <p class="text-lg font-medium text-gray-900">${caseInfo.hairColor}</p>
                </div>
                ` : ''}
            </div>
            
            <!-- 图片展示 -->
            ${caseInfo.images && caseInfo.images.length > 0 ? `
            <div class="mt-8">
                <h3 class="text-xl font-semibold mb-4 flex items-center">
                    <i class="fas fa-images text-blue-500 mr-2"></i>
                    相关照片
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 photo-gallery">
                    ${caseInfo.images.map((img, index) => `
                    <div class="relative overflow-hidden rounded-lg shadow-md">
                        <img src="${img}" 
                             alt="${caseInfo.name || caseId}的照片 ${index + 1}" 
                             class="w-full h-64 object-cover cursor-pointer"
                             loading="lazy"
                             onclick="openModal('${img}')">
                        <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                            <i class="fas fa-search-plus text-white text-2xl opacity-0 hover:opacity-100 transition-opacity"></i>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>

        <!-- 紧急联系信息 -->
        <div class="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-xl p-6 md:p-8 mb-8 text-white hover-lift">
            <div class="flex items-center mb-6">
                <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                    <i class="fas fa-phone-alt text-2xl"></i>
                </div>
                <h2 class="text-2xl font-bold">紧急联系信息</h2>
            </div>
            
            <p class="text-lg mb-6">如果您有任何关于 <strong>${caseInfo.name || caseId}</strong> 的线索，请立即联系：</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-shield-alt text-2xl mr-3"></i>
                        <div>
                            <h3 class="font-bold text-lg">当地警方</h3>
                            <p class="opacity-90">紧急情况请拨打</p>
                        </div>
                    </div>
                    <div class="text-2xl font-bold tracking-wider">911</div>
                </div>
                
                <div class="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-flag-usa text-2xl mr-3"></i>
                        <div>
                            <h3 class="font-bold text-lg">国家失踪儿童中心</h3>
                            <p class="opacity-90">24小时热线</p>
                        </div>
                    </div>
                    <div class="text-2xl font-bold tracking-wider">1-800-THE-LOST</div>
                </div>
            </div>
        </div>

        <!-- 案件详情 -->
        <div class="bg-white rounded-2xl shadow-xl p-6 md:p-8 hover-lift">
            <div class="flex items-center mb-6">
                <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <i class="fas fa-clipboard-list text-green-600 text-xl"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-800">案件详情</h2>
            </div>
            
            <div class="prose prose-lg max-w-none">
                <p><strong>${caseInfo.name || caseId}</strong> 是一名 ${caseInfo.age || '未知年龄'} 的 ${caseInfo.gender === 'Female' ? '女孩' : '男孩'}，最后一次出现在 <strong>${city}市, ${state}州</strong>。</p>
                
                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="fas fa-exclamation-triangle text-yellow-400"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-yellow-700">
                                <strong>重要提示：</strong> 如果您有任何相关信息，请不要直接接触疑似人员，立即联系警方。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- 页脚 -->
    <footer class="bg-gray-800 text-white py-8 mt-12">
        <div class="container mx-auto px-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                    <h3 class="text-lg font-bold mb-4">失踪人口案件信息中心</h3>
                    <p class="text-gray-300">致力于帮助寻找失踪人员，提供最新的案件信息和联系方式。</p>
                </div>
                <div>
                    <h3 class="text-lg font-bold mb-4">快速链接</h3>
                    <ul class="space-y-2">
                        <li><a href="#" class="text-gray-300 hover:text-white transition-colors">最新案件</a></li>
                        <li><a href="#" class="text-gray-300 hover:text-white transition-colors">如何提供帮助</a></li>
                        <li><a href="#" class="text-gray-300 hover:text-white transition-colors">安全提示</a></li>
                    </ul>
                </div>
                <div>
<h3 class="text-lg font-bold mb-4">联系信息</h3>
                    <div class="space-y-2 text-gray-300">
                        <p><i class="fas fa-phone mr-2"></i> 紧急热线: 911</p>
                        <p><i class="fas fa-globe mr-2"></i> 国家失踪儿童中心: 1-800-THE-LOST</p>
                    </div>
                </div>
            </div>
            <div class="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
                <p>&copy; 2024 失踪人口案件信息中心. 所有信息均来自公开渠道。</p>
            </div>
        </div>
    </footer>

    <!-- 图片模态框 -->
    <div id="imageModal" class="fixed inset-0 bg-black bg-opacity-75 hidden z-50 flex items-center justify-center p-4">
        <div class="relative max-w-4xl max-h-full">
<button onclick="closeModal()" class="absolute -top-12 right-0 text-white text-2xl hover:text-gray-300">
                <i class="fas fa-times"></i>
            </button>
            <img id="modalImage" src="" alt="" class="max-w-full max-h-full rounded-lg">
        </div>
    </div>

    <script>
        // 图片模态框功能
        function openModal(imageSrc) {
            document.getElementById('modalImage').src = imageSrc;
            document.getElementById('imageModal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
}

        function closeModal() {
document.getElementById('imageModal').classList.add('hidden');
            document.body.style.overflow = 'auto';
        }

        // 点击模态框背景关闭
document.getElementById('imageModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });

        // 键盘ESC键关闭
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });

        // 页面加载动画
document.addEventListener('DOMContentLoaded', function() {
            const elements = document.querySelectorAll('.animate-fade-in, .animate-slide-up');
            elements.forEach((el, index) => {
                el.style.animationDelay = (index * 0.1) + 's';
            });
        });
    </script>
</body>
</html>`;
}

const { exec } = require('child_process');
// 删除重复的模块声明
// const fs = require('fs');
// const path = require('path');
// const axios = require('axios');

// 删除重复的常量声明
// const PROCESSED_CASES_FILE = 'processed-cases.txt';
// const LOG_FILE = 'webpage-generation.log';

// 获取已处理的案件ID列表
function getProcessedCaseIds() {
    try {
        if (fs.existsSync(PROCESSED_CASES_FILE)) {
            const content = fs.readFileSync(PROCESSED_CASES_FILE, 'utf8');
            return new Set(content.split('\n').filter(line => line.trim()));
        }
    } catch (error) {
        console.error('读取已处理案件文件失败:', error);
}
    return new Set();
}

// 记录已处理的案件ID
function recordProcessedCaseId(caseId) {
    try {
        fs.appendFileSync(PROCESSED_CASES_FILE, caseId + '\n', 'utf8');
    } catch (error) {
        console.error('记录案件ID失败:', error);
    }
}

// 记录日志
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    try {
        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (error) {
        console.error('记录日志失败:', error);
    }
}

// 等待函数（带倒计时显示）
function wait(seconds) {
    return new Promise((resolve) => {
        log(`等待 ${seconds} 秒...`);
        let remaining = seconds;
        
        const interval = setInterval(() => {
            process.stdout.write(`\r⏰ 倒计时: ${remaining} 秒   `);
            remaining--;
            
            if (remaining < 0) {
                clearInterval(interval);
                process.stdout.write('\r✅ 等待完成!           \n');
                resolve();
            }
        }, 1000);
    });
}

// 随机等待5-15秒
async function randomWait() {
    const seconds = Math.floor(Math.random() * 11) + 5; // 5-15秒
    await wait(seconds);
}

// 获取需要处理的案件（从真实数据库查询）
async function getCasesToScrape() {
    return new Promise((resolve, reject) => {
        // 查询所有有 scraped_content 内容的案件
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="SELECT id, case_id, case_url, case_title, scraped_content, analysis_result FROM missing_persons_cases WHERE scraped_content IS NOT NULL AND scraped_content != '' ORDER BY id;"`;
        
        log('查询数据库中有内容的案件...');
        
        const options = {
            maxBuffer: 10 * 1024 * 1024 // 10MB
        };
        
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                log(`获取错误: ${error.message}`);
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(stdout);
                const cases = [];
                
                if (result[0] && result[0].results) {
                    cases.push(...result[0].results);
                }
                
                if (cases.length > 0) {
                    log(`✅ 找到 ${cases.length} 条有内容的案件记录`);
                    // 为每个案件添加州和城市信息
                    const enhancedCases = cases.map(caseData => {
                        const { state, city } = extractStateCityFromContent(caseData.scraped_content || '');
                        return {
                            ...caseData,
                            state: state || 'unknown',
                            city: city || 'unknown'
                        };
                    });
                    resolve(enhancedCases);
                } else {
                    log('⚠️ 没有找到有内容的案件记录');
                    resolve([]);
                }
            } catch (parseError) {
                log(`解析响应错误: ${parseError.message}`);
                // 备用方法：如果 --json 参数无效，手动提取JSON
                try {
                    const jsonStart = stdout.indexOf('[');
                    const jsonEnd = stdout.lastIndexOf(']') + 1;
                    
                    if (jsonStart !== -1 && jsonEnd > jsonStart) {
                        const cleanJson = stdout.substring(jsonStart, jsonEnd);
                        const result = JSON.parse(cleanJson);
                        const cases = [];
                        
                        if (result[0] && result[0].results) {
                            cases.push(...result[0].results);
                        }
                        
                        if (cases.length > 0) {
                            log(`✅ 备用方法找到 ${cases.length} 条有内容的案件记录`);
                            const enhancedCases = cases.map(caseData => {
                                const { state, city } = extractStateCityFromContent(caseData.scraped_content || '');
                                return {
                                    ...caseData,
                                    state: state || 'unknown',
                                    city: city || 'unknown'
                                };
                            });
                            resolve(enhancedCases);
                        } else {
                            log('⚠️ 备用方法：没有找到有内容的案件记录');
                            resolve([]);
                        }
                        return;
                    }
                } catch (backupError) {
                    log(`备用方法也失败: ${backupError.message}`);
                }
                
                log('原始输出内容: ' + stdout.substring(0, 200));
                resolve([]);
            }
        });
    });
}

// 从内容中提取州和城市信息（使用真实的美国州和城市名称）
function extractStateCityFromContent(content) {
    // 美国州名列表（小写）
    const usStates = [
        'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 
        'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 
        'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 
        'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 
        'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 
        'new hampshire', 'new jersey', 'new mexico', 'new york', 
        'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 
        'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 
        'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 
        'west virginia', 'wisconsin', 'wyoming'
    ];
    
    // 常见美国城市名（小写）
    const usCities = [
        'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
        'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
        'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis',
        'seattle', 'denver', 'washington', 'boston', 'el paso', 'nashville',
        'detroit', 'oklahoma city', 'portland', 'las vegas', 'memphis', 
        'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 
        'fresno', 'sacramento', 'kansas city', 'long beach', 'mesa', 
        'atlanta', 'colorado springs', 'virginia beach', 'raleigh', 'omaha',
        'miami', 'oakland', 'minneapolis', 'tulsa', 'wichita', 'new orleans',
        'arlington', 'cleveland', 'bakersfield', 'tampa', 'aurora', 'honolulu',
        'anaheim', 'santa ana', 'corpus christi', 'riverside', 'st. louis',
        'lexington', 'stockton', 'pittsburgh', 'st. paul', 'anchorage', 
        'cincinnati', 'henderson', 'greensboro', 'plano', 'newark', 'toledo',
        'lincoln', 'orlando', 'chula vista', 'jersey city', 'chandler', 
        'fort wayne', 'buffalo', 'durham', 'st. petersburg', 'irvine', 
        'laredo', 'lubbock', 'madison', 'gilbert', 'norfolk', 'reno', 
        'winston-salem', 'glendale', 'hialeah', 'garland', 'scottsdale', 
        'irving', 'chesapeake', 'north las vegas', 'fremont', 'baton rouge',
        'richmond', 'boise', 'san bernardino'
    ];
    
    let state = null;
    let city = null;
    
    // 在内容中查找州名
    for (const stateName of usStates) {
        const regex = new RegExp('\\b' + stateName + '\\b', 'i');
        if (regex.test(content)) {
            state = stateName.toLowerCase();
            break;
        }
    }
    
    // 在内容中查找城市名
    for (const cityName of usCities) {
        const regex = new RegExp('\\b' + cityName + '\\b', 'i');
        if (regex.test(content)) {
            city = cityName.toLowerCase().replace(/\s+/g, '-');
            break;
        }
    }
    
    // 如果没找到城市，尝试从内容中提取
    if (!city) {
        const cityPattern = /(?:in|from|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
        const cityMatch = content.match(cityPattern);
        if (cityMatch) {
            city = cityMatch[1].toLowerCase().replace(/\s+/g, '-');
        }
    }
    
    return { state, city };
}

// 删除第85行的模拟函数，让程序使用第637行的真实数据库查询函数
// 获取需要处理的案件（模拟数据库查询） - 删除这个模拟函数
// async function getCasesToScrape() {
//     try {
//         // 这里应该替换为真实的数据库查询
//         // 模拟返回一些案件数据
//         return [
//             {
//                 case_id: 'randolph-alger',
//                 case_url: 'https://www.missingkids.org/poster/NCMC/2073371/15284/screen',
//                 state: 'Idaho',
//                 city: 'Monteview',
//                 scraped_content: '案件内容...'
//             }
//         ];
//     } catch (error) {
//         log(`获取案件列表失败: ${error.message}`);
//         return [];
//     }
// }

// 调用AI接口生成网页内容
async function generateWebpageWithAI(caseData) {
    try {
        log(`调用AI接口生成网页内容: ${caseData.case_id}`);
        
        // 使用可用的线上Cloudflare Pages API (/analyze接口)
        const aiEndpoint = 'https://666.rinuo.com/api/missing-persons/analyze';
        
        // 构建完整的案件数据，发送给AI进行分析并生成网页
        const requestData = {
            caseId: caseData.case_id,
            caseUrl: caseData.case_url,
            state: caseData.state,
            city: caseData.city,
            scrapedContent: caseData.scraped_content,
            targetLanguage: 'zh', // 使用中文
            generateWebpage: true // 指示需要生成网页
        };
        
        const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 从分析结果中提取HTML内容或生成网页
        let htmlContent;
        if (data.html) {
            htmlContent = data.html;
        } else if (data.content) {
            htmlContent = data.content;
        } else if (data.analysis) {
            // 如果只有分析结果，基于分析结果生成网页
            htmlContent = generateWebpageFromAnalysis(caseData, data.analysis);
        } else {
            throw new Error('无效的 API 响应格式');
        }

        // 提取纯HTML代码
        const cleanHtmlCode = extractHtmlCode(htmlContent);
        
        return {
            success: true,
            content: cleanHtmlCode,
            filename: generateFilename(caseData)
        };
    } catch (error) {
        log(`AI接口调用失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 基于分析结果生成网页
function generateWebpageFromAnalysis(caseData, analysis) {
    const caseId = caseData.case_id;
    const state = caseData.state || 'Unknown';
    const city = caseData.city || 'Unknown';
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${caseId} 失踪案件 - AMBER警报 | ${state}州${city}失踪</title>
    <meta name="description" content="${caseId}失踪案件分析报告，在${state}州${city}市失踪。如有线索请立即联系警方。">
    
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <style>
        body { font-family: Arial, sans-serif; }
        .amber-alert { background: linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f97316 100%); color: white; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="amber-alert py-4 text-center font-bold">
        AMBER警报 - 如有线索请立即联系警方
    </div>
    
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold mb-4">${caseId} 失踪案件</h1>
        <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4">案件分析报告</h2>
            <div class="prose max-w-none">
                ${analysis.replace(/\n/g, '<br>')}
            </div>
        </div>
        
        <div class="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4">案件基本信息</h2>
            <ul class="space-y-2">
                <li><strong>案件ID:</strong> ${caseId}</li>
                <li><strong>地点:</strong> ${city}, ${state}</li>
                <li><strong>案件链接:</strong> <a href="${caseData.case_url}" class="text-blue-600 hover:underline">查看原始案件</a></li>
            </ul>
        </div>
    </div>
</body>
</html>`;
}

// 提取纯HTML代码（增强版，支持多种响应格式）
function extractHtmlCode(text) {
    // 如果文本已经是HTML格式，直接返回
    if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
        return text;
    }
    
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
    
    // 尝试提取 <!DOCTYPE html> 到 </html> 之间的完整HTML
    const fullHtmlMatch = text.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);
    if (fullHtmlMatch) {
        return fullHtmlMatch[0];
    }
    
    // 尝试提取 <html> 到 </html> 之间的HTML
    const htmlTagMatch = text.match(/<html>[\s\S]*?<\/html>/i);
    if (htmlTagMatch) {
        return htmlTagMatch[0];
    }
    
    // 如果没有代码块标记，返回原始文本
    return text;
}

// 生成文件名（使用小写case_id）
function generateFilename(caseData) {
    const state = (caseData.state || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const city = (caseData.city || 'unknown').toLowerCase().replace(/\s+/g, '-');
    return `${caseData.case_id}-${city}-${state}.html`; // 使用小写case_id-城市-州.html格式
}

// 创建文件夹结构（按州和城市，使用小写）
function createFolderStructure(state, city) {
    // 确保州和城市名是小写
    const stateLower = state.toLowerCase().replace(/\s+/g, '-');
    const cityLower = city.toLowerCase().replace(/\s+/g, '-');
    
    const baseDir = path.join(__dirname, 'cases');
    const stateDir = path.join(baseDir, stateLower);
    const cityDir = path.join(stateDir, cityLower);
    
    try {
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);
        if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir);
        if (!fs.existsSync(cityDir)) fs.mkdirSync(cityDir);
        
        log(`📁 创建文件夹: ${stateLower}/${cityLower}`);
        return cityDir;
    } catch (error) {
        log(`创建文件夹结构失败: ${error.message}`);
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

// 处理单个案件
async function processSingleCase() {
    const processedCaseIds = getProcessedCaseIds();
    
    // 从数据库获取案件信息
    const cases = await getCasesToScrape();
    
    if (!cases || cases.length === 0) {
        log('❌ 没有找到有内容的案件');
        return null; // 返回null表示没有案件需要处理
    }
    
    // 过滤掉已经处理过的案件
    const unprocessedCases = cases.filter(caseData => !processedCaseIds.has(caseData.case_id));
    
    if (unprocessedCases.length === 0) {
        log(`⏭️ 所有 ${cases.length} 个有内容的案件都已处理过`);
        return null; // 返回null表示没有未处理的案件
    }
    
    const caseData = unprocessedCases[0]; // 每次只处理一个案件
    
    log(`🔍 开始处理案件: ${caseData.case_id}`);
    log(`📍 地点: ${caseData.city}, ${caseData.state}`);
    log(`📄 内容长度: ${caseData.scraped_content?.length || 0} 字符`);
    log(`📊 待处理案件: ${unprocessedCases.length}/${cases.length}`);
    
    try {
        // 生成网页内容
        const result = await generateWebpageWithAI(caseData);
        
        if (!result.success) {
            log(`❌ 生成网页内容失败: ${result.error}`);
            return false;
        }
        
        // 创建文件夹结构
        const folderPath = createFolderStructure(caseData.state, caseData.city);
        
        // 保存网页文件
        const filePath = saveWebpageFile(result.content, folderPath, result.filename);
        
        if (filePath) {
            // 记录已处理的案件ID
            recordProcessedCaseId(caseData.case_id);
            log(`✅ 案件处理完成: ${caseData.case_id}`);
            log(`📁 文件保存位置: ${filePath}`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        log(`❌ 处理案件失败: ${error.message}`);
        return false;
    }
}

// 主处理函数 - 循环处理所有案件
async function processCasesForWebpage() {
    log('🚀 开始网页生成任务');
    
    let totalProcessed = 0;
    let hasMoreCases = true;
    
    while (hasMoreCases) {
        try {
            const result = await processSingleCase();
            
            if (result === true) {
                totalProcessed++;
                log(`✅ 已成功处理 ${totalProcessed} 个案件`);
                
                // 处理完一个案件后等待5-15秒
                await randomWait();
            } else if (result === null) {
                // 没有案件需要处理
                hasMoreCases = false;
                if (totalProcessed === 0) {
                    log('⚠️ 没有需要处理的案件或处理失败');
                } else {
                    log(`🎉 网页生成任务完成！总共处理了 ${totalProcessed} 个案件`);
                }
            } else {
                // 处理失败，继续下一个
                log('⚠️ 当前案件处理失败，继续下一个案件');
                await wait(3); // 失败后等待3秒
            }
            
        } catch (error) {
            log(`❌ 处理案件时发生错误: ${error.message}`);
            await wait(5); // 错误后等待5秒
        }
    }
    
    // 所有案件处理完成后，等待5分钟再重新开始
    if (totalProcessed > 0) {
        log('⏰ 所有案件处理完成，等待5分钟后重新查询...');
        await wait(300); // 等待5分钟
        log('🔄 重新开始查询新案件...');
        await processCasesForWebpage(); // 递归调用重新开始
    }
}

// 导出函数供监控脚本使用
module.exports = {
    processCasesForWebpage
};

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
    processCasesForWebpage().catch(error => {
        console.error('程序执行失败:', error);
        process.exit(1);
    });
}
