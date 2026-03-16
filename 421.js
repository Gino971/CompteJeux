document.addEventListener('DOMContentLoaded', function(){
  const board = document.getElementById('fourTwoOneBoard');
  const rollBtn = document.getElementById('roll421Btn');
  const resetBtn = document.getElementById('reset421Btn');
  const status = document.getElementById('roll421Status');
  const endTurnBtn = document.getElementById('end421TurnBtn');
  const currentPlayerEl = document.getElementById('current421Player');
  const rollCountEl = document.getElementById('current421RollCount');
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
  const TOKENS_KEY = 'scorekeeper_421_tokens_v1';
  const HISTORY_KEY = 'scorekeeper_421_history_v1';
  const POT_KEY = 'scorekeeper_421_pot_v1';

  // game phase: 1 = distribution from pot, 2 = give tokens to loser to get rid of them
  let gamePhase = 1;
  let pot = 0;

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
  function savePot(){ try{ localStorage.setItem(POT_KEY, JSON.stringify(Number(pot||0))) }catch(e){} }

  function renderPhaseUI(){
    try{
      const phaseEl = document.getElementById('fourtwoonePhaseLabel');
      const potEl = document.getElementById('fourtwoonePotDisplay');
      if(phaseEl) phaseEl.textContent = `Phase: ${gamePhase === 1 ? 'Charge' : 'Décharge'}`;
      if(potEl) potEl.textContent = `Pot: ${pot}`;
    }catch(e){}
  }

  function loadTokens(){
    try{
      const raw = localStorage.getItem(TOKENS_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === 'object'){
          for(const k in parsed){ tokens[k] = Number(parsed[k]) || 0 }
        }
      }
    }catch(e){ /* ignore */ }
    // ensure defaults for current players (start with 0 tokens)
    players.forEach(p=>{ if(typeof tokens[p.id] === 'undefined') tokens[p.id] = 0 });
  }

  function saveTokens(){
    try{ localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens)); }catch(e){}
  }

  function loadHistory(){
    try{
      // disable loading previous history — clear stored history
      try{ localStorage.removeItem(HISTORY_KEY); }catch(e){}
      history._rounds = [];
    }catch(e){ history._rounds = []; }
  }

  function saveHistory(){
    // history persistence disabled
    return;
  }

  // initialize tokens from storage
  loadTokens();

  players.forEach(p=>{ if(typeof tokens[p.id] === 'undefined') tokens[p.id] = 0 });

  function updatePlayersFromState(){
    const s = (typeof state !== 'undefined' && Array.isArray(state.game) && state.game.length) ? state.game.slice() : ((window.state && Array.isArray(window.state.game) && window.state.game.length) ? window.state.game.slice() : [{ id: 'solo', name: 'Joueur' }]);
    players = s;
    // ensure tokens exist for new players
    players.forEach(p=>{ if(typeof tokens[p.id] === 'undefined') tokens[p.id] = 0 });
    // persist any changes
    saveTokens();
  }
  let currentPlayerIndex = 0;
  let rollCount = 0; // number of rolls done this turn (max 3)
  const maxRolls = 3;
  let dice = [null,null,null];
  let selected = [false,false,false]; // which dice are kept (true = keep). default none kept before first roll
  const history = {};
  let currentRoundResults = {}; // pid -> { dice, eval }
  let roundIndex = 0;
  let autoFinalizeTimer = null;

  function createDieEl(value, idx){
    const d = document.createElement('div');
    d.className = 'die';
    // clickable to toggle selection between rolls
    d.addEventListener('click', function(){
      if(rollCount === 0 || rollCount >= maxRolls) return;
      const idxLocal = Array.prototype.indexOf.call(board.children, d);
      const i = (typeof idx === 'number') ? idx : idxLocal;
      if(i === -1) return;
      // toggle keep state (selected true means kept)
      selected[i] = !selected[i];
      d.classList.toggle('selected', selected[i]);
      d.classList.toggle('kept', selected[i]);
    });
    // if numeric value provided, render pips
    if(value && Number(value)){
      const n = Number(value);
      const pips = document.createElement('div');
      pips.className = 'pips';
      const positions = {
        1: [5],
        2: [1,9],
        3: [1,5,9],
        4: [1,3,7,9],
        5: [1,3,5,7,9],
        6: [1,4,7,3,6,9]
      };
      const map = positions[n] || [];
      // always render nine slot elements to keep layout stable
      for(let i=1;i<=9;i++){
        const slot = document.createElement('span');
        slot.className = 'pip pos-'+i;
        if(map.indexOf(i)===-1) slot.classList.add('hidden-pip');
        pips.appendChild(slot);
      }
      d.appendChild(pips);
    }
    // reflect current kept state if index passed
    if(typeof idx === 'number' && selected[idx]){
      d.classList.add('selected');
      d.classList.add('kept');
    }
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

    function miniDieHTML(v) {
      let html = '<div class="mini-die" data-value="' + v + '">';
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          html += '<span class="pip"></span>';
        }
      }
      html += '</div>';
      return html;
    }

    function miniDiceRow(values) {
      return '<div class="mini-dice-row">' + values.map(v => miniDieHTML(v)).join('') + '</div>';
    }

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
      return `<tr data-player="${p.id}"><td>${escapeHtml(p.name)}</td><td class="actions"><span class="token-badge">${t}</span> <button class="token-btn" data-action="minus" data-player="${p.id}">-</button> <button class="token-btn" data-action="plus" data-player="${p.id}">+</button></td></tr>`;
    }).join('');
    el.innerHTML = rows;
    // attach handlers
    el.querySelectorAll('.token-btn').forEach(btn => btn.addEventListener('click', function(){
      const pid = this.getAttribute('data-player');
      const act = this.getAttribute('data-action');
      if(!pid) return;
      if(act==='plus'){ tokens[pid] = (tokens[pid]||0)+1 } else { tokens[pid] = Math.max(0,(tokens[pid]||0)-1) }
      saveTokens();
      renderPlayerTokens();
    }));
  }

  function renderComboInfo(vals){
    try{
      const labelEl = document.getElementById('fourtwooneComboLabel');
      const tokensEl = document.getElementById('fourtwooneComboTokens');
      if(!labelEl || !tokensEl) return;
      if(!vals || !Array.isArray(vals) || vals.length<3 || vals.every(v=>!v)){
        labelEl.textContent = 'Combinaison: —';
        tokensEl.textContent = 'Jetons: —';
        return;
      }
      const evalRes = evaluateDice(vals.slice());
      const t = tokensForDice(vals.slice());
      const lab = (evalRes && evalRes.label ? evalRes.label : '—');
      labelEl.textContent = 'Combinaison: ' + lab;
      tokensEl.textContent = 'Jetons: ' + (typeof t === 'number' ? t : '—');
      // highlight in combos table
      highlightCombo(lab, t, (evalRes && typeof evalRes.score !== 'undefined') ? evalRes.score : undefined);
    }catch(e){}
  }

  function applyRoundTransfers(results){
    // results: ordered array (winner first) with { pid, name, dice }
    if(!results || !results.length) return;
    const winner = results[0];
    // determine loser as the player with the lowest combination value (tokensForDice)
    const tokenVals = results.map(r => ({ pid: r.pid, name: r.name, dice: r.dice, eval: r.eval, val: Number(tokensForDice(r.dice) || 0) }));
    let minVal = Math.min(...tokenVals.map(x=>x.val));
    let losers = tokenVals.filter(x=>x.val === minVal);
    let loser = null;
    if(losers.length === 1){ loser = losers[0]; }
    else {
      // tie-break: pick the one with the lowest eval.score
      losers.sort((a,b)=> a.eval.score - b.eval.score);
      loser = losers[0];
    }
    const transfers = [];
    if(gamePhase === 1){
      // Phase 1: loser receives tokens equal to the highest combination value among all players (from the pot)
      const bestVal = Math.max(0, ...results.map(r => Number(tokensForDice(r.dice) || 0)));
      const give = Math.min(bestVal, pot || 0);
      const beforeL = Number(tokens[loser.pid]||0);
      tokens[loser.pid] = beforeL + give;
      pot = Math.max(0, (pot||0) - give);
      transfers.push({ pid: loser.pid, name: loser.name, before: beforeL, delta: give, after: tokens[loser.pid] });
      saveTokens(); savePot();
      // attach transfers to last round entry in history if present
      if(history._rounds && history._rounds.length){ const last = history._rounds[history._rounds.length-1]; last.transfers = transfers; saveHistory(); }
      // if pot empty, switch to phase 2
      if((pot||0) <= 0){ gamePhase = 2; renderPhaseUI(); }
    } else {
      // Phase 2: winner gives tokens equal to his combination value to the loser (loser determined above)
      const giveVal = tokensForDice(winner.dice) || 0;
      const beforeW = Number(tokens[winner.pid]||0);
      const give = Math.min(giveVal, beforeW);
      tokens[winner.pid] = Math.max(0, beforeW - give);
      const beforeL = Number(tokens[loser.pid]||0);
      tokens[loser.pid] = beforeL + give;
      transfers.push({ pid: winner.pid, name: winner.name, before: beforeW, delta: -give, after: tokens[winner.pid] });
      transfers.push({ pid: loser.pid, name: loser.name, before: beforeL, delta: give, after: tokens[loser.pid] });
      saveTokens();
      if(history._rounds && history._rounds.length){ const last = history._rounds[history._rounds.length-1]; last.transfers = transfers; saveHistory(); }
      // check end condition: only one player left with tokens
      const playersWithTokens = players.filter(p=> (tokens[p.id]||0) > 0 ).length;
      if(playersWithTokens <= 1){
        // game over
        status.textContent = 'Partie terminée';
        rollBtn && (rollBtn.disabled = true);
      }
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

  function rollAnimation(finalVals, duration){
    const start = Date.now();
    const ticks = 12;
    const interval = Math.max(30, Math.floor((duration||420)/ticks));
    let t = 0;
    // add rolling class to enable 3D animation
    if(board) board.classList.add('rolling');
    const iv = setInterval(()=>{
      t++;
      const tmp = [rollOnce(), rollOnce(), rollOnce()];
      // show rolling only for dice that are not kept: kept dice display their current value
      const tmpShow = tmp.slice();
      for(let i=0;i<3;i++){
        if(selected[i]){
          // keep current visible value (prefer `dice[i]`, fall back to finalVals)
          tmpShow[i] = (typeof dice[i] !== 'undefined' && dice[i] !== '' && dice[i] !== null) ? dice[i] : (finalVals && Array.isArray(finalVals) ? finalVals[i] : tmp[i]);
        }
      }
      renderDice(tmpShow);
      if(Date.now() - start > duration || t>=ticks){
        clearInterval(iv);
        renderDice(finalVals);
        try{ /* final preview handled after animation by updateUIAfterRoll/finishTurn */ }catch(e){}
        // remove rolling animation and add a quick pop effect on final faces
        if(board) board.classList.remove('rolling');
        try{
          Array.prototype.forEach.call(board.children, function(el){ if(!el.classList.contains('kept')) el.classList.add('pop'); });
          setTimeout(function(){ Array.prototype.forEach.call(board.children, function(el){ if(!el.classList.contains('kept')) el.classList.remove('pop'); }); }, 320);
        }catch(e){}
        if(is421(finalVals)){
          status.textContent = '421 ! Bravo !';
          status.style.color = '#0b5fff';
        } else {
          status.textContent = 'Résultat: ' + finalVals.join(' - ');
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
      // reroll dice that are NOT kept (selected == false)
      for(let i=0;i<3;i++) if(!selected[i]) vals[i] = rollOnce();
    }
    rollCount++;
    // do NOT clear kept selections after a roll - user keeps chosen dice until they toggle them
    rollAnimation(vals, 420);
    // update internal state and UI after short delay when animation completes
    setTimeout(()=>{
      dice = vals.slice();
      updateUIAfterRoll();
    }, 480);
  }

  function updateUIAfterRoll(){
    // update selection visuals
    Array.prototype.forEach.call(board.children, function(el, i){
      el.classList.toggle('selected', !!selected[i]);
      el.classList.toggle('kept', !!selected[i]);
    });
    // accept button enabled only after at least one roll and before max rolls
    try{
      const btn = document.getElementById('accept421Btn');
      if(btn) btn.disabled = !(rollCount > 0);
    }catch(e){}
    // update roll count display
    rollCountEl && (rollCountEl.textContent = `Lancer: ${rollCount}/${maxRolls}`);
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
    status.textContent = is421(dice) ? '421 !' : `Résultat: ${dice.join(' - ')}`;
    // combo info will be rendered only when the turn is finalized
  }

  if(rollBtn) rollBtn.addEventListener('click', doRoll);
  const acceptBtn = document.getElementById('accept421Btn');
  if(acceptBtn){
    acceptBtn.addEventListener('click', function(){ if(rollCount>0){ finishTurn(); } });
    acceptBtn.disabled = true;
  }
  // hide Terminer button: validation must go through Accepter
  try{ if(endTurnBtn) endTurnBtn.style.display = 'none'; }catch(e){}

  if(resetBtn){ resetBtn.addEventListener('click', function(){
    // reset UI and state
    board.innerHTML='';
    status.textContent='';
    rollCount = 0;
    dice = ['','',''];
    selected = [false,false,false];
    rollBtn.disabled = false;
    currentPlayerIndex = 0;
    // reset pot and tokens for new game start
    pot = 21;
    players.forEach(p=>{ tokens[p.id] = 0 });
    gamePhase = 1;
    // clear history
    history._rounds = [];
    saveTokens(); savePot(); saveHistory();
    renderHistory(true);
    updatePlayerUI();
    renderPlayerTokens();
    renderPhaseUI();
    rollCountEl && (rollCountEl.textContent = `Lancer: ${rollCount}/${maxRolls}`);
    try{ const b = document.getElementById('accept421Btn'); if(b) b.disabled = true }catch(e){}
  }) }

  function checkRoundComplete(){
    const all = players.every(p => currentRoundResults[p.id]);
    if(!all) return;
    const results = players.map(p=>({ pid: p.id, name: p.name, dice: currentRoundResults[p.id].dice, eval: currentRoundResults[p.id].eval }));
    results.sort((a,b)=> b.eval.score - a.eval.score);
    const roundLabel = `M${roundIndex+1}`;
    history._rounds = history._rounds || [];
      history._rounds.push({ round: roundLabel, results: results.map(r=>({ pid: r.pid, name: r.name, label: r.eval.label, tokens: tokensForDice(r.dice), dice: r.dice })) });
    // persist history at round end (transfers may be attached shortly after)
    saveHistory();
    roundIndex++;
    currentRoundResults = {};
    renderHistory();
    const winner = results[0];
    const loser = results[results.length-1];
    // apply transfers according to current phase rules
    applyRoundTransfers(results);
    renderPlayerTokens();
    status.textContent = `Tour ${roundLabel} — gagnant: ${winner.name} (${winner.eval.label})`;
    // next round starts with loser
    const nextIndex = players.findIndex(p=>p.id === loser.pid);
    if(nextIndex !== -1) currentPlayerIndex = nextIndex; else currentPlayerIndex = 0;
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
    // render combo info for the finalized combination so the combos table cell stays highlighted
    try{ renderComboInfo(currentRoundResults[pid].dice.slice()); }catch(e){}
    checkRoundComplete();
    // advance to next player only if the round didn't complete
    if(Object.keys(currentRoundResults).length === 0){
      // round completed: `checkRoundComplete` already set `currentPlayerIndex` to loser
    } else {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    }
    dice = ['','',''];
    renderDice(dice);
    updatePlayerUI();
    rollCountEl && (rollCountEl.textContent = `Lancer: ${rollCount}/${maxRolls}`);
    status.textContent = '';
    try{ const b = document.getElementById('accept421Btn'); if(b) b.disabled = true }catch(e){}
  }

  function updatePlayerUI(){
    if(currentPlayerEl) currentPlayerEl.textContent = `Joueur: ${players[currentPlayerIndex] && players[currentPlayerIndex].name ? players[currentPlayerIndex].name : '—'}`;
  }

  function renderHistory(clear){
    // history display disabled — clear UI
    if(!historyEl) return;
    historyEl.innerHTML = '';
    return;
  }

  // init three empty dice
  renderDice(['','', '']);
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
  rollCountEl && (rollCountEl.textContent = `Lancer: ${rollCount}/${maxRolls}`);
  renderHistory(true);
  renderPhaseUI();

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
  if(tabBtn){ tabBtn.addEventListener('click', function(){ updatePlayersFromState(); renderPlayerTokens(); renderHistory(false); updatePlayerUI(); }) }

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
