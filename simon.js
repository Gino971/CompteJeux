// Simon game — minimal implementation
(function(){
  const pads = []
  let sequence = []
  let userPos = 0
  let playing = false
  let animating = false
  const PAD_HOLD = 420 // durée (ms) utilisée pour la lecture de la séquence

  function $(id){ return document.getElementById(id) }

  function init(){
    for(let i=0;i<4;i++){ pads[i] = $("simon-btn-"+i); if(pads[i]) pads[i].addEventListener('pointerdown', onPadPointer) }
    const start = $('simon-start'); if(start) start.addEventListener('click', startGame)
    const reset = $('simon-reset'); if(reset) reset.addEventListener('click', resetGame)
    const tabBtn = $('tabSimonBtn'); if(tabBtn) tabBtn.addEventListener('click', showSimonTab)
    // allow Escape to return to lists
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ showListsTab() } })
  }

  function showSimonTab(){ document.getElementById('listsTab').classList.add('hidden'); document.getElementById('boardTab').classList.add('hidden'); document.getElementById('yamsTab').classList.add('hidden'); const st = document.getElementById('simonTab'); if(st) st.classList.remove('hidden') }
  function showListsTab(){ const st = document.getElementById('simonTab'); if(st) st.classList.add('hidden'); document.getElementById('listsTab').classList.remove('hidden') }

  function resetGame(){ sequence = []; userPos = 0; playing = false; animating = false; updateLevel() }

  function startGame(){ resetGame(); nextRound() }

  function nextRound(){ sequence.push(randPad()); userPos = 0; playSequence() ; updateLevel() }

  function randPad(){ return Math.floor(Math.random()*4) }

  function updateLevel(){ const el = $('simon-level'); if(el) el.textContent = sequence.length }

  function playSequence(){ animating = true; disablePads(true); let i=0; const delay=600; const hold = PAD_HOLD; const playNext = ()=>{
      if(i>=sequence.length){ animating = false; disablePads(false); return }
      const idx = sequence[i++]; flashPad(idx, hold);
      setTimeout(()=> setTimeout(playNext, 80), delay)
    }
    playNext()
  }

  function flashPad(idx, ms){ const el = pads[idx]; if(!el) return; el.classList.add('active'); beepTone(220 + idx*140, ms); setTimeout(()=> el.classList.remove('active'), ms) }

  function onPadPointer(e){
    if(animating) return;
    // provide immediate visual + audio feedback on pointer interaction
    try{ e.preventDefault() }catch(e){}
    const idx = Number(e.currentTarget.dataset.index);
    // play feedback with same duration as sequence playback
    flashPad(idx, PAD_HOLD);
    // process game input after a minimal delay to allow feedback to start
    setTimeout(()=>{ try{ handleUserInput(idx) }catch(e){} }, 20);
  }

  function handleUserInput(idx){ if(!sequence.length) return; if(idx === sequence[userPos]){ userPos++; if(userPos >= sequence.length){ // round complete
        setTimeout(()=> nextRound(), 600)
      }
    } else {
      // fail: show sequence again and reset user position
      blinkAll(); userPos = 0; setTimeout(()=> playSequence(), 800)
    }
  }

  function blinkAll(){ for(let i=0;i<3;i++){ setTimeout(()=> pads.forEach((p,idx)=> setTimeout(()=> flashPad(idx,120), idx*40)), i*220) } }

  // simple beep using WebAudio
  function beepTone(freq, ms){ try{ const Ctx = window.AudioContext || window.webkitAudioContext; if(!window.__simonAudio) window.__simonAudio = new Ctx(); const ctx = window.__simonAudio; const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01); o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(()=>{ try{ g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02); o.stop() }catch(e){} }, ms) }catch(e){} }

  // enable/disable pointer events on pads
  function disablePads(dis){ pads.forEach(p=>{ if(p) p.disabled = dis; if(dis) p.classList.add('disabled'); else p.classList.remove('disabled') }) }

  // start when DOM ready
  if(document.readyState === 'complete' || document.readyState === 'interactive'){ setTimeout(init,10) } else { window.addEventListener('DOMContentLoaded', init) }

})();
