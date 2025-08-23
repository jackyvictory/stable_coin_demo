#!/usr/bin/env python3
"""
创建完美的圆形头像
完全去除四角，只保留圆形区域
"""

from PIL import Image, ImageDraw
import numpy as np

def create_circular_avatar(input_path, output_path):
    """
    创建圆形头像，四角完全透明
    """
    # 打开图片
    img = Image.open(input_path)
    
    # 转换为RGBA模式
    img = img.convert("RGBA")
    
    # 获取图片尺寸
    width, height = img.size
    
    # 创建一个新的透明图片
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    # 创建圆形遮罩
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    
    # 计算圆形的中心和半径
    center_x, center_y = width // 2, height // 2
    radius = min(center_x, center_y) - 10  # 稍微缩小一点，确保边缘干净
    
    # 绘制白色圆形（白色区域将被保留）
    draw.ellipse([
        center_x - radius, center_y - radius,
        center_x + radius, center_y + radius
    ], fill=255)
    
    # 应用遮罩
    result.paste(img, (0, 0))
    result.putalpha(mask)
    
    # 保存结果
    result.save(output_path, 'PNG')
    print(f"已保存圆形头像到: {output_path}")

if __name__ == "__main__":
    # 创建圆形头像
    create_circular_avatar("demo/images/avatar.png", "demo/images/avatar_circular.png")