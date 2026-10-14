(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* =====================================================
   DADOS: cores, pacotes e fases
===================================================== */
const PALETTE = ['#ff4d5e','#3d8bff','#2fd67b','#ffd43b','#ff8c3a','#2fe0e8','#c84bff','#b5e61d','#ff8fc7'];
const PACKS = [
  {name:'Iniciante', cfg:[[4,3],[4,3],[4,3],[4,4],[5,4],[5,4],[5,4],[5,5],[5,5],[5,5],[5,5],[5,5]]},
  {name:'Fácil',     cfg:[[6,5],[6,5],[6,5],[6,6],[6,6],[6,6],[6,6],[7,6],[7,6],[7,6],[7,7],[7,7]]},
  {name:'Médio',     cfg:[[7,6],[7,6],[7,7],[7,7],[7,7],[7,7],[8,7],[8,7],[8,7],[8,8],[8,8],[8,8]]},
  {name:'Difícil',   cfg:[[8,7],[8,7],[8,8],[8,8],[8,8],[8,8],[9,8],[9,8],[9,8],[9,9],[9,9],[9,9]]},
  {name:'Mestre',    cfg:[[9,8],[9,8],[9,9],[9,9],[9,9],[9,9],[10,9],[10,9],[10,9],[10,9],[10,9],[10,9]]},
];
const LEVELS = [];
PACKS.forEach((p, pi) => p.cfg.forEach(([n, k], i) => LEVELS.push({n, k, pack: pi, idx: i})));
const PACK_START = PACKS.map((_, pi) => LEVELS.findIndex(l => l.pack === pi));

/* =====================================================
   GERAÇÃO DE FASES (sempre solucionáveis)
   Caminho hamiltoniano aleatório (algoritmo backbite)
   cortado em k segmentos: cada segmento é uma cor.
===================================================== */
function rng32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hamPath(n, rng){
  const p0 = [];
  for(let r=0;r<n;r++) for(let q=0;q<n;q++) p0.push(r*n + (r%2 ? n-1-q : q));
  let p = p0;
  const iters = n*n*60;
  for(let it=0; it<iters; it++){
    if(rng() < .5) p.reverse();
    const h = p[0], hr = (h/n)|0, hc = h%n, nb = [];
    if(hr>0) nb.push(h-n); if(hr<n-1) nb.push(h+n); if(hc>0) nb.push(h-1); if(hc<n-1) nb.push(h+1);
    const v = nb[(rng()*nb.length)|0], j = p.indexOf(v);
    if(j > 1) p = p.slice(0, j).reverse().concat(p.slice(j));
  }
  return p;
}
const adj = (a,b,n) => Math.abs(((a/n)|0)-((b/n)|0)) + Math.abs(a%n - b%n) === 1;
const levelCache = {};
function buildLevel(i){
  if(levelCache[i]) return levelCache[i];
  const {n, k} = LEVELS[i];
  let res = null;
  for(let attempt=0; attempt<80; attempt++){
    const rng = rng32(i*9973 + 17 + attempt*7919);
    const p = hamPath(n, rng);
    const minLen = n <= 6 ? 3 : 4;
    const lens = Array(k).fill(minLen);
    let rem = n*n - k*minLen;
    while(rem-- > 0) lens[(rng()*k)|0]++;
    const segs = []; let o = 0;
    for(const L of lens){ segs.push(p.slice(o, o+L)); o += L; }
    const pal = PALETTE.slice();
    for(let a=pal.length-1;a>0;a--){ const b=(rng()*(a+1))|0; [pal[a],pal[b]]=[pal[b],pal[a]]; }
    res = {n, k, segs, colors: pal.slice(0, k)};
    if(segs.every(s => !adj(s[0], s[s.length-1], n))) break;
  }
  return levelCache[i] = res;
}

/* =====================================================
   SALVAMENTO
===================================================== */
const SAVE_KEY = 'colorlink:v1';
const defaults = () => ({stars:{}, best:{}, wip:{}, hints:5, sound:true, vibe:true, cb:false, theme:'auto', seenHelp:false});
let save = defaults();
try{ const raw = localStorage.getItem(SAVE_KEY); if(raw) save = Object.assign(defaults(), JSON.parse(raw)); }catch(e){}
function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
const totalStars = () => Object.values(save.stars).reduce((a,b)=>a+b,0);
const clearedCount = () => Object.keys(save.stars).filter(k=>save.stars[k]>0).length;
const unlocked = i => i===0 || !!save.stars[i-1];
const nextLevelIndex = () => { for(let i=0;i<LEVELS.length;i++) if(!save.stars[i]) return i; return LEVELS.length-1; };

/* =====================================================
   ÁUDIO E VIBRAÇÃO
===================================================== */
let AC = null;
function audio(){
  if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  if(AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, d=.09, type='sine', vol=.05, when=0){
  if(!save.sound) return; const a = audio(); if(!a) return;
  const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+.012); g.gain.exponentialRampToValueAtTime(.0001, t+d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+d+.03);
}
let lastStepSnd = 0;
const sfx = {
  step(len){ const now = performance.now(); if(now-lastStepSnd < 45) return; lastStepSnd = now; tone(330 + Math.min(len,24)*16, .06, 'sine', .035); },
  connect(){ tone(660,.12,'triangle',.07); tone(990,.2,'triangle',.06,.09); },
  cut(){ tone(190,.1,'square',.03); },
  pop(){ tone(520,.07,'sine',.04); },
  win(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,.28,'triangle',.07,i*.1)); },
  hint(){ tone(740,.1,'sine',.05); tone(1110,.16,'sine',.05,.08); },
};
const vibe = p => { if(save.vibe && navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} };

