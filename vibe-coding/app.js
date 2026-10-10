/* Vibe Coding — presentatie-logica. Geen dependencies. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     Hero: drijvende code-glyphs en pixels
     --------------------------------------------------------------- */
  const canvas = $('#heroCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const glyphs = '{}<>/=;()[]01λ→#$*+'.split('');
    const colors = ['#c8ff3d', '#ff3d8b', '#3de0ff', '#f3f1ea'];
    let w, h, dpr, parts = [];
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: Math.round(w * h / 9000) }, () => spawn(true));
    };
    const spawn = (anywhere) => ({
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 20,
      v: .15 + Math.random() * .6, s: 10 + Math.random() * 14,
      g: glyphs[(Math.random() * glyphs.length) | 0],
      c: colors[(Math.random() * colors.length) | 0], a: .08 + Math.random() * .35,
      px: Math.random() < .35
    });
    let mx = w / 2, my = h / 2;
    addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
    const tick = () => {
      if (scrollY < innerHeight * 1.2) {
        ctx.clearRect(0, 0, w, h);
        for (const p of parts) {
          p.y -= p.v;
          const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
          if (d < 140) { p.x += dx / d * 1.2; p.y += dy / d * 1.2; }
          if (p.y < -20) Object.assign(p, spawn(false));
          ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
          if (p.px) ctx.fillRect(Math.round(p.x / 4) * 4, Math.round(p.y / 4) * 4, 4, 4);
          else { ctx.font = `${p.s}px "JetBrains Mono", monospace`; ctx.fillText(p.g, p.x, p.y); }
        }
      }
      requestAnimationFrame(tick);
    };
    resize(); addEventListener('resize', resize);
    if (!reduced) tick();
  }

  /* ---------------------------------------------------------------
     Woord-voor-woord quotes voorbereiden
     --------------------------------------------------------------- */
  $$('[data-words]').forEach(el => {
    const wrap = (text, key) => text.split(/(\s+)/).map(t =>
      /^\s+$/.test(t) || !t ? document.createTextNode(t) :
        Object.assign(document.createElement('span'), { className: 'w' + (key ? ' key' : ''), textContent: t }));
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 3) n.replaceWith(...wrap(n.textContent, false));
      else if (n.classList?.contains('key')) n.replaceWith(...wrap(n.textContent, true));
    });
  });

  /* ---------------------------------------------------------------
     Reveal: slides krijgen .in zodra ze in beeld komen
     --------------------------------------------------------------- */
  const fmt = new Intl.NumberFormat('nl-NL');
  const countUp = el => {
    const end = +el.dataset.count, dur = 1400, t0 = performance.now();
    if (reduced || end === 0) { el.textContent = fmt.format(end); return; }
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt.format(Math.round(end * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const typeIn = box => {
    if (box.dataset.done) return; box.dataset.done = 1;
    const t = $('.typed', box), text = t.dataset.text; let i = 0;
    t.textContent = '';
    const go = () => {
      t.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(go, reduced ? 0 : 18 + Math.random() * 30);
      else { t.classList.add('done'); setTimeout(() => $('.bot', box).classList.add('show'), 500); }
    };
    setTimeout(go, 600);
  };
  const onEnter = sec => {
    if (sec.classList.contains('in')) return;
    sec.classList.add('in');
    $$('[data-count]', sec).forEach(countUp);
    $$('[data-typer]', sec).forEach(typeIn);
    $$('[data-words]', sec).forEach(q => {
      $$('.w', q).forEach((w, i) => setTimeout(() => w.classList.add('on'), reduced ? 0 : 300 + i * 90));
    });
  };
  // Tellers starten op 0 zodat ze zichtbaar oplopen
  $$('[data-count]').forEach(el => { if (!reduced) el.textContent = '0'; });
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && onEnter(e.target)), { threshold: .18 });
  $$('.slide, .evo').forEach(s => io.observe(s));

  /* ---------------------------------------------------------------
     Scherm-componenten: video als die bestaat, anders slideshow
     --------------------------------------------------------------- */
  $$('.screen').forEach(scr => {
    const imgs = $$('.slides img', scr);
    let idx = 0, timer = null, video = null;
    if (imgs.length) imgs[0].classList.add('on');
    const next = () => { imgs[idx].classList.remove('on'); idx = (idx + 1) % imgs.length; imgs[idx].classList.add('on'); };
    if (scr.dataset.video) {
      video = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'auto' });
      for (const ev of ['loadeddata', 'canplay', 'playing']) video.addEventListener(ev, () => scr.classList.add('has-video'));
      video.addEventListener('error', () => { video.remove(); video = null; });
      video.src = scr.dataset.video;
      scr.prepend(video);
    }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        // Afspelen zodra in beeld; tot de video loopt draait de slideshow als terugval
        if (video) { video.currentTime = 0; video.play().catch(() => {}); }
        if (imgs.length > 1 && !timer) timer = setInterval(next, 3800);
      } else {
        video?.pause(); clearInterval(timer); timer = null;
      }
    }, { threshold: .3 }).observe(scr);
  });

  /* ---------------------------------------------------------------
     Live spelen in een iframe
     --------------------------------------------------------------- */
  const modal = $('#liveModal'), frame = $('#liveFrame');
  const openLive = (url, title) => {
    frame.src = url; $('#liveTitle').textContent = `${title} · live · ${url}`;
    modal.classList.add('open'); setTimeout(() => frame.focus(), 300);
  };
  const closeLive = () => { modal.classList.remove('open'); frame.src = 'about:blank'; };
  $('#liveClose').addEventListener('click', closeLive);
  $$('.live').forEach(b => b.addEventListener('click', () => {
    const src = b.dataset.liveUrl ? b : b.closest('.screen');
    openLive(src.dataset.liveUrl || src.dataset.live, src.dataset.title);
  }));

  /* ---------------------------------------------------------------
     Voor/na-slider
     --------------------------------------------------------------- */
  $$('[data-ba]').forEach(ba => {
    const set = x => { const r = ba.getBoundingClientRect(); ba.style.setProperty('--x', Math.max(0, Math.min(100, (x - r.left) / r.width * 100)) + '%'); };
    let drag = false;
    ba.addEventListener('pointerdown', e => { drag = true; ba.setPointerCapture(e.pointerId); set(e.clientX); });
    ba.addEventListener('pointermove', e => drag && set(e.clientX));
    ba.addEventListener('pointerup', () => drag = false);
    // Kleine demo-zwaai zodra hij in beeld komt
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting || reduced) return; o.disconnect();
      const t0 = performance.now();
      const anim = now => {
        if (drag) return;
        const k = (now - t0) / 2600; if (k > 1) return;
        ba.style.setProperty('--x', (50 + Math.sin(k * Math.PI * 2) * 38) + '%');
        requestAnimationFrame(anim);
      };
      setTimeout(() => requestAnimationFrame(anim), 700);
    }, { threshold: .5 }).observe(ba);
  });

  /* ---------------------------------------------------------------
     Lightbox
     --------------------------------------------------------------- */
  const lb = $('#lightbox');
  document.addEventListener('click', e => {
    const z = e.target.closest('[data-zoom]');
    if (z) { $('img', lb).src = z.src; lb.classList.add('open'); }
    else if (e.target.closest('#lightbox')) lb.classList.remove('open');
  });

  /* ---------------------------------------------------------------
     GitHub-avatars (online), anders initialen
     --------------------------------------------------------------- */
  $$('[data-gh]').forEach(a => {
    const img = new Image();
    img.onload = () => a.append(img);
    img.alt = a.dataset.gh; img.title = a.dataset.gh;
    img.src = `https://github.com/${a.dataset.gh}.png?size=120`;
  });

  /* ---------------------------------------------------------------
     Scroll-gestuurd: app-evolutie en parallax
     --------------------------------------------------------------- */
  const evo = $('[data-evo]');
  const evoTxt = evo ? $$('.stage-txt', evo) : [], evoShots = evo ? $$('.shot', evo) : [], evoDots = evo ? $$('.dots i', evo) : [];
  let evoStage = -1;
  const onScroll = () => {
    if (evo) {
      const r = evo.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, -r.top / (r.height - innerHeight)));
      evo.style.setProperty('--p', p);
      const st = Math.min(evoTxt.length - 1, Math.floor(p * evoTxt.length * .999 + .001));
      if (st !== evoStage) {
        evoStage = st;
        [evoTxt, evoShots, evoDots].forEach(list => list.forEach((el, i) => el.classList.toggle('on', i === st)));
      }
    }
    $$('[data-parallax]').forEach(el => {
      const r = el.parentElement.getBoundingClientRect();
      el.style.setProperty('--p', ((r.top + r.height / 2) - innerHeight / 2) / innerHeight);
    });
    updateNav();
  };

  /* ---------------------------------------------------------------
     Navigatie: stops = slides + tussenstappen in de evolutie
     --------------------------------------------------------------- */
  const stops = $$('main > .slide, .evo .marker');
  const topOf = el => el.getBoundingClientRect().top + scrollY;
  const sorted = () => stops.map(el => ({ el, y: topOf(el) })).sort((a, b) => a.y - b.y);
  const currentIdx = (off = 4) => {
    const list = sorted(), y = scrollY + off;
    let i = 0; list.forEach((s, k) => { if (s.y <= y) i = k; });
    return { i, list };
  };
  // Tijdens een lopende animatie rekenen we vanaf het doel, niet vanaf de tussenpositie
  let navTarget = null, navUntil = 0;
  const go = dir => {
    const { i, list } = currentIdx();
    const from = performance.now() < navUntil && navTarget != null ? navTarget : i;
    navTarget = Math.max(0, Math.min(list.length - 1, from + dir));
    navUntil = performance.now() + 900;
    scrollTo({ top: list[navTarget].y, behavior: reduced ? 'auto' : 'smooth' });
  };
  const sectionOf = el => el.closest('.slide, .evo');

  const chaps = $$('#chapters .chap');
  chaps.forEach(c => c.addEventListener('click', () => $('#ch' + c.dataset.ch).scrollIntoView({ behavior: 'smooth' })));
  const notesPanel = $('#notesPanel');
  let lastSec = null;
  function updateNav() {
    const { i, list } = currentIdx(innerHeight * .4);
    const sec = sectionOf(list[i].el);
    const ch = +sec.dataset.ch || 0;
    chaps.forEach(c => {
      const n = +c.dataset.ch;
      c.classList.toggle('active', n === ch);
      const inCh = list.filter(s => +sectionOf(s.el).dataset.ch === n);
      const pos = inCh.findIndex(s => s === list[i]);
      $('.fill', c).style.width = n < ch ? '100%' : n > ch ? '0%' : ((pos + 1) / inCh.length * 100) + '%';
    });
    if (sec !== lastSec) {
      lastSec = sec;
      const note = $('.notes', sec);
      notesPanel.innerHTML = note ? note.innerHTML : '<span class="t">Geen notities</span>';
    }
  }

  /* ---------------------------------------------------------------
     Timer met budget per hoofdstuk (2 · 5 · 10 · 5 · 5 = 27 min + marge)
     --------------------------------------------------------------- */
  const timerEl = $('#timer');
  const budgetEnd = { 1: 2, 2: 7, 3: 17, 4: 22, 5: 27 };
  let t0 = null, acc = 0, run = false;
  const elapsed = () => acc + (run ? Date.now() - t0 : 0);
  const mmss = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const toggleTimer = () => { if (run) { acc += Date.now() - t0; run = false; } else { t0 = Date.now(); run = true; } paintTimer(); };
  const resetTimer = () => { acc = 0; t0 = Date.now(); run = false; paintTimer(); };
  function paintTimer() {
    const ms = elapsed(), min = ms / 60000;
    timerEl.textContent = `${mmss(ms)} / 30:00`;
    timerEl.classList.toggle('running', run);
    timerEl.classList.toggle('late', min > 30);
    const active = chaps.find(c => c.classList.contains('active'));
    chaps.forEach(c => c.classList.toggle('over', ms > 0 && c === active && min > budgetEnd[c.dataset.ch]));
  }
  timerEl.addEventListener('click', toggleTimer);
  setInterval(paintTimer, 500);

  /* ---------------------------------------------------------------
     Toetsenbord
     --------------------------------------------------------------- */
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (modal.classList.contains('open')) { if (k === 'Escape') closeLive(); return; }
    if (k === 'Escape') { lb.classList.remove('open'); $('#help').classList.remove('open'); notesPanel.classList.remove('open'); return; }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(k)) { e.preventDefault(); go(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k)) { e.preventDefault(); go(-1); }
    else if (k === 'Home' || k === '0') scrollTo({ top: 0, behavior: 'smooth' });
    else if (/^[1-5]$/.test(k)) $('#ch' + k).scrollIntoView({ behavior: 'smooth' });
    else if (k === 'n' || k === 'N') notesPanel.classList.toggle('open');
    else if (k === 't' || k === 'T') toggleTimer();
    else if (k === 'r' || k === 'R') resetTimer();
    else if (k === 'f' || k === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    else if (k === '?') $('#help').classList.toggle('open');
    else if (k === 'l' || k === 'L') {
      const { i, list } = currentIdx();
      const b = $('.live', sectionOf(list[i].el));
      b?.click();
    }
  });

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
})();
