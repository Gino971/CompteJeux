document.addEventListener('DOMContentLoaded', function(){
  const board = document.getElementById('fourTwoOneBoard');
  const rollBtn = document.getElementById('roll421Btn');
  // Correction : utiliser globalResetBtn si reset421Btn n'existe pas
  let resetBtn = document.getElementById('reset421Btn');
  if(!resetBtn) resetBtn = document.getElementById('globalResetBtn');
  // status element removed from DOM; provide a safe fallback object so existing
  // assignments like `status.textContent = ...` do nothing instead of throwing.
  let status = document.getElementById('roll421Status');
  if(!status){ status = { textContent: '', style: {} }; }
  const endTurnBtn = document.getElementById('end421TurnBtn');
  const currentPlayerEl = document.getElementById('current421Player');
  const remainingRollsEl = document.getElementById('remainingRolls');
  const historyEl = document.getElementById('fourtwooneHistory');

  // players come from global `state.game` (declared in script.js using `let state`),
  // fall back to `window.state` if present, otherwise default.
  let players = (typeof state !== 'undefined' && Array.isArray(state.game) && state.game.length) ? state.game.slice() : ((window.state && Array.isArray(window.state.game) && window.state.game.length) ? window.state.game.slice() : [{ id: 'solo', name: 'Joueur' }]);
  // combos and token values (fixed table) per user's mapping
  const combos = [
    { label: '4-2-1', tokens: 10, sample: [4,2,1] },
    { label: '3 as', tokens: 7, sample: [1,1,1] },
    { label: '2 as + 6', tokens: 6, sample: [1,1,6] },
    { label: '3 six', tokens: 6, sample: [6,6,6] },
    { label: '2 as + 5', tokens: 5, sample: [1,1,5] },
    { label: '3 cinq', tokens: 5, sample: [5,5,5] },
    { label: '2 as + 4', tokens: 4, sample: [1,1,4] },
    { label: '3 quatre', tokens: 4, sample: [4,4,4] },
    { label: '2 as + 3', tokens: 3, sample: [1,1,3] },
    { label: '3 trois', tokens: 3, sample: [3,3,3] },
    { label: '2 as + 2', tokens: 2, sample: [1,1,2] },
    { label: '3 deux', tokens: 2, sample: [2,2,2] },
    { label: '6+5+4', tokens: 2, sample: [6,5,4] },
    { label: '5+4+3', tokens: 2, sample: [5,4,3] },
    { label: '4+3+2', tokens: 2, sample: [4,3,2] },
    { label: '3+2+1', tokens: 1, sample: [3,2,1] },
    { label: 'AUTRE', tokens: 1, sample: [6,3,2] }
  ];
  // tokens per player (modifiable) — default 10 jetons par joueur
  const tokens = {};
  const figures = {};
  const TOKENS_KEY = 'scorekeeper_421_tokens_v1';
  const HISTORY_KEY = 'scorekeeper_421_history_v1';
  const POT_KEY = 'scorekeeper_421_pot_v1';

  // game phase: 1 = distribution from pot, 2 = give tokens to loser to get rid of them
  let gamePhase = 1;
  let pot = 0;
  // runtime state for rolling
  let rollCount = 0;
  let maxRolls = 3;
  // initial dice: three sixes at start
  let dice = [6,6,6];
  let selected = [false,false,false];
  let currentPlayerIndex = 0;
  let currentRoundResults = {};
  let roundIndex = 0;
  let autoFinalizeTimer = null;
  let dechargeRounds = 0;
  let justReachedZero = null;
  let justEnteredPhase2 = false;

  // history object for rounds (persisted to localStorage)
  let history = { _rounds: [] };

  function saveHistory(){
    try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(history||{_rounds:[]})); }catch(e){}
  }

  function loadHistory(){
    try{
      const raw = localStorage.getItem(HISTORY_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === 'object'){
          history = parsed;
          if(!Array.isArray(history._rounds)) history._rounds = [];
          return;
        }
      }
    }catch(e){}
    history = { _rounds: [] };
  }

  // sync local `players` array from global `state.game` when main app updates players
  function updatePlayersFromState(){
    try{
      const src = (typeof state !== 'undefined' && Array.isArray(state.game) && state.game.length) ? state.game.slice() : ((window.state && Array.isArray(window.state.game) && window.state.game.length) ? window.state.game.slice() : null);
      if(Array.isArray(src)) players = src.slice();
      // ensure tokens/figures reflect players
      players.forEach(p=>{ if(typeof tokens[p.id] === 'undefined') tokens[p.id] = 0; if(typeof figures[p.id] === 'undefined') figures[p.id] = ''; });
      for(const k in tokens) if(!players.find(p=>p.id===k)) delete tokens[k];
      for(const k in figures) if(!players.find(p=>p.id===k)) delete figures[k];
    }catch(e){}
  }

  function saveTokens(){
    try{ localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens||{})); }catch(e){}
  }

  function loadPot(){
    try{
      const raw = localStorage.getItem(POT_KEY);
      if(raw){
        pot = Number(JSON.parse(raw)) || 0;
      } else {
        // default starting pot
        pot = 21;
      }
    }catch(e){ pot = 21 }
  }

  // helper: render a single mini-die (3x3 pips) as HTML string
  function miniDieHTML(v) {
    // deterministic small vein SVG per face (seeded RNG), colored and slightly thicker
    function makeRng(seed){ let s = (seed % 2147483647) || 1; return function(){ s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
    try{
      const val = Number(v) || 0;
      const rng = makeRng(1000 + val);
      const w = 48, h = 48;
      const paths = [];
      const palette = ['#8B5CF6','#EC4899','#06B6D4','#F59E0B','#10B981','#EF4444'];
      const count = 1 + (val % 3) + Math.floor(rng()*2);
      for(let pi=0; pi<count; pi++){
        const opacity = (0.18 + rng()*0.32).toFixed(3);
        const color = palette[Math.abs((val-1 + pi)) % palette.length];
        const segs = 2 + (val % 3) + Math.floor(rng()*2);
        let pts = [];
        for(let s=0;s<=segs;s++){
          const x = Math.round((s/segs)*w + (rng()*6-3));
          const y = Math.round(6 + rng()*(h-12));
          pts.push([x,y]);
        }
        let dpath = `M ${pts[0][0]} ${pts[0][1]}`;
        for(let i=1;i<pts.length;i++){
          const prev = pts[i-1]; const cur = pts[i];
          const cx1 = prev[0] + (rng()*12-6);
          const cy1 = prev[1] + (rng()*12-6);
          const cx2 = cur[0] + (rng()*12-6);
          const cy2 = cur[1] + (rng()*12-6);
          dpath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${cur[0]} ${cur[1]}`;
        }
        // thicker strokes for mini-dice; add a soft thicker shadow stroke
        const sw = 2 + rng()*4;
        const swShadow = (sw * 1.6).toFixed(2);
        const swMain = sw.toFixed(2);
        paths.push(`<path d="${dpath}" fill="none" stroke="${color}" stroke-opacity="${(opacity*0.45).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${swShadow}" vector-effect="non-scaling-stroke"/>`);
        paths.push(`<path d="${dpath}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${swMain}" vector-effect="non-scaling-stroke"/>`);
      }
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>${paths.join('')}</svg>`;
      const dataUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
      let html = '<div class="mini-die veined" data-value="' + (v||0) + '" style="--vein-svg:' + dataUrl + '">';
      for (let i = 0; i < 9; i++) html += '<span class="pip"></span>';
      html += '</div>';
      return html;
    }catch(e){
      let html = '<div class="mini-die" data-value="' + (v||0) + '">';
      for (let i = 0; i < 9; i++) html += '<span class="pip"></span>';
      html += '</div>';
      return html;
    }
  }
  function miniDiceRow(values){ return '<div class="mini-dice-row">' + (values||[]).map(v=>miniDieHTML(v)).join('') + '</div>'; }
  function savePot(){ try{ localStorage.setItem(POT_KEY, JSON.stringify(Number(pot||0))) }catch(e){} }

  function renderPhaseUI(){
    try{
      // ensure tokens/figures exist for each player and cleanup removed keys
      players.forEach(p=>{ if(typeof tokens[p.id] === 'undefined') tokens[p.id] = 0; if(typeof figures[p.id] === 'undefined') figures[p.id] = ''; });
      for(const k in tokens) if(!players.find(p=>p.id===k)) delete tokens[k];
      for(const k in figures) if(!players.find(p=>p.id===k)) delete figures[k];
      // refresh related UI areas
      try{ renderPlayerTokens(); }catch(e){}
      try{ renderCombosTable(); }catch(e){}
    }catch(e){}
  }
  // create a simple die element for the board
  function createDieEl(value, idx){
    const d = document.createElement('div');
    d.className = 'die';
    // apply persistent veined texture to board dice
    try{ d.classList.add('veined'); }catch(e){}
    // generate a randomized SVG vein overlay and assign it to CSS variable --vein-svg
    try{
      // deterministic RNG seeded by face value so same face => same veins
      function makeRng(seed){ let s = (seed % 2147483647) || 1; return function(){ s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
      const val = Number(value) || 0;
      const rng = makeRng(2000 + val);
      const w = 160, h = 160;
      const paths = [];
        const palette = ['#8B5CF6','#EC4899','#06B6D4','#F59E0B','#10B981','#EF4444'];
        const count = 2 + (val % 3);
      for(let pi=0; pi<count; pi++){
          const opacity = (0.22 + rng()*0.38).toFixed(3);
          const color = palette[Math.abs((val-1 + pi)) % palette.length];
        const segs = 3 + (val % 3);
        let pts = [];
        for(let s=0;s<=segs;s++){
          const x = Math.round((s/segs)*w + (rng()*14-7));
          // distribute Y across face area (not grouped on top) and add small wave
          const y = Math.round(24 + rng()*(h-48) + Math.sin((s/segs)*Math.PI* (1 + rng())) * (12 + rng()*10));
          pts.push([x,y]);
        }
        let dpath = `M ${pts[0][0]} ${pts[0][1]}`;
        for(let i=1;i<pts.length;i++){
          const prev = pts[i-1]; const cur = pts[i];
          const cx1 = prev[0] + (rng()*20-10);
          const cy1 = prev[1] + (rng()*18-9);
          const cx2 = cur[0] + (rng()*20-10);
          const cy2 = cur[1] + (rng()*18-9);
          dpath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${cur[0]} ${cur[1]}`;
        }
        const sw = 1.5 + rng()*2.5;
        const swShadow = (sw * 1.4).toFixed(2);
        const swMain = sw.toFixed(2);
        paths.push(`<path d="${dpath}" fill="none" stroke="${color}" stroke-opacity="${(opacity*0.45).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${swShadow}" vector-effect="non-scaling-stroke"/>`);
        paths.push(`<path d="${dpath}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${swMain}" vector-effect="non-scaling-stroke"/>`);
      }
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>${paths.join('')}</svg>`;
      const dataUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
      d.style.setProperty('--vein-svg', dataUrl);
    }catch(e){}
    d.dataset.index = typeof idx === 'number' ? String(idx) : '';
    d.setAttribute('data-value', typeof value !== 'undefined' && value !== '' ? String(value) : '');
    // build 3x3 pip grid
    const pips = document.createElement('div');
    pips.className = 'pips';
    // mapping of face value -> pip positions (1..9)
    const faces = {
      1: [5],
      2: [1,9],
      3: [1,5,9],
      4: [1,3,7,9],
      5: [1,3,5,7,9],
      6: [1,3,4,6,7,9]
    };
    const map = faces[Number(value)] || [];
    for(let i=1;i<=9;i++){
      const slot = document.createElement('span');
      slot.className = 'pip pos-' + i;
      if(map.indexOf(i) === -1) slot.classList.add('hidden-pip');
      pips.appendChild(slot);
    }
    d.appendChild(pips);
    // reflect current kept state if index passed
      try{
      // selected === dice to be re-rolled (inverse of previous "kept" semantics)
      if(typeof idx === 'number' && selected[idx]){ d.classList.add('selected'); }
      // allow toggling which dice will be re-rolled by clicking the die
      d.style.cursor = 'pointer';
      d.addEventListener('click', function(evt){
        try{
          if(typeof idx !== 'number') return;
          selected[idx] = !selected[idx];
          d.classList.toggle('selected', !!selected[idx]);
        }catch(e){}
      });
    }catch(e){}
    return d;
  }

  function renderDice(values){
    board.innerHTML = '';
    values.forEach((v,i) => board.appendChild(createDieEl(v, i)));
  }

  function renderCombosTable(){
    const el = document.getElementById('fourtwooneCombos');
    if(!el) return;
    const $table = el;
    $table.innerHTML = '';
    // use global helpers to produce mini-dice HTML

    const tbody = document.createElement('tbody');
    for(let i=0;i<combos.length;i+=2){
      const tr = document.createElement('tr');
      // left cell (combo i)
      const left = combos[i];
      const tdLeft = document.createElement('td');
      if(left){
        const cell = document.createElement('div');
        cell.className = 'combo-cell';
        cell.dataset.label = left.label;
        try{
          const ev = evaluateDice((left.sample||[1,2,3]).slice());
          cell.dataset.eval = ev.label;
          cell.dataset.score = String(ev.score);
        }catch(e){}
        if(String(left.label).toLowerCase().trim() === 'autres' || String(left.label).toLowerCase().trim() === 'autre') cell.dataset.isOther = '1';
        cell.dataset.tokens = left.tokens;
        if(cell.dataset.isOther){
          cell.innerHTML = '<span class="combo-other-label">AUTRE</span>' + '<span class="combo-tokens">' + left.tokens + '</span>';
        } else {
          cell.innerHTML = miniDiceRow(left.sample || [1,2,3]) + '<span class="combo-tokens">' + left.tokens + '</span>';
        }
        tdLeft.appendChild(cell);
      }
      tr.appendChild(tdLeft);
      // right cell (combo i+1)
      const right = combos[i+1];
      const tdRight = document.createElement('td');
      if(right){
        const cell2 = document.createElement('div');
        cell2.className = 'combo-cell';
        cell2.dataset.label = right.label;
        try{
          const ev2 = evaluateDice((right.sample||[1,2,3]).slice());
          cell2.dataset.eval = ev2.label;
          cell2.dataset.score = String(ev2.score);
        }catch(e){}
        if(String(right.label).toLowerCase().trim() === 'autres' || String(right.label).toLowerCase().trim() === 'autre') cell2.dataset.isOther = '1';
        cell2.dataset.tokens = right.tokens;
        if(cell2.dataset.isOther){
          cell2.innerHTML = '<span class="combo-other-label">AUTRE</span>' + '<span class="combo-tokens">' + right.tokens + '</span>';
        } else {
          cell2.innerHTML = miniDiceRow(right.sample || [1,2,3]) + '<span class="combo-tokens">' + right.tokens + '</span>';
        }
        tdRight.appendChild(cell2);
      }
      tr.appendChild(tdRight);
      tbody.appendChild(tr);
    }
    $table.appendChild(tbody);
  }

  function highlightCombo(label, tokens, score){
    // Simplified highlight logic:
    // - if no label/tokens provided, keep existing highlight
    // - otherwise clear existing highlight and try matching in order: data-eval, data-label, data-tokens, 'Autres'
    const el = document.getElementById('fourtwooneCombos');
    if(!el) return;
    // debug logs removed
    if(!label && typeof tokens === 'undefined') return; // do not clear existing highlight
    // clear
    el.querySelectorAll('.combo-cell.combo-active').forEach(n=>n.classList.remove('combo-active'));
    el.querySelectorAll('td.combo-active-td').forEach(n=>n.classList.remove('combo-active-td'));
    el.querySelectorAll('tr.combo-active').forEach(n=>n.classList.remove('combo-active'));
    const esc = s => String(s).replace(/"/g,'\\"');
    // first try to match by numeric score if available
    if(typeof score !== 'undefined'){
      const es = el.querySelector('.combo-cell[data-score="' + esc(score) + '"]');
      if(es){ es.classList.add('combo-active'); const t = es.closest('td'); if(t){ t.classList.add('combo-active-td'); const tr = t.closest('tr'); if(tr) tr.classList.add('combo-active'); } return; }
    }
    if(label){
      const e1 = el.querySelector('.combo-cell[data-eval="' + esc(label) + '"]');
      if(e1){ e1.classList.add('combo-active'); const t = e1.closest('td'); if(t){ t.classList.add('combo-active-td'); const tr = t.closest('tr'); if(tr) tr.classList.add('combo-active'); } return; }
      const e2 = el.querySelector('.combo-cell[data-label="' + esc(label) + '"]');
      if(e2){ e2.classList.add('combo-active'); const t = e2.closest('td'); if(t){ t.classList.add('combo-active-td'); const tr = t.closest('tr'); if(tr) tr.classList.add('combo-active'); } return; }
    }
    if(typeof tokens !== 'undefined'){
      const list = Array.from(el.querySelectorAll('.combo-cell[data-tokens="' + esc(tokens) + '"]'));
      if(list.length === 1){ const e3 = list[0]; e3.classList.add('combo-active'); const t = e3.closest('td'); if(t){ t.classList.add('combo-active-td'); const tr = t.closest('tr'); if(tr) tr.classList.add('combo-active'); } return; }
      // if multiple cells share the same tokens value, prefer the 'Autre' fallback instead of ambiguous token match
    }
    const other = el.querySelector('.combo-cell[data-is-other]');
    if(other){ other.classList.add('combo-active'); const t = other.closest('td'); if(t){ t.classList.add('combo-active-td'); const tr = t.closest('tr'); if(tr) tr.classList.add('combo-active'); } return; }
    // no match found — log cells for debugging
    // no match found
  }

  function renderPlayerTokens(){
    const el = document.getElementById('fourtwoonePlayersTokens');
    if(!el) return;
    const rows = players.map(p => {
      const t = tokens[p.id] || 0;
      const fig = figures[p.id] || null;
      const figHtml = (fig && fig.dice && Array.isArray(fig.dice)) ? miniDiceRow(fig.dice) : (fig && fig.label ? escapeHtml(fig.label) : '—');
      return `<tr data-player="${p.id}"><td>${escapeHtml(p.name)}</td><td class="figure"><div class="player-figure">${figHtml}</div></td><td class="actions"><span class="token-badge">${t}</span></td></tr>`;
    }).join('');
    el.innerHTML = rows;
    // highlight current player row
    try{
      const cur = players[currentPlayerIndex] && players[currentPlayerIndex].id;
      if(cur){
        const r = el.querySelector('tr[data-player="' + cur + '"]');
        if(r){ r.classList.add('current-player'); }
      }
    }catch(e){}
  }

  function renderComboInfo(vals){
    // removed: combo info box was deleted from the UI; highlighting is handled directly
  }

  function applyRoundTransfers(results){
    // Simplified transfer logic:
    // - Phase 1 (charge) unchanged: pot -> worst player.
    // - Phase 2 (décharge): best combo gives tokensForDice(best) to worst combo.
    if(!results || !results.length) return;
    const transfers = [];
    const tokensBefore = Object.assign({}, tokens);
    // helper to compute combo index from `combos`
    function comboIndexForDice(vals){
      try{
        const norm = (vals||[]).slice().map(n=>Number(n)||0).sort((a,b)=>a-b);
        for(let i=0;i<combos.length;i++){
          const samp = (combos[i].sample||[]).slice().map(n=>Number(n)||0).sort((a,b)=>a-b);
          if(samp.length === norm.length && samp.every((v,idx)=> v === norm[idx])) return i;
        }
        for(let i=0;i<combos.length;i++){ if(String(combos[i].label||'').toLowerCase().indexOf('autre') !== -1) return i; }
      }catch(e){}
      return combos.length - 1;
    }
    // build considered list from results
    const considered = (results||[]).map(r=>({ pid: r.pid, name: r.name, dice: r.dice||[], eval: r.eval||{score:0}, val: Number(tokensForDice(r.dice)||0), comboIdx: comboIndexForDice(r.dice||[]) }));
    if(gamePhase === 1){
      // existing behavior: worst player receives from pot amount = bestVal limited by pot
      let worst = considered.slice().sort((a,b)=>{
        if(a.val !== b.val) return a.val - b.val; // smaller val worse
        if(a.comboIdx !== b.comboIdx) return b.comboIdx - a.comboIdx; // larger idx worse
        if(a.eval && b.eval && a.eval.score !== b.eval.score) return a.eval.score - b.eval.score; // smaller score worse
        return players.findIndex(p=>p.id===a.pid) - players.findIndex(p=>p.id===b.pid);
      })[0];
      const bestVal = Math.max(0, ...considered.map(c=> Number(c.val||0)));
      const give = Math.min(bestVal, pot || 0);
      const beforeL = Number(tokens[worst.pid]||0);
      tokens[worst.pid] = beforeL + give;
      pot = Math.max(0, (pot||0) - give);
      transfers.push({ pid: worst.pid, name: worst.name, before: beforeL, delta: give, after: tokens[worst.pid] });
      saveTokens(); savePot();
      try{ const el = document.getElementById('fourtwooneTransfers'); if(el && transfers.length){ el.innerHTML=''; const n=document.createElement('div'); n.className='transfer-item'; n.textContent = `${worst.name} a ramassé ${Number(give)||0} jeton${give>1?'s':''}`; el.appendChild(n); } }catch(e){}
      if((pot||0) <= 0){ gamePhase = 2; dechargeRounds = 0; justReachedZero = null; justEnteredPhase2 = true; renderPhaseUI(); }
      return;
    }
    // Phase 2: best gives to worst
    const best = considered.slice().sort((a,b)=>{
      if(a.comboIdx !== b.comboIdx) return a.comboIdx - b.comboIdx; // smaller index better
      if((b.eval&&b.eval.score||0) !== (a.eval&&a.eval.score||0)) return (b.eval&&b.eval.score||0) - (a.eval&&a.eval.score||0); // larger score better
      return players.findIndex(p=>p.id===a.pid) - players.findIndex(p=>p.id===b.pid);
    })[0];
    const worst = considered.slice().sort((a,b)=>{
      if(a.comboIdx !== b.comboIdx) return b.comboIdx - a.comboIdx; // larger index worse
      if((a.eval&&a.eval.score||0) !== (b.eval&&b.eval.score||0)) return (a.eval&&a.eval.score||0) - (b.eval&&b.eval.score||0); // smaller score worse
      return players.findIndex(p=>p.id===a.pid) - players.findIndex(p=>p.id===b.pid);
    })[0];
    if(!best || !worst || best.pid === worst.pid) return;
    const giveVal = Number(tokensForDice(best.dice) || 0);
    const beforeW = Number(tokens[best.pid]||0);
    const give = Math.min(giveVal, beforeW);
    tokens[best.pid] = Math.max(0, beforeW - give);
    const beforeL = Number(tokens[worst.pid]||0);
    tokens[worst.pid] = beforeL + give;
    saveTokens();
    transfers.push({ pid: best.pid, name: best.name, before: beforeW, delta: -give, after: tokens[best.pid] });
    transfers.push({ pid: worst.pid, name: worst.name, before: beforeL, delta: give, after: tokens[worst.pid] });
    try{ const el = document.getElementById('fourtwooneTransfers'); if(el && transfers.length){ el.innerHTML=''; const n=document.createElement('div'); n.className='transfer-item'; n.textContent = `${best.name} a donné ${give} jeton${give>1?'s':''} à ${worst.name}`; el.appendChild(n); } }catch(e){}
    // detect zero
    try{ for(const p of players){ const pid=p.id; if((tokensBefore&&tokensBefore[pid]||0)>0 && (tokens[pid]||0)===0){ justReachedZero=pid; break; } } }catch(e){}
    // check end
    const playersWithTokens = players.filter(p=> (tokens[p.id]||0) > 0 ).length;
    if(playersWithTokens <= 1 && gamePhase === 2 && (dechargeRounds || 0) >= 1){
      status.textContent='Partie terminée';
      rollBtn&&(rollBtn.disabled=true);
      let winnerObj = players.find(p=> (tokens[p.id]||0) > 0);
      if(!winnerObj){ const sorted = players.slice().sort((a,b)=> (tokens[b.id]||0) - (tokens[a.id]||0)); winnerObj = sorted[0]; }
      try{ showWinnerBanner(winnerObj?winnerObj.name:'—'); }catch(e){}
    }
  }

  function rollOnce(){
    return 1 + Math.floor(Math.random()*6);
  }

  function is421(vals){
    const sorted = vals.slice().sort((a,b)=>a-b).join(',');
    return sorted === '1,2,4';
  }

  // Evaluate dice according to common 421 ranking:
  // - exact 4-2-1 is highest
  // - then triples (6..1)
  // - otherwise compare sorted descending tuples lexicographically
  function evaluateDice(vals){
    const v = vals.slice();
    // ensure numbers
    for(let i=0;i<3;i++) v[i] = Number(v[i]) || 0;
    if(is421(v)) return { label: '4-2-1', score: 100000 };
    // triple
    if(v[0]===v[1] && v[1]===v[2]){
      // higher triple gets higher score
      return { label: `Brelan ${v[0]}`, score: 90000 + v[0]*100 };
    }
    // else sort descending and build lexicographic score
    const desc = v.slice().sort((a,b)=>b-a);
    const label = desc.join('-');
    const score = desc[0]*1000 + desc[1]*10 + desc[2];
    return { label: label, score: score };
  }

  function tokensForDice(vals){
    const v = vals.slice().map(n=>Number(n)||0);
    if(is421(v)) return 10;
    // counts
    const counts = {};
    v.forEach(n=>counts[n]=(counts[n]||0)+1);
    // triple
    for(const n in counts){ if(counts[n]===3){ if(Number(n)===1) return 7; return Number(n); } }
    // two aces + X
    if((counts[1]||0)===2){
      const other = v.find(n=>n!==1);
      return Number(other) || 1;
    }
    // straights
    const desc = v.slice().sort((a,b)=>b-a);
    const descKey = desc.join('-');
    if(descKey === '6-5-4' || descKey === '5-4-3' || descKey === '4-3-2') return 2;
    if(descKey === '3-2-1') return 1;
    // default others
    return 1;
  }

  // Play a short dice-rattle noise using WebAudio during a roll
  function playDiceRattle(durationMs){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const sr = ctx.sampleRate;
      // short noise buffer (looped) to repeat during the animation
      const chunkSec = 0.12;
      const len = Math.max(1, Math.floor(chunkSec * sr));
      const buffer = ctx.createBuffer(1, len, sr);
      const data = buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){
        data[i] = (Math.random()*2 - 1) * (0.6 + Math.random()*0.4);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      // small random detune to avoid perfectly repeating artifact
      try{ src.playbackRate.value = 0.9 + Math.random()*0.2; }catch(e){}
      const biquad = ctx.createBiquadFilter();
      biquad.type = 'bandpass';
      biquad.frequency.value = 1200 + Math.random()*800;
      biquad.Q.value = 0.8 + Math.random()*0.8;
      const gain = ctx.createGain();
      // envelope: quick attack, sustain, then release near end
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.9, now + 0.02);
      // schedule release
      const total = Math.max(0.08, (durationMs||900)/1000);
      gain.gain.setValueAtTime(0.9, now + total - 0.08);
      gain.gain.linearRampToValueAtTime(0.0001, now + total);
      src.connect(biquad).connect(gain).connect(ctx.destination);
      src.start(now);
      // stop and close after duration
      setTimeout(()=>{ try{ src.stop(); ctx.close(); }catch(e){} }, Math.max(50, durationMs||900) + 150);
    }catch(e){}
  }

  function rollAnimation(finalVals, duration, rollingIndices){
    const start = Date.now();
    const ticks = 16;
    const interval = Math.max(30, Math.floor((duration||900)/ticks));
    let t = 0;
    // add rolling class to enable 3D animation
    if(board) board.classList.add('rolling');
    // play dice sound (user gesture required - doRoll is triggered by click)
    try{ playDiceRattle(duration||900); }catch(e){}
    const iv = setInterval(()=>{
      t++;
      const tmp = [rollOnce(), rollOnce(), rollOnce()];
      // rollingIndices provided by caller
      rollingIndices = Array.isArray(rollingIndices) ? rollingIndices : (rollCount===0? [0,1,2] : (()=>{ const r=[]; for(let i=0;i<3;i++) if(selected[i]) r.push(i); return r; })());
      const tmpShow = tmp.slice();
      for(let i=0;i<3;i++){
        if(rollingIndices.indexOf(i) === -1){
          tmpShow[i] = (typeof dice[i] !== 'undefined' && dice[i] !== '' && dice[i] !== null) ? dice[i] : (finalVals && Array.isArray(finalVals) ? finalVals[i] : tmp[i]);
        }
      }
      renderDice(tmpShow);
      // after rendering, mark dice elements that are rolling with class 'anim'
      try{ Array.prototype.forEach.call(board.children, function(el, i){ el.classList.toggle('anim', rollingIndices.indexOf(i) !== -1); }); }catch(e){}
      if(Date.now() - start > duration || t>=ticks){
        clearInterval(iv);
        renderDice(finalVals);
        try{ /* final preview handled after animation by updateUIAfterRoll/finishTurn */ }catch(e){}
        // remove rolling animation and add a quick pop effect on final faces
        if(board) board.classList.remove('rolling');
        try{
          Array.prototype.forEach.call(board.children, function(el){ if(el.classList.contains('anim')) el.classList.add('pop'); });
          setTimeout(function(){ Array.prototype.forEach.call(board.children, function(el){ el.classList.remove('pop'); el.classList.remove('anim'); }); }, 320);
        }catch(e){}
        if(is421(finalVals)){
          status.textContent = '421 ! Bravo !';
          status.style.color = '#0b5fff';
        } else {
          status.textContent = finalVals.join(' - ');
          status.style.color = '';
        }
      }
    }, interval);
  }

  function doRoll(){
    if(!board) return;
    if(rollCount >= maxRolls){
      status.textContent = 'Plus de lancers disponibles pour ce tour.';
      return;
    }
    // if an auto-finalize timer exists from a previous action, clear it (user is rolling again)
    if(autoFinalizeTimer){ clearTimeout(autoFinalizeTimer); autoFinalizeTimer = null; }
    status.textContent = '...';
    // determine which dice to roll
    let vals = dice.slice();
    if(rollCount === 0){
      // first roll: roll all
      vals = [rollOnce(), rollOnce(), rollOnce()];
    } else {
      // reroll only the dice that are selected (selected === will be re-rolled)
      for(let i=0;i<3;i++) if(selected[i]) vals[i] = rollOnce();
    }
    // determine which dice indices will be rolled in this action
    const rollingIndices = (rollCount === 0) ? [0,1,2] : (function(){ const r=[]; for(let i=0;i<3;i++) if(selected[i]) r.push(i); return r; })();
    rollCount++;
    // do NOT clear kept selections after a roll - user keeps chosen dice until they toggle them
    const animDuration = 900;
    rollAnimation(vals, animDuration, rollingIndices);
    // update internal state and UI after animation completes
    setTimeout(()=>{
      dice = vals.slice();
      updateUIAfterRoll();
    }, animDuration + 80);
  }

  function updateUIAfterRoll(){
    // update selection visuals
    Array.prototype.forEach.call(board.children, function(el, i){
      // `selected` now means this die WILL be re-rolled; show a border
      el.classList.toggle('selected', !!selected[i]);
    });
    // accept button enabled only after at least one roll and before max rolls
    try{
      const btn = document.getElementById('accept421Btn');
      if(btn) btn.disabled = !(rollCount > 0);
    }catch(e){}
    // update remaining rolls display (show 3,2,1)
    try{ if(remainingRollsEl) remainingRollsEl.textContent = String(Math.max(0, maxRolls - rollCount)); }catch(e){}
    // if max rolls reached, disable roll button
    if(rollCount >= maxRolls){ rollBtn && (rollBtn.disabled = true); }
    // if we've exhausted the allowed rolls, schedule an automatic validation after a short delay
    if(rollCount >= maxRolls){
      try{ const btn = document.getElementById('accept421Btn'); if(btn) btn.disabled = true; }catch(e){}
      try{
        status.textContent = 'Validation automatique...';
        // short delay to allow players to see the final faces
        autoFinalizeTimer = setTimeout(()=>{ autoFinalizeTimer = null; try{ finishTurn(); }catch(e){} }, 900);
      }catch(e){}
      return;
    }
    // store provisional result for this round
    const pid = players[currentPlayerIndex].id;
    currentRoundResults[pid] = { dice: dice.slice(), eval: evaluateDice(dice.slice()) };
    // update status text
    status.textContent = is421(dice) ? '421 !' : `${dice.join(' - ')}`;
    // highlight the corresponding combo in the combos table on every roll
    try{
      const ev = evaluateDice(dice.slice());
      const t = tokensForDice(dice.slice());
      highlightCombo((ev && ev.label) ? ev.label : undefined, t, (ev && typeof ev.score !== 'undefined') ? ev.score : undefined);
    }catch(e){}
  }

  if(rollBtn) rollBtn.addEventListener('click', doRoll);
  const acceptBtn = document.getElementById('accept421Btn');
  if(acceptBtn){
    acceptBtn.addEventListener('click', function(){ if(rollCount>0){ finishTurn(); } });
    acceptBtn.disabled = true;
  }
  // hide Terminer button: validation must go through Accepter
  try{ if(endTurnBtn) endTurnBtn.style.display = 'none'; }catch(e){}

  function reset421(){
    // reset UI and state
    board.innerHTML='';
    status.textContent='';
    rollCount = 0;
    dice = ['','',''];
    selected = [false,false,false];
    rollBtn.disabled = false;
    currentPlayerIndex = 0;
    // clear any combo highlight in the combos table
    try{
      const combosEl = document.getElementById('fourtwooneCombos');
      if(combosEl){
        combosEl.querySelectorAll('.combo-cell.combo-active').forEach(n=>n.classList.remove('combo-active'));
        combosEl.querySelectorAll('td.combo-active-td').forEach(n=>n.classList.remove('combo-active-td'));
        combosEl.querySelectorAll('tr.combo-active').forEach(n=>n.classList.remove('combo-active'));
      }
    }catch(e){}
    // clear transfers log
    try{ const t = document.getElementById('fourtwooneTransfers'); if(t) t.innerHTML = ''; }catch(e){}
    // reset pot and tokens for new game start
    pot = 21;
    players.forEach(p=>{ tokens[p.id] = 0; figures[p.id] = ''; });
    gamePhase = 1;
    justReachedZero = null;
    // clear history
    history._rounds = [];
    saveTokens(); savePot(); saveHistory();
    renderHistory(true);
    updatePlayerUI();
    renderPlayerTokens();
    renderPhaseUI();
    try{ if(remainingRollsEl) remainingRollsEl.textContent = String(Math.max(0, maxRolls - rollCount)); }catch(e){}
    try{ const b = document.getElementById('accept421Btn'); if(b) b.disabled = true }catch(e){}
  }
  window.reset421 = reset421;
  if(resetBtn){ resetBtn.addEventListener('click', reset421) }

  function checkRoundComplete(){
    const all = players.every(p => currentRoundResults[p.id]);
    if(!all) return;
    const results = players.map(p=>({ pid: p.id, name: p.name, dice: currentRoundResults[p.id].dice, eval: currentRoundResults[p.id].eval }));
    results.sort((a,b)=> b.eval.score - a.eval.score);
    const roundLabel = `M${roundIndex+1}`;
    // persist history at round end (disabled)
    roundIndex++;
    currentRoundResults = {};
    renderHistory();
    const winner = results[0];
    const loser = results[results.length-1];
    // apply transfers according to current phase rules
    applyRoundTransfers(results);
    renderPlayerTokens();
    status.textContent = `Tour ${roundLabel} — gagnant: ${winner.name} (${winner.eval.label})`;
    // handle decharge end condition: count rounds in phase 2
    if(gamePhase === 2){
      if(justEnteredPhase2){
        // the phase2 state was entered during the transfer resolution of the previous phase;
        // do not count this current round as a decharge round — wait for the next round.
        justEnteredPhase2 = false;
        dechargeRounds = 0;
      } else {
        dechargeRounds = (dechargeRounds || 0) + 1;
      }
    }
    // if we are in décharge and at least one décharge round completed, end the game
    // as soon as any player has 0 tokens after this round
    if(gamePhase === 2 && dechargeRounds >= 1){
      const zeroPlayer = players.find(p => (tokens[p.id]||0) === 0);
      if(zeroPlayer){
        renderPlayerTokens();
        try{ showWinnerBanner(zeroPlayer.name); }catch(e){}
        justReachedZero = null;
        return; // stop further round initialization
      }
    }
    // next round starts with first player (wrap to J1)
    currentPlayerIndex = 0;
    renderPhaseUI();
  }

  function finishTurn(){
    // finalize current player's turn and move to next
    // clear any pending auto-finalize timer
    if(autoFinalizeTimer){ clearTimeout(autoFinalizeTimer); autoFinalizeTimer = null; }
    rollCount = 0;
    selected = [false,false,false];
    rollBtn.disabled = false;
    // record final result for this player (always use current dice — ensures 3rd roll is taken)
    const pid = players[currentPlayerIndex].id;
    currentRoundResults[pid] = { dice: dice.slice(), eval: evaluateDice(dice.slice()) };
    // store figure (label + dice) for player UI
    try{ figures[pid] = { label: (currentRoundResults[pid].eval && currentRoundResults[pid].eval.label) ? currentRoundResults[pid].eval.label : '', dice: currentRoundResults[pid].dice.slice() }; }catch(e){}
    // update players table immediately
    try{ renderPlayerTokens(); }catch(e){}
    // highlight the finalized combination in the combos table
    try{
      const vals = currentRoundResults[pid].dice.slice();
      const ev = evaluateDice(vals);
      const t = tokensForDice(vals);
      highlightCombo((ev && ev.label) ? ev.label : undefined, t, (ev && typeof ev.score !== 'undefined') ? ev.score : undefined);
    }catch(e){}
    checkRoundComplete();
    // advance to next player only if the round didn't complete
    if(Object.keys(currentRoundResults).length === 0){
      // round completed: `checkRoundComplete` already set `currentPlayerIndex` to loser
    } else {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    }
    dice = [6,6,6];
    renderDice(dice);
    updatePlayerUI();
    try{ if(remainingRollsEl) remainingRollsEl.textContent = String(Math.max(0, maxRolls - rollCount)); }catch(e){}
    status.textContent = '';
    try{ const b = document.getElementById('accept421Btn'); if(b) b.disabled = true }catch(e){}
  }

  function updatePlayerUI(){
    // current player label removed from UI — keep function as no-op to preserve call sites
    return;
  }

  function renderHistory(clear){
    if(clear){ for(const k in history) if(k!=='_rounds') delete history[k]; }
    if(!historyEl) return;
    historyEl.innerHTML = '';
    // render round summaries
    if(history._rounds && history._rounds.length){
      history._rounds.forEach(r=>{
        const h = document.createElement('div');
        h.style.marginBottom = '6px';
        h.innerHTML = `<strong>${escapeHtml(r.round)}</strong>: ` + (r.results && r.results.length ? r.results.map(rr=>escapeHtml(`${rr.name} (${rr.label}) ${rr.tokens? '('+rr.tokens+'j)':''}`)).join(', ') : '');
        historyEl.appendChild(h);
      });
    }
  }

  // init three dice (start with three sixes) and give them a marbled texture
  renderDice(dice.slice());
  try{ document.querySelectorAll('#fourTwoOneBoard .die').forEach(d=>d.classList.add('marble')); }catch(e){}
  // load history from storage
  loadHistory();
  // load pot and determine phase
  loadPot();
  gamePhase = (pot && pot>0) ? 1 : 2;
  // ensure players reflect current selection
  updatePlayersFromState();
  renderCombosTable();
  renderPlayerTokens();
  updatePlayerUI();
  try{ if(remainingRollsEl) remainingRollsEl.textContent = String(Math.max(0, maxRolls - rollCount)); }catch(e){}
  renderHistory(true);
  renderPhaseUI();

  // Winner modal controls for 421
  function showWinnerBanner(name){
    try{
      const m = document.getElementById('fourtwooneWinnerModal');
      const title = document.getElementById('fourtwooneWinnerTitle');
      const text = document.getElementById('fourtwooneWinnerText');
      if(title) title.textContent = 'Partie terminée';
      if(text) text.textContent = `Le vainqueur est ${name}`;
      if(m) m.classList.remove('hidden');
      try{ if(rollBtn) rollBtn.disabled = true; }catch(e){}
      try{ const ab = document.getElementById('accept421Btn'); if(ab) ab.disabled = true; }catch(e){}
    }catch(e){}
  }
  function hideWinnerBanner(){ try{ const m = document.getElementById('fourtwooneWinnerModal'); if(m) m.classList.add('hidden'); }catch(e){} }
  const btnRejouer = document.getElementById('btnRejouer421');
  if(btnRejouer) btnRejouer.addEventListener('click', function(){ hideWinnerBanner(); try{ if(resetBtn) resetBtn.click(); }catch(e){} });
  const btnRetourPlayers = document.getElementById('btnRetourPlayers421');
  if(btnRetourPlayers) btnRetourPlayers.addEventListener('click', function(){ hideWinnerBanner(); try{ document.getElementById('listsTab').classList.remove('hidden'); document.getElementById('421Tab').classList.add('hidden'); }catch(e){} });

  // allow clicking pot display to set initial pot
  try{
    const potEl = document.getElementById('fourtwoonePotDisplay');
    if(potEl){ potEl.addEventListener('click', function(){ const v = prompt('Montant initial du pot (jetons)', String(pot||0)); if(v!==null){ const n = Number(v)||0; pot = Math.max(0, Math.floor(n)); // reset player tokens for phase 1
      players.forEach(p=>{ tokens[p.id] = 0 });
      saveTokens();
      savePot();
      gamePhase = pot>0?1:2;
      renderPlayerTokens(); renderPhaseUI(); } }); }
  }catch(e){}

  // Re-sync players/tokens when the 421 tab is opened
  const tabBtn = document.getElementById('tab421Btn');
  if(tabBtn){
    tabBtn.addEventListener('click', function(){
      updatePlayersFromState();
      renderPlayerTokens();
      renderHistory && renderHistory(false);
      updatePlayerUI && updatePlayerUI();
      // Ajout : toujours afficher le tableau des combinaisons avec les dés
      renderCombosTable && renderCombosTable();
    });
  }

  // Also sync once on window load (after main app init has run)
  window.addEventListener('load', function(){ updatePlayersFromState(); renderPlayerTokens(); updatePlayerUI(); });

  // Debounce helper for observer
  function debounce(fn, wait){ let t; return function(){ clearTimeout(t); t = setTimeout(()=>fn.apply(this, arguments), wait||150); } }

  // Observe DOM changes to refresh players/tokens when the user moves players in the main UI
  try{
    const observer = new MutationObserver(debounce(function(muts){
      // simple safe refresh: re-read state.game and update tokens UI
      updatePlayersFromState();
      renderPlayerTokens();
      updatePlayerUI();
    }, 180));
    observer.observe(document.body, { childList:true, subtree:true, attributes:true });
  }catch(e){ /* ignore */ }
});

// small helper used in history rendering
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c)) }
