const path = require('path');
const { execSync } = require('child_process');

module.exports = {
  // 上传图片到B2存储
  upload: (filePath, caseId, imageType = 'profile') => {
    try {
      const b2ImageManagerPath = path.join(__dirname, '../task/b2-image-manager.js');
      
      // 从filePath中提取url_path信息
      // 处理多种路径格式：
      // 1. ./url_path/case_id/filename.webp
      // 2. ./../url_path/case_id/filename.webp
      // 3. /absolute/path/url_path/case_id/filename.webp
      
      // 首先解析为绝对路径，确保一致性
      const absolutePath = path.resolve(filePath);
      
      // 使用path.parse解析路径，获取目录名
      const dirname = path.dirname(absolutePath);
      
      // 查找case_id在目录路径中的位置
      const caseIdIndex = dirname.indexOf(caseId);
      
      if (caseIdIndex === -1) {
        throw new Error(`无法在路径中找到case_id ${caseId}: ${filePath}`);
      }
      
      // 提取case_id之前的部分作为url_path
      let urlPath = dirname.substring(0, caseIdIndex).trim();
      
      // 清理url_path：
      // 1. 移除末尾的路径分隔符
      // 2. 移除开头的无关部分
      urlPath = urlPath.replace(/\/$/, '');
      
      // 如果url_path为空，尝试另一种方法
      if (!urlPath) {
        // 第二种方法：使用path.basename获取目录结构
        let currentDir = path.dirname(absolutePath);
        let found = false;
        let urlPathParts = [];
        
        // 向上遍历目录，直到找到根目录或确定url_path
        while (currentDir !== path.dirname(currentDir)) {
          const base = path.basename(currentDir);
          
          if (base === caseId) {
            found = true;
            break;
          }
          
          urlPathParts.unshift(base);
          currentDir = path.dirname(currentDir);
        }
        
        if (found) {
          urlPath = urlPathParts.join('/');
        } else {
          // 第三种方法：处理简单格式
          const simplePathParts = filePath.split('/');
          const caseIdPos = simplePathParts.indexOf(caseId);
          
          if (caseIdPos > 0) {
            // 提取caseId之前的部分（不包括.和..）
            const relevantParts = simplePathParts.slice(0, caseIdPos)
              .filter(part => part && part !== '.' && part !== '..');
            
            if (relevantParts.length > 0) {
              urlPath = relevantParts.join('/');
            }
          }
        }
      }
      
      // 如果仍然无法提取url_path，抛出错误
      if (!urlPath) {
        throw new Error(`无法从路径中提取有效的url_path: ${filePath}`);
      }
      
      // 检查url_path是否存在
      if (!urlPath) {
        throw new Error(`url_path不存在，无法继续上传图片: ${filePath}`);
      }
      
      // 执行上传命令，使用url_path作为存储路径
      execSync(`node ${b2ImageManagerPath} -f "${filePath}" -c "${caseId}" -t "${imageType}" -p "${urlPath}"`, {
        encoding: 'utf8',
        timeout: 30000 // 30秒超时
      });
      
      return true;
    } catch (error) {
      throw new Error(`B2上传失败: ${error.message}`);
    }
  },
  
  // 生成B2存储的URL
  generateUrl: (caseId, imageType, fileName, urlPath = '') => {
    // 这里可以根据B2的存储规则生成URL
    // 实际应用中，可能需要从上传结果中获取真实URL
    const bucketName = process.env.B2_BUCKET_NAME || 'gudq-missing-assets';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileExt = path.extname(fileName).toLowerCase();
    
    // 使用与upload方法相同的路径结构
    const basePath = urlPath ? `${urlPath}/${caseId}` : `cases/${caseId}`;
    const storagePath = `${basePath}/${imageType}-${timestamp}-${randomStr}${fileExt}`;
    return `https://f005.backblazeb2.com/file/${bucketName}/${storagePath}`;
  }
};