// Backblaze B2 图片管理系统 - 完整版
// 支持批量上传、CDN集成、图片映射管理

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
// 加载环境变量 - 尝试从当前目录和项目根目录加载
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

class B2ImageManager {
    constructor(config) {
        // 从环境变量获取默认配置
        this.config = {
            bucketName: process.env.B2_BUCKET_NAME || 'gudq-missing-assets',
            endpoint: process.env.B2_ENDPOINT || 's3.us-east-005.backblazeb2.com',
            accessKeyId: process.env.B2_ACCESS_KEY_ID || 'c6790dd2f167',
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || 'YOUR_SECRET_KEY_HERE',
            region: process.env.B2_REGION || 'us-east-005',
            cdnDomain: 'images.missingpersonsdb.com', // 自定义CDN域名
            ...config
        };
        
        // 确保端点包含 https://
        if (!this.config.endpoint.startsWith('http://') && !this.config.endpoint.startsWith('https://')) {
            this.config.endpoint = `https://${this.config.endpoint}`;
        }
        
        // 调试输出
        console.log('🔧 B2ImageManager 构造器配置:');
        console.log('   accessKeyId:', this.config.accessKeyId);
        console.log('   secretAccessKey:', this.config.secretAccessKey ? '***' + this.config.secretAccessKey.slice(-4) : '未设置');
        console.log('   endpoint:', this.config.endpoint);
        console.log('   region:', this.config.region);
        console.log('   bucketName:', this.config.bucketName);
        
        this.s3 = new AWS.S3({
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
            endpoint: this.config.endpoint,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
            region: this.config.region
        });
        
        this.imageMap = new Map(); // 内存中的图片映射
        this.stats = {
            totalUploaded: 0,
            totalSize: 0,
            failedUploads: 0
        };
    }

    // 1. 单张图片上传
    async uploadSingleImage(filePath, caseId, imageType = 'profile') {
        try {
            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                throw new Error(`文件不存在: ${filePath}`);
            }
            
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);
            const fileExt = path.extname(fileName).toLowerCase();
            
            // 验证图片格式
            const allowedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            if (!allowedFormats.includes(fileExt)) {
                throw new Error(`不支持的文件格式: ${fileExt}`);
            }
            
            // 生成存储路径
            const storagePath = this.generateStoragePath(caseId, imageType, fileExt);
            
            // 上传参数
            const params = {
                Bucket: this.config.bucketName,
                Key: storagePath,
                Body: fileBuffer,
                ContentType: this.getContentType(fileExt),
                ACL: 'public-read',
                Metadata: {
                    'case-id': caseId,
                    'image-type': imageType,
                    'upload-date': new Date().toISOString(),
                    'original-filename': fileName
                }
            };
            
            const result = await this.s3.upload(params).promise();
            
            // 更新统计信息
            this.stats.totalUploaded++;
            this.stats.totalSize += fileBuffer.length;
            
            // 添加到图片映射
            const imageInfo = {
                caseId,
                imageType,
                originalName: fileName,
                storagePath: storagePath,
                b2Url: result.Location,
                cdnUrl: this.generateCDNUrl(storagePath),
                size: fileBuffer.length,
                uploadDate: new Date().toISOString(),
                optimizedUrls: this.generateOptimizedUrls(storagePath)
            };
            
            this.imageMap.set(storagePath, imageInfo);
            
