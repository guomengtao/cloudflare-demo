#!/bin/bash

# --- 配置区 ---
INTERVAL=15  # 自动执行的间隔秒数
COUNT=0      # 执行计数器

echo "------------------------------------------"
echo "      Git 冲突自动解决工具 (--ours)"
echo "------------------------------------------"
echo "策略：git checkout --ours ."
echo "操作：回车立即执行 | 'q' 退出 | 无操作 ${INTERVAL}s 后自动执行"
echo "------------------------------------------"

while true; do
    # 动态倒计时交互
    echo -n "等待中 (当前执行次数: $COUNT)... [回车确认 / q 退出]: "
    
    # -t 指定超时时间，-n 1 读入一个字符
    read -t $INTERVAL -n 1 user_input
    res=$?

    # 检查是否输入了 q 退出
    if [[ "$user_input" == "q" || "$user_input" == "Q" ]]; then
        echo -e "\n[已停止] 脚本运行结束。总计执行: $COUNT 次。"
        exit 0
    fi

    # 执行 Git 命令 (如果是超时 res > 128，或者是用户按了回车)
    echo -e "\n[$(date +%H:%M:%S)] 正在执行 git checkout --ours . ..."
    
    # 执行命令并捕获错误
    if git checkout --ours . 2>/dev/null; then
        ((COUNT++))
        echo "成功！已应用 --ours 策略。"
    else
        echo "提示：当前可能没有合并冲突，或不在 Git 仓库目录中。"
    fi
    
    echo "------------------------------------------"
done
