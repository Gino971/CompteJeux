// Standalone app (no Electron/Capacitor). Uses localStorage only.
// const STORAGE_KEY = 'scorekeeper_history_v1' // supprimé
const LISTS_KEY = 'scorekeeper_lists_v1'
const BOARD_KEY = 'scorekeeper_board_v1'
const $ = id => document.getElementById(id)
let state = { available: [], game: [], board: { rounds: [], players: [] }, timer: { duration: 60, remaining: 60, running: false } } // history supprimé
// ODS wordlist set (loaded from ods8.txt if present)
let odsSet = null
let odsAvailable = false

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

async function init(){
  // attempt to load local ODS file (non-blocking if missing)
  await loadODS()
  updateODSStatus()
  bind()
  loadLists()
  // loadHistory() supprimé
  loadBoard()
  renderAll()
  // renderHistory() supprimé
}

async function loadODS(){
  odsSet = null
  odsAvailable = false
  try{
    const r = await fetch('ods8.txt')
    if(r && r.ok){
      const txt = await r.text()
      const lines = txt.split(/\r?\n/)
      odsSet = new Set()
      for(const l of lines){ const w = (l||'').trim(); if(!w) continue; odsSet.add(normalizeWord(w)) }
      if(odsSet.size) odsAvailable = true
      return
    }
  }catch(e){}
  // fallback to embedded seed element
  try{
    const seed = document.getElementById('seed-ods')
    if(seed){
      const words = (seed.textContent || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
      if(words.length){ odsSet = new Set(words.map(w=>normalizeWord(w))); odsAvailable = true; return }
    }
  }catch(e){}
  odsSet = null
  odsAvailable = false
}

function updateODSStatus(){
  const el = document.getElementById('odsStatus')
  if(!el) return
  // Ne pas afficher le statut ODS dans l'UI
  el.textContent = ''
}

// Normalize a word: remove diacritics and uppercase for accent-insensitive comparisons
function normalizeWord(w){
  if(!w) return '';
  try{
    return String(w).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  }catch(e){
    return String(w).toUpperCase();
  }
}

function bind(){
  // Track next intended input target (mousedown/pointerdown happens before blur/change)
  document.addEventListener('pointerdown', function(e){
    try{
        var t = e.target && e.target.closest && e.target.closest('input.yams-input');
      if(t){ window.__yamsNextFocus = { player: t.getAttribute('data-player'), fig: t.getAttribute('data-fig') }; } else { window.__yamsNextFocus = null }
    }catch(e){ window.__yamsNextFocus = null }
  }, true);

  const _tabLists = $('tabListsBtn'); if(_tabLists) _tabLists.addEventListener('click', ()=>showTab('lists'))
  const _tabYams = $('tabYamsBtn'); if(_tabYams) _tabYams.addEventListener('click', ()=>{ renderYams(); showTab('yams') })
  const _tabSimon = $('tabSimonBtn'); if(_tabSimon) _tabSimon.addEventListener('click', ()=> showTab('simon'))
  const _tabTimer = $('tabTimerBtn'); if(_tabTimer) _tabTimer.addEventListener('click', ()=> showTab('timer'))
  // Bouton reset Yams
  setTimeout(()=>{
    const btn = $('yamsResetBtn');
    if(btn) btn.addEventListener('click', function(){
      if(!confirm('Remettre à zéro le tableau Yams ?')) return;
      window.yamsState = {};
      renderYams();
    });
  }, 300);
  const _addPlayerInput = $('addPlayerInput')
  if(_addPlayerInput){
    const _submitAdd = (e) => {
      try{ console.log('submitAdd event', e && e.type, e && (e.key || e.keyCode)) }catch(e){}
      const isEnter = e && (e.key === 'Enter' || e.key === 'Return' || e.keyCode === 13 || e.which === 13)
      if(!isEnter) return
      // prevent double submission from multiple key events
      if(_addPlayerInput.dataset._submitted === '1') return
      _addPlayerInput.dataset._submitted = '1'
      setTimeout(()=>{ delete _addPlayerInput.dataset._submitted }, 400)
      try{ e.preventDefault() }catch(e){}
      const v = (_addPlayerInput.value||'').trim()
      if(v){ addAvailable(v); _addPlayerInput.value = '' }
    }
    _addPlayerInput.addEventListener('keydown', _submitAdd)
    _addPlayerInput.addEventListener('keypress', _submitAdd)
    _addPlayerInput.addEventListener('keyup', _submitAdd)
    _addPlayerInput.addEventListener('input', (e)=>{ try{ console.log('addPlayerInput input', e.data) }catch(e){} })
    const _addPlayerBtn = $('addPlayerBtn')
    if(_addPlayerBtn){
      const _btnHandler = (ev) => { try{ console.log('addPlayerBtn event', ev && ev.type) }catch(e){} ev.preventDefault(); const v = (_addPlayerInput.value||'').trim(); if(!v) return; addAvailable(v); _addPlayerInput.value=''; _addPlayerInput.focus(); }
      _addPlayerBtn.addEventListener('click', _btnHandler)
      _addPlayerBtn.addEventListener('touchend', _btnHandler)
      _addPlayerBtn.addEventListener('pointerup', _btnHandler)
    }
    const _addPlayerForm = $('addPlayerForm')
    if(_addPlayerForm){ _addPlayerForm.addEventListener('submit', (ev)=>{ try{ ev.preventDefault() }catch(e){} const v = (_addPlayerInput.value||'').trim(); if(!v) return; addAvailable(v); _addPlayerInput.value=''; _addPlayerInput.focus(); }) }
  }
  // Click / touch handler for general list: row click = move to game; trash button = delete
  (function(){
    const list = $('generalTbody')
    if(!list) return
    const handler = (e) => {
      // Fallback universel : suppression sur tous les événements
      const delBtn = e.target.closest('.del');
      if(delBtn) {
        const tr = delBtn.closest('tr');
        if(!tr) return;
        const id = tr.dataset.id;
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
        deleteAvailable(id);
        return;
      }
      const tr = e.target.closest('tr');
      if(!tr) return;
      moveToGame(tr.dataset.id);
    }
    list.addEventListener('touchend', handler)
    list.addEventListener('pointerup', handler)
    list.addEventListener('click', handler)
  })()
  $('gameTbody').addEventListener('click', e=>{ const tr=e.target.closest('tr'); if(!tr) return; moveToAvailable(tr.dataset.id) })
  $('startGameBtn').addEventListener('click', ()=>startGame())
  $('endGameBtn').addEventListener('click', ()=>endGame())
  const _nextRoundBtn = $('nextRoundBtn')
  if(_nextRoundBtn) _nextRoundBtn.addEventListener('click', ()=>nextRound())
  const _resetScoresBtn = $('resetScoresBtn')
  if(_resetScoresBtn) _resetScoresBtn.addEventListener('click', ()=>resetBoard())
  // timer hooks
  const _timerStart = $('timerStartBtn')
  const _timerStop = $('timerStopBtn')
  const _timerDuration = $('timerDuration')
  if(_timerStart){ _timerStart.addEventListener('click', ()=>{ const v = Number((_timerDuration && _timerDuration.value) || 0); if(!v || v <= 0) return alert('Durée invalide'); startTimer(v) }) }
  if(_timerStop){ _timerStop.addEventListener('click', ()=> stopTimer()) }
  // word checker hooks
  const _wordCheckBtn = $('wordCheckBtn')
  const _wordCheckInput = $('wordCheckInput')
  if(_wordCheckBtn){
    _wordCheckBtn.addEventListener('click', ()=>{
      const w = (_wordCheckInput && _wordCheckInput.value||'').trim();
      if(!w) return alert('Entrez un mot');
      const bw = $('boardWordcheck'); if(bw){ bw.classList.add('active'); bw.setAttribute('aria-hidden','false') }
      checkWord(w).then(r=>{
        try{ showWordResult(r,w) }catch(e){}
        try{ if(_wordCheckInput){ _wordCheckInput.value=''; _wordCheckInput.focus(); } }catch(e){}
      })
    })
  }
  if(_wordCheckInput){ _wordCheckInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ _wordCheckBtn && _wordCheckBtn.click() } }) }
  try{
    $('modalSave').addEventListener('click', ()=>{ try{ doEndGameSave() }catch(e){ console.error('save error',e) } finally{ hideModal() } })
    $('modalResume').addEventListener('click', ()=>{ hideModal() })
    $('modalReset').addEventListener('click', ()=>{ try{ state.board={rounds:[],players:[]} ; persistBoard(); renderBoard(); showTab('lists') }catch(e){ console.error('reset error', e) } finally{ hideModal() } })
    // quit button: try to close window, fallback to goodbye screen
    const modalQuit = document.createElement('button')
    modalQuit.id = 'modalQuit'
    modalQuit.type = 'button'
    modalQuit.className = 'btn ghost'
    modalQuit.textContent = 'Quitter'
    const parent = $('modalSave').parentNode
    parent.appendChild(modalQuit)
    modalQuit.addEventListener('click', ()=>{
      try{ window.close(); }catch(e){ /* fallback */ }
      try{
        document.body.innerHTML = `
          <div class="goodbye-screen">
            <div class="goodbye-inner">
              <h1>À bientôt</h1>
              <p>Tu peux fermer cet onglet.</p>
            </div>
          </div>`
      }catch(e){}
    })
  }catch(e){ console.warn('modal hooks attach failed', e) }
  // allow clicking backdrop to close modal and Esc to dismiss
  const _modal = $('endGameModal')
  if(_modal){
    _modal.addEventListener('click', (ev)=>{ if(ev.target === _modal) hideModal() })
  }
  document.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape') hideModal() })
}

