(() => {
  /* 桌面/移动布局的"看不见的错"：元素互相压住、越出屏幕、被裁切 */
  const out = [];
  document.querySelectorAll('.screen').forEach(scr => {
    const frame = scr.closest('.frame');
    const r = scr.getBoundingClientRect();
    if (!r.width) return;
    const isAnc = (a, b) => a.contains(b) || b.contains(a);
    const els = [...scr.querySelectorAll('*')].filter(el => {
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      if (b.width < 40 || b.height < 18) return false;
      if (cs.position === 'absolute' || cs.position === 'fixed') return false;
      // 祖先里有绝对/固定定位的（tabbar、FAB 这类浮层）不算重叠：它们本来就该压在 feed 上
      let anc = el.parentElement, floating = false;
      while (anc && anc !== scr) { const acs = getComputedStyle(anc); if (acs.position === 'absolute' || acs.position === 'fixed') { floating = true; break; } anc = anc.parentElement; }
      if (floating) return false;
      if (el.closest('.ph') || el.classList.contains('ph')) return false;
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      return true;
    });
    const pairs = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (isAnc(a, b)) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 4 && oy > 4) pairs.push({ a: a.className || a.tagName, b: b.className || b.tagName, ox: Math.round(ox), oy: Math.round(oy) });
    }
    const beyond = [...scr.querySelectorAll('*')].filter(el => {
      const b = el.getBoundingClientRect();
      return b.height && b.bottom > r.bottom + 2 && !el.closest('[class*="wall"],[class*="feed"],[class*="sheet"]');
    }).map(el => (el.className || el.tagName) + ' +' + Math.round(el.getBoundingClientRect().bottom - r.bottom));
    out.push({ name: (frame && frame.dataset.screen) || '?', w: Math.round(r.width), h: Math.round(r.height), overlaps: pairs.slice(0, 8), beyond: [...new Set(beyond)].slice(0, 6) });
  });
  return out;
})()
