const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * 检查是否为 URL
 * @param {string} str - 要检查的字符串
 * @returns {boolean} 是否为 URL
 */
function isUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * 下载远程图片
 * @param {string} url - 图片 URL
 * @param {string} outputPath - 保存路径
 * @returns {Promise<string>} 保存的文件路径
 */
async function downloadImage(url, outputPath) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    await fs.promises.writeFile(outputPath, response.data);
    return outputPath;
  } catch (error) {
    throw new Error(`下载图片失败: ${error.message}`);
  }
}

/**
 * 将图片转换为 WebP 格式
 * @param {string} inputPath - 输入图片路径或 URL
 * @param {string} outputPath - 输出 WebP 图片路径
 * @param {Object} options - 转换选项
 * @param {number} options.quality - 图片质量 (0-100)
 */
async function convertToWebp(inputPath, outputPath, options = {}) {
  try {
    let localInputPath = inputPath;
    let tempFile = false;

    // 检查是否为 URL
    if (isUrl(inputPath)) {
      // 为远程图片创建临时文件
      const tempFileName = `temp_${Date.now()}_${path.basename(new URL(inputPath).pathname)}`;
      localInputPath = path.join(__dirname, tempFileName);
      tempFile = true;
      
      // 下载图片
      console.log(`正在下载图片: ${inputPath}`);
      await downloadImage(inputPath, localInputPath);
    } else {
      // 检查本地文件是否存在
      if (!fs.existsSync(inputPath)) {
        throw new Error(`输入文件不存在: ${inputPath}`);
      }
    }

    // 设置默认选项
    const { quality = 80 } = options;

    // 如果没有指定输出路径，使用默认名称
    if (!outputPath) {
      outputPath = `${path.parse(localInputPath).name}.webp`;
    }

    // 转换图片
    console.log(`正在转换为 WebP...`);
    await sharp(localInputPath)
      .webp({ quality })
      .toFile(outputPath);

    // 将输出路径转换为相对路径
    const relativeOutputPath = `./${path.relative(__dirname, outputPath)}`;
    console.log(`成功转换为 WebP: ${relativeOutputPath}`);

    // 删除临时文件
    if (tempFile) {
      fs.unlinkSync(localInputPath);
      const relativeTempPath = `./${path.relative(__dirname, localInputPath)}`;
      console.log(`已删除临时文件: ${relativeTempPath}`);
    }
  } catch (error) {
    console.error('转换失败:', error.message);
  }
}

// 如果直接运行脚本，则使用命令行参数
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('用法: node webp.js <输入图片路径> [输出路径] [质量]');
    console.log('示例: node webp.js input.jpg output.webp 80');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || `${path.parse(inputPath).name}.webp`;
  const quality = args[2] ? parseInt(args[2]) : 80;

  convertToWebp(inputPath, outputPath, { quality });
}

module.exports = convertToWebp;