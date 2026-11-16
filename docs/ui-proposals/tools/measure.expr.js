(() => {
  const parse = c => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const effBg = el => { /* 把祖先链上的半透明层逐层合成（含元素自身底色）：scrim/label 也能算对 */
    const chain = [];
    let n = el;
    while (n && n !== document.documentElement) { chain.push(parse(getComputedStyle(n).backgroundColor)); n = n.parentElement; }
    chain.push(parse(getComputedStyle(document.documentElement).backgroundColor));
    chain.push({ r: 255, g: 255, b: 255, a: 1 });
    let base = chain[chain.length - 1];
    for (let i = chain.length - 2; i >= 0; i--) { const c = chain[i]; if (c) base = blend(c, base); else continue; }
    return base;
  };
  const pair = (el) => {
    if (!el) return null;
    const fgRaw = parse(getComputedStyle(el).color);
    const bg = effBg(el);
    const fg = fgRaw.a < 1 ? blend(fgRaw, bg) : fgRaw;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    return {
      sel: el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase(),
      color: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      size: fs, ratio: ratio(fg, bg), need: fs >= 18.66 ? 3 : 4.5
    };
  };
  const outs = [];
  document.querySelectorAll('.screen').forEach(scr => {
    const name = scr.dataset.screen;
    const r = scr.getBoundingClientRect();
    const parts = {};
    const q = sel => scr.querySelector(sel);
    [['author', '.p__head, .s-c3__author, .s-c6__head, .card .p__head'],
     ['body', '.p__body, .row p, .detail__body'],
     ['figs', '.p__figs, .figs, .cover, .quote__figs, .thumbs, .s-c3__photo'],
     ['counts', '.p__counts, .acts, .s-c3__counts, .meta']
    ].forEach(([k, sel]) => {
      const el = q(sel);
      if (el) { const b = el.getBoundingClientRect(); parts[k] = { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top - r.top) }; }
    });
    // 文字家族采样（正文/标签/标题）
    const textEls = [...scr.querySelectorAll('p, span, b, i, em, div')].filter(e => e.children.length === 0 && e.textContent.trim().length > 3).slice(0, 60);
    const sizes = [...new Set(textEls.map(e => parseFloat(getComputedStyle(e).fontSize)))].sort((a, b) => a - b);
    const minText = textEls.map(pair).filter(Boolean).sort((a, b) => a.ratio - b.ratio).slice(0, 4);
    // 横向溢出
    let overX = 0, overEl = '';
    scr.querySelectorAll('*').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > r.right + 1.5) { const d = b.right - r.right; if (d > overX) { overX = d; overEl = (el.className || el.tagName); } }
    });
    // 内容底 vs 绝对定位浮层顶：判断内容是否被 tabbar / 输入条压住
    let contentBottom = 0;
    [...scr.children].forEach(ch => { const cs = getComputedStyle(ch); if (cs.position === 'absolute' || cs.position === 'fixed') return; const b = ch.getBoundingClientRect(); if (b.height) contentBottom = Math.max(contentBottom, b.bottom - r.top); });
    let overlayTop = Infinity;
    [...scr.children].forEach(ch => { const cs = getComputedStyle(ch); if (cs.position === 'absolute' || cs.position === 'fixed') { const b = ch.getBoundingClientRect(); if (b.height && b.top - r.top < overlayTop) overlayTop = Math.round(b.top - r.top); } });
    const fig = scr.closest('.cand').getBoundingClientRect();
    outs.push({
      name, box: { w: Math.round(r.width), h: Math.round(r.height) },
      candBox: { x: Math.round(fig.left + scrollX), y: Math.round(fig.top + scrollY), w: Math.round(fig.width), h: Math.round(fig.height) },
      screenBox: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      contentBottom: Math.round(contentBottom), overlayTop: overlayTop === Infinity ? null : overlayTop,
      scrollH: Math.round(scr.scrollHeight), overflowX: Math.round(overX), overEl,
      bg: getComputedStyle(scr).backgroundColor,
      cards: scr.querySelectorAll('.p, .card, .cc, .row, .rp, .s-c3__author').length,
      parts, sizes, minText,
      clamped: [...scr.querySelectorAll('*')].filter(e => {
        const s = getComputedStyle(e); return s.webkitLineClamp && s.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 2;
      }).length
    });
  });
  // 每格是否都有「时间线卡片结构」四件套：作者行 / 正文 / 图格 / 计数行
  const structure = [...document.querySelectorAll('.screen')].map(scr => {
    const has = sel => !!scr.querySelector(sel);
    return {
      name: scr.dataset.screen,
      author: has('.p__head, .s-c3__author, .s-c6__head, .card .p__head, .s-c5 .meta'),
      body: has('.p__body, .row p, .t, .quote__body'),
      media: scr.querySelectorAll('.ph').length,
      counts: has('.p__counts, .acts, .s-c3__counts, .meta, .quote__counts')
    };
  });
  const captions = [...document.querySelectorAll('.cand')].map(c => ({
    no: (c.querySelector('.cand__no') || {}).textContent || '',
    style: (c.querySelector('.cand__style') || {}).textContent || '',
    temp: (c.querySelector('.cand__temp') || {}).textContent || '',
    screen: (c.querySelector('.cand__screen') || {}).textContent || ''
  }));
  const ext = [];
  document.querySelectorAll('img, link[href], script[src], use[href], iframe').forEach(el => {
    const u = el.getAttribute('src') || el.getAttribute('href');
    if (u) ext.push(u);
  });
  performance.getEntriesByType('resource').map(e => e.name).forEach(n => ext.push(n));
  return {
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    cols: getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length,
    page: { scrollH: Math.round(document.documentElement.scrollHeight), scrollW: Math.round(document.documentElement.scrollWidth), clientW: Math.round(document.documentElement.clientWidth) },
    fontFamily: getComputedStyle(document.body).fontFamily,
    externals: [...new Set(ext)],
    structure, captions,
    screens: outs
  };
})()