function showTab(name){
  const bw = $('boardWordcheck')
  // hide all main tabs first
  const ids = ['listsTab','boardTab','yamsTab','simonTab','timerTab']
  ids.forEach(id => { const el = document.getElementById(id); if(!el) return; el.classList.add('hidden') })
  if(bw) { bw.classList.remove('active'); bw.setAttribute('aria-hidden','true') }
  // show requested tab
  if(name === 'lists') {
    $('listsTab').classList.remove('hidden')
  } else if(name === 'board') {
    $('boardTab').classList.remove('hidden')
    if(bw) { bw.classList.add('active'); bw.setAttribute('aria-hidden','false') }
  } else if(name === 'yams') {
    $('yamsTab').classList.remove('hidden')
  } else if(name === 'simon') {
    const st = $('simonTab'); if(st) st.classList.remove('hidden')
  } else if(name === 'timer') {
    const tt = $('timerTab'); if(tt) tt.classList.remove('hidden')
  }
}



function addAvailable(name){
  try{ console.log('addAvailable called with:', name) }catch(e){}
  const p = { id: uid(), name };
  state.available.push(p);
  try{ console.log('state.available.length =', state.available.length, 'state.available=', state.available) }catch(e){}
  persistLists();
  try{ renderGeneral(); }catch(e){ try{ console.error('renderGeneral failed', e) }catch(_){} }
  try{ renderGame(); }catch(e){}
  // small visual feedback (toast)
  try{
    let t = document.getElementById('addToast')
    if(!t){ t = document.createElement('div'); t.id='addToast'; Object.assign(t.style,{position:'fixed',bottom:'16px',right:'16px',background:'#10b981',color:'#fff',padding:'8px 12px',borderRadius:'8px',zIndex:99999,boxShadow:'0 6px 20px rgba(0,0,0,0.2)'}); document.body.appendChild(t) }
    t.textContent = `+ ${name}`
    t.style.opacity = '1'
    setTimeout(()=>{ try{ t.style.transition='opacity 350ms'; t.style.opacity='0' }catch(e){} }, 800)
  }catch(e){}
}
function moveToGame(id){ const i=state.available.findIndex(p=>p.id===id); if(i===-1) return; const [p]=state.available.splice(i,1); state.game.push(p); persistLists(); renderAll() }
function moveToAvailable(id){ const i=state.game.findIndex(p=>p.id===id); if(i===-1) return; const [p]=state.game.splice(i,1); state.available.push(p); persistLists(); renderAll() }

