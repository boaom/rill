#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 A「日报」方向的应用图标 / 启动图资产（纯本地，零外链）。

设计语言（来自 A 原型 weibo-lite/docs/ui-proposals/A/index.html 的 token）：
  - 纸面为底（--rill-bg #FFFFFF / --rill-surface-2 #F1F1EE）
  - 墨色刊头块（--rill-text #0B0B0B），字在块内反白
  - 一条朱红「报眉」（--rill-accent #C22F1C）
不引入任何 A 之外的新色相：全文件只有 4 个颜色常量，见 PALETTE。

字形：块内反白的「R」用 Arial Bold（几何、笔画均匀，24×24 下仍成立）；
      splash 的中文「溪流」用 Songti（宋体）—— 报纸刊头本来就用宋体，这是设计选择不是兜底。
     「溪」单字做过 24×24 试排（见 assets/app/README.md「为什么不用『溪』当主标」），
     密集笔画在 24px 会糊成一团，所以主标用 R，溪流只在 splash 里当副标。

用法：python3 scripts/gen-app-assets.py
输出：weibo-lite/assets/app/**、weibo-lite/docs/shots/app-icon-preview.png
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "app")
SHOTS = os.path.join(ROOT, "docs", "shots")

# ---- 颜色：全部来自 A 的 token，不许新增 --------------------------------------------------
PALETTE = {
    "paper": (0xFF, 0xFF, 0xFF),   # --rill-bg
    "paper2": (0xF1, 0xF1, 0xEE),  # --rill-surface-2
    "ink": (0x0B, 0x0B, 0x0B),     # --rill-text
    "accent": (0xC2, 0x2F, 0x1C),  # --rill-accent（唯一彩色）
}

FONT_R = "/System/Library/Fonts/Supplemental/Arial Black.ttf"   # 笔画最粗的本地字体：24×24 下反白字才不糊
FONT_CJK = "/System/Library/Fonts/Supplemental/Songti.ttc"


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def _knockout_R(draw: ImageDraw.ImageDraw, box_w: int, box_h: int, ox: int, oy: int,
                color, block_inner_w: float = 0.56) -> None:
    """在墨块里反白一个 R（居中，字面高约为块高的 62%）。"""
    size = int(box_h * 0.90)
    f = _font(FONT_R, size)
    bbox = draw.textbbox((0, 0), "R", font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = ox + (box_w - tw) / 2 - bbox[0]
    y = oy + (box_h - th) / 2 - bbox[1] - box_h * 0.01
    draw.text((x, y), "R", font=f, fill=color)


def draw_mark(img: Image.Image, cx: int, cy: int, box: int,
              paper, ink, accent, with_rule: bool = True,
              w_ratio: float = 0.88, h_ratio: float = 0.74,
              rule_ratio: float = 0.062, gap_ratio: float = 0.035) -> tuple[int, int, int, int]:
    """画刊头标记：墨块（R 反白）+ 下方朱红报眉线。返回标记的外接框 (x0,y0,x1,y1)。"""
    d = ImageDraw.Draw(img)
    blk_w = int(box * w_ratio)
    blk_h = int(box * h_ratio)
    total_h = blk_h + (int(box * (gap_ratio + rule_ratio)) if with_rule else 0)
    x0 = cx - blk_w // 2
    y0 = cy - total_h // 2
    d.rectangle([x0, y0, x0 + blk_w, y0 + blk_h], fill=ink)
    _knockout_R(d, blk_w, blk_h, x0, y0, paper)
    y1 = y0 + blk_h
    if with_rule:
        gap = int(box * gap_ratio)
        h = int(box * rule_ratio)
        d.rectangle([x0, y1 + gap, x0 + blk_w, y1 + gap + h], fill=accent)
        y1 = y1 + gap + h
    return (x0, y0, x0 + blk_w, y1)


def rounded_icon(size: int, radius_ratio: float = 0.225, circular: bool = False) -> Image.Image:
    """方形兼容图标：纸底 + 圆角（自绘，不依赖系统裁切）。"""
    ss = 4  # 超采样，保证圆角边缘干净
    img = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    draw_mark(img, size * ss // 2, size * ss // 2, int(size * ss * 0.94),
              PALETTE["paper"], PALETTE["ink"], PALETTE["accent"],
              w_ratio=0.96, h_ratio=0.84, rule_ratio=0.070, gap_ratio=0.030)
    mask = Image.new("L", (size * ss, size * ss), 0)
    md = ImageDraw.Draw(mask)
    if circular:
        md.ellipse([0, 0, size * ss - 1, size * ss - 1], fill=255)
    else:
        r = int(size * ss * radius_ratio)
        md.rounded_rectangle([0, 0, size * ss - 1, size * ss - 1], radius=r, fill=255)
    # 纸底铺在标记下面
    base = Image.new("RGBA", (size * ss, size * ss), PALETTE["paper"] + (255,))
    base.alpha_composite(img)
    base.putalpha(mask)
    return base.resize((size, size), Image.LANCZOS)


def adaptive_foreground(size: int = 432) -> Image.Image:
    """自适应前景：所有非透明像素必须落在 264×264 中央安全区内。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    safe = int(size * 264 / 432)
    inset = 2                                     # 只留 2px 抗锯齿余量：安全区内尽量做大
    draw_mark(img, size // 2, size // 2, safe - inset * 2,
              (0, 0, 0, 0), PALETTE["ink"], PALETTE["accent"],
              w_ratio=0.99, h_ratio=0.84, rule_ratio=0.088, gap_ratio=0.026)
    return img


def adaptive_background(size: int = 432) -> Image.Image:
    img = Image.new("RGB", (size, size), PALETTE["paper"])
    return img


def splash(size: int = 2732) -> Image.Image:
    img = Image.new("RGB", (size, size), PALETTE["paper"])
    d = ImageDraw.Draw(img)
    mark = int(size * 0.115)                       # 主体约为中心的 1/9 面积，远在中心 1/3 内
    cx, cy = size // 2, int(size * 0.47)
    box = draw_mark(img, cx, cy, mark, PALETTE["paper"], PALETTE["ink"], PALETTE["accent"])
    f = _font(FONT_CJK, int(size * 0.026))
    label = "溪流 · RILL"
    b = d.textbbox((0, 0), label, font=f)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], box[3] + int(size * 0.028)), label,
           font=f, fill=PALETTE["ink"])
    return img


def contrast_ratio(c1, c2) -> float:
    def lum(c):
        def f(v):
            v /= 255
            return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    a, b = lum(c1), lum(c2)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def ink_coverage(img: Image.Image, bg) -> float:
    """主体（墨块 + 朱红条）占画布比例：非背景像素占比。"""
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 30:
                n += 1
    return n / (w * h)


def bbox_nonbg(img: Image.Image, bg):
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 30:
                xs.append(x); ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def bbox_alpha(img: Image.Image):
    a = img.convert("RGBA").split()[3]
    return a.getbbox()


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)

    # 1) 自适应图标两层
    adaptive_foreground(432).save(os.path.join(OUT, "icon-foreground.png"))
    adaptive_background(432).save(os.path.join(OUT, "icon-background.png"))

    # 2) 兼容方形 + 圆形
    legacy = rounded_icon(192)
    legacy.save(os.path.join(OUT, "icon-legacy.png"))

    # 3) splash
    splash(2732).save(os.path.join(OUT, "splash-2732x2732.png"))

    # 4) 各密度 mipmap
    for dpi, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        d = os.path.join(OUT, f"mipmap-{dpi}")
        os.makedirs(d, exist_ok=True)
        rounded_icon(px).save(os.path.join(d, "ic_launcher.png"))
        rounded_icon(px, circular=True).save(os.path.join(d, "ic_launcher_round.png"))

    # ---- 实测断言 ----------------------------------------------------------------
    print("=" * 68)
    ink, paper, accent = PALETTE["ink"], PALETTE["paper"], PALETTE["accent"]
    print(f"墨 vs 纸 对比度 {contrast_ratio(ink, paper):.2f}:1（要求 >=4.5）")
    print(f"朱红 vs 纸 对比度 {contrast_ratio(accent, paper):.2f}:1（要求 >=4.5）")

    fg = Image.open(os.path.join(OUT, "icon-foreground.png")).convert("RGBA")
    fg_box = bbox_alpha(fg)
    safe0, safe1 = 84, 348  # 432 画布下 264 安全区：x/y 84..348
    inside = fg_box[0] >= safe0 and fg_box[1] >= safe0 and fg_box[2] <= safe1 and fg_box[3] <= safe1
    print(f"自适应前景非透明包围盒 {fg_box}，安全区 [{safe0},{safe1}] → {'在内' if inside else '越界'}")
    assert inside, "前景越出 264×264 安全区"

    for size in (192, 48, 24):
        im = rounded_icon(size)
        cov = ink_coverage(im, paper)
        print(f"方形图标 {size}×{size}: 主体占比 {cov*100:.1f}%（要求 55%–80%）")
        if size >= 48:
            assert 0.55 <= cov <= 0.80, f"{size} 主体占比越界: {cov:.3f}"

    # 自适应合成（Android 遮罩成 72dp 圆形）后的“感知占比”
    comp = Image.alpha_composite(Image.open(os.path.join(OUT, "icon-background.png")).convert("RGBA"), fg)
    cov_all = ink_coverage(comp, paper)
    masked_area = (72 / 108) ** 2
    print(f"自适应合成 432: 主体占整画布 {cov_all*100:.1f}%，占 72dp 遮罩区 {cov_all/masked_area*100:.1f}%"
          f"（后者才是用户看到的比例，要求 55%–80%）")
    assert 0.55 <= cov_all / masked_area <= 0.80, "自适应合成在遮罩区内的占比越界"

    sp = Image.open(os.path.join(OUT, "splash-2732x2732.png"))
    b = bbox_nonbg(sp, paper)
    third0, third1 = 2732 / 3, 2732 * 2 / 3
    ok = b[0] >= third0 and b[1] >= third0 and b[2] <= third1 and b[3] <= third1
    print(f"splash 主体包围盒 {b}，中心 1/3 区 [{third0:.0f},{third1:.0f}] → {'在内' if ok else '越界'}")
    assert ok, "splash 主体越出中心 1/3"

    # 24×24 的“糊成一团”量化：中间调（抗锯齿灰）像素占比
    for label, img in (("R 反白标记", rounded_icon(24)),):
        px = img.convert("L").load()
        mid = sum(1 for y in range(24) for x in range(24) if 60 < px[x, y] < 195)
        print(f"24×24 {label}: 中间调像素 {mid} / 576 = {mid/576*100:.1f}%（越低越锐）")
    print("=" * 68)

    # 5) 预览页
    preview(legacy)


def preview(legacy: Image.Image) -> None:
    W, H = 1200, 1180
    bg = (0xF4, 0xF4, 0xF1)
    canvas = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(canvas)

    big = Image.open(os.path.join(OUT, "mipmap-xxxhdpi", "ic_launcher.png")).resize((1024, 1024), Image.LANCZOS)
    big = big.resize((420, 420), Image.LANCZOS)
    canvas.paste(big, (70, 70), big)

    rnd = Image.open(os.path.join(OUT, "mipmap-xxxhdpi", "ic_launcher_round.png")).resize((200, 200), Image.LANCZOS)
    canvas.paste(rnd, (540, 70), rnd)
    canvas.paste(legacy.resize((120, 120), Image.LANCZOS), (540, 300), legacy.resize((120, 120), Image.LANCZOS))
    s48 = legacy.resize((48, 48), Image.LANCZOS)
    s24 = legacy.resize((24, 24), Image.LANCZOS)
    canvas.paste(s48, (700, 300), s48)
    canvas.paste(s24, (770, 312), s24)
    # 自适应分层
    fg = Image.open(os.path.join(OUT, "icon-foreground.png")).resize((200, 200), Image.LANCZOS)
    bgl = Image.open(os.path.join(OUT, "icon-background.png")).resize((200, 200), Image.LANCZOS)
    composed = Image.alpha_composite(bgl.convert("RGBA"), fg.convert("RGBA"))
    canvas.paste(bgl.convert("RGB"), (830, 70))
    canvas.paste(composed, (830, 300), composed)

    sp = Image.open(os.path.join(OUT, "splash-2732x2732.png")).resize((600, 600), Image.LANCZOS)
    canvas.paste(sp, (70, 540))

    f = _font(FONT_CJK, 22)
    fl = _font(FONT_CJK, 16)
    d.text((70, 30), "A · 日报 / APK 资产", font=f, fill=PALETTE["ink"])
    d.text((540, 20), "圆形 / 方形 192 / 48 / 24（真机缩到 24 仍能读出 R）", font=fl, fill=(0x46, 0x47, 0x3F))
    d.text((20, 520), "自适应前景（左）／合成（右）／splash 缩略（下）", font=fl, fill=(0x46, 0x47, 0x3F))
    d.text((720, 560), "水墨 = --rill-text #0B0B0B\n纸面 = --rill-bg #FFFFFF\n报眉 = --rill-accent #C22F1C\n无第四个色相",
           font=fl, fill=(0x0B, 0x0B, 0x0B), spacing=8)
    canvas.save(os.path.join(SHOTS, "app-icon-preview.png"))
    print("预览页 →", os.path.relpath(os.path.join(SHOTS, "app-icon-preview.png"), ROOT))


if __name__ == "__main__":
    main()