            console.log(`✅ 上传成功: ${fileName} -> ${storagePath}`);
            return imageInfo;
            
        } catch (error) {
            console.error(`❌ 上传失败: ${filePath}`, error.message);
            this.stats.failedUploads++;
            throw error;
        }
    }

    // 2. 批量上传图片
    async uploadBatchImages(imageList) {
        const results = [];
        const batchSize = 10; // 并发控制
        
        for (let i = 0; i < imageList.length; i += batchSize) {
            const batch = imageList.slice(i, i + batchSize);
            const batchPromises = batch.map(item => 
                this.uploadSingleImage(item.filePath, item.caseId, item.imageType)
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults);
            
            // 进度显示
            const progress = Math.round((i + batch.length) / imageList.length * 100);
            console.log(`📊 上传进度: ${progress}%`);
            
            // 延迟避免请求限制
            await this.delay(1000);
        }
        
        return this.processBatchResults(results);
    }

    // 3. 生成CDN URL
    generateCDNUrl(storagePath, options = {}) {
        const { width, height, format = 'webp' } = options;
        let url = `https://${this.config.cdnDomain}/${storagePath}`;
        
        // 添加优化参数
        const params = new URLSearchParams();
        if (width) params.append('width', width);
        if (height) params.append('height', height);
        if (format !== 'original') params.append('format', format);
        
        const queryString = params.toString();
        return queryString ? `${url}?${queryString}` : url;
    }

    // 4. 生成优化URL集合
    generateOptimizedUrls(storagePath) {
        return {
            original: this.generateCDNUrl(storagePath),
            webp: this.generateCDNUrl(storagePath, { format: 'webp' }),
            avif: this.generateCDNUrl(storagePath, { format: 'avif' }),
            thumbnail: this.generateCDNUrl(storagePath, { width: 300, format: 'webp' }),
            medium: this.generateCDNUrl(storagePath, { width: 600, format: 'webp' }),
            large: this.generateCDNUrl(storagePath, { width: 1200, format: 'webp' })
        };
    }

    // 5. 生成存储路径
    generateStoragePath(caseId, imageType, fileExt) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        
        return `cases/${caseId}/${imageType}-${timestamp}-${randomStr}${fileExt}`;
    }

    // 6. 生成图片映射文件
    generateImageMapFile(outputPath = './image-map.json') {
        const mapData = {
            generatedAt: new Date().toISOString(),
            totalImages: this.imageMap.size,
            totalSize: this.stats.totalSize,
            images: Object.fromEntries(this.imageMap)
        };
        
        fs.writeFileSync(outputPath, JSON.stringify(mapData, null, 2));
        console.log(`🗺️ 图片映射文件已生成: ${outputPath}`);
        return mapData;
    }

    // 7. 文件管理功能
    async listImages(prefix = 'cases/') {
        const params = {
            Bucket: this.config.bucketName,
            Prefix: prefix
        };
        
        const result = await this.s3.listObjectsV2(params).promise();
        return result.Contents || [];
    }

    async deleteImage(storagePath) {
        const params = {
            Bucket: this.config.bucketName,
            Key: storagePath
        };
        
        await this.s3.deleteObject(params).promise();
        this.imageMap.delete(storagePath);
        console.log(`🗑️ 已删除: ${storagePath}`);
    }

    // 8. 统计信息
    getStatistics() {
        return {
            ...this.stats,
            successRate: this.stats.totalUploaded / (this.stats.totalUploaded + this.stats.failedUploads) * 100,
            averageSize: this.stats.totalSize / this.stats.totalUploaded,
            imageMapSize: this.imageMap.size
        };
    }

    // 辅助方法
    getContentType(ext) {
        const typeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        return typeMap[ext] || 'application/octet-stream';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    processBatchResults(results) {
        const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);
        
        return {
            successful,
            failed,
            total: results.length,
            successCount: successful.length,
            failCount: failed.length
        };
    }
}

// 使用示例
async function main() {
    // 初始化管理器
    const manager = new B2ImageManager();

    // 示例：批量上传失踪人口图片
    const imageBatch = [
        {
            filePath: './images/romaldo-astran-profile.jpg',
            caseId: 'romaldo-astran',
            imageType: 'profile'
        },
        {
            filePath: './images/romaldo-astran-evidence1.jpg',
            caseId: 'romaldo-astran',
            imageType: 'evidence'
        },
        // 添加更多图片...
    ];

    try {
        // 执行批量上传
        const results = await manager.uploadBatchImages(imageBatch);
        
        // 生成图片映射
        const imageMap = manager.generateImageMapFile('./missing-persons-image-map.json');
        
        // 显示统计信息
        const stats = manager.getStatistics();
        console.log('📈 上传统计:', stats);
        
        // 示例CDN URL
        const sampleImage = results.successful[0];
        if (sampleImage) {
            console.log('🌐 示例CDN URL:');
            console.log('   原始图片:', sampleImage.cdnUrl);
            console.log('   缩略图:', sampleImage.optimizedUrls.thumbnail);
            console.log('   中等尺寸:', sampleImage.optimizedUrls.medium);
        }
        
    } catch (error) {
        console.error('批量上传失败:', error);
    }
}

// 导出模块
module.exports = B2ImageManager;

