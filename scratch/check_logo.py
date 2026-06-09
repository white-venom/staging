import os
from PIL import Image
from collections import Counter

def find_prominent_colors(path):
    print(f"=== Colors in {path} ===")
    if not os.path.exists(path):
        return
    with Image.open(path) as img:
        img = img.convert('RGBA')
        pixels = list(img.getdata())
        non_white = [p for p in pixels if p[3] > 0 and not (p[0] > 240 and p[1] > 240 and p[2] > 240)]
        counter = Counter(non_white)
        print("Most common non-white colors:")
        for color, count in counter.most_common(15):
            print(f"RGBA: {color}, Hex: #{color[0]:02x}{color[1]:02x}{color[2]:02x}, Count: {count}")

if __name__ == "__main__":
    find_prominent_colors("d:/work/doit servcie/frontend/public/logo.png")