/* =====================================================
   ESTADO DO JOGO
===================================================== */
const G = {level:0,n:0,k:0,segs:[],colors:[],tint:[],dot:null,owner:null,paths:[],stamp:null,tip:[],completeAt:[],
  drawing:-1,moves:0,elapsed:0,t0:0,running:false,done:false,hintUsed:false,winAt:0,snap:''};
const canvas = $('#board'), ctx = canvas.getContext('2d'), wrap = $('#boardWrap');
const view = {size:0,dpr:1};
const COL = {grid:'rgba(255,255,255,.08)'};

const hexA = (h,a) => { const n = parseInt(h.slice(1),16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`; };
const center = (c,n) => ({x:(c%n)+.5, y:((c/n)|0)+.5});
const isComplete = c => { const p = G.paths[c]; return p.length >= 2 && G.dot[p[p.length-1]] === c && p[p.length-1] !== p[0]; };
const covered = () => { let s=0; for(let i=0;i<G.owner.length;i++) if(G.owner[i]>=0) s++; return s; };
const sig = () => G.paths.map(p=>p.join(',')).join('|');

function loadLevel(i){
  const L = buildLevel(i), {n,k} = L;
  Object.assign(G, {level:i,n,k,segs:L.segs,colors:L.colors,tint:L.colors.map(c=>hexA(c,.2))});
  G.dot = new Int8Array(n*n).fill(-1);
  L.segs.forEach((s,c)=>{ G.dot[s[0]] = c; G.dot[s[s.length-1]] = c; });
  G.paths = Array.from({length:k},()=>[]);
  G.owner = new Int8Array(n*n).fill(-1);
  G.stamp = new Float64Array(n*n);
  G.tip = Array.from({length:k},()=>({x:0,y:0}));
  G.completeAt = Array(k).fill(-9999);
  Object.assign(G,{drawing:-1,moves:0,elapsed:0,t0:0,running:false,done:false,hintUsed:false,winAt:0});
  const w = save.wip && save.wip[i];
  if(w && restoreWip(w)){ G.moves = w.moves||0; G.elapsed = w.elapsed||0; }
  G.paths.forEach((p,c)=>{ if(p.length){ const t = center(p[p.length-1],n); G.tip[c].x=t.x; G.tip[c].y=t.y; } });
  buildLegend(); updateHUD();
  $('#gTitle').textContent = 'Fase ' + (i+1);
  $('#gSub').textContent = `${PACKS[LEVELS[i].pack].name}, ${n}×${n}, ${k} cores`;
  $('#hintN').textContent = save.hints;
  $('#gPrev').disabled = i === 0;
  $('#gNext').disabled = i >= LEVELS.length-1 || !save.stars[i];
  wrap.classList.remove('win'); wrap.classList.remove('swap'); void wrap.offsetWidth; wrap.classList.add('swap');
}
function restoreWip(w){
  const {n,k} = G;
  if(!w.p || w.p.length !== k) return false;
  const seen = new Set(), tmp = [];
  for(let c=0;c<k;c++){
    const p = w.p[c]; if(!Array.isArray(p)) return false;
    for(let j=0;j<p.length;j++){
      const cell = p[j];
      if(!Number.isInteger(cell) || cell<0 || cell>=n*n || seen.has(cell)) return false;
      if(j===0 && G.dot[cell] !== c) return false;
      if(j>0 && !adj(p[j-1],cell,n)) return false;
      if(G.dot[cell] >= 0 && G.dot[cell] !== c) return false;
      if(j<p.length-1 && j>0 && G.dot[cell] === c) return false;
      seen.add(cell);
    }
    tmp.push(p.slice());
  }
  tmp.forEach((p,c)=>{ G.paths[c] = p; p.forEach(cell=>{ G.owner[cell] = c; G.stamp[cell] = -9999; }); });
  return true;
}
function saveWip(){
  if(G.done) return;
  if(covered() === 0){ delete save.wip[G.level]; }
  else save.wip[G.level] = {p:G.paths, moves:G.moves, elapsed:curTime()};
  persist();
}

/* ---------- Lógica de caminhos ---------- */
function truncate(c, len){
  const p = G.paths[c];
  for(let j=len;j<p.length;j++) if(G.owner[p[j]] === c) G.owner[p[j]] = -1;
  p.length = len;
  if(len){ const t = center(p[len-1],G.n); G.tip[c].x=t.x; G.tip[c].y=t.y; }
}
function stampCell(cell){ G.stamp[cell] = performance.now(); }

function onDown(cell){
  G.snap = sig();
  const d = G.dot[cell];
  if(d >= 0){
    truncate(d,0); G.paths[d] = [cell]; G.owner[cell] = d; stampCell(cell);
    const t = center(cell,G.n); G.tip[d].x = t.x; G.tip[d].y = t.y;
    G.drawing = d; sfx.pop(); vibe(8);
  } else if(G.owner[cell] >= 0){
    const c = G.owner[cell], idx = G.paths[c].indexOf(cell);
    truncate(c, idx+1); G.drawing = c; sfx.pop();
  } else return;
  startTimer(); updateHUD();
}
function stepToward(a, b){
  const n = G.n, ar=(a/n)|0, ac=a%n, br=(b/n)|0, bc=b%n, dr=br-ar, dc=bc-ac;
  if(Math.abs(dr) > Math.abs(dc)) return a + Math.sign(dr)*n;
  if(dc !== 0) return a + Math.sign(dc);
  return a + Math.sign(dr)*n;
}
function tryMove(next){
  const c = G.drawing, p = G.paths[c], n = G.n, head = p[p.length-1];
  const idx = p.indexOf(next);
  if(idx >= 0){ truncate(c, idx+1); sfx.step(p.length); return true; }   // voltar sobre o próprio caminho
  const dc = G.dot[next];
  if(dc >= 0 && dc !== c) { return false; }                               // ponto de outra cor bloqueia
  const o = G.owner[next];
  if(o >= 0 && o !== c){ truncate(o, G.paths[o].indexOf(next)); sfx.cut(); }  // corta o outro caminho
  p.push(next); G.owner[next] = c; stampCell(next);
  if(dc === c){                                                            // chegou ao ponto par: conectou
    G.drawing = -1; G.completeAt[c] = performance.now(); sfx.connect(); vibe([12,30,18]);
  } else sfx.step(p.length);
  return true;
}
function onMove(target){
  if(G.drawing < 0 || target < 0) return;
  let guard = 0;
  while(G.drawing >= 0 && guard++ < 24){
    const p = G.paths[G.drawing], head = p[p.length-1];
    if(head === target) break;
    if(!tryMove(stepToward(head, target))) break;
  }
  updateHUD();
  if(G.drawing < 0) checkWin();
}
function onUp(){
  if(G.drawing >= 0) G.drawing = -1;
  if(G.snap !== '' && sig() !== G.snap){
    G.moves++;
    updateHUD();
  }
  G.snap = '';
  if(!G.done){
    const allConnected = G.paths.every((_,c)=>isComplete(c));
    if(allConnected && covered() < G.n*G.n) toast('Quase! Preencha todas as casas do tabuleiro.');
    checkWin();
    saveWip();
  }
}

/* ---------- Vitória ---------- */
function checkWin(){
  if(G.done) return;
  if(G.paths.every((_,c)=>isComplete(c)) && covered() === G.n*G.n){
    if(G.drawing >= 0) G.drawing = -1;
    if(G.snap !== '' && sig() !== G.snap){ G.moves++; G.snap=''; }
    win();
  }
}
function win(){
  G.done = true; G.winAt = performance.now();
  const t = curTime(); G.running = false; G.elapsed = t;
  const k = G.k;
  let stars = G.moves <= Math.ceil(k*1.6) ? 3 : G.moves <= Math.ceil(k*2.6) ? 2 : 1;
  if(G.hintUsed) stars = Math.min(stars, 2);
  const first = !save.stars[G.level];
  const prevBest = save.best[G.level];
  save.stars[G.level] = Math.max(save.stars[G.level]||0, stars);
  if(!prevBest || t < prevBest) save.best[G.level] = t;
  if(first) save.hints = Math.min(9, save.hints+1);
  delete save.wip[G.level];
  persist(); updateHUD();
  sfx.win(); vibe([30,40,30,40,60]);
  wrap.classList.add('win');
  setTimeout(()=>showWin(stars, first), 1000);
  setTimeout(()=>confetti(), 250);
}
function showWin(stars, first){
  const i = G.level, last = i >= LEVELS.length-1;
  const packEnd = LEVELS[i].idx === 11;
  $('#wTitle').textContent = last ? 'Você zerou o jogo!' : packEnd ? `Pacote ${PACKS[LEVELS[i].pack].name} completo!` : stars === 3 ? 'Perfeito!' : 'Fase concluída!';
  $$('#wStars svg').forEach((s,j)=>{ s.classList.remove('on'); void s.getBBox; if(j < stars) setTimeout(()=>s.classList.add('on'),20); });
  $('#wMoves').textContent = G.moves;
  $('#wTime').textContent = fmt(G.elapsed);
  $('#wMsg').textContent = first ? 'Você ganhou +1 dica por completar uma fase nova.' : (stars < 3 ? 'Tente com menos movimentos para ganhar mais estrelas.' : 'Sem desperdício nenhum.');
  $('#wNext').style.display = last ? 'none' : '';
  openModal('mWin');
}

/* ---------- Dica ---------- */
function useHint(){
  if(G.done || !G.n) return;
  if(save.hints <= 0){ toast('Sem dicas. Complete fases novas para ganhar mais.'); return; }
  const wrong = [];
  for(let c=0;c<G.k;c++){
    const p = G.paths[c], s = G.segs[c];
    const same = p.length === s.length && (p.every((v,j)=>v===s[j]) || p.every((v,j)=>v===s[s.length-1-j]));
    if(!same) wrong.push(c);
  }
  if(!wrong.length) return;
  const c = wrong[(Math.random()*wrong.length)|0], s = G.segs[c];
  truncate(c,0);
  for(const cell of s){
    const o = G.owner[cell];
    if(o >= 0 && o !== c) truncate(o, G.paths[o].indexOf(cell));
  }
  G.paths[c] = s.slice();
  s.forEach((cell,j)=>{ G.owner[cell] = c; setTimeout(()=>stampCell(cell), j*35); });
  const t = center(s[s.length-1],G.n); G.tip[c].x = t.x; G.tip[c].y = t.y;
  G.completeAt[c] = performance.now() + s.length*35;
  G.hintUsed = true; save.hints--; $('#hintN').textContent = save.hints;
  sfx.hint(); startTimer(); updateHUD(); saveWip(); checkWin();
}
function resetLevel(){
  if(!G.n) return;
  delete save.wip[G.level]; persist();
  const done = G.done; loadLevel(G.level);
  if(done) closeModal('mWin');
}

/* =====================================================
   HUD, TEMPO, LEGENDA
===================================================== */
const fmt = s => { s = Math.floor(s); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
const curTime = () => G.elapsed + (G.running ? (performance.now()-G.t0)/1000 : 0);
function startTimer(){ if(!G.running && !G.done){ G.running = true; G.t0 = performance.now(); } }
function buildLegend(){
  const lg = $('#legend'); lg.innerHTML = '';
  G.colors.forEach(c=>{
    const d = document.createElement('span'); d.className = 'lg'; d.style.setProperty('--c', c);
    d.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'; lg.appendChild(d);
  });
}
function updateHUD(){
  if(!G.n) return;
  $('#sMoves').textContent = G.moves;
  const b = save.best[G.level]; $('#sBest').textContent = b != null ? fmt(b) : '-';
  const cov = covered(), total = G.n*G.n;
  $('#pBar').style.width = (cov/total*100) + '%';
  $$('#legend .lg').forEach((el,c)=>el.classList.toggle('on', isComplete(c)));
}
setInterval(()=>{ if(G.n && !G.done && $('#game').classList.contains('active')) $('#sTime').textContent = fmt(curTime()); else if(G.done) $('#sTime').textContent = fmt(G.elapsed); }, 250);

/* =====================================================
   RENDERIZAÇÃO (canvas)
===================================================== */
function rr(x,y,w,h,r){
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(x,y,w,h,r);
  else{ ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
}
const easeOutBack = t => { const c1=1.9, c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); };
let lastTs = 0;
function draw(ts){
  const n = G.n; if(!n || !view.size) return;
  const S = view.size, cell = S/n;
  ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
  ctx.clearRect(0,0,S,S);
  const dt = Math.min(.05, (ts-lastTs)/1000 || .016); lastTs = ts;
  const k1 = 1 - Math.exp(-dt*26);

  // grade
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; ctx.beginPath();
  for(let i=1;i<n;i++){ ctx.moveTo(i*cell,0); ctx.lineTo(i*cell,S); ctx.moveTo(0,i*cell); ctx.lineTo(S,i*cell); }
  ctx.stroke();

  // fundo das casas preenchidas
  for(let c=0;c<G.k;c++){
    const p = G.paths[c]; ctx.fillStyle = G.tint[c];
    for(const cellIdx of p){
      const a = (ts - G.stamp[cellIdx]) / 220;
      const s = a >= 1 ? 1 : a <= 0 ? 0.01 : easeOutBack(a);
      const pad = cell*.05, size = (cell - pad*2)*s, off = (cell - size)/2;
      rr((cellIdx%n)*cell + off, ((cellIdx/n)|0)*cell + off, size, size, cell*.18); ctx.fill();
    }
  }

  // caminhos
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for(let c=0;c<G.k;c++){
    const p = G.paths[c]; if(!p.length) continue;
    const tip = G.tip[c], last = center(p[p.length-1], n);
    tip.x += (last.x - tip.x)*k1; tip.y += (last.y - tip.y)*k1;
    if(p.length >= 2){
      ctx.beginPath();
      for(let j=0;j<p.length-1;j++){ const q = center(p[j],n); j ? ctx.lineTo(q.x*cell,q.y*cell) : ctx.moveTo(q.x*cell,q.y*cell); }
      ctx.lineTo(tip.x*cell, tip.y*cell);
      const comp = isComplete(c);
      ctx.strokeStyle = G.colors[c]; ctx.lineWidth = cell*.3;
      ctx.shadowColor = G.colors[c]; ctx.shadowBlur = comp ? cell*.22 : cell*.1;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    if(G.drawing === c){          // cabeça do traço
      ctx.beginPath(); ctx.arc(tip.x*cell, tip.y*cell, cell*.2, 0, 7);
      ctx.fillStyle = '#fff'; ctx.globalAlpha = .9; ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  // pontos
  for(let c=0;c<G.k;c++){
    const s = G.segs[c], col = G.colors[c];
    for(const cellIdx of [s[0], s[s.length-1]]){
      const ctr = center(cellIdx,n), x = ctr.x*cell, y = ctr.y*cell;
      let r = cell*.31*(1 + .03*Math.sin(ts/450 + c*1.3));
      if(G.drawing === c) r *= 1.08 + .06*Math.sin(ts/120);
      ctx.shadowColor = col; ctx.shadowBlur = cell*.3;
      ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fillStyle = col; ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(x - r*.28, y - r*.3, r*.38, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
      if(save.cb){
        ctx.fillStyle = 'rgba(10,8,30,.78)'; ctx.font = `700 ${cell*.3}px Fredoka, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c+1, x, y + cell*.02);
      }
      const age = (ts - G.completeAt[c]) / 650;
      if(age >= 0 && age < 1){                 // onda ao conectar
        ctx.beginPath(); ctx.arc(x,y,cell*(.3 + age*.45),0,7);
        ctx.strokeStyle = col; ctx.globalAlpha = 1-age; ctx.lineWidth = cell*.06; ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
  }

  // onda de vitória
  if(G.done){
    const w = (ts - G.winAt)/800;
    if(w < 2){
      for(let i=0;i<n*n;i++){
        const d = (((i/n)|0) + (i%n)) / (2*n-2);
        const a = Math.max(0, 1 - Math.abs(w - d*1.1)*5) * .45;
        if(a > 0){ ctx.fillStyle = `rgba(255,255,255,${a})`; rr((i%n)*cell+2, ((i/n)|0)*cell+2, cell-4, cell-4, cell*.18); ctx.fill(); }
      }
    }
  }
}
function frame(ts){
  requestAnimationFrame(frame);
  if($('#game').classList.contains('active')) draw(ts);
}
requestAnimationFrame(frame);

