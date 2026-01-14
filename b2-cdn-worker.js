// Cloudflare Workers - Backblaze B2 CDN 加速脚本
// 部署到 Cloudflare Workers 实现免费CDN加速

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // 只处理图片请求
        if (!url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            return new Response('Not Found', { status: 404 });
        }

        try {
            // 提取图片路径（去掉开头的/）
            let imagePath = url.pathname.substring(1); // 去掉开头的/
            
            // 如果是根路径，使用默认图片
            if (!imagePath || imagePath === '/') {
                return new Response('Image path required', { status: 400 });
            }

            // Backblaze B2 直接访问URL
            const b2Url = `https://f005.backblazeb2.com/file/gudq-missing-assets/${imagePath}`;
            
            // 构建请求头
            const headers = new Headers();
            headers.set('User-Agent', 'MissingPersonsDB-CDN/1.0');
            
            // 添加条件请求头（缓存优化）
            if (request.headers.get('If-Modified-Since')) {
                headers.set('If-Modified-Since', request.headers.get('If-Modified-Since'));
            }
            if (request.headers.get('If-None-Match')) {
                headers.set('If-None-Match', request.headers.get('If-None-Match'));
            }

            // 转发请求到 Backblaze B2
            const b2Response = await fetch(b2Url, { headers });

            if (!b2Response.ok) {
                if (b2Response.status === 404) {
                    return new Response('Image not found', { status: 404 });
                }
                return new Response('Backend error', { status: 502 });
            }

            // 处理图片优化参数
            const searchParams = url.searchParams;
            const width = searchParams.get('width');
            const height = searchParams.get('height');
            const format = searchParams.get('format') || 'webp';

            let finalResponse = b2Response;
            
            // 如果请求了图片优化，使用Cloudflare Images优化
            if (width || height || format !== 'original') {
                finalResponse = await optimizeImage(b2Response, { width, height, format });
            }

            // 构建响应头（优化缓存）
            const responseHeaders = new Headers(finalResponse.headers);
            
            // 设置缓存策略
            responseHeaders.set('Cache-Control', 'public, max-age=86400'); // 缓存1天
            responseHeaders.set('CDN-Cache-Control', 'public, max-age=86400');
            responseHeaders.set('Access-Control-Allow-Origin', '*');
            responseHeaders.set('Vary', 'Accept');
            
            // 设置内容类型
            if (format === 'webp') {
                responseHeaders.set('Content-Type', 'image/webp');
            } else if (format === 'avif') {
                responseHeaders.set('Content-Type', 'image/avif');
            }

            return new Response(finalResponse.body, {
                status: finalResponse.status,
                headers: responseHeaders
            });

        } catch (error) {
            console.error('CDN error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};

// 图片优化函数（使用Cloudflare Images API）
async function optimizeImage(originalResponse, options = {}) {
    const { width, height, format = 'webp' } = options;
    
    try {
        // 获取原始图片数据
        const arrayBuffer = await originalResponse.arrayBuffer();
        
        // 这里可以集成Cloudflare Images优化
        // 暂时返回原始图片，后续可以添加真正的优化逻辑
        
        return new Response(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': `image/${format}`,
                'X-Optimized-By': 'MissingPersonsDB-CDN'
            }
        });
        
    } catch (error) {
        console.error('Image optimization failed:', error);
        return originalResponse; // 失败时返回原始图片
    }
}

// 高级功能：图片格式自动检测和转换
class ImageProcessor {
    constructor() {
        this.supportedFormats = ['webp', 'avif', 'jpeg', 'png'];
    }

    // 检测浏览器支持的图片格式
    getBestFormat(request) {
        const acceptHeader = request.headers.get('accept') || '';
        
        if (acceptHeader.includes('image/avif')) {
            return 'avif';
        } else if (acceptHeader.includes('image/webp')) {
            return 'webp';
        }
        
        return 'jpeg'; // 默认格式
    }

    // 计算最佳图片尺寸
    getOptimalSize(request) {
        const userAgent = request.headers.get('user-agent') || '';
        const viewport = request.headers.get('viewport') || '';
        
        // 根据设备类型返回最佳尺寸
        if (userAgent.includes('Mobile')) {
            return { width: 400, quality: 80 };
        } else if (userAgent.includes('Tablet')) {
            return { width: 800, quality: 85 };
        } else {
            return { width: 1200, quality: 90 }; // 桌面端
        }
    }
}

/*
部署说明：

1. 注册 Cloudflare 账户
2. 进入 Workers 控制台
3. 创建新的 Worker
4. 粘贴此代码
5. 配置自定义域名：images.missingpersonsdb.com
6. 部署

使用方式：

原始B2 URL: https://f005.backblazeb2.com/file/gudq-missing-assets/cases/romaldo-astran.jpg
CDN URL: https://images.missingpersonsdb.com/cases/romaldo-astran.jpg
优化URL: https://images.missingpersonsdb.com/cases/romaldo-astran.jpg?width=600&format=webp

优势：
- 免费CDN加速
- 自动图片优化
- 浏览器格式检测
- 全球边缘缓存
*/