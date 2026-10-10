// Neemt de gameplay-video's voor de presentatie op.
//
//   node tools/record-games.mjs                 # alles
//   node tools/record-games.mjs websoccer webtype
//
// Elke game staat in ~/Development/<naam> en wordt met zijn eigen server gestart.
// De video's komen in assets/video/.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, serve, FPS } from './recorder.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(HERE, '..', 'assets', 'video');
const DEV = path.join(process.env.HOME, 'Development');
const sec = (s) => Math.round(s * FPS);

/**
 * Spoelt vooruit tot `cond` (JS-expressie over `s`, de state) waar wordt en geeft
 * terug hoeveel frames vóór dat moment de opname moet beginnen. De wedstrijd wordt
 * daarvoor teruggezet naar een snapshot: de simulatie is deterministisch, dus wat
 * we zagen gebeurt opnieuw, nu met de camera aan.
 */
async function rewindTo(rec, cond, { chunk = sec(5), tries = 30, lead = sec(3.5) } = {}) {
  return rec.run(`(() => {
    const g = window.__game;
    let prev = null;
    const seen = (() => { const s = g.state; return ${cond.init}; })();
    for (let t = 0; t < ${tries}; t++) {
      const snap = structuredClone(g.state);
      const k = window.__clock.forward(${chunk}, () => { const s = g.state; return ${cond.test}; });
      if (k < ${chunk}) {
        // Terug naar de laatste snapshot die genoeg aanloop heeft.
        const useprev = k < ${lead} && prev;
        g.state = structuredClone(useprev ? prev : snap);
        const skip = Math.max(0, (useprev ? ${chunk} : 0) + k - ${lead});
        window.__clock.forward(skip);
        return { found: true, at: t, k, skip };
      }
      prev = snap;
    }
    return { found: false };
  })()`);
}

const SCENES = {
  /** Twee doelpunten, CPU tegen CPU. */
  async websoccer() {
    const srv = await serve(path.join(DEV, 'websoccer'), 'node', ['server/relay.js'], 5191, { SCORES_FILE: '/tmp/rec-soccer.json' });
    const rec = await open({ port: 9451 });
    try {
      await rec.go('http://localhost:5191/');
      await rec.run(`document.querySelector('[data-music=off]').click();
        document.querySelector('[data-commentary=off]').click();
        document.getElementById('start').click(); 1`);
      await rec.forward(20);
      await rec.run('window.__game.state.teams.forEach(t => t.human = false); 1');
      await rec.forward(sec(4));
      for (let goal = 0; goal < 2; goal++) {
        const r = await rewindTo(rec, { init: 's.score[0] + s.score[1]', test: 's.score[0] + s.score[1] > seen' });
        console.log('  doelpunt', r);
        await rec.record(sec(6));
      }
      rec.encode(path.join(VIDEO, 'websoccer.mp4'));
    } finally { await rec.close(); srv.kill(); }
  },

  /** Vier CPU-auto's, twee tafels: de start op de pooltafel, een gevecht op het ontbijt. */
  async webracing() {
    const srv = await serve(path.join(DEV, 'webracing'), 'node', ['server/relay.js'], 5192, { SCORES_FILE: '/tmp/rec-racing.json' });
    const rec = await open({ port: 9452 });
    const race = async (track) => {
      await rec.go('http://localhost:5192/');
      await rec.run(`const t = document.getElementById('track'); t.value = '${track}'; t.dispatchEvent(new Event('change'));
        document.querySelector('[data-sound=off]').click(); document.querySelector('[data-talk=off]').click();
        document.querySelector('[data-difficulty=hard]').click(); document.getElementById('start').click(); 1`);
      await rec.forward(5);
      await rec.run('window.__game.state.cars.forEach(c => c.human = false); 1');
    };
    try {
      await race('pool');
      // Net na de start: het hele veld op een kluitje en de camera ingezoomd.
      await rec.run(`window.__clock.forward(600, () => window.__game.state.phase !== 'countdown'); 1`);
      await rec.forward(sec(2));
      await rec.record(sec(6.5));
      await race('breakfast');
      await rec.run(`window.__clock.forward(600, () => window.__game.state.phase !== 'countdown'); 1`);
      await rec.forward(sec(9));
      await rec.record(sec(6.5));
      rec.encode(path.join(VIDEO, 'webracing.mp4'));
    } finally { await rec.close(); srv.kill(); }
  },

  /** Niet het rustige begin: stage 2, de draaiende Foundry en een baas, met volle bewapening. */
  async webtype() {
    const srv = await serve(path.join(DEV, 'webtype'), 'node', ['server/relay.js'], 5193, { SCORES_FILE: '/tmp/rec-type.json' });
    const rec = await open({ port: 9453, width: 1280, height: 720 });
    try {
      await rec.go('http://localhost:5193/');
      await rec.run("document.getElementById('start').click(); 1");
      await rec.forward(10);
      // De autopilot van het titelscherm neemt de stick over, en het schip kan niet dood.
      await rec.run(`(async () => {
        const g = window.__game;
        const { demoMask } = await import('/src/demo.js');
        const { nextStage } = await import('/src/game/state.js');
        const orig = g.transport.poll.bind(g.transport);
        g.transport.poll = (t) => {
          const i = orig(t);
          i[g.seat] = demoMask(g.state, g.seat);
          const sh = g.state.ships[g.seat];
          if (sh) sh.hull = Math.max(sh.hull, 3);
          return i;
        };
        window.__equip = (give) => {
          const sh = g.state.ships[g.seat];
          for (const w of give) g.state.drops.push({ id: g.state.nextId++, x: sh.x, y: sh.y, give: w, vy: 0, life: 60 });
        };
        window.__next = () => nextStage(g.state);
        return 1;
      })()`);
      await rec.forward(sec(4));
      await rec.run("__equip(['blue', 'blue', 'speed', 'missile']); __next(); 1");
      await rec.forward(sec(9));
      await rec.record(sec(4.5));
      await rec.run("__equip(['red', 'red', 'missile']); __next(); 1");
      await rec.forward(sec(24));
      await rec.record(sec(4));
      await rec.run("__next(); 1");
      await rec.run(`window.__clock.forward(${sec(120)}, () => window.__game.state.phase === 'boss'); 1`);
      await rec.forward(sec(1.5));
      await rec.record(sec(5.5));
      rec.encode(path.join(VIDEO, 'webtype.mp4'));
    } finally { await rec.close(); srv.kill(); }
  },

  /** De attract mode zonder menu ervoor: drie circuits, midden in het veld. */
  async webtrack() {
    const srv = await serve(path.join(DEV, 'webtrack'), 'node', ['server/board.js'], 5194, { BOARD_FILE: '/tmp/rec-track.json' });
    const rec = await open({ port: 9454 });
    const circuit = (route, dusk) => rec.run(`document.querySelector('[data-dusk=${dusk ? 'on' : 'off'}]').click();
      document.querySelector('[data-route=${route}]').click(); 1`);
    try {
      await rec.go('http://localhost:5194/');
      await rec.run(`const st = document.createElement('style');
        st.textContent = '#menu, .overlay { display: none !important; }'; document.head.append(st); 1`);
      await circuit('zandvoort', false);
      await rec.forward(sec(1.5));
      await rec.record(sec(4.5));
      await circuit('monaco', false);
      await rec.forward(sec(1.5));
      await rec.record(sec(4.5));
      await circuit('suzuka', true);
      await rec.forward(sec(1.5));
      await rec.record(sec(4.5));
      rec.encode(path.join(VIDEO, 'webtrack.mp4'));
    } finally { await rec.close(); srv.kill(); }
  },

  /**
   * Article 5: een echte verdediging neergezet, golven laten komen, en de camera
   * naar de plek met het meeste vuur. Draait op de echte GPU (zichtbaar venster):
   * bloom en post-processing zijn in software te traag.
   */
  async webTA() {
    const srv = await serve(path.join(DEV, 'webTA'), 'node', ['server/board.js'], 8091, { BOARD_FILE: '/tmp/rec-ta.json' });
    const rec = await open({ port: 9455, gpu: true });
    try {
      await rec.go('http://localhost:8091/?quality=high&noreplay', 3000);
      await rec.run(`(() => {
        const w = window.webta; w.startGame(); const s = w.sim; s.funds = 1e7;
        window.__defend = (lon, lat, kinds) => {
          for (const kind of kinds) {
            for (let i = 0; i < 16; i++) {
              const [x, y] = w.lonlat(lon + (i % 4) * 0.3 - 0.45, lat + Math.floor(i / 4) * 0.22 - 0.33);
              if (s.command({ type: 'build', kind, x, y })) break;
            }
          }
        };
        /** Waar de NAVO-eenheid staat met de meeste vijanden om zich heen. */
        window.__hotspot = () => {
          const us = s.units.filter((u) => u.side === 'nato' && u.hp > 0);
          const them = s.units.filter((u) => u.side !== 'nato' && u.hp > 0);
          let best = null, score = -1;
          for (const u of us) {
            const n = them.filter((e) => Math.hypot(e.x - u.x, e.y - u.y) < 120).length;
            if (n > score) { score = n; best = u; }
          }
          return best ? { x: best.x, y: best.y, n: score } : null;
        };
        window.__look = (dist) => { const h = __hotspot(); if (h) w.rig.flyTo(h.x, h.y, dist); return h; };
        const hint = document.createElement('style');
        hint.textContent = '.hint, #hint, .toast { display: none !important; }';
        document.head.append(hint);
        return 1;
      })()`);
      await rec.run(`__defend(27.2, 58.6, ['tank', 'tank', 'infantry', 'infantry', 'drone', 'drone', 'fighter']);
        __defend(25.4, 56.8, ['tank', 'infantry', 'drone', 'fighter']);
        __defend(23.2, 54.0, ['tank', 'tank', 'infantry', 'drone', 'fighter']);
        __defend(20.5, 55.6, ['frigate', 'frigate']); 1`);
      // Door naar golf 5, met elke pauze een nieuwe golf en wat versterking.
      for (let i = 0; i < 30; i++) {
        const st = await rec.run(`(() => { const s = webta.sim;
          if (s.state === 'between' || s.state === 'prep') { s.command({ type: 'nextWave' });
            __defend(24 + (s.wave % 4), 55 + (s.wave % 3), ['tank', 'drone', 'infantry']); }
          return [s.state, s.wave]; })()`);
        console.log('  ', st);
        if (st[1] >= 5 && st[0] === 'wave') break;
        await rec.forward(sec(5));
      }
      await rec.forward(sec(8));
      // Het testbudget hoort niet in beeld
      await rec.run('webta.sim.funds = 1872; 1');
      // 1: dichtbij, waar het vuur is
      await rec.run('__look(520); 1');
      await rec.forward(sec(1.5));
      await rec.record(sec(5), "if (Math.random() < 0.02) __look(520)");
      // 2: langzaam uitzoomen naar het hele front
      await rec.run('const h = __hotspot(); webta.rig.flyTo(h.x, h.y, 1700); 1');
      await rec.record(sec(4.5));
      // 3: verder in de oorlog, weer dichtbij
      await rec.run("webta.sim.state === 'between' && webta.sim.command({ type: 'nextWave' }); 1");
      await rec.forward(sec(10));
      await rec.run('webta.sim.funds = 2340; __look(650); 1');
      await rec.forward(sec(1.5));
      await rec.record(sec(4.5));
      rec.encode(path.join(VIDEO, 'webta.mp4'));
    } finally { await rec.close(); srv.kill(); }
  },

  /**
   * Prompt Machina: de stad van bovenaf, een stukje lopen, een gevecht en een
   * echt gesprek met Del (Gemini via de lokale Worker). Verwacht `pnpm dev` in
   * ~/Development/PHK-RPG (Vite op PHK_URL, standaard http://localhost:5174).
   */
  async phk() {
    const BASE = process.env.PHK_URL || 'http://localhost:5174/';
    const rec = await open({ port: 9456, gpu: true });
    const enter = async (query) => {
      await rec.go(BASE + query, 800);
      await rec.wait("(document.querySelector('.start-knop')?.click(), !document.querySelector('.laadscherm'))");
      await rec.forward(20);
      // Intro-uitleg wegklikken en meldingen ('Ontdekt: ...') uit beeld houden
      await rec.run(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Overslaan'))?.click();
        new MutationObserver(() => document.querySelectorAll('body *').forEach(e => {
          if (e.children.length < 4 && /^📍\\s*Ontdekt/.test(e.textContent.trim())) e.style.display = 'none';
        })).observe(document.body, { childList: true, subtree: true }); 1`);
      await rec.forward(10);
    };
    // Helder weer op dag 2 (de tijd van de spelstand wordt alleen in deze pagina overschreven)
    const middag = (uur) => rec.run(`import('/src/klok.ts').then(k => { k.koppelKlok(() => 1440 + ${uur} * 60, false); return 1; })`);
    try {
      await rec.go(BASE);
      await rec.run("localStorage.setItem('instellingen', JSON.stringify({ taal: 'nl', geluidAan: false, kwaliteit: 'hoog' })); localStorage.setItem('gevecht-tempo', '1'); 1");

      // 1 — Whitestone van bovenaf: één rustige, gelijkmatige draai (geen zoomstappen).
      console.log('  stad');
      await enter('?plek=whitestone&nep-timers');
      await middag(14);
      await rec.forward(30);
      await rec.mouse('mouseMoved', 900, 520);
      await rec.mouse('mousePressed', 900, 520);
      for (let i = 0; i < 8; i++) { await rec.mouse('mouseMoved', 900 - i * 2, 520, { buttons: 1 }); await rec.forward(1); }
      await rec.record(sec(5), '', {
        between: async (i) => rec.mouse('mouseMoved', 884 - i * 2, 520, { buttons: 1 }),
      });
      await rec.mouse('mouseReleased', 884 - sec(5) * 2, 520);

      // 2 — Te voet door de winkelstraat (de straat met de meeste winkels, aan de
      // zuidkant van het plein), met de camera laag achter de groep. Op het plein
      // kantelt de camera langzaam omhoog naar de Sun Tree.
      console.log('  lopen');
      await enter('?plek=whitestone&lopen&nep-timers&start=1.7,19&kijk=0,3,12');
      await middag(12);
      await rec.forward(30);
      const key = (type, k = 'w') => rec.run(`window.dispatchEvent(new KeyboardEvent('${type}', { key: '${k}', code: 'Key${k.toUpperCase()}', bubbles: true })); 1`);
      await key('keydown');
      await rec.forward(sec(0.3));
      await rec.record(sec(5));
      const KANTEL = sec(2.2);
      await rec.mouse('mouseMoved', 640, 600);
      await rec.mouse('mousePressed', 640, 600);
      await rec.record(KANTEL, '', { between: (i) => rec.mouse('mouseMoved', 640, 600 - i * 1.4, { buttons: 1 }) });
      await rec.mouse('mouseReleased', 640, 600 - KANTEL * 1.4);
      await key('keyup');
      await rec.record(sec(0.8));

      // 3 — Een gevecht: drie spreuken van dichtbij. Ook de timers van het spel lopen
      // op de nepklok (?nep-timers), dus elke beurt loopt vloeiend en voorspelbaar.
      console.log('  gevecht');
      await enter('?plek=gevecht&nep-timers');
      await rec.forward(20);
      const kies = () => rec.run(`(() => {
        if (!/is aan de beurt/.test(document.body.innerText)) return null;
        const btns = [...document.querySelectorAll('button')].filter(b => b.offsetParent);
        const spell = btns.find(b => /Fire Bolt|Magic Missile|Sacred Flame|Eldritch|Ray of/i.test(b.textContent));
        const atk = spell || btns.find(b => /bow|Javelin|Handaxe/i.test(b.textContent));
        const foes = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && !e.className
          && /^(Skelet|Zombie)( \\d)?$/.test(e.textContent.trim()))
          .map(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height + 50]; })
          .sort((a, b) => b[1] - a[1]);
        if (!atk || !foes.length) { btns.find(b => b.textContent.includes('Beurt klaar'))?.click(); return 'klaar'; }
        atk.click();
        return { at: foes[0], spreuk: !!spell };
      })()`);
      const klaar = () => rec.run("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Beurt klaar'))?.click(); 1");
      let spreuken = 0;
      for (let stap = 0; stap < 40 && spreuken < 3; stap++) {
        const k = await kies();
        if (k && k.at) {
          if (k.spreuk) {
            await rec.record(8);
            await rec.click(k.at[0], k.at[1]);
            await rec.record(sec(1.8));
            spreuken++;
          } else {
            await rec.forward(6);
            await rec.click(k.at[0], k.at[1]);
            await rec.forward(sec(1.5));
          }
          await klaar();
        }
        await rec.forward(sec(1));
      }

      // 4 — Een gesprek met Del, live door Gemini geschreven.
      console.log('  gesprek');
      await enter('?plek=herberg');
      await rec.run("document.querySelector('.npc-label').click(); 1");
      await rec.wait("/Del/.test(document.querySelector('[class*=gesprek]')?.innerText ?? '') && !!document.querySelector('[class*=gesprek] *')", 20000);
      await rec.wait("(document.querySelector('[class*=gesprek]')?.innerText.length ?? 0) > 160", 30000);
      const vraag = 'Goedenavond Del! Wat is het laatste nieuws in Whitestone?';
      await rec.record(vraag.length + sec(0.6), '', {
        realtime: true,
        between: async (i) => {
          if (i < vraag.length) {
            await rec.run(`(() => { const inp = [...document.querySelectorAll('input')].find(e => /Del/.test(e.placeholder));
              inp.value = ${JSON.stringify(vraag)}.slice(0, ${i + 1}); return 1; })()`);
          }
        },
      });
      await rec.run("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Zeg').click(); 1");
      await rec.record(sec(5.5), '', { realtime: true });
      rec.encode(path.join(VIDEO, 'prompt-machina.mp4'));
    } finally { await rec.close(); }
  },
};

const want = process.argv.slice(2);
for (const name of (want.length ? want : Object.keys(SCENES))) {
  console.log(`● ${name}`);
  const t0 = Date.now();
  await SCENES[name]();
  console.log(`  klaar in ${Math.round((Date.now() - t0) / 1000)} s`);
}