new ResizeObserver(()=>{
  const r = wrap.getBoundingClientRect(); if(r.width < 10) return;
  view.dpr = Math.min(window.devicePixelRatio||1, 2.5); view.size = r.width;
  canvas.width = canvas.height = Math.round(r.width*view.dpr);
}).observe(wrap);

/* ---------- Entrada (mouse e toque) ---------- */
function cellFromEvent(e, clamp){
  const n = G.n, r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left)/r.width*n, y = (e.clientY - r.top)/r.height*n;
  if(!clamp && (x<0||y<0||x>=n||y>=n)) return -1;
  const cx = Math.min(n-1, Math.max(0, Math.floor(x))), cy = Math.min(n-1, Math.max(0, Math.floor(y)));
  return cy*n + cx;
}
canvas.addEventListener('pointerdown', e=>{
  if(G.done || !G.n) return;
  e.preventDefault();
  try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
  const c = cellFromEvent(e,false); if(c >= 0) onDown(c);
});
canvas.addEventListener('pointermove', e=>{ if(G.drawing >= 0){ e.preventDefault(); onMove(cellFromEvent(e,true)); } });
['pointerup','pointercancel'].forEach(t => canvas.addEventListener(t, e=>{ onUp(); }));
canvas.addEventListener('contextmenu', e=>e.preventDefault());

