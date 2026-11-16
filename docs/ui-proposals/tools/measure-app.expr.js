(() => {
  /* 方向初稿（A/B/C）通用度量：几何 / 字号 / 对比度（半透明层逐层合成）/ 裁切 / 溢出
     约定：页面里给四件套打 data-part="author|body|media|counts"，度量按它取。 */
  const parse = c => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const effBg = el => {
    const chain = []; let n = el;
    while (n && n !== document.documentElement) { chain.push(parse(getComputedStyle(n).backgroundColor)); n = n.parentElement; }
    chain.push(parse(getComputedStyle(document.documentElement).backgroundColor));
    chain.push({ r: 255, g: 255, b: 255, a: 1 });
    let base = chain[chain.length - 1];
    for (let i = chain.length - 2; i >= 0; i--) { const c = chain[i]; if (c) base = blend(c, base); }
    return base;
  };
  const pair = el => {
    const fgRaw = parse(getComputedStyle(el).color); const bg = effBg(el);
    const fg = fgRaw.a < 1 ? blend(fgRaw, bg) : fgRaw;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    return {
      sel: (el.dataset.part || (el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase())),
      text: el.textContent.trim().slice(0, 14),
      color: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      size: fs, ratio: ratio(fg, bg), need: fs >= 18.66 ? 3 : 4.5
    };
  };

  const screens = [...document.querySelectorAll('.screen')].map(scr => {
    const frame = scr.closest('.frame');
    const name = (frame && frame.dataset.screen) || scr.dataset.screen || '(unnamed)';
    const r = scr.getBoundingClientRect();
    const parts = {};
    scr.querySelectorAll('[data-part]').forEach(el => {
      const k = el.dataset.part; if (parts[k]) return;
      const b = el.getBoundingClientRect();
      parts[k] = { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top - r.top), bottom: Math.round(b.bottom - r.top) };
    });
    const leaves = [...scr.querySelectorAll('p, span, b, i, em, a, dd, dt, h1, h2, h3, h4, button')]
      .filter(e => e.children.length === 0 && e.textContent.trim().length >= 3);
    const sizes = [...new Set(leaves.map(e => parseFloat(getComputedStyle(e).fontSize)))].sort((a, b) => a - b);
    const minText = leaves.map(pair).filter(Boolean).sort((a, b) => a.ratio - b.ratio).slice(0, 5);

    let overX = 0, overEl = '';
    scr.querySelectorAll('*').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > r.right + 1.5) { const d = b.right - r.right; if (d > overX) { overX = d; overEl = el.className || el.tagName; } }
    });

    // 裁切：overflow 容器里装不下的内容（feed 的硬裁切、图格被切断都记在这里）
    const clip = [];
    scr.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 2) {
        clip.push({ sel: el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase(), hidden: Math.round(el.scrollHeight - el.clientHeight) });
      }
    });

    return {
      name, box: { w: Math.round(r.width), h: Math.round(r.height) },
      screenBox: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      bg: getComputedStyle(scr).backgroundColor,
      scrollH: Math.round(scr.scrollHeight), clientH: Math.round(scr.clientHeight),
      overflowX: Math.round(overX), overEl, clip,
      parts, sizes, minText,
      cards: scr.querySelectorAll('[data-card]').length,
      figs: scr.querySelectorAll('.ph').length,
      clamped: [...scr.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return s.webkitLineClamp && s.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 2; }).length
    };
  });

  const ext = [];
  document.querySelectorAll('img, link[href], script[src], use[href], iframe, video, audio').forEach(el => {
    const u = el.getAttribute('src') || el.getAttribute('href'); if (u) ext.push(u);
  });
  performance.getEntriesByType('resource').map(e => e.name).forEach(n => ext.push(n));

  return {
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    page: { scrollH: Math.round(document.documentElement.scrollHeight), scrollW: Math.round(document.documentElement.scrollWidth), clientW: Math.round(document.documentElement.clientWidth) },
    fontFamily: getComputedStyle(document.body).fontFamily,
    onlyMode: document.documentElement.classList.contains('only'),
    externals: [...new Set(ext)],
    screens
  };
})()