// 命令行接口支持
if (require.main === module) {
    const yargs = require('yargs/yargs');
    const { hideBin } = require('yargs/helpers');
    const fs = require('fs');
    const path = require('path');
    const dotenv = require('dotenv');
    
    // 强制从 .env 文件加载配置（忽略系统环境变量）
    const envConfig = dotenv.config({ override: true });
    
    const argv = yargs(hideBin(process.argv))
        .option('file', {
            alias: 'f',
            describe: '要上传的图片文件路径',
            type: 'string',
            demandOption: true
        })
        .option('case-id', {
            alias: 'c',
            describe: '案件ID',
            type: 'string',
            default: 'default-case'
        })
        .option('image-type', {
            alias: 't',
            describe: '图片类型 (profile/evidence/scene)',
            type: 'string',
            default: 'profile'
        })
        .option('help', {
            alias: 'h',
            describe: '显示帮助信息',
            type: 'boolean'
        })
        .parse();
    
    async function cliUpload() {
        try {
            console.log('🚀 开始上传图片...');
            console.log('📁 图片路径:', argv.file);
            console.log('🔍 案件ID:', argv.caseId);
            console.log('🖼️ 图片类型:', argv.imageType);
            
            // 验证文件是否存在
            if (!fs.existsSync(argv.file)) {
                throw new Error(`文件不存在: ${argv.file}`);
            }
            
            // 验证图片格式
            const fileExt = path.extname(argv.file).toLowerCase();
            const allowedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            if (!allowedFormats.includes(fileExt)) {
                throw new Error(`不支持的文件格式: ${fileExt}`);
            }
            
            // 使用环境变量配置B2密钥
            const AWS = require('aws-sdk');
            const s3 = new AWS.S3({
                accessKeyId: process.env.B2_ACCESS_KEY_ID,
                secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
                endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
                s3ForcePathStyle: true,
                signatureVersion: 'v4',
                region: process.env.B2_REGION || 'us-east-005'
            });
            
            // 生成存储路径
            const fileName = path.basename(argv.file);
            const storagePath = `cases/${argv.caseId}/${argv.imageType}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${fileExt}`;
            
            // 读取文件
            const fileBuffer = fs.readFileSync(argv.file);
            
            // 上传参数
            const params = {
                Bucket: 'gudq-missing-assets',
                Key: storagePath,
                Body: fileBuffer,
                ContentType: getContentType(fileExt),
                // B2 不支持 ACL，移除该参数
                Metadata: {
                    'case-id': argv.caseId,
                    'image-type': argv.imageType,
                    'upload-date': new Date().toISOString(),
                    'original-filename': fileName
                }
            };
            
            console.log('\n🔧 上传配置:');
            console.log('   存储桶:', 'gudq-missing-assets');
            console.log('   存储路径:', storagePath);
            console.log('   文件大小:', (fileBuffer.length / 1024).toFixed(2), 'KB');
            console.log('   文件格式:', fileExt);
            
            // 执行上传
            const result = await s3.upload(params).promise();
            
            console.log('\n✅ 上传成功!');
            console.log('📌 存储路径:', storagePath);
            console.log('🌐 B2 URL:', result.Location);
            console.log('📊 图片大小:', (fileBuffer.length / 1024).toFixed(2), 'KB');
            
            console.log('\n💡 图片信息:');
            console.log('   案件ID:', argv.caseId);
            console.log('   图片类型:', argv.imageType);
            console.log('   原始文件名:', fileName);
            
        } catch (error) {
            console.error('❌ 上传失败:', error.message);
            console.error('🔍 错误详情:', error.stack);
            process.exit(1);
        }
    }
    
    // 获取内容类型
    function getContentType(ext) {
        const typeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        return typeMap[ext] || 'application/octet-stream';
    }
    
    cliUpload();
}

/*
安装依赖：
npm install aws-sdk yargs

环境变量配置：
export B2_ACCESS_KEY_ID=your_access_key_id
export B2_SECRET_ACCESS_KEY=your_secret_access_key
export B2_BUCKET_NAME=your_bucket_name
export B2_ENDPOINT=your_endpoint
export B2_REGION=your_region

命令行使用：
node b2-image-manager.js --file ./image.jpg --case-id "case-123" --image-type profile

简化命令：
node b2-image-manager.js -f ./image.jpg -c "case-123" -t evidence

优势：
✅ 完整的图片管理解决方案
✅ 支持批量上传和并发控制
✅ 自动生成CDN优化URL
✅ 图片映射文件便于前端使用
✅ 详细的统计和错误处理
✅ 企业级稳定性和安全性
✅ 命令行接口支持
*/