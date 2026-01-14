// Imgur 图片批量上传和管理系统
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ImgurImageManager {
    constructor(clientId) {
        this.clientId = clientId;
        this.baseUrl = 'https://api.imgur.com/3';
        this.headers = {
            'Authorization': `Client-ID ${clientId}`,
            'Content-Type': 'application/json'
        };
    }

    // 单张图片上传
    async uploadImage(imagePath, title = '', description = '') {
        try {
            const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
            
            const response = await axios.post(`${this.baseUrl}/image`, {
                image: imageData,
                type: 'base64',
                title: title,
                description: description
            }, { headers: this.headers });

            return {
                success: true,
                data: response.data.data,
                url: response.data.data.link,
                deletehash: response.data.data.deletehash
            };
        } catch (error) {
            console.error('上传失败:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // 批量上传图片
    async batchUploadImages(imagesDir, batchSize = 10) {
        const files = fs.readdirSync(imagesDir)
            .filter(file => /(\.jpg|\.jpeg|\.png|\.gif)$/i.test(file))
            .map(file => path.join(imagesDir, file));

        const results = [];
        
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            console.log(`处理批次 ${i/batchSize + 1}: ${batch.length} 张图片`);
            
            const batchPromises = batch.map(async (filePath, index) => {
                const fileName = path.basename(filePath);
                const result = await this.uploadImage(filePath, `失踪人口照片 - ${fileName}`);
                
                return {
                    originalFile: fileName,
                    imgurUrl: result.url,
                    deletehash: result.deletehash,
                    success: result.success
                };
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // 避免API限制，添加延迟
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }

    // 生成图片映射文件
    generateImageMap(uploadResults, outputPath) {
        const imageMap = {};
        
        uploadResults.forEach(result => {
            if (result.success) {
                const caseId = path.basename(result.originalFile, path.extname(result.originalFile));
                imageMap[caseId] = {
                    imgurUrl: result.imgurUrl,
                    deletehash: result.deletehash,
                    optimizedUrl: this.getOptimizedUrl(result.imgurUrl, 'large')
                };
            }
        });

        fs.writeFileSync(outputPath, JSON.stringify(imageMap, null, 2));
        console.log(`图片映射文件已生成: ${outputPath}`);
        return imageMap;
    }

    // 获取优化后的URL（支持不同尺寸）
    getOptimizedUrl(originalUrl, size = 'large') {
        const sizes = {
            'small': 's',    // 90x90
            'medium': 'm',   // 320x320
            'large': 'l',    // 640x640
            'huge': 'h',     // 1024x1024
        };
        
        if (sizes[size]) {
            return originalUrl.replace(/\.(jpg|jpeg|png|gif)$/, `${sizes[size]}.$1`);
        }
        return originalUrl;
    }

    // 删除图片
    async deleteImage(deletehash) {
        try {
            await axios.delete(`${this.baseUrl}/image/${deletehash}`, {
                headers: this.headers
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// 使用示例
async function main() {
    // 1. 注册Imgur应用获取Client ID
    const clientId = 'YOUR_IMGUR_CLIENT_ID';
    const manager = new ImgurImageManager(clientId);
    
    // 2. 批量上传图片
    const imagesDir = './case-images';
    const uploadResults = await manager.batchUploadImages(imagesDir);
    
    // 3. 生成映射文件
    const imageMapPath = './image-mapping.json';
    manager.generateImageMap(uploadResults, imageMapPath);
    
    console.log('批量上传完成！');
    console.log(`成功上传: ${uploadResults.filter(r => r.success).length} 张图片`);
}

module.exports = ImgurImageManager;