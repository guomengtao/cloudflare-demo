const { execSync } = require('child_process');

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
 * 获取 GitHub 变量值
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
  
  // 解析参数
  if (args.length >= 1) {
    taskName = args[0];
  }
  
  if (args.length >= 2) {
    varValue = args[1];
  }
  
  // 转换为符合 GitHub 要求的变量名
  const varName = convertToGhVariableName(`TASK_${taskName}`);
  
  // 获取当前变量值
  const currentValue = getGhVariable(varName);
  
  let resultValue;
  if (currentValue === null) {
    // 变量不存在
    if (args.length >= 2) {
      // 传入了新值，直接使用该值
      resultValue = varValue;
      setGhVariable(varName, resultValue);
    } else {
      // 没有传入新值，默认使用1
      resultValue = '1';
      setGhVariable(varName, resultValue);
    }
  } else {
    // 变量存在
    if (args.length >= 2) {
      // 传入了新值，直接使用该值
      resultValue = varValue;
      setGhVariable(varName, resultValue);
    } else {
      // 没有传入新值，使用当前值+1
      resultValue = (parseInt(currentValue) + 1).toString();
      setGhVariable(varName, resultValue);
    }
  }
  
  // 返回结果 - 使用process.stdout.write确保完整输出
  process.stdout.write('{"task":"' + taskName + '","value":' + resultValue + '}\n');
}

// 执行主函数
if (require.main === module) {
  main();
}