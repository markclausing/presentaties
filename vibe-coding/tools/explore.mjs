// Verkennen: node explore.mjs "<query>" stappen...   (fw:N, shot, js:..., key:w, keyup:w, click:x,y, wait:expr)
import { open } from './recorder.mjs';
import { writeFileSync } from 'node:fs';
const [,, q, ...steps] = process.argv;
const OUT = '/private/tmp/claude-501/-Users-mjaclausing-Development-presentaties/492b570b-45db-46b1-9d34-bc0f6fe93663/scratchpad';
const rec = await open({ port: 9472, gpu: true });
let n = 0;
try {
  await rec.go('http://localhost:5174/');
  await rec.run("localStorage.setItem('instellingen', JSON.stringify({ taal: 'nl', geluidAan: false, kwaliteit: 'hoog' })); 1");
  await rec.go('http://localhost:5174/' + q, 800);
  console.log('geladen', await rec.wait("(document.querySelector('.start-knop')?.click(), !document.querySelector('.laadscherm'))"));
  await rec.forward(15);
  for (const s of steps) {
    if (s.startsWith('fw:')) await rec.forward(+s.slice(3));
    else if (s === 'shot') { const { data } = await rec.dev.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(`${OUT}/ex-${n++}.jpg`, Buffer.from(data, 'base64')); }
    else if (s.startsWith('js:')) console.log(String(JSON.stringify(await rec.run(s.slice(3)))).slice(0, 400));
    else if (s.startsWith('key:') || s.startsWith('keyup:')) { const [t, k] = s.split(':'); await rec.run(`window.dispatchEvent(new KeyboardEvent('${t === 'key' ? 'keydown' : 'keyup'}', { key: '${k}', code: 'Key${k.toUpperCase()}', bubbles: true })); 1`); }
    else if (s.startsWith('click:')) { const [x, y] = s.slice(6).split(',').map(Number); await rec.click(x, y); }
  }
  if (rec.dev.logs.length) console.log('ERR', rec.dev.logs.slice(0, 3));
} finally { await rec.close(); }
