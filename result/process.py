import os
import json
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from scipy.ndimage import gaussian_filter

# 文件夹路径
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(THIS_DIR, "data")
IMG_DIR = os.path.join(THIS_DIR, "..", "public", "test_imgs")
HEATMAP_DIR = os.path.join(THIS_DIR, "heatmap")

if not os.path.exists(HEATMAP_DIR):
    os.makedirs(HEATMAP_DIR, exist_ok=True)

def plot_heatmap(img_path, points, save_path, sigma=30):
    """叠加热力图并保存"""
    im = Image.open(img_path).convert("RGB")
    W, H = im.size
    fig, ax = plt.subplots(figsize=(W/100, H/100), dpi=100)
    ax.imshow(im)

    # 只画有 gaze 点的情况
    if points:
        pts = np.array(points)
        heat = np.zeros((H, W))
        for x, y in pts:
            # 防止超出边界
            ix, iy = int(np.clip(y, 0, H-1)), int(np.clip(x, 0, W-1))
            heat[ix, iy] += 1
        heat = gaussian_filter(heat, sigma=sigma)
        ax.imshow(heat, cmap="jet", alpha=0.35)
    ax.axis("off")
    plt.subplots_adjust(0,0,1,1)
    fig.savefig(save_path, bbox_inches="tight", pad_inches=0)
    plt.close(fig)

def process_all():
    json_files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
    if not json_files:
        print("[警告] data 目录下没有 json 文件！")
        return
    for fname in json_files:
        img_id = os.path.splitext(fname)[0]
        json_path = os.path.join(DATA_DIR, fname)

        # 支持多种图片后缀
        img_path = None
        for ext in ['.png', '.jpg', '.jpeg', '.bmp', '.webp']:
            try_path = os.path.join(IMG_DIR, f"{img_id}{ext}")
            if os.path.exists(try_path):
                img_path = try_path
                break
        if not img_path:
            print(f"[跳过] 未找到图片: {img_id}.*")
            continue

        # 读取 gaze 数据
        with open(json_path, "r", encoding="utf8") as f:
            gaze_arr = json.load(f)

        pts_img = []
        for entry in gaze_arr:
            x, y, img = entry.get('x'), entry.get('y'), entry.get('img')
            if x is None or y is None or img is None: continue
            try:
                px = (x - img['left']) / img['width']
                py = (y - img['top']) / img['height']
                if 0 <= px <= 1 and 0 <= py <= 1:
                    with Image.open(img_path) as im:
                        real_x = px * im.width
                        real_y = py * im.height
                    pts_img.append([real_x, real_y])
            except Exception as e:
                print(f"[警告] 归一化失败: {entry}, 错误: {e}")
                continue

        out_path = os.path.join(HEATMAP_DIR, f"{img_id}_heatmap.png")
        plot_heatmap(img_path, pts_img, out_path, sigma=30)
        print(f"Processed {img_id}, gaze points: {len(pts_img)}, saved: {out_path}")

if __name__ == "__main__":
    process_all()
