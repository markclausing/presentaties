// Gameplay opnemen zonder dat iemand hoeft te spelen, en zonder haperingen.
//
// Een headless Chrome draait de game, maar de klok van de pagina is van ons:
// requestAnimationFrame, performance.now en Date.now worden vervangen door een
// nepklok die alleen vooruit gaat als wij dat zeggen. Per videoframe zetten we
// de tijd 1/30 seconde verder, laten de game één frame tekenen en maken een
// screenshot. Hoe traag de (software-)GPU ook is: de video loopt vloeiend.
//
// Geen dependencies: het DevTools-protocol is JSON over een WebSocket.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => existsSync(p));

export const FPS = 30;

/** Wordt vóór elk script op de pagina uitgevoerd. */
const FAKE_CLOCK = `(() => {
  let now = 0;
  const base = Date.now();
  const queue = new Map();
  let id = 0;
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { queue.set(++id, cb); return id; };
  window.cancelAnimationFrame = (i) => queue.delete(i);
  // Met ?nep-timers lopen ook setTimeout/setInterval op deze klok, zodat alles wat
  // het spel met timers doet (beurten, animaties) in de pas loopt met de frames.
  const timers = new Map();
  let tid = 0;
  if (new URLSearchParams(location.search).has('nep-timers')) {
    window.setTimeout = (fn, ms = 0, ...a) => { timers.set(++tid, { at: now + Math.max(0, ms), fn, a }); return tid; };
    window.setInterval = (fn, ms = 0, ...a) => { timers.set(++tid, { at: now + Math.max(1, ms), fn, a, every: Math.max(1, ms) }); return tid; };
    window.clearTimeout = window.clearInterval = (i) => timers.delete(i);
  }
  const runTimers = () => {
    for (let guard = 0; guard < 1000; guard++) {
      let next = null;
      for (const [i, t] of timers) if (t.at <= now && (!next || t.at < next[1].at)) next = [i, t];
      if (!next) return;
      const [i, t] = next;
      if (t.every) t.at += t.every; else timers.delete(i);
      try { typeof t.fn === 'function' ? t.fn(...t.a) : eval(t.fn); } catch (e) { console.error(e); }
    }
  };
  window.__clock = {
    tick(ms) {
      now += ms;
      runTimers();
      const cbs = [...queue.values()];
      queue.clear();
      for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } }
      return cbs.length;
    },
    /** Snel vooruit zonder op te nemen; stopt eerder als until() waar wordt. */
    forward(frames, until) {
      for (let i = 0; i < frames; i++) {
        this.tick(1000 / ${FPS});
        if (until && until()) return i;
      }
      return frames;
    },
    get now() { return now; },
  };
})();`;

class Devtools {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.waiting = new Map();
    this.logs = [];
    socket.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.method === 'Runtime.exceptionThrown') this.logs.push(msg.params.exceptionDetails?.exception?.description);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.logs.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
      const pending = this.waiting.get(msg.id);
      if (!pending) return;
      this.waiting.delete(msg.id);
      if (msg.error) pending.reject(new Error(`${pending.method}: ${msg.error.message} ${msg.error.data ?? ''}`));
      else pending.resolve(msg.result);
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject, method: `${method} ${JSON.stringify(params).slice(0, 160)}` });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async run(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result.value;
  }
}

/**
 * Start Chrome, opent een tab met de nepklok en geeft een opnemer terug.
 *
 *   const rec = await open({ width: 1280, height: 800 });
 *   await rec.go('http://localhost:5191/');
 *   await rec.forward(90);          // drie seconden zonder op te nemen
 *   await rec.record(150, 'x');     // vijf seconden, met optionele JS per frame
 *   rec.encode('out.mp4');
 */