function deleteAvailable(id){ const i = state.available.findIndex(p=>p.id===id); if(i===-1) return; state.available.splice(i,1); persistLists(); renderAll(); }

function renderAll(){ try{ renderGeneral() }catch(e){ console.error('renderAll.renderGeneral error',e) } try{ renderGame() }catch(e){ console.error('renderAll.renderGame error',e) } }
function renderGeneral(){
  try{
    const el = $('generalTbody');
    if(!el){ console.log('renderGeneral: #generalTbody not found'); return }
    el.innerHTML = state.available.map(p => {
      return `<tr data-id="${p.id}"><td class="name-col">${escapeHtml(p.name)}</td><td class="action-col"><button type="button" class="del" title="Supprimer" aria-label="Supprimer">🗑</button></td></tr>`
    }).join('')
  }catch(e){ try{ console.error('renderGeneral catch', e, 'state.available=', state.available) }catch(_){} }
}
function renderGame(){ $('gameTbody').innerHTML = state.game.map(p=>`<tr data-id="${p.id}"><td class="name-col">${escapeHtml(p.name)}</td></tr>`).join('') }

// Board
function startGame(){ if(state.game.length===0) return alert('Sélectionner des joueurs'); state.board={ rounds:[{id:1,scores:{}}], players: state.game.map(p=>({id:p.id,name:p.name})) }; persistBoard(); renderBoard(); showTab('board') }

function renderBoard(){
  const table = $('activeGameTableBoard')
  const thead = $('boardThead')
  const tbody = $('activeGameTbodyBoard')
  const tfoot = $('boardTfoot')

  // header (player names) — ensure it's the first row in the table
  const colWidth = 56; // pixel width for score columns
  const head = ['<tr><th>Manche</th>']
  state.board.players.forEach(p => head.push(`<th class="player-col" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</th>`))
  head.push('</tr>')
  if(thead) thead.innerHTML = head.join('')
  if(table && thead && thead.parentNode !== table) table.insertBefore(thead, table.firstChild)

  // body (rounds + inputs)
  let html = ''
  state.board.rounds.forEach((rnd, ridx) => {
    html += `<tr data-round="${ridx}"><td>M${ridx+1}</td>`
    state.board.players.forEach(p => {
      const v = (rnd.scores && (p.id in rnd.scores)) ? rnd.scores[p.id] : ''
      html += `<td><input type="text" class="board-score" data-player="${p.id}" data-round="${ridx}" value="${v}"/></td>`
    })
    html += '</tr>'
    const sub = state.board.players.map(p => {
      const cum = state.board.rounds.slice(0, ridx+1).reduce((s, rr) => s + Number((rr.scores && rr.scores[p.id])||0), 0)
      return `<td class="subtotal-cell">${cum}</td>`
    })
    html += `<tr class="subtotal-row"><td>Sous-total M${ridx+1}</td>${sub.join('')}</tr>`
  })
  if(tbody) tbody.innerHTML = html

  // footer totals — ensure it's the last element in the table
  const totals = ['<tr><td>Total</td>']
  state.board.players.forEach(p => {
    const tot = state.board.rounds.reduce((s, r) => s + Number((r.scores && r.scores[p.id])||0), 0)
    totals.push(`<td class="player-total">${tot}</td>`)
  })
  totals.push('</tr>')
  if(tfoot) tfoot.innerHTML = totals.join('')
  if(table && tfoot && tfoot.parentNode !== table) table.appendChild(tfoot)

  // attach handlers
  if(tbody) tbody.querySelectorAll('.board-score').forEach(inp => { inp.addEventListener('keydown', onBoardEnter) })
  if(tbody) tbody.querySelectorAll('.board-score').forEach(inp => { inp.addEventListener('blur', onBoardBlur) })
}

