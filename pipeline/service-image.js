const fs = require('fs');
const path = require('path');
const convertToWebp = require('../task/webp');

// 辅助函数：格式化路径名
function formatPathName(name) {
  if (!name) return 'unknown';
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[\'\"]/g, '');
}

module.exports = {
  // 提取有效图片URL
  extractUrls: (htmlContent) => {
    if (!htmlContent) return [];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const urlPattern = new RegExp(`https?:\/\/[^\s\"']+\.(${imageExtensions.join('|')})[^\s\"']*`, 'gi');
    const urlMatches = htmlContent.match(urlPattern) || [];
    
    const imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    let imgMatches;
    const allUrls = [...urlMatches];
    while ((imgMatches = imgPattern.exec(htmlContent)) !== null) {
        if (imgMatches[1]) allUrls.push(imgMatches[1]);
    }

    const realImages = [...new Set(allUrls.filter(url => {
        if (!url) return false;
        const lower = url.toLowerCase();
        return !['placeholder', 'via.placeholder', 'data:image', 'blank', 'default'].some(p => lower.includes(p));
    }))];

    return realImages;
  },
  
  // 转换图片为WebP格式
  convert: async (url, caseData, imageType = 'profile') => {
    try {
      // 使用从caseData中直接获取的url_path
      const urlPath = caseData.url_path;
      
      // 检查url_path是否存在
      if (!urlPath) {
        throw new Error(`url_path不存在，无法继续处理图片: ${url}`);
      }
      
      const urlObj = new URL(url);
      const fileName = path.parse(path.basename(urlObj.pathname)).name + '.webp';
      // 相对路径：./url_path/case_id/filename.webp
      const outputDir = path.join('./', urlPath, caseData.case_id);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, fileName);
      
      // 转换图片
      await convertToWebp(url, outputPath, { quality: 80 });
      
      return outputPath;
    } catch (error) {
      throw new Error(`图片转换失败: ${error.message}`);
    }
  },
  
  // 删除本地文件
  cleanup: (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`清理文件失败: ${filePath} - ${error.message}`);
    }
  }
};