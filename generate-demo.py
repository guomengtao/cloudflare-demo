import os
import random
import string
from datetime import datetime

# 1. 配置：定义目标文件夹
TARGET_DIR = "./dist/case"

def generate_random_name(length=8):
    """生成一个短的随机字符串，比如 'a7k9b2x1'"""
    letters_and_digits = string.ascii_lowercase + string.digits
    return ''.join(random.choice(letters_and_digits) for i in range(length))

def create_html():
    # 确保文件夹存在，没有就创建一个
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)
        print(f"✅ 已创建目录: {TARGET_DIR}")

    # 生成随机文件名和当前时间
    random_id = generate_random_name()
    file_name = f"case_{random_id}.html"
    file_path = os.path.join(TARGET_DIR, file_name)
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 定义 HTML 内容
    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <title>{file_name}</title>
    </head>
    <body>
        <h1>你好！</h1>
        <p>这个文件的名字是：<strong>{file_name}</strong></p>
        <p>生成时间是：{current_time}</p>
    </body>
    </html>
    """

    # 写入文件
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"🚀 成功生成文件: {file_path}")

if __name__ == "__main__":
    create_html()