function onBoardEnter(e){ if(e.key!=='Enter') return; e.preventDefault(); const pid = e.target.dataset.player; const ridx = Number(e.target.dataset.round); const raw = e.target.value.trim(); const val = raw===''?0:Number(raw); if(!state.board.rounds[ridx].scores) state.board.rounds[ridx].scores = {}; state.board.rounds[ridx].scores[pid]=val; persistBoard(); const players = state.board.players; const playerIdx = players.findIndex(p=>p.id===pid); const isLastPlayerInRound = playerIdx === players.length -1; const isLastRound = ridx === state.board.rounds.length -1; if(isLastPlayerInRound && isLastRound){ state.board.rounds.push({id:state.board.rounds.length+1,scores:{}}); persistBoard(); renderBoard(); const firstPlayerId = players.length?players[0].id:null; if(firstPlayerId){ const newInput = document.querySelector(`.board-score[data-round="${state.board.rounds.length-1}"][data-player="${firstPlayerId}"]`); if(newInput) newInput.focus() } } else { const nextRoundIdx = isLastPlayerInRound? (ridx+1) : ridx; const nextPlayerId = isLastPlayerInRound? players[0].id : players[playerIdx+1].id; renderBoard(); setTimeout(()=>{ const nextInput = document.querySelector(`.board-score[data-round="${nextRoundIdx}"][data-player="${nextPlayerId}"]`); if(nextInput) nextInput.focus() },0) } }

function onBoardBlur(e){ try{ const pid = e.target.dataset.player; const ridx = Number(e.target.dataset.round); const raw = (e.target.value||'').trim(); const val = raw===''?0:Number(raw); if(Number.isNaN(val)){ alert('Score invalide'); e.target.focus(); return } if(!state.board.rounds[ridx].scores) state.board.rounds[ridx].scores = {}; state.board.rounds[ridx].scores[pid]=val; persistBoard(); // Defer re-render so a click that caused this blur can reach its target
    try{
      const players = state.board.players || [];
      const playerIdx = players.findIndex(p=>p.id===pid);
      const isLastPlayerInRound = playerIdx === players.length -1;
      const isLastRound = ridx === state.board.rounds.length -1;
      if(isLastPlayerInRound && isLastRound){
        // add a new round but defer so the click that caused this blur reaches its target
        setTimeout(()=>{ try{ nextRound() }catch(e){ console.error(e) } }, 0);
      }else{
        try{ updateBoardTotals(); }catch(e){}
      }
    }catch(e){ console.error('onBoardBlur post-persist error', e) }
  }catch(err){ console.error('onBoardBlur error', err) } }

function updateBoardTotals(){
  try{
    if(!state.board || !state.board.players || !state.board.rounds) return;
    const players = state.board.players;
    // Update subtotals for each round
    const subtotalRows = document.querySelectorAll('#activeGameTableBoard .subtotal-row');
    state.board.rounds.forEach((rnd, ridx)=>{
      const row = subtotalRows[ridx];
      if(!row) return;
      const cells = row.querySelectorAll('.subtotal-cell');
      players.forEach((p, pi)=>{
        const cum = state.board.rounds.slice(0, ridx+1).reduce((s, rr) => s + Number((rr.scores && rr.scores[p.id])||0), 0);
        if(cells[pi]) cells[pi].textContent = cum;
      })
    })

    // Update footer totals
    const tfoot = document.getElementById('boardTfoot');
    if(tfoot){
      const totalCells = tfoot.querySelectorAll('.player-total');
      players.forEach((p, pi)=>{
        const tot = state.board.rounds.reduce((s, r) => s + Number((r.scores && r.scores[p.id])||0), 0);
        if(totalCells[pi]) totalCells[pi].textContent = tot;
      })
    }
  }catch(e){ console.error('updateBoardTotals error', e) }
}

function computeRowTotals(rnd){ if(!rnd||!rnd.scores) return 0; return Object.values(rnd.scores).reduce((s,v)=>s+Number(v||0),0) }
function nextRound(){ state.board.rounds.push({id:state.board.rounds.length+1,scores:{}}); persistBoard(); renderBoard() }

function endGame(){ showModal() }
function doEndGameSave(){ state.board = { rounds: [], players: [] }; persistBoard(); renderBoard(); showTab('lists') } // historique supprimé

function resetBoard(){ if(!confirm('Réinitialiser le tableau ?')) return; state.board = { rounds: [], players: [] }; persistBoard(); renderBoard(); showTab('lists') }

// persistence via localStorage only
function persistLists(){ try{ localStorage.setItem(LISTS_KEY, JSON.stringify({available:state.available,game:state.game})) }catch(e){} }
function loadLists(){ try{ const raw = localStorage.getItem(LISTS_KEY); if(raw){ const parsed = JSON.parse(raw); state.available = Array.isArray(parsed.available)?parsed.available:[]; state.game = Array.isArray(parsed.game)?parsed.game:[] } else { // seed from embedded
    const seed = document.getElementById('seed-players'); try{ const j = JSON.parse(seed.textContent); if(j && Array.isArray(j.players)){ state.available = j.players.map(n=>({id:uid(),name:n})) } }catch(e){} }
 }catch(e){ state.available=[]; state.game=[] } }

async function persistBoard(){ try{ localStorage.setItem(BOARD_KEY, JSON.stringify(state.board)) }catch(e){} }
function loadBoard(){ try{ const raw = localStorage.getItem(BOARD_KEY); if(raw){ state.board = JSON.parse(raw); return } // try seed
    const seed = document.getElementById('seed-board'); try{ const j = JSON.parse(seed.textContent); if(j && Array.isArray(j.rounds) && Array.isArray(j.players) && j.players.length>0){ state.board = j; localStorage.setItem(BOARD_KEY, JSON.stringify(j)); return } }catch(e){} state.board = { rounds: [], players: [] }
 }catch(e){ state.board = { rounds: [], players: [] } }
}

