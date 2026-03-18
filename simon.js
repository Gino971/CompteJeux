// Simon game — minimal implementation
(function(){
  const pads = []
  const PAD_HOLD = 520
  let sequence = []
  let userPos = 0
  let playing = false
  let animating = false
  let lives = 3

  function $(id){ return document.getElementById(id) }

  function init(){
    for(let i=0;i<4;i++){ pads[i] = $("simon-btn-"+i); if(pads[i]) pads[i].addEventListener('click', onPadClick) }
    const start = $('simon-start'); if(start) start.addEventListener('click', startGame)
    const reset = $('simon-reset'); if(reset) reset.addEventListener('click', resetGame)
    const tabBtn = $('tabSimonBtn'); if(tabBtn) tabBtn.addEventListener('click', showSimonTab)
    // allow Escape to return to lists
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ showListsTab() } })
    // prepare AudioContext early to avoid creation/resume delays on first click
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(Ctx && !window.__simonAudio){
        window.__simonAudio = new Ctx();
      }
      // ensure it's resumed on the first user interaction (pointerdown) without awaiting
      const resumeOnInteraction = ()=>{
        try{ if(window.__simonAudio && window.__simonAudio.state === 'suspended') window.__simonAudio.resume().catch(()=>{}) }catch(e){}
        document.removeEventListener('pointerdown', resumeOnInteraction);
      };
      document.addEventListener('pointerdown', resumeOnInteraction, {once:true});
    }catch(e){}
    try{ updateLivesDisplay() }catch(e){}
  }

  function showSimonTab(){ if(window && window.showTab) return window.showTab('simon'); const st = document.getElementById('simonTab'); if(st) st.classList.remove('hidden') }
  function showListsTab(){ if(window && window.showTab) return window.showTab('lists'); document.getElementById('listsTab').classList.remove('hidden') }

  function resetGame(){ sequence = []; userPos = 0; playing = false; animating = false; lives = 3; updateLevel(); updateLivesDisplay(); try{ enableAllPads() }catch(e){} }
  window.resetSimon = resetGame;
  function enableAllPads(){ try{ pads.forEach(p=>{ if(p){ p.disabled = false; p.classList && p.classList.remove && p.classList.remove('disabled') } }) }catch(e){} }

  function startGame(){ resetGame(); nextRound() }

  function updateLivesDisplay(){
    try{
      const wrap = $('simon-lives-wrap');
      if(!wrap) return;
      // render hearts
      const max = 3;
      let html = '';
      for(let i=0;i<max;i++){
        if(i<lives) html += `<span class="heart full">\u2665</span>`;
        else html += `<span class="heart empty">\u2661</span>`;
      }
      wrap.innerHTML = html;
    }catch(e){ console.error(e) }
  }

  function showLoseBanner(points){
    try{
      // remove existing
      const old = document.getElementById('simon-lose-banner'); if(old) old.remove();
      const b = document.createElement('div'); b.id = 'simon-lose-banner';
      b.innerHTML = `<div class="simon-lose-inner"><h2>PERDU</h2><p>tu as eu ${points} points</p><div class="simon-lose-actions"><button id="simon-restart">Rejouer</button><button id="simon-back-to-players" class="btn ghost">Joueurs</button></div></div>`;
      // placer le popup dans le wrap Simon si possible
      var simonWrap = document.querySelector('.simon-wrap');
      if (simonWrap) {
        simonWrap.appendChild(b);
      } else {
        document.body.appendChild(b);
      }
      // disable pads
      pads.forEach(p=>{ if(p) p.disabled = true; p && p.classList.add && p.classList.add('disabled') });
      animating = true;
      const restart = document.getElementById('simon-restart'); if(restart) restart.addEventListener('click', ()=>{ try{ b.remove(); resetGame(); startGame() }catch(e){} })
      const back = document.getElementById('simon-back-to-players'); if(back) back.addEventListener('click', ()=>{ try{ b.remove(); showListsTab(); }catch(e){} })
    }catch(e){ console.error(e) }
  }

  function nextRound(){ sequence.push(randPad()); userPos = 0; playSequence() ; updateLevel() }

  function randPad(){ return Math.floor(Math.random()*4) }

  function updateLevel(){ const el = $('simon-level'); if(el) el.textContent = sequence.length }

  function playSequence(){ animating = true; let i=0; const delay=600; const hold=420; const playNext = ()=>{
      if(i>=sequence.length){ animating = false; return }
      const idx = sequence[i++]; flashPad(idx, hold);
      setTimeout(()=> setTimeout(playNext, 80), delay)
    }
    playNext()
  }

  function flashPad(idx, ms){
    const el = pads[idx];
    if(!el) return;
    // simple visual flash only; sound is triggered by caller for clearer separation
    el.classList.add('active');
    setTimeout(()=> el.classList.remove('active'), ms);
  }

  async function onPadClick(e){
    if(animating) return;
    const btn = e.currentTarget;
    const idx = Number(btn.dataset.index);
    // disable only the clicked pad so others do not change appearance
    try{ btn.disabled = true }catch(e){}
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx){
      try{
        if(!window.__simonAudio) window.__simonAudio = new Ctx();
        const ctx = window.__simonAudio;
        if(ctx && ctx.state === 'suspended'){
          try{ await ctx.resume() }catch(e){}
        }
        try{ beepTone(220 + idx*140, PAD_HOLD, ctx.currentTime + 0.005) }catch(e){}
      }catch(e){ try{ beepTone(220 + idx*140, PAD_HOLD) }catch(e){} }
    }else{
      try{ beepTone(220 + idx*140, PAD_HOLD) }catch(e){}
    }
    flashPad(idx, PAD_HOLD);
    setTimeout(()=>{
      try{ handleUserInput(idx) }catch(e){ console.error(e) }
      try{ btn.disabled = false }catch(e){}
    }, PAD_HOLD + 40);
  }

  function handleUserInput(idx){
    if(!sequence.length) return;
    if(idx === sequence[userPos]){
      userPos++;
      if(userPos >= sequence.length){
        // short pause to let the last pad animation/sound finish and signal success
        setTimeout(()=> nextRound(), 700);
      }
    } else {
      // wrong answer: decrement lives and either show lose banner or replay
      lives = Math.max(0, lives - 1);
      updateLivesDisplay();
      if(lives <= 0){
        const points = Math.max(0, sequence.length - 1);
        showLoseBanner(points);
        return;
      }
      blinkAll();
      userPos = 0;
      setTimeout(()=> playSequence(), 1000);
    }
  }

  function blinkAll(){
    const rounds = 3;
    const perPadDelay = 40;
    const roundGap = 220;
    for(let r=0;r<rounds;r++){
      for(let idx=0; idx<pads.length; idx++){
        setTimeout(()=> flashPad(idx, 120), r*roundGap + idx*perPadDelay);
      }
    }
  }

  // simple beep using WebAudio
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)) }

  // schedule a visual flash at an absolute AudioContext time (seconds)
  function scheduleFlash(idx, startSec, ms){
    const el = pads[idx];
    const ctx = window.__simonAudio;
    const nowSec = (ctx && ctx.currentTime) ? ctx.currentTime : performance.now()/1000;
    const delay = Math.max(0, (startSec - nowSec) * 1000);
    setTimeout(()=>{
      if(!el) return;
      el.classList.add('active');
      setTimeout(()=> el.classList.remove('active'), ms);
    }, delay);
  }

  // play the full sequence using AudioContext timing when available
  async function playSequence(){
    animating = true;
    const hold = PAD_HOLD; const gap = 120;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(window.__simonAudio || (window && Ctx && (window.__simonAudio = window.__simonAudio || new Ctx()))){
      const ctx = window.__simonAudio;
      const base = ctx.currentTime + 0.05; // small lead time
      for(let i=0;i<sequence.length;i++){
        const idx = sequence[i];
        const startSec = base + i * ((hold + gap)/1000);
        scheduleFlash(idx, startSec, hold);
        beepTone(220 + idx*140, hold, startSec);
      }
      // wait until end
      const totalMs = sequence.length * (hold + gap) + 50;
      await sleep(totalMs);
    }else{
      // fallback
      for(let i=0;i<sequence.length;i++){
        const idx = sequence[i]; flashPad(idx, hold);
        await sleep(hold + gap);
      }
    }
    animating = false;
  }

  // precise beep using WebAudio scheduling; optional start time in AudioContext seconds
  function beepTone(freq, ms, startSec){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!window.__simonAudio && Ctx) window.__simonAudio = new Ctx();
      const ctx = window.__simonAudio;
      if(!ctx){
        // no audio context: approximate with setTimeout and simple oscillator via WebAudio isn't available
        return;
      }
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const startTime = typeof startSec === 'number' ? startSec : ctx.currentTime;
      const endTime = startTime + Math.max(0.02, ms/1000);
      g.gain.setValueAtTime(0.0001, startTime);
      try{ g.gain.exponentialRampToValueAtTime(0.08, startTime + 0.01) }catch(e){ g.gain.linearRampToValueAtTime(0.08, startTime + 0.01) }
      try{ g.gain.exponentialRampToValueAtTime(0.0001, endTime - 0.02) }catch(e){ g.gain.linearRampToValueAtTime(0.0001, endTime - 0.02) }
      o.start(startTime);
      try{ o.stop(endTime) }catch(e){ setTimeout(()=>{ try{o.stop()}catch(e){} }, (endTime - ctx.currentTime + 0.05)*1000) }
    }catch(e){}
  }

  // enable/disable pointer events on pads
  function disablePads(dis){ pads.forEach(p=>{ if(p) p.disabled = dis; if(dis) p.classList.add('disabled'); else p.classList.remove('disabled') }) }

  // Initialisation automatique au chargement de la page
  if (window && window.addEventListener) window.addEventListener('load', init);

})();