/* =====================================================
   CONFETE
===================================================== */
const fx = $('#fx'), fctx = fx.getContext('2d'); let parts = [], fxRun = false;
function sizeFx(){ const d = Math.min(devicePixelRatio||1,2); fx.width = innerWidth*d; fx.height = innerHeight*d; fctx.setTransform(d,0,0,d,0,0); }
function confetti(){
  sizeFx();
  const W = innerWidth, H = innerHeight;
  for(let i=0;i<150;i++){
    const left = i%2===0;
    parts.push({x: left ? -10 : W+10, y: H*.55 + Math.random()*H*.1, vx:(left?1:-1)*(4+Math.random()*9), vy:-(9+Math.random()*12),
      rot:Math.random()*6, vr:(Math.random()-.5)*.4, w:6+Math.random()*8, h:4+Math.random()*6,
      c:PALETTE[(Math.random()*PALETTE.length)|0], round: Math.random()<.3});
  }
  if(!fxRun){ fxRun = true; requestAnimationFrame(fxLoop); }
}
function fxLoop(){
  fctx.clearRect(0,0,innerWidth,innerHeight);
  parts = parts.filter(p => p.y < innerHeight + 30);
  for(const p of parts){
    p.vy += .32; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    fctx.save(); fctx.translate(p.x,p.y); fctx.rotate(p.rot); fctx.fillStyle = p.c;
    if(p.round){ fctx.beginPath(); fctx.arc(0,0,p.h*.7,0,7); fctx.fill(); } else fctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
    fctx.restore();
  }
  if(parts.length) requestAnimationFrame(fxLoop); else { fxRun = false; fctx.clearRect(0,0,innerWidth,innerHeight); }
}