// fonctions persistHistory et loadHistory supprimées

function showModal(){ const m=$('endGameModal'); if(m){ m.classList.remove('hidden') } }
function hideModal(){ const m=$('endGameModal'); if(m){ m.classList.add('hidden') } }

function escapeHtml(s){ return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c)) }
// Liste complète des figures Yams classiques
const yamsFigures = [
  { key: 'as', label: 'As', points: 0 },
  { key: 'deux', label: 'Deux', points: 0 },
  { key: 'trois', label: 'Trois', points: 0 },
  { key: 'quatre', label: 'Quatre', points: 0 },
  { key: 'cinq', label: 'Cinq', points: 0 },
  { key: 'six', label: 'Six', points: 0 },
  { key: 'brelan', label: 'Brelan', points: 20 },
  { key: 'carre', label: 'Carré', points: 30 },
  { key: 'full', label: 'Full', points: 25 },
  { key: 'petite_suite', label: 'Petite suite', points: 30 },
  { key: 'grande_suite', label: 'Grande suite', points: 40 },
  { key: 'yams', label: 'Yams', points: 50 },
  { key: 'chance', label: 'Chance', points: 0 }
];

function renderYams() {
  const tbody = document.getElementById('yamsTbody');
  const table = document.getElementById('yamsTable');
  if (!tbody || !table) return;
  const players = state.game.length ? state.game : state.board.players;
  
  if (!window.yamsState) window.yamsState = {};
  // Fonction pour nettoyer les clés
  function safeKey(key) {
    return String(key).replace(/[^a-zA-Z0-9_]/g, '_');
  }
  // En-tête horizontal : joueurs
  let thead = '<tr><th>Figure</th>';
  players.forEach(p => {
    thead += '<th>' + escapeHtml(p.name) + '</th>';
  });
  thead += '</tr>';
  // Build/replace a <colgroup> to enforce fixed pixel widths per column
  try{
    const existingColgroup = table.querySelector('colgroup');
    const cg = document.createElement('colgroup');
    const firstCol = document.createElement('col'); firstCol.style.width = '140px'; firstCol.style.minWidth = '140px'; firstCol.style.maxWidth = '140px'; cg.appendChild(firstCol);
    players.forEach(function(){ const c = document.createElement('col'); c.style.width = '80px'; c.style.minWidth = '80px'; c.style.maxWidth = '80px'; cg.appendChild(c); });
    if(existingColgroup && existingColgroup.parentNode){ existingColgroup.parentNode.replaceChild(cg, existingColgroup); } else { table.insertBefore(cg, table.firstChild); }
  }catch(e){ /* ignore colgroup errors */ }
  var theadElem = table.querySelector('thead');
  if(!theadElem){
    theadElem = document.createElement('thead');
    const ref = table.querySelector('tbody') || table.firstChild;
    table.insertBefore(theadElem, ref);
  }
  theadElem.innerHTML = thead;
  // helper: show a small field-level error popup near an element
  function showFieldError(el, msg){
    try{
      var pop = document.createElement('div'); pop.className = 'field-error-popup'; pop.textContent = String(msg);
      document.body.appendChild(pop);
      var r = el.getBoundingClientRect();
      // position above if possible, otherwise below
      var top = window.scrollY + r.top - pop.offsetHeight - 6;
      if(top < window.scrollY + 6) top = window.scrollY + r.bottom + 6;
      var left = window.scrollX + Math.max(6, r.left);
      pop.style.position = 'absolute'; pop.style.left = left + 'px'; pop.style.top = top + 'px';
      // Ensure popup does not take focus, then refocus the input
      try{ pop.setAttribute('aria-hidden','true'); pop.tabIndex = -1; }catch(e){}
      try{ if(el && el.focus){ el.focus(); if(el.setSelectionRange) el.setSelectionRange((el.value||'').length,(el.value||'').length); } }catch(e){}
      // try again on next frames to make focus stick
      requestAnimationFrame(function(){
        try{ if(el && el.focus){ el.focus(); if(el.setSelectionRange) el.setSelectionRange((el.value||'').length,(el.value||'').length); } }catch(e){}
        requestAnimationFrame(function(){
          try{ if(el && el.focus){ el.focus(); } }catch(e){}
        });
      });
      clearTimeout(pop.__hide);
      pop.__hide = setTimeout(function(){ try{ pop.remove() }catch(e){} }, 2200);
    }catch(e){}
  }
  // Column widths are now handled in CSS (styles.css)
  // Corps : figures en lignes
  let rows = '';
    yamsFigures.forEach(function(fig) {
    // Vérifie si la figure est barrée pour au moins un joueur
    let isBarredRow = false;
    players.forEach(function(p) {
      if (!window.yamsState[p.id]) window.yamsState[p.id] = {};
      var barreKey = 'barre_' + safeKey(fig.key);
      if (window.yamsState[p.id][barreKey]) isBarredRow = true;
    });
    // Applique une classe CSS si la ligne est barrée
    rows += '<tr class="yams-row' + (isBarredRow ? ' yams-barred-row' : '') + '">';
    // Première colonne : nom + points
    rows += '<td class="yams-label">';
    rows += escapeHtml(fig.label);
    if (fig.points && typeof fig.points === 'number' && fig.points > 0) {
      rows += ' <span class="small">(' + fig.points.toString() + ')</span>';
    }
    rows += '</td>';
    // Colonnes joueurs
    players.forEach(function(p) {
      if (!window.yamsState[p.id]) window.yamsState[p.id] = {};
      var barreKey = 'barre_' + safeKey(fig.key);
      var barred = window.yamsState[p.id][barreKey];
      // Si barré, rien
      if (barred) {
          rows += '<td class="yams-barred-cell">Barré <button class="yams-barre-btn" data-player="' + p.id + '" data-fig="' + barreKey + '" title="Débarrasser">✖</button></td>';
        return;
      }
      // Figures à points fixes
      if(['full','petite_suite','grande_suite','yams','brelan','carre'].indexOf(fig.key) !== -1) {
        var checked = window.yamsState[p.id][safeKey(fig.key)] ? 'checked' : '';
          rows += '<td class="yams-cell-center">';
        rows += '<input type="checkbox" class="yams-check" data-player="' + p.id + '" data-fig="' + safeKey(fig.key) + '" ' + checked + '> ';
        rows += '<label class="small">' + fig.points.toString() + '</label> ';
        var existingVal = (window.yamsState[p.id] && typeof window.yamsState[p.id][safeKey(fig.key)] !== 'undefined') ? window.yamsState[p.id][safeKey(fig.key)] : null;
        var disabledClass = (typeof existingVal !== 'undefined' && existingVal !== false && existingVal !== null && existingVal !== '') ? ' disabled-look' : '';
          rows += '<button class="yams-barre-btn' + disabledClass + '" aria-disabled="' + (disabledClass ? 'true' : 'false') + '" data-player="' + p.id + '" data-fig="' + barreKey + '" title="Barrer">✖</button>';
        rows += '</td>';
      } else {
        var val = (window.yamsState[p.id] && typeof window.yamsState[p.id][safeKey(fig.key)] !== 'undefined') ? window.yamsState[p.id][safeKey(fig.key)] : '';
          rows += '<td class="yams-cell-center">';
          rows += '<input type="text" inputmode="numeric" pattern="[0-9]*" class="yams-input" data-player="' + p.id + '" data-fig="' + safeKey(fig.key) + '" value="' + val + '"> ';
        var existingValNum = (window.yamsState[p.id] && typeof window.yamsState[p.id][safeKey(fig.key)] !== 'undefined') ? window.yamsState[p.id][safeKey(fig.key)] : '';
        var disabledClassNum = (typeof existingValNum !== 'undefined' && existingValNum !== false && existingValNum !== '') ? ' disabled-look' : '';
          rows += '<button class="yams-barre-btn' + disabledClassNum + '" aria-disabled="' + (disabledClassNum ? 'true' : 'false') + '" data-player="' + p.id + '" data-fig="' + barreKey + '" title="Barrer">✖</button>';
        rows += '</td>';
      }
    });
    rows += '</tr>';
  });
  // Ligne de bonus
  rows += '<tr><td class="yams-bold">Bonus (+35 si ≥63)</td>';
  players.forEach(function(p) {
    var upperSum = 0;
    ['as','deux','trois','quatre','cinq','six'].forEach(function(key) {
      var barreKey = 'barre_' + safeKey(key);
      if(window.yamsState[p.id] && window.yamsState[p.id][barreKey]) return;
      var v = (window.yamsState[p.id] && typeof window.yamsState[p.id][key] !== 'undefined') ? Number(window.yamsState[p.id][key]) : 0;
      upperSum += v;
    });
    var bonus = upperSum >= 63 ? 35 : 0;
    rows += '<td class="yams-cell-center yams-bold">' + bonus + '</td>';
  });
  rows += '</tr>';
  // Ligne de total en bas
  rows += '<tr><td class="yams-bold">Total</td>';
  players.forEach(function(p) {
    var total = 0;
    yamsFigures.forEach(function(fig) {
      var barreKey = 'barre_' + safeKey(fig.key);
      if(window.yamsState[p.id] && window.yamsState[p.id][barreKey]) return;
      // Points fixes
      if(['full','petite_suite','grande_suite','yams','brelan','carre'].indexOf(fig.key) !== -1) {
        if(window.yamsState[p.id][safeKey(fig.key)]) total += fig.points;
      } else {
        total += (window.yamsState[p.id] && typeof window.yamsState[p.id][fig.key] !== 'undefined') ? Number(window.yamsState[p.id][fig.key]) : 0;
      }
    });
    var upperSum = 0;
    ['as','deux','trois','quatre','cinq','six'].forEach(function(key) {
      var barreKey = 'barre_' + safeKey(key);
      if(window.yamsState[p.id] && window.yamsState[p.id][barreKey]) return;
      upperSum += (window.yamsState[p.id] && typeof window.yamsState[p.id][key] !== 'undefined') ? Number(window.yamsState[p.id][key]) : 0;
    });
    if (upperSum >= 63) total += 35;
    rows += '<td class="yams-cell-center yams-bold">' + total + '</td>';
  });
  rows += '</tr>';
  tbody.innerHTML = rows;
  // Gestion des inputs numériques
    tbody.querySelectorAll('input.yams-input').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var pid = this.getAttribute('data-player');
        var fig = safeKey(this.getAttribute('data-fig'));
        if (!window.yamsState[pid]) window.yamsState[pid] = {};
        var prev = (window.yamsState[pid] && typeof window.yamsState[pid][fig] !== 'undefined') ? window.yamsState[pid][fig] : '';
        var raw = (this.value||'').trim();
        var v = parseInt(raw, 10);
        if (isNaN(v) || v < 0) {
          showFieldError(this, 'Saisissez un nombre valide');
          this.value = prev || '';
          return;
        }
        // validation for figures 1-6: max = value*5, must be multiple of value
        var numMap = { as:1, deux:2, trois:3, quatre:4, cinq:5, six:6 };
        if(numMap.hasOwnProperty(fig)){
          var n = numMap[fig];
          var max = n * 5;
          if(v > max){ showFieldError(this, 'Maximum pour ' + n + ' : ' + max); this.value = prev || ''; return; }
          if(v % n !== 0){ showFieldError(this, 'Doit être un multiple de ' + n); this.value = prev || ''; return; }
        }
        // chance max 36
        if(fig === 'chance'){
          if(v > 36){ showFieldError(this, 'Maximum pour Chance : 36'); this.value = prev || ''; return; }
        }
        // Determine focused target: prefer detected next focus (pointerdown), fallback to activeElement
        var focused = null;
        try{
          if(window.__yamsNextFocus){ focused = window.__yamsNextFocus; }
          else { var ae = document.activeElement; if(ae && ae.matches && ae.matches('input.yams-input')){ focused = { player: ae.getAttribute('data-player'), fig: ae.getAttribute('data-fig') }; } }
        }catch(e){ focused = null }
        window.yamsState[pid][fig] = v;
        scheduleRenderYams(focused);
        window.__yamsNextFocus = null;
      });
    // Prevent mouse wheel from changing value when focused
    inp.addEventListener('wheel', function(e){ e.preventDefault(); });
    // Prevent arrow up/down from changing value (improves UX on small inputs)
    inp.addEventListener('keydown', function(e){ if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); } });
  });
  // Gestion des cases à cocher
  tbody.querySelectorAll('input.yams-check').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var pid = this.getAttribute('data-player');
      var fig = safeKey(this.getAttribute('data-fig'));
      if (!window.yamsState[pid]) window.yamsState[pid] = {};
      var focused = null;
      try{
        if(window.__yamsNextFocus){ focused = window.__yamsNextFocus; }
        else { var ae = document.activeElement; if(ae && ae.matches && ae.matches('input.yams-input')){ focused = { player: ae.getAttribute('data-player'), fig: ae.getAttribute('data-fig') }; } }
      }catch(e){ focused = null }
      window.yamsState[pid][fig] = this.checked;
      scheduleRenderYams(focused);
      window.__yamsNextFocus = null;
    });
  });
  // Gestion des boutons barré
  tbody.querySelectorAll('button.yams-barre-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pid = this.getAttribute('data-player');
      var fig = safeKey(this.getAttribute('data-fig'));
      var focused = null;
      try{ var ae = document.activeElement; if(ae && ae.matches && ae.matches('input.yams-input')){ focused = { player: ae.getAttribute('data-player'), fig: ae.getAttribute('data-fig') }; } }catch(e){}
      // fig is like 'barre_<key>' — derive the underlying key
      var underlying = fig.indexOf('barre_') === 0 ? fig.slice(6) : fig;
      if (!window.yamsState[pid]) window.yamsState[pid] = {};
      // If already barred, this click should unbar
      if (window.yamsState[pid][fig]) {
        try{ delete window.yamsState[pid][fig]; }catch(e){}
        scheduleRenderYams(focused);
        return;
      }
      // Otherwise, prevent barring if underlying value exists
      var existing = window.yamsState[pid][underlying];
      if (typeof existing !== 'undefined' && existing !== false && existing !== '') {
        showToast('Impossible de barrer : la figure est déjà renseignée.');
        return;
      }
      // Set barred
      window.yamsState[pid][fig] = true;
      scheduleRenderYams(focused);
    });
  });
}

