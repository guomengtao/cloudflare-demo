// Cloudflare Workers 脚本 - Imgur 域名代理
// 部署到 Cloudflare Workers 实现自定义域名访问 Imgur 图片

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // 只处理图片请求
        if (!url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            return new Response('Not Found', { status: 404 });
        }

        try {
            // 提取图片ID（假设URL格式为 /images/{imgur_id}.jpg）
            const pathParts = url.pathname.split('/');
            const filename = pathParts[pathParts.length - 1];
            const imgurId = filename.split('.')[0];
            
            if (!imgurId) {
                return new Response('Invalid image ID', { status: 400 });
            }

            // 构建 Imgur URL
            const imgurUrl = `https://i.imgur.com/${imgurId}.jpg`;
            
            // 转发请求到 Imgur
            const imgurResponse = await fetch(imgurUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Missing Persons DB)'
                }
            });

            if (!imgurResponse.ok) {
                return new Response('Image not found', { status: 404 });
            }

            // 返回图片响应，添加缓存头
            const headers = new Headers(imgurResponse.headers);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=86400'); // 缓存1天
            headers.set('CDN-Cache-Control', 'public, max-age=86400');
            
            return new Response(imgurResponse.body, {
                status: imgurResponse.status,
                headers: headers
            });

        } catch (error) {
            console.error('Proxy error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};

// 高级版本：支持图片优化和格式转换
class ImageOptimizer {
    constructor() {
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    }

    // 检测浏览器支持的图片格式
    getBestFormat(request) {
        const acceptHeader = request.headers.get('accept') || '';
        
        if (acceptHeader.includes('webp')) {
            return 'webp';
        } else if (acceptHeader.includes('avif')) {
            return 'avif';
        }
        
        return 'jpg'; // 默认格式
    }

    // 获取优化后的图片尺寸
    getOptimalSize(width, deviceType) {
        const sizes = {
            'mobile': { maxWidth: 400, quality: 80 },
            'tablet': { maxWidth: 800, quality: 85 },
            'desktop': { maxWidth: 1200, quality: 90 }
        };
        
        return sizes[deviceType] || sizes.desktop;
    }
}

// 使用示例：部署到 Cloudflare Workers
/*
部署步骤：
1. 注册 Cloudflare 账户
2. 进入 Workers 控制台
3. 创建新的 Worker
4. 粘贴此代码
5. 配置自定义域名（如 images.yourdomain.com）
6. 部署

使用方式：
原URL: https://i.imgur.com/abc123.jpg
新URL: https://images.yourdomain.com/abc123.jpg
*/