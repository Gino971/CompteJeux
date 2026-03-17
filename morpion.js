document.addEventListener('DOMContentLoaded', function () {
  const boardEl = document.getElementById('morpionBoard');
  const statusEl = document.getElementById('morpionStatus');
  const restartBtn = document.getElementById('morpionRestart');
  const toggleAIBtn = document.getElementById('morpionToggleAI');

  let board = Array(9).fill(null);
  let current = 'X';
  let active = true;
  let aiEnabled = false;

  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  function renderBoard(){
    boardEl.innerHTML = '';
    for(let i=0;i<9;i++){
      const cell = document.createElement('button');
      cell.className = 'morpion-cell';
      cell.setAttribute('data-index', i);
      cell.setAttribute('role','gridcell');
      cell.setAttribute('aria-label', `Case ${i+1}`);
      cell.textContent = board[i] ? board[i] : '';
      if(board[i]) cell.classList.add(board[i].toLowerCase());
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
  }

  function onCellClick(e){
    if(!active) return;
    const idx = Number(e.currentTarget.getAttribute('data-index'));
    // when AI is enabled, human plays X and should not click when it's O's turn
    if(aiEnabled && current === 'O') return;
    placeMark(idx);
  }

  function placeMark(idx){
    if(!active) return;
    if(board[idx]) return;
    board[idx] = current;
    renderBoard();
    const winner = checkWinner();
    if(winner){
      active = false;
      statusEl.textContent = `Gagnant: ${winner}`;
      highlightWin(winner);
      return;
    }
    if(board.every(Boolean)){
      active = false;
      statusEl.textContent = `Match nul`;
      return;
    }
    current = current === 'X' ? 'O' : 'X';
    statusEl.textContent = `À jouer: ${current}`;
    // if AI enabled and it's O's turn, let the AI play shortly after
    if(aiEnabled && current === 'O'){
      setTimeout(()=>{ try{ aiTurn() }catch(e){} }, 350);
    }
  }

  function checkWinner(){
    for(const combo of wins){
      const [a,b,c] = combo;
      if(board[a] && board[a] === board[b] && board[a] === board[c]){
        return board[a];
      }
    }
    return null;
  }

  function highlightWin(winner){
    for(const combo of wins){
      const [a,b,c] = combo;
      if(board[a] && board[a] === board[b] && board[a] === board[c]){
        const cells = boardEl.querySelectorAll('[data-index]');
        [a,b,c].forEach(i => cells[i].classList.add('win'));
        return;
      }
    }
  }

  // AI logic: win if possible, block if needed, center, corners, else random
  function aiChooseMove(){
    const me = 'O';
    const opp = 'X';
    // try to win
    for(let i=0;i<9;i++){
      if(board[i]) continue;
      const copy = board.slice(); copy[i] = me;
      if(isWinner(copy, me)) return i;
    }
    // block opponent
    for(let i=0;i<9;i++){
      if(board[i]) continue;
      const copy = board.slice(); copy[i] = opp;
      if(isWinner(copy, opp)) return i;
    }
    // center
    if(!board[4]) return 4;
    // corners
    const corners = [0,2,6,8].filter(i=>!board[i]);
    if(corners.length) return corners[Math.floor(Math.random()*corners.length)];
    // sides
    const sides = [1,3,5,7].filter(i=>!board[i]);
    if(sides.length) return sides[Math.floor(Math.random()*sides.length)];
    // fallback
    const empties = board.map((v,i)=>v?null:i).filter(v=>v!==null);
    return empties.length?empties[Math.floor(Math.random()*empties.length)]:-1;
  }

  function isWinner(bd, player){
    for(const combo of wins){
      const [a,b,c] = combo;
      if(bd[a] === player && bd[b] === player && bd[c] === player) return true;
    }
    return false;
  }

  function aiTurn(){
    if(!active) return;
    const idx = aiChooseMove();
    if(idx >=0) placeMark(idx);
  }

  function startNew(){
    board = Array(9).fill(null);
    current = 'X';
    active = true;
    statusEl.textContent = `À jouer: ${current}`;
    renderBoard();
    // if AI enabled and AI should start as O, wait a bit then play
    if(aiEnabled && current === 'O'){
      setTimeout(()=>{ try{ aiTurn() }catch(e){} }, 350);
    }
  }

  restartBtn.addEventListener('click', startNew);
  if(toggleAIBtn){
    toggleAIBtn.addEventListener('click', ()=>{
      aiEnabled = !aiEnabled;
      toggleAIBtn.classList.toggle('active', aiEnabled);
      toggleAIBtn.textContent = aiEnabled ? 'IA: ON' : 'Jouer vs IA';
      // restart when enabling to avoid inconsistent state
      startNew();
      // update status immediately
      statusEl.textContent = aiEnabled ? `IA activée — À jouer: ${current}` : `IA désactivée — À jouer: ${current}`;
    });
  }

  // Init
  startNew();
});