// Schedule a re-render with small debounce and restore focus to a given input afterwards
function scheduleRenderYams(focused){
  if(window.__yamsRenderTimer) clearTimeout(window.__yamsRenderTimer);
  window.__yamsRenderTimer = setTimeout(function(){
    try{ renderYams(); }catch(e){}
    if(focused){
      try{
            var sel = 'input.yams-input[data-player="'+focused.player+'"][data-fig="'+focused.fig+'"]';
        var el = document.querySelector(sel);
        if(el){
          try{ el.focus(); if(el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); }catch(e){}
          // ensure focus sticks: try again in next frames
          requestAnimationFrame(function(){
            try{ el.focus(); if(el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); }catch(e){}
            requestAnimationFrame(function(){ try{ el.focus(); }catch(e){} });
          });
        }
      }catch(e){}
    }
  }, 20);
}



    
  function playBeep(){ try{ const AudioCtx = window.AudioContext || window.webkitAudioContext; const ctx = __audioCtx || (AudioCtx ? new AudioCtx() : null); if(!ctx) return; if(ctx.state === 'suspended' && ctx.resume) ctx.resume(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01); o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6); setTimeout(()=>{ try{ o.stop(); if(!__audioCtx){ ctx.close() } }catch(e){} }, 700) }catch(e){} }
    
  function playShortBeep(){ try{ const ctx = __audioCtx; if(!ctx) return; if(ctx.state === 'suspended' && ctx.resume) ctx.resume(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'square'; o.frequency.value = 1200; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.005); o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); setTimeout(()=>{ try{ o.stop() }catch(e){} }, 180) }catch(e){} }
    
  function playShortBeep(){ try{ const AudioCtx = window.AudioContext || window.webkitAudioContext; const ctx = __audioCtx || (AudioCtx ? new AudioCtx() : null); if(!ctx) return; if(ctx.state === 'suspended' && ctx.resume) ctx.resume(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'square'; o.frequency.value = 1200; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.005); o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); setTimeout(()=>{ try{ o.stop(); if(!__audioCtx){ ctx.close() } }catch(e){} }, 180) }catch(e){} }
    
  function playLongBeep(){ try{ const AudioCtx = window.AudioContext || window.webkitAudioContext; const ctx = __audioCtx || (AudioCtx ? new AudioCtx() : null); if(!ctx) return; if(ctx.state === 'suspended' && ctx.resume) ctx.resume(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 392; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02); o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.0); setTimeout(()=>{ try{ o.stop(); if(!__audioCtx){ ctx.close() } }catch(e){} }, 2100) }catch(e){} }
    
  // Timer control
  var __timerInterval = null;

  function updateTimerDisplay(){
    try{
      const el = $('timerText'); if(!el) return;
      const t = (state && state.timer) ? state.timer : { duration: 0, remaining: 0, running: false };
      const rem = (typeof t.remaining === 'number') ? t.remaining : (t.duration || 0);
      const m = Math.floor(rem/60).toString().padStart(1,'0');
      const s = (rem%60).toString().padStart(2,'0');
      el.textContent = m + ':' + s;
      const hg = document.querySelector('.hourglass'); if(hg){ if(t.running) hg.classList.add('running'); else hg.classList.remove('running') }
      // flash timer in last 5 seconds
      try{
        const td = $('timerDisplay'); if(td){ if(t.running && rem>0 && rem<=5) td.classList.add('urgent'); else td.classList.remove('urgent') }
      }catch(e){}
    }catch(e){}
  }

  function startTimer(seconds){
    try{
      if(!state) state = { timer: { duration: 0, remaining: 0, running: false } }
      if(typeof seconds === 'number' && seconds > 0){ state.timer.duration = seconds; state.timer.remaining = seconds }
      if(!state.timer || typeof state.timer.remaining !== 'number') state.timer.remaining = Number(state.timer.duration) || 0;
      state.timer.running = true;
      // Ensure AudioContext exists (user gesture: clicking Start)
      try{ const AudioCtx = window.AudioContext || window.webkitAudioContext; if(AudioCtx && !window.__audioCtx){ try{ window.__audioCtx = new AudioCtx(); }catch(e){} } }catch(e){}
      try{ if(window.__audioCtx && window.__audioCtx.state === 'suspended' && window.__audioCtx.resume){ window.__audioCtx.resume().catch(()=>{}) } }catch(e){}
      updateTimerDisplay();
      if(__timerInterval) clearInterval(__timerInterval);
      __timerInterval = setInterval(function(){
        try{
          if(!state.timer || !state.timer.running) return;
          state.timer.remaining = Math.max(0, (state.timer.remaining || 0) - 1);
          // play short beep for the last 5 seconds
          try{ if(state.timer.remaining > 0 && state.timer.remaining <= 5){ try{ playShortBeep() }catch(e){} } }catch(e){}
          updateTimerDisplay();
          if(state.timer.remaining <= 0){
            // time's up
            stopTimer();
            try{
              // play the final beep 5 times quickly
              for(var i=0;i<5;i++){ (function(i){ setTimeout(function(){ try{ playLongBeep() }catch(e){} }, i*150) })(i) }
            }catch(e){}
            try{ showToast('Temps écoulé') }catch(e){}
          }
        }catch(e){}
      }, 1000);
    }catch(e){}
  }

  function stopTimer(){ if(__timerInterval){ clearInterval(__timerInterval); __timerInterval = null } if(state.timer) state.timer.running = false; updateTimerDisplay() }

  // Toast helper (non-intrusive notifications)
  function showToast(msg, duration){
    // Toast UI removed: keep a console fallback for debug
    try{ if(!msg || String(msg).trim() === '') return; console.log('toast:', String(msg)); }catch(e){}
  }

  // --- Word checker (FFScrabble attempt + fallback) ---
 function showWordResult(res, word){
  const el = $('wordCheckResult'); if(!el) return;
  const w = escapeHtml(word || '')
  if(res && res.valid){
    el.innerHTML = `<span class="small wordcheck-result-valid">${w} est valide</span>`;
  } else if(res && res.valid === false){
    if(res.source === 'ODS8'){
      el.innerHTML = `<span class="small wordcheck-result-invalid">${w} n'est pas valide selon ODS8</span>`;
    } else {
      el.innerHTML = `<span class="small wordcheck-result-invalid">${w} n'est pas valide</span>`;
    }
  } else {
    el.innerHTML = `<span class="small wordcheck-result-unknown">Impossible de vérifier (${escapeHtml(res && res.source || 'aucun')})</span>`;
  }
}

// Initialisation automatique au chargement de la page
window.onload = init;

 async function checkWord(word){
  const trimmed = (word||'').trim(); if(!trimmed) return { valid: null, source: null }
  // Si l'ODS est disponible, il est maître : présent => valide, absent => invalide
  try{
    if(odsSet){
      const norm = normalizeWord(trimmed);
      if(odsSet.has(norm)){
        return { valid: true, source: 'ODS8', defs: [] }
      } else {
        return { valid: false, source: 'ODS8' }
      }
    }
  }catch(e){}
  // Pas d'ODS : impossible de vérifier localement de manière fiable
  return { valid: null, source: null }
}
