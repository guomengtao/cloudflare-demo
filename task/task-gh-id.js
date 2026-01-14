// 彻底抑制dotenv的所有输出
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

// 禁用所有控制台输出
console.log = function() {};
console.error = function() {};
console.warn = function() {};
console.info = function() {};

// 启用dotenv
const dotenv = require('dotenv');
dotenv.config();

// 恢复控制台输出
console.log = originalLog;
console.error = originalError;
console.warn = originalWarn;
console.info = originalInfo;

const { execSync } = require('child_process');

// 默认配置：不自动更新GitHub变量
const DEFAULT_CONFIG = {
  updateGhVariable: false
};

/**
 * 执行 shell 命令并获取输出
 * @param {string} command - 要执行的命令
 * @returns {string} 命令输出
 */
function executeCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    // 过滤掉变量不存在时的错误信息
    if (error.stderr && error.stderr.includes('variable') && error.stderr.includes('was not found')) {
      return '';
    }
    // 其他错误信息仍会输出
    if (error.stderr) {
      console.error(error.stderr.trim());
    }
    return '';
  }
}

/**
 * 设置 GitHub 变量
 * @param {string} name - 变量名
 * @param {string} value - 变量值
 * @returns {boolean} 是否成功
 */
function setGhVariable(name, value) {
  try {
    executeCommand(`gh variable set ${name} --body "${value}"`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 获取变量值 - 优先从环境变量中读取
 * @param {string} name - 变量名
 * @returns {string|null} 变量值或 null
 */
function getVariable(name) {
  try {
    // 优先从环境变量中读取（包括.env文件）
    if (process.env[name]) {
      return process.env[name];
    }
    
    return null;
  } catch (error) {
    console.error('获取变量失败:', error.message);
    return null;
  }
}

/**
 * 获取 GitHub 变量值（仅在明确需要时使用）
 * @param {string} name - 变量名
 * @returns {string|null} 变量值或 null
 */
function getGhVariable(name) {
  try {
    const value = executeCommand(`gh variable get ${name}`);
    return value || null;
  } catch (error) {
    // 如果错误是"variable ... was not found"，返回null
    // 否则重新抛出错误
    if (error.stdout && error.stdout.includes('variable') && error.stdout.includes('was not found')) {
      return null;
    }
    throw error;
  }
}

/**
 * 转换变量名为符合 GitHub 要求的格式
 * @param {string} name - 原始变量名
 * @returns {string} 转换后的变量名
 */
function convertToGhVariableName(name) {
  // 替换连字符为下划线，确保符合 GitHub 变量名要求
  return name.replace(/-/g, '_').toUpperCase();
}

/**
 * 主函数
 */
function main() {
  // 处理命令行参数
  const args = process.argv.slice(2);
  let taskName = 'webp'; // 默认任务名
  let varValue = '1'; // 默认变量值
  let config = { ...DEFAULT_CONFIG };
  
  // 解析参数
  if (args.length >= 1) {
    taskName = args[0];
  }
  
  if (args.length >= 2) {
    // 检查是否是开启GitHub更新的标志
    if (args[1] === '--gh' || args[1] === '-gh') {
      config.updateGhVariable = true;
      // 如果还有第三个参数，那就是varValue
      if (args.length >= 3) {
        varValue = args[2];
      }
    } else {
      varValue = args[1];
      // 检查是否有第三个参数是开启GitHub更新的标志
      if (args.length >= 3 && (args[2] === '--gh' || args[2] === '-gh')) {
        config.updateGhVariable = true;
      }
    }
  }
  
  // 转换为符合要求的变量名
  const varName = convertToGhVariableName(`TASK_${taskName}`);
  
  // 获取当前变量值 - 优先从环境变量中读取
  let currentValue = getVariable(varName);
  
  // 如果环境变量中没有，且配置了使用GitHub变量，则从GitHub读取
  if (!currentValue && config.updateGhVariable) {
    currentValue = getGhVariable(varName);
  }
  
  let resultValue;
  if (currentValue === null) {
    // 变量不存在
    if (args.length >= 2 && !['--gh', '-gh'].includes(args[1])) {
      // 传入了新值，直接使用该值
      resultValue = varValue;
      if (config.updateGhVariable) {
        setGhVariable(varName, resultValue);
      }
    } else {
      // 没有传入新值，默认使用1
      resultValue = '1';
      if (config.updateGhVariable) {
        setGhVariable(varName, resultValue);
      }
    }
  } else {
    // 变量存在
    if (args.length >= 2 && !['--gh', '-gh'].includes(args[1])) {
      // 传入了新值，直接使用该值
      resultValue = varValue;
      if (config.updateGhVariable) {
        setGhVariable(varName, resultValue);
      }
    } else {
      // 没有传入新值，使用当前值+1
      resultValue = (parseInt(currentValue) + 1).toString();
      if (config.updateGhVariable) {
        setGhVariable(varName, resultValue);
      }
    }
  }
  
  // 返回结果 - 直接输出值
  process.stdout.write(resultValue + '\n');
}

// 执行主函数
if (require.main === module) {
  main();
}