// Backblaze B2 图片批量上传和管理系统
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

class BackblazeB2Manager {
    constructor(config) {
        this.config = {
            endpoint: 'https://s3.us-east-005.backblazeb2.com',
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            bucketName: config.bucketName || 'gudq-missing-assets',
            ...config
        };

        this.s3 = new AWS.S3({
            endpoint: this.config.endpoint,
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
            s3ForcePathStyle: true,
            signatureVersion: 'v4'
        });
    }

    // 单张图片上传
    async uploadImage(imagePath, key = null, metadata = {}) {
        try {
            const fileBuffer = fs.readFileSync(imagePath);
            const fileName = key || path.basename(imagePath);
            const contentType = mime.lookup(imagePath) || 'image/jpeg';

            const params = {
                Bucket: this.config.bucketName,
                Key: fileName,
                Body: fileBuffer,
                ContentType: contentType,
                Metadata: {
                    'upload-date': new Date().toISOString(),
                    'case-id': metadata.caseId || path.basename(imagePath, path.extname(imagePath)),
                    'original-filename': path.basename(imagePath),
                    ...metadata
                }
            };

            const result = await this.s3.upload(params).promise();
            
            return {
                success: true,
                key: result.Key,
                url: result.Location,
                etag: result.ETag,
                size: fileBuffer.length
            };
        } catch (error) {
            console.error('上传失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 批量上传图片
    async batchUploadImages(imagesDir, prefix = 'cases/', batchSize = 20) {
        const files = fs.readdirSync(imagesDir)
            .filter(file => /(\.jpg|\.jpeg|\.png|\.gif|webp)$/i.test(file))
            .map(file => path.join(imagesDir, file));

        const results = [];
        const uploadQueue = [];

        console.log(`开始上传 ${files.length} 张图片...`);

        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            const fileName = path.basename(filePath);
            const caseId = fileName.split('.')[0];
            
            const s3Key = `${prefix}${fileName}`;
            
            const uploadPromise = this.uploadImage(filePath, s3Key, { caseId })
                .then(result => ({
                    originalFile: fileName,
                    s3Key: s3Key,
                    url: result.url,
                    cdnUrl: this.getCDNUrl(s3Key),
                    size: result.size,
                    success: result.success
                }));

            uploadQueue.push(uploadPromise);

            // 控制并发数量
            if (uploadQueue.length >= batchSize || i === files.length - 1) {
                console.log(`上传批次 ${Math.ceil((i+1)/batchSize)}: ${uploadQueue.length} 张图片`);
                
                const batchResults = await Promise.all(uploadQueue);
                results.push(...batchResults);
                
                uploadQueue.length = 0; // 清空队列
                
                // 避免API限制，添加延迟
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return results;
    }

    // 获取CDN优化URL（通过Cloudflare Workers）
    getCDNUrl(s3Key, options = {}) {
        const { width, height, format = 'webp' } = options;
        
        // 基础URL格式
        let url = `https://images.missingpersonsdb.com/${s3Key}`;
        
        // 添加图片优化参数
        const params = [];
        if (width) params.push(`width=${width}`);
        if (height) params.push(`height=${height}`);
        if (format !== 'original') params.push(`format=${format}`);
        
        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }
        
        return url;
    }

    // 生成图片映射文件
    generateImageMap(uploadResults, outputPath) {
        const imageMap = {};
        
        uploadResults.forEach(result => {
            if (result.success) {
                const caseId = path.basename(result.originalFile, path.extname(result.originalFile));
                imageMap[caseId] = {
                    s3Key: result.s3Key,
                    originalUrl: result.url,
                    cdnUrl: result.cdnUrl,
                    optimizedUrls: {
                        small: this.getCDNUrl(result.s3Key, { width: 300, format: 'webp' }),
                        medium: this.getCDNUrl(result.s3Key, { width: 600, format: 'webp' }),
                        large: this.getCDNUrl(result.s3Key, { width: 1200, format: 'webp' })
                    },
                    size: result.size,
                    uploadTime: new Date().toISOString()
                };
            }
        });

        fs.writeFileSync(outputPath, JSON.stringify(imageMap, null, 2));
        console.log(`图片映射文件已生成: ${outputPath}`);
        return imageMap;
    }

    // 列出存储桶中的文件
    async listFiles(prefix = '', maxKeys = 1000) {
        try {
            const params = {
                Bucket: this.config.bucketName,
                Prefix: prefix,
                MaxKeys: maxKeys
            };

            const result = await this.s3.listObjectsV2(params).promise();
            return result.Contents || [];
        } catch (error) {
            console.error('列出文件失败:', error.message);
            return [];
        }
    }

    // 删除文件
    async deleteFile(key) {
        try {
            await this.s3.deleteObject({
                Bucket: this.config.bucketName,
                Key: key
            }).promise();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 获取存储桶统计信息
    async getBucketStats() {
        try {
            const files = await this.listFiles('', 10000);
            const totalSize = files.reduce((sum, file) => sum + (file.Size || 0), 0);
            
            return {
                fileCount: files.length,
                totalSize: totalSize,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                lastModified: files.length > 0 ? 
                    new Date(Math.max(...files.map(f => new Date(f.LastModified).getTime()))) : null
            };
        } catch (error) {
            console.error('获取统计信息失败:', error.message);
            return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00' };
        }
    }
}

// 使用示例
async function main() {
    // 配置信息（从环境变量或配置文件读取）
    const config = {
        accessKeyId: process.env.B2_ACCESS_KEY_ID || 'c6790dd2f167',
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || '您的Master Application Key',
        bucketName: 'gudq-missing-assets'
    };

    const manager = new BackblazeB2Manager(config);
    
    // 测试连接
    console.log('测试B2连接...');
    const stats = await manager.getBucketStats();
    console.log('存储桶状态:', stats);
    
    // 批量上传图片
    const imagesDir = './case-images';
    if (fs.existsSync(imagesDir)) {
        const uploadResults = await manager.batchUploadImages(imagesDir);
        
        // 生成映射文件
        const imageMapPath = './b2-image-mapping.json';
        manager.generateImageMap(uploadResults, imageMapPath);
        
        console.log('批量上传完成！');
        console.log(`成功上传: ${uploadResults.filter(r => r.success).length} 张图片`);
    }
}

module.exports = BackblazeB2Manager;