/* =====================================================
   TELAS, MODAIS E MENUS
===================================================== */
let current = 'home';
function show(id){
  current = id;
  $$('.screen').forEach(s=>{ const on = s.id === id; s.classList.toggle('active', on); s.classList.remove('enter'); if(on){ void s.offsetWidth; s.classList.add('enter'); } });
  if(id === 'home') renderHome();
  if(id === 'levels') renderLevels();
}
function openModal(id){ $('#'+id).classList.add('open'); }
function closeModal(id){ $('#'+id).classList.remove('open'); }
const anyModal = () => $$('.modal.open')[0];
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2200); }

function renderHome(){
  $('#hsStars').textContent = `${totalStars()} / ${LEVELS.length*3}`;
  $('#hsLevels').textContent = `${clearedCount()} de ${LEVELS.length} fases`;
  const nl = nextLevelIndex();
  $('#playLabel').textContent = clearedCount() === 0 ? 'Jogar' : (clearedCount() >= LEVELS.length ? 'Jogar de novo' : 'Continuar, fase ' + (nl+1));
}
const starSvg = on => `<svg viewBox="0 0 24 24" class="${on?'on':''}"><use href="#i-star"/></svg>`;
function renderLevels(){
  const list = $('#levelList'); list.innerHTML = '';
  $('#lvStars').textContent = `${totalStars()} / ${LEVELS.length*3}`;
  const nl = nextLevelIndex();
  PACKS.forEach((p,pi)=>{
    const sec = document.createElement('section'); sec.className = 'pack';
    const start = PACK_START[pi], end = start + p.cfg.length;
    let done = 0; for(let i=start;i<end;i++) if(save.stars[i]) done++;
    if(!unlocked(start)) sec.classList.add('locked');
    sec.innerHTML = `<div class="pack-head"><h3>${p.name}</h3><small>${done} de ${p.cfg.length}, tabuleiros de ${p.cfg[0][0]}×${p.cfg[0][0]} a ${p.cfg[p.cfg.length-1][0]}×${p.cfg[p.cfg.length-1][0]}</small></div>`;
    const grid = document.createElement('div'); grid.className = 'grid';
    for(let i=start;i<end;i++){
      const b = document.createElement('button'); b.className = 'lv'; b.setAttribute('aria-label','Fase '+(i+1));
      const s = save.stars[i] || 0;
      if(!unlocked(i)){ b.disabled = true; b.innerHTML = '<svg class="ic"><use href="#i-lock"/></svg>'; }
      else{
        if(s) b.classList.add('done'); if(i === nl) b.classList.add('current');
        b.innerHTML = `<span>${i+1}</span><span class="mini">${starSvg(s>=1)}${starSvg(s>=2)}${starSvg(s>=3)}</span>`;
        b.onclick = () => startLevel(i);
      }
      grid.appendChild(b);
    }
    sec.appendChild(grid); list.appendChild(sec);
  });
  const cur = list.querySelector('.current'); if(cur) setTimeout(()=>cur.scrollIntoView({block:'center'}),30);
}
function startLevel(i){
  if(i < 0 || i >= LEVELS.length || !unlocked(i)) return;
  closeModal('mWin'); loadLevel(i); show('game');
}

