// Backblaze B2 图片管理系统 - 简化升级版本
// 支持图片下载、WebP转换和批量上传

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const fetch = require('node-fetch'); // 确保已安装 node-fetch@2
const sharp = require('sharp'); // 用于图片转换

// 初始化配置
dotenv.config({ override: true });

// B2 配置
const B2_CONFIG = {
    bucketName: process.env.B2_BUCKET_NAME,
    endpoint: process.env.B2_ENDPOINT,
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    region: process.env.B2_REGION
};

// 验证B2配置是否完整
if (!B2_CONFIG.bucketName || !B2_CONFIG.endpoint || !B2_CONFIG.accessKeyId || !B2_CONFIG.secretAccessKey || !B2_CONFIG.region) {
    console.error('❌ B2配置不完整，请检查.env文件中的B2配置项');
    process.exit(1);
}

// 初始化 AWS S3 客户端
const s3 = new AWS.S3({
    accessKeyId: B2_CONFIG.accessKeyId,
    secretAccessKey: B2_CONFIG.secretAccessKey,
    endpoint: B2_CONFIG.endpoint,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    region: B2_CONFIG.region
});

/**
 * 封装延迟函数
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 创建下载目录
 */
function createDownloadDir(state, county, city, caseId) {
    const dirPath = path.join(__dirname, 'img', state, county, city, caseId);
    
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 创建目录成功: ${dirPath}`);
    }
    
    return dirPath;
}

/**
 * 下载图片
 */
async function downloadImage(url, savePath) {
    console.log(`📥 正在下载图片: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`下载失败: ${response.status}`);
        }
        
        const buffer = await response.buffer();
        fs.writeFileSync(savePath, buffer);
        console.log(`✅ 图片下载成功: ${savePath}`);
        return true;
    } catch (error) {
        console.error(`❌ 图片下载失败: ${error.message}`);
        return false;
    }
}

/**
 * 转换图片为WebP格式
 */
