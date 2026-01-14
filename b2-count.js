// Backblaze B2 文件数量和大小统计工具
// 使用 b2 命令行工具统计 B2 存储桶中的文件数量和总大小

const { exec } = require('child_process');
const util = require('util');

// 将 exec 转换为 Promise 形式
const execPromise = util.promisify(exec);

class B2FileCounter {
    constructor(config) {
        // 默认配置
        this.config = {
            bucketName: config.bucketName || 'gudq-missing-assets',
            ...config
        };
        
        // 统计信息
        this.stats = {
            fileCount: 0,
            totalSize: 0,
            startTime: null,
            endTime: null
        };
    }
    
    /**
     * 使用 b2 命令行工具统计文件数量和大小
     * @returns {Promise<Object>} 统计结果
     */
    async countFiles() {
        try {
            // 设置开始时间
            this.stats.startTime = new Date();
            console.log(`🔍 开始统计 ${this.config.bucketName} 中的文件...`);
            
            // 使用 b2 ls --recursive --long 命令获取所有文件信息
            const command = `b2 ls --recursive --long b2://${this.config.bucketName}`;
            const { stdout, stderr } = await execPromise(command);
            
            // 解析输出
            const lines = stdout.trim().split('\n');
            
            // 统计文件数量和大小
            this.stats.fileCount = lines.length;
            this.stats.totalSize = lines.reduce((total, line) => {
                // 分割每行，取第3个字段（大小）
                const parts = line.split(/\s+/);
                if (parts.length >= 4) {
                    const size = parseInt(parts[2]);
                    return total + (isNaN(size) ? 0 : size);
                }
                return total;
            }, 0);
            
            // 完成统计
            this.stats.endTime = new Date();
            this.stats.duration = this.stats.endTime - this.stats.startTime;
            
            return this.stats;
            
        } catch (error) {
            console.error(`❌ 统计文件失败: ${error.message}`);
            if (error.stderr) {
                console.error(`   错误详情: ${error.stderr}`);
            }
            throw error;
        }
    }
    
    /**
     * 格式化文件大小为易读的格式
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} 格式化后的文件大小
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(3)) + ' ' + sizes[i];
    }
    
    /**
     * 显示统计结果
     * @param {Object} stats - 统计信息
     */
    displayResults(stats) {
        console.log('\n📊 文件统计结果');
        console.log('=====================');
        console.log(`📦 存储桶: ${this.config.bucketName}`);
        console.log(`📝 文件总数: ${stats.fileCount} 个`);
        console.log(`📏 总大小: ${this.formatSize(stats.totalSize)}`);
        console.log(`   (${(stats.totalSize / 1024 / 1024).toFixed(3)} MB)`);
        console.log(`⏱️  耗时: ${(stats.duration / 1000).toFixed(2)} 秒`);
        console.log('=====================');
    }
}

// 主函数
async function main() {
    try {
        // 创建 B2FileCounter 实例
        const counter = new B2FileCounter({});
        
        // 统计文件
        const stats = await counter.countFiles();
        
        // 显示结果
        counter.displayResults(stats);
        
    } catch (error) {
        console.error(`❌ 程序执行失败: ${error.message}`);
        process.exit(1);
    }
}

// 执行主函数
if (require.main === module) {
    main();
}

module.exports = B2FileCounter;