/* ---------- Configurações ---------- */
function applyTheme(){
  const t = save.theme;
  if(t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  requestAnimationFrame(()=>{ COL.grid = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || COL.grid;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); const m = document.querySelector('meta[name=theme-color]'); if(m && bg) m.content = bg; });
}
function syncSettings(){
  $('#tSound').setAttribute('aria-pressed', save.sound);
  $('#tVibe').setAttribute('aria-pressed', save.vibe);
  $('#tCb').setAttribute('aria-pressed', save.cb);
  $$('#tTheme button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.v === save.theme));
}
$('#tSound').onclick = () => { save.sound = !save.sound; persist(); syncSettings(); if(save.sound) sfx.pop(); };
$('#tVibe').onclick = () => { save.vibe = !save.vibe; persist(); syncSettings(); vibe(15); };
$('#tCb').onclick = () => { save.cb = !save.cb; persist(); syncSettings(); };
$$('#tTheme button').forEach(b => b.onclick = () => { save.theme = b.dataset.v; persist(); applyTheme(); syncSettings(); });
let resetArm = 0;
$('#bReset').onclick = function(){
  if(!resetArm){
    resetArm = setTimeout(()=>{ resetArm = 0; this.textContent = 'Apagar todo o progresso'; this.classList.remove('danger'); }, 3500);
    this.textContent = 'Toque de novo para confirmar'; this.classList.add('danger'); return;
  }
  clearTimeout(resetArm); resetArm = 0; this.textContent = 'Apagar todo o progresso'; this.classList.remove('danger');
  const keep = {sound:save.sound, vibe:save.vibe, cb:save.cb, theme:save.theme, seenHelp:true};
  save = Object.assign(defaults(), keep); persist();
  closeModal('mSettings'); toast('Progresso apagado.'); G.n = 0; show('home');
};
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------- Eventos de interface ---------- */
document.addEventListener('click', e=>{
  const o = e.target.closest('[data-open]'); if(o){ openModal(o.dataset.open); return; }
  if(e.target.closest('[data-close]')){ const m = e.target.closest('.modal'); if(m) m.classList.remove('open'); return; }
  const g = e.target.closest('[data-go]'); if(g){ show(g.dataset.go); return; }
  if(e.target.classList.contains('modal') && e.target.id !== 'mWin') e.target.classList.remove('open');
});
$('#btnPlay').onclick = () => startLevel(clearedCount() >= LEVELS.length ? 0 : nextLevelIndex());
$('#btnLevels').onclick = () => show('levels');
$('#gBack').onclick = () => { saveWip(); show('levels'); };
$('#gReset').onclick = resetLevel;
$('#gHint').onclick = useHint;
$('#gPrev').onclick = () => { saveWip(); startLevel(G.level-1); };
$('#gNext').onclick = () => { saveWip(); startLevel(G.level+1); };
$('#wNext').onclick = () => startLevel(G.level+1);
$('#wRetry').onclick = () => { closeModal('mWin'); delete save.wip[G.level]; loadLevel(G.level); };
$('#wMenu').onclick = () => { closeModal('mWin'); show('levels'); };

document.addEventListener('keydown', e=>{
  if(e.key === 'Escape'){ const m = anyModal(); if(m && m.id !== 'mWin'){ m.classList.remove('open'); return; } if(current === 'game'){ saveWip(); show('levels'); } else if(current === 'levels') show('home'); return; }
  if(current !== 'game' || anyModal()) return;
  const k = e.key.toLowerCase();
  if(k === 'r') resetLevel(); else if(k === 'h') useHint();
  else if(e.key === 'ArrowLeft') startLevel(G.level-1); else if(e.key === 'ArrowRight' && save.stars[G.level]) startLevel(G.level+1);
});
document.addEventListener('visibilitychange', () => { if(document.hidden && current === 'game') saveWip(); });
addEventListener('pagehide', () => { if(current === 'game') saveWip(); });
addEventListener('resize', () => { if(fxRun) sizeFx(); });
// evita zoom por gesto/duplo toque no celular
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

/* ---------- Início ---------- */
applyTheme(); syncSettings(); renderHome();
if(!save.seenHelp){ setTimeout(()=>{ openModal('mHelp'); save.seenHelp = true; persist(); }, 500); }
})();