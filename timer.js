(function(){
  let intervalId = null
  let endTime = 0
  let prevSecond = null
  let __timerAudio = null

  function $(id){ return document.getElementById(id) }

  function formatTime(ms){
    const s = Math.max(0, Math.ceil(ms/1000))
    const mm = Math.floor(s/60)
    const ss = s % 60
    return mm>0 ? `${mm}:${String(ss).padStart(2,'0')}` : `${s}s`
  }

  function updateDisplay(){
    const display = $('bigTimerDisplay')
    if(!display) return
    const remaining = endTime - Date.now()
    if(remaining <= 0){ display.textContent = '0:00'; // final state
      stopTimer(true); return }
    display.textContent = formatTime(remaining)
    const secs = Math.max(0, Math.ceil(remaining/1000))
    // update topbar reminder if present
    const tb = $('topbarTimerReminder')
    if(tb){ tb.textContent = formatTime(remaining) }
    // last-5s visual + sound
    if(secs > 0 && secs <= 5){
      display.classList.add('last-five')
      if(tb) tb.classList.add('last-five')
      if(secs !== prevSecond){ prevSecond = secs; shortBeep() }
    } else {
      display.classList.remove('last-five')
      if(tb) tb.classList.remove('last-five')
      prevSecond = null
    }
  }

  function startTimer(seconds){
    stopTimer()
    endTime = Date.now() + seconds*1000
    updateDisplay()
    intervalId = setInterval(updateDisplay, 200)
    // show topbar reminder while running (use CSS transition)
    const tb = $('topbarTimerReminder')
    if(tb){ tb.classList.remove('ended'); tb.classList.add('running'); tb.classList.add('visible') }
  }

  function stopTimer(triggerEnd=false){
    if(intervalId){ clearInterval(intervalId); intervalId = null }
    // clear topbar running indicator and always hide the reminder when stopped
    const tb = $('topbarTimerReminder')
    if(tb){ tb.classList.remove('running'); tb.classList.remove('last-five'); tb.classList.remove('ended'); tb.classList.remove('visible') }
    // also ensure the big timer display and any element stop flashing
    try{
      const d = $('bigTimerDisplay');
      if(d){
        d.classList.remove('last-five');
        d.classList.remove('timer-ended');
        try{ d.style.animation = 'none'; void d.offsetWidth; d.style.animation = ''; }catch(e){}
      }
      // remove last-five from any element that might still have it
      document.querySelectorAll('.last-five').forEach(el=>{ try{ el.classList.remove('last-five') }catch(e){} });
    }catch(e){}
    prevSecond = null;
    if(triggerEnd){
      try{ playGongs(5, 160) }catch(e){}
      blinkDisplay()
    }
  }

  function blinkDisplay(){
    const d = $('bigTimerDisplay')
    if(!d) return
    d.classList.add('timer-ended')
    setTimeout(()=> d.classList.remove('timer-ended'), 1200)
  }

  // short beep for countdown
  function shortBeep(){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext
      if(!__timerAudio && Ctx) __timerAudio = new Ctx()
      const ctx = __timerAudio
      if(!ctx) return
      const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='square'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.005); o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); setTimeout(()=>{ try{ o.stop() }catch(e){} }, 120)
    }catch(e){}
  }

  // play a quick series of gongs using scheduled AudioContext events
  function playGongs(count, gapMs){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!__timerAudio && Ctx) __timerAudio = new Ctx();
      const ctx = __timerAudio;
      if(!ctx) return;
      const start = ctx.currentTime + 0.01;
      for(let i=0;i<count;i++){
        const t = start + (i * gapMs) / 1000;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        // descending frequency for a gong-like effect
        const freq = 600 - i*60;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        try{ g.gain.exponentialRampToValueAtTime(0.18, t + 0.01) }catch(e){ g.gain.linearRampToValueAtTime(0.18, t + 0.01) }
        try{ g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28) }catch(e){ g.gain.linearRampToValueAtTime(0.0001, t + 0.28) }
        o.connect(g); g.connect(ctx.destination);
        o.start(t);
        try{ o.stop(t + 0.3) }catch(e){ setTimeout(()=>{ try{o.stop()}catch(e){} }, (t + 0.3 - ctx.currentTime)*1000) }
      }
    }catch(e){}
  }

  function showTimerTab(){ if(window && window.showTab) return window.showTab('timer'); const ids = ['listsTab','boardTab','yamsTab','simonTab','timerTab']; ids.forEach(id=>{ const el = document.getElementById(id); if(!el) return; if(id==='timerTab') el.classList.remove('hidden'); else el.classList.add('hidden') }) }

  function init(){
    // tab button
    const tabBtn = $('tabTimerBtn'); if(tabBtn) tabBtn.addEventListener('click', showTimerTab)
    const topbarRem = $('topbarTimerReminder'); if(topbarRem) topbarRem.addEventListener('click', ()=>{ if(window && window.showTab) return window.showTab('timer'); showTimerTab() })

    // presets
    document.querySelectorAll('.preset').forEach(b=> b.addEventListener('click', (e)=>{ const s = Number(e.currentTarget.dataset.seconds)||60; $('timerCustom').value = s; $('bigTimerDisplay').textContent = formatTime(s*1000) }))

    // controls
    const start = $('timerStartBtnPage'); const stop = $('timerStopBtnPage'); const reset = $('timerResetBtnPage'); const custom = $('timerCustom');
    if(start) start.addEventListener('click', ()=>{ const s = Math.max(1, Number(custom.value)||60); startTimer(s) })
    if(stop) stop.addEventListener('click', ()=> stopTimer())
    if(reset) reset.addEventListener('click', ()=>{ stopTimer(); const s = Math.max(1, Number(custom.value)||60); $('bigTimerDisplay').textContent = formatTime(s*1000) })

    // keyboard: Escape returns to lists
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ const st = document.getElementById('timerTab'); if(st) st.classList.add('hidden'); const lt = document.getElementById('listsTab'); if(lt) lt.classList.remove('hidden') } })

    // reflect initial custom value
    const initial = Number($('timerCustom')?.value)||60; $('bigTimerDisplay').textContent = formatTime(initial*1000)
    // initialize topbar reminder
    const tb = $('topbarTimerReminder'); if(tb) tb.textContent = formatTime(initial*1000)
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init()

})();
