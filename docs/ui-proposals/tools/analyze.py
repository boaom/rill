"""candidates-*.png 的像素级体检：每格主色占比 / 明度 / 纹理量 / 两两差异。
用途：本 runtime 模型无图像输入，用可复算的像素统计替代"看一眼"。
"""
import json, sys, math
from collections import Counter
from PIL import Image

shot, rep = sys.argv[1], sys.argv[2]
img = Image.open(shot).convert("RGB")
R = json.load(open(rep))
S = R["screens"]

def cell(s):
    b = s["screenBox"]
    x0, y0 = b["x"], b["y"]
    x1, y1 = min(x0 + b["w"], img.width), min(y0 + b["h"], img.height)
    return img.crop((x0, y0, x1, y1))

def stats(im):
    px = list(im.getdata())
    n = len(px)
    q = Counter(((r >> 3, g >> 3, b >> 3) for r, g, b in px))
    top = q.most_common(4)
    lum = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px]
    mean = sum(lum) / n
    var = sum((v - mean) ** 2 for v in lum) / n
    # 纹理量：相邻像素亮度差的平均（横+纵），越高越"满"
    g = im.convert("L")
    W, H = g.size
    d = g.load()
    diff = 0; cnt = 0
    for y in range(0, H, 2):
        for x in range(0, W - 1, 2):
            diff += abs(d[x + 1, y] - d[x, y]); cnt += 1
    for x in range(0, W, 2):
        for y in range(0, H - 1, 2):
            diff += abs(d[x, y + 1] - d[x, y]); cnt += 1
    hist = Counter()
    for r, gg, b in px:
        hist[(r >> 4, gg >> 4, b >> 4)] += 1
    return dict(n=n, mean=round(mean, 1), std=round(math.sqrt(var), 1),
                texture=round(diff / cnt, 2),
                top=[(("#%02X%02X%02X" % (r << 3, gg << 3, b << 3)), round(c / n * 100, 1)) for (r, gg, b), c in top],
                hist=hist)

res = {}
for s in S:
    im = cell(s)
    res[s["name"]] = stats(im)
    r = res[s["name"]]
    print(f"{s['name']}: mean L {r['mean']:5.1f}  std {r['std']:5.1f}  texture {r['texture']:5.2f}  top " +
          "  ".join(f"{c} {p}%" for c, p in r["top"]))

print("\n两两差异（4bit 颜色直方图 L1 距离，越大越不像；上限 200）：")
names = list(res)
for i, a in enumerate(names):
    row = []
    for j, b in enumerate(names):
        if j < i: row.append("  ·  "); continue
        if i == j: row.append("  -  "); continue
        ha, hb = res[a]["hist"], res[b]["hist"]
        keys = set(ha) | set(hb)
        d = sum(abs(ha.get(k, 0) - hb.get(k, 0)) for k in keys) / max(sum(ha.values()), 1) * 100
        row.append(f"{d:5.1f}")
    print(f"{a:4s} " + " ".join(row))