async function convertToWebP(inputPath, outputPath) {
    console.log(`🎨 正在转换为WebP格式: ${inputPath}`);
    
    try {
        await sharp(inputPath)
            .webp({ quality: 85 })
            .toFile(outputPath);
        
        console.log(`✅ WebP转换成功: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`❌ WebP转换失败: ${error.message}`);
        return false;
    }
}

/**
 * 上传图片到B2
 */
async function uploadToB2(filePath, caseId, imageType = 'profile') {
    console.log(`📤 正在上传到B2: ${filePath}`);
    
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        const fileExt = path.extname(fileName).toLowerCase();
        
        // 生成存储路径
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const storagePath = `cases/${caseId}/${imageType}-${timestamp}-${randomStr}${fileExt}`;
        
        // 上传参数
        const params = {
            Bucket: B2_CONFIG.bucketName,
            Key: storagePath,
            Body: fileBuffer,
            ContentType: getContentType(fileExt),
            Metadata: {
                'case-id': caseId,
                'image-type': imageType,
                'upload-date': new Date().toISOString(),
                'original-filename': fileName
            }
        };
        
        const result = await s3.upload(params).promise();
        console.log(`✅ 上传成功: ${result.Location}`);
        return result.Location;
    } catch (error) {
        console.error(`❌ 上传失败: ${error.message}`);
        console.error('错误详情:', error.stack);
        return null;
    }
}

/**
 * 获取文件内容类型
 */
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

/**
 * 处理单个案件
 */
async function processCase(caseInfo) {
    console.log(`\n🚀 开始处理案件: ${caseInfo.case_id}`);
    
    try {
        const { case_id, images_json, missing_state, missing_county, missing_city } = caseInfo;
        const images = typeof images_json === 'string' ? JSON.parse(images_json) : images_json;
        
        console.log(`📊 找到 ${images.length} 张图片`);
        console.log(`📌 案件位置: ${missing_state}/${missing_county}/${missing_city}`);
        
        // 创建下载目录
        const downloadDir = createDownloadDir(missing_state, missing_county, missing_city, case_id);
        
        // 处理每张图片
        let successCount = 0;
        for (let i = 0; i < images.length; i++) {
            const imageUrl = images[i];
            const imageName = `image-${i}.jpg`;
            const originalPath = path.join(downloadDir, imageName);
            const webpPath = path.join(downloadDir, `image-${i}.webp`);
            
            // 下载图片
            const downloadSuccess = await downloadImage(imageUrl, originalPath);
            if (!downloadSuccess) continue;
            
            // 转换为WebP
            const convertSuccess = await convertToWebP(originalPath, webpPath);
            if (!convertSuccess) {
                fs.unlinkSync(originalPath); // 清理原始图片
                continue;
            }
            
            // 上传到B2
            const uploadSuccess = await uploadToB2(webpPath, case_id, 'evidence');
            if (uploadSuccess) {
                successCount++;
            }
            
            // 清理本地文件
            if (fs.existsSync(originalPath)) {
                fs.unlinkSync(originalPath);
            }
            if (fs.existsSync(webpPath)) {
                fs.unlinkSync(webpPath);
            }
        }
        
        console.log(`✅ 案件处理完成: ${case_id}`);
        console.log(`📊 处理结果: ${successCount}/${images.length} 张图片成功`);
        return {
            case_id,
            success: true,
            processed_count: successCount,
            total_count: images.length
        };
        
    } catch (error) {
        console.error(`❌ 案件处理失败: ${error.message}`);
        console.error('错误详情:', error.stack);
        
        return {
            case_id: caseInfo.case_id,
            success: false,
            error: error.message
        };
    }
}

/**
 * 主程序入口
 */
async function main() {
    console.log('🌟 Backblaze B2 图片管理系统 - 简化升级版本');
    console.log('======================================\n');
    
    // 示例案件数据（用户可以根据需要修改）
    const sampleCases = [
        {
            case_id: 'test-case-001',
            images_json: JSON.stringify([
                'https://example.com/image1.jpg',
                'https://example.com/image2.jpg'
            ]),
            missing_state: 'California',
            missing_county: 'Los Angeles',
            missing_city: 'Los Angeles'
        },
        {
            case_id: 'test-case-002',
            images_json: JSON.stringify([
                'https://example.com/image3.jpg',
                'https://example.com/image4.jpg'
            ]),
            missing_state: 'New York',
            missing_county: 'New York',
            missing_city: 'New York'
        }
    ];
    
    // 可以从文件或其他来源加载案件数据
    let casesToProcess = sampleCases;
    
    // 检查是否有案件数据文件
    const casesFile = path.join(__dirname, 'cases-to-process.json');
    if (fs.existsSync(casesFile)) {
        try {
            const casesData = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
            casesToProcess = casesData;
            console.log(`📥 从文件加载了 ${casesToProcess.length} 个案件`);
        } catch (error) {
            console.error('❌ 加载案件数据文件失败:', error.message);
            console.log('📝 将使用示例案件数据');
        }
    } else {
        console.log('📝 将使用示例案件数据');
        console.log('💡 提示: 创建 cases-to-process.json 文件可以加载自定义案件数据');
    }
    
    const TASK_LIMIT = 2; // 每执行2个任务后停止
    let taskCount = 0;
    
    try {
        for (const caseInfo of casesToProcess) {
            if (taskCount >= TASK_LIMIT) {
                console.log('\n⚠️  已达到任务限制，停止处理');
                break;
            }
            
            await processCase(caseInfo);
            taskCount++;
            
            // 如果不是最后一个任务，添加延迟
            if (taskCount < TASK_LIMIT && taskCount < casesToProcess.length) {
                console.log('\n⏳ 等待 5 秒后执行下一个任务...');
                await sleep(5000);
            }
        }
        
        console.log(`\n🏁 处理完成！共处理了 ${taskCount} 个任务`);
        
    } catch (error) {
        console.error(`❌ 程序执行失败: ${error.message}`);
        console.error('错误详情:', error.stack);
        process.exit(1);
    }
}

// 启动程序
main();