export async function open({ width = 1280, height = 800, port = 9444, fakeClock = true, gpu = !!process.env.GPU } = {}) {
  if (!CHROME) throw new Error('Chrome niet gevonden; zet CHROME=/pad/naar/chrome');
  const profile = path.join(tmpdir(), `rec-${process.pid}-${port}`);
  rmSync(profile, { recursive: true, force: true });
  // gpu: een zichtbaar venster op de echte GPU (WebGPU, snelle post-processing).
  // Anders headless met SwiftShader: overal te draaien, maar trager.
  const render = gpu
    ? ['--enable-unsafe-webgpu', '--window-position=40,40', '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows']
    : ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const chrome = spawn(CHROME, [
    ...render,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-extensions',
    '--autoplay-policy=no-user-gesture-required',
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 150 && !target; i++) {
    await sleep(100);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* nog niet op */ }
  }
  if (!target) { chrome.kill(); throw new Error('Chrome reageert niet'); }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
  const dev = new Devtools(socket);
  await dev.send('Page.enable');
  await dev.send('Runtime.enable');
  await dev.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  if (fakeClock) await dev.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE_CLOCK });

  const frames = path.join(tmpdir(), `rec-frames-${process.pid}-${port}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  let n = 0;

  const rec = {
    dev,
    run: (js) => dev.run(js),
    async go(url, settle = 1500) {
      await dev.send('Page.navigate', { url });
      await sleep(settle);
      if (fakeClock) await dev.run('window.__clock.forward(10)');
    },
    /** Snel vooruit. `until` is een JS-expressie die true wordt bij genoeg actie. */
    forward: (count, until) => dev.run(`window.__clock.forward(${count}${until ? `, () => (${until})` : ''})`),
    async shot() {
      const { data } = await dev.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      writeFileSync(path.join(frames, `${String(n++).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    },
    /** Neemt `count` frames op. `each` is optionele JS die vóór elk frame draait. */
    async record(count, each = '', { realtime = false, between = null } = {}) {
      for (let i = 0; i < count; i++) {
        const t0 = Date.now();
        if (each) await dev.run(each);
        if (between) await between(i);
        if (fakeClock) await dev.run(`window.__clock.tick(${1000 / FPS})`);
        await rec.shot();
        // Echte tijd laten meelopen voor alles wat niet aan de klok hangt (netwerk, timers)
        if (realtime) await sleep(Math.max(0, 1000 / FPS - (Date.now() - t0)));
        if (i % 30 === 29) process.stdout.write('.');
      }
      process.stdout.write('\n');
    },
    get frameCount() { return n; },
    async mouse(type, x, y, extra = {}) {
      await dev.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
    },
    async click(x, y) { for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await rec.mouse(t, x, y); },
    /** Echte tijd én klok laten lopen zonder op te nemen (laden, netwerk). */
    async wait(cond, max = 90000) {
      const t0 = Date.now();
      while (Date.now() - t0 < max) {
        await dev.run('window.__clock.tick(33); 1');
        if (await dev.run(cond)) return true;
        await sleep(30);
      }
      return false;
    },
    encode(out, { crf = 23, fps = FPS } = {}) {
      mkdirSync(path.dirname(out), { recursive: true });
      const r = spawnSync('ffmpeg', [
        '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, '%05d.jpg'),
        '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', '-an', out,
      ], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('ffmpeg faalde');
      console.log(`  → ${out} (${n} frames, ${(n / fps).toFixed(1)} s)`);
    },
    async close() {
      socket.close();
      chrome.kill();
      await sleep(800);
      for (const dir of [profile, frames]) {
        try { rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); } catch { /* opgeruimd door het OS */ }
      }
    },
  };
  return rec;
}

/** Start een gameserver en wacht tot hij antwoordt. */
export async function serve(cwd, cmd, args, port, env = {}) {
  const proc = spawn(cmd, args, { cwd, env: { ...process.env, PORT: String(port), QUIET: '1', ...env }, stdio: 'ignore' });
  for (let i = 0; i < 200; i++) {
    try { if ((await fetch(`http://localhost:${port}/`)).ok) return proc; } catch { /* nog niet op */ }
    await sleep(150);
  }
  proc.kill();
  throw new Error(`server op ${port} kwam niet op`);
}
