(function(){
  "use strict";

  // ---------- DOM Elements ----------
  const settingsPanel = document.getElementById('settings-panel');
  const gameUI = document.getElementById('game-ui');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const peelerImg = document.getElementById('peeler-img');
  const scoreSpan = document.getElementById('score');
  const levelSpan = document.getElementById('level');
  const streakSpan = document.getElementById('streak');
  const feedbackDiv = document.getElementById('feedback');

  const fruitSelect = document.getElementById('fruit-select');
  const directionSelect = document.getElementById('direction-select');
  const speedSlider = document.getElementById('speed-slider');
  const startBtn = document.getElementById('start-game');

  // ---------- Game State ----------
  let gameActive = false;
  let score = 0;
  let level = 1;
  let streak = 0;
  
  // Fruit data
  const fruits = {
    apple:   { name: 'Apple',   color: '#c0392b', peelColor: '#e74c3c', innerColor: '#f1c40f' },
    banana:  { name: 'Banana',  color: '#f1c40f', peelColor: '#f39c12', innerColor: '#f9e79f' },
    potato:  { name: 'Potato',  color: '#8B4513', peelColor: '#a0522d', innerColor: '#f5deb3' }
  };
  let currentFruit = 'apple';
  
  // Peeler settings
  let peelerDirection = 'down';   // 'up' or 'down' (facing direction)
  let peelerSpeed = 5;            // pixels per frame
  
  // Peeler position and movement
  let peelerX = 0;
  let peelerMoveDir = 1;          // 1 = right, -1 = left
  const PEELER_WIDTH = 100;       // visual width in px
  
  // Fruit strips (vertical)
  const STRIP_COUNT = 10;
  let strips = [];                // boolean: true = peeled, false = unpeeled
  let stripWidth = 0;
  
  // Dotted line indicator
  let currentStripIndex = 0;
  
  // Animation / physics
  let peelStrokeActive = false;
  let strokeProgress = 0;         // 0..1
  let strokeTargetStrip = -1;
  let strokeDirection = 0;        // +1 = down, -1 = up
  
  // Juice particles
  let particles = [];
  
  // Audio context
  let audioCtx = null;
  
  // Frame rate
  let lastTimestamp = 0;
  let animFrame = null;

  // ---------- Helper Functions ----------
  function resizeCanvas() {
    const container = canvas.parentElement;
    const w = container.clientWidth;
    canvas.width = w;
    canvas.height = w;  // square
    stripWidth = canvas.width / STRIP_COUNT;
  }
  window.addEventListener('resize', () => { if (gameActive) resizeCanvas(); });

  // Initialize strips (all unpeeled)
  function resetStrips() {
    strips = new Array(STRIP_COUNT).fill(false);
  }

  // Update peeler visual position
  function updatePeelerPosition() {
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = peelerImg.parentElement.getBoundingClientRect();
    const offsetX = (peelerX / canvas.width) * canvasRect.width;
    peelerImg.style.left = offsetX + 'px';
  }

  // Get strip index from x coordinate (0..canvas.width)
  function getStripIndex(x) {
    return Math.min(STRIP_COUNT - 1, Math.max(0, Math.floor(x / stripWidth)));
  }

  // Spawn juice particles at strip center
  function spawnJuice(stripIdx) {
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + (stripIdx + 0.5) * stripWidth;
    const y = rect.top + rect.height * 0.5;
    for (let i=0; i<8; i++) {
      particles.push({
        x, y,
        vx: (Math.random()-0.5)*8,
        vy: (Math.random()*-5)-2,
        life: 30 + Math.floor(Math.random()*20),
        size: 4+Math.random()*6
      });
    }
  }

  // Play slice sound
  async function playSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 500 + Math.random()*200;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.1);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime+0.1);
    } catch(e) {}
  }

  // Vibrate
  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // Show feedback
  function showFeedback(text, isGood=true) {
    feedbackDiv.textContent = text;
    feedbackDiv.style.color = isGood ? 'gold' : '#ff6b6b';
    feedbackDiv.classList.add('show');
    setTimeout(() => feedbackDiv.classList.remove('show'), 400);
  }

  // ---------- Game Loop ----------
  function gameLoop(now) {
    if (!gameActive) return;
    
    // Update peeler bouncing movement (if no peel stroke active)
    if (!peelStrokeActive) {
      peelerX += peelerMoveDir * peelerSpeed;
      // Bounce at edges
      if (peelerX >= canvas.width - PEELER_WIDTH/2) {
        peelerX = canvas.width - PEELER_WIDTH/2;
        peelerMoveDir = -1;
      } else if (peelerX <= PEELER_WIDTH/2) {
        peelerX = PEELER_WIDTH/2;
        peelerMoveDir = 1;
      }
      
      // Update current strip index for dotted line
      currentStripIndex = getStripIndex(peelerX);
    } else {
      // Peel stroke animation: move peeler vertically (up or down)
      strokeProgress += 0.05;  // speed of stroke
      if (strokeProgress >= 1) {
        // Stroke finished
        peelStrokeActive = false;
        // The strip was already peeled during tap; nothing more to do
      }
      // Visual effect: during stroke we could offset peeler y, but we'll just show feedback
    }
    
    updatePeelerPosition();
    drawCanvas();
    
    animFrame = requestAnimationFrame(gameLoop);
  }

  // ---------- Drawing ----------
  function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw fruit base (inner color)
    const fruit = fruits[currentFruit];
    
    // Draw each strip
    for (let i=0; i<STRIP_COUNT; i++) {
      const x = i * stripWidth;
      const isPeeled = strips[i];
      
      if (isPeeled) {
        // Peeled: show inner color
        ctx.fillStyle = fruit.innerColor;
        ctx.fillRect(x, 0, stripWidth, canvas.height);
        // Add texture lines
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for (let ly=0; ly<canvas.height; ly+=8) {
          ctx.fillRect(x, ly, stripWidth, 2);
        }
      } else {
        // Unpeeled: show peel color with texture
        ctx.fillStyle = fruit.peelColor;
        ctx.fillRect(x, 0, stripWidth, canvas.height);
        // Speckles
        ctx.fillStyle = '#5d2e0c';
        for (let s=0; s<3; s++) {
          ctx.beginPath();
          ctx.arc(x+Math.random()*stripWidth, Math.random()*canvas.height, 2+Math.random()*4, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }
    
    // Draw fruit outline and highlight
    ctx.strokeStyle = '#2c1e0e';
    ctx.lineWidth = 6;
    ctx.strokeRect(2, 2, canvas.width-4, canvas.height-4);
    
    // Draw dotted line indicator (current strip)
    const highlightX = currentStripIndex * stripWidth;
    ctx.setLineDash([8, 12]);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 10;
    ctx.strokeRect(highlightX+2, 2, stripWidth-4, canvas.height-4);
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    
    // Draw peel stroke effect if active
    if (peelStrokeActive) {
      const targetX = strokeTargetStrip * stripWidth;
      ctx.fillStyle = 'rgba(255,255,200,0.4)';
      ctx.fillRect(targetX, 0, stripWidth, canvas.height);
    }
    
    // Draw juice particles
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life--;
      ctx.fillStyle = `rgba(220,100,20,${p.life/40})`;
      ctx.beginPath();
      ctx.arc(p.x - canvas.getBoundingClientRect().left, p.y - canvas.getBoundingClientRect().top, p.size, 0, 2*Math.PI);
      ctx.fill();
      return p.life > 0;
    });
  }

  // ---------- Peel Action (triggered by tap) ----------
  function attemptPeel() {
    if (!gameActive || peelStrokeActive) return;
    
    const stripIdx = currentStripIndex;
    
    // Mistiming: if already peeled, do nothing but play miss feedback
    if (strips[stripIdx]) {
      showFeedback('❌ ALREADY PEELED', false);
      vibrate(30);
      return;
    }
    
    // Determine stroke direction based on peeler facing
    // If peeler faces "up", stroke moves down; if "down", stroke moves up
    const strokeDir = (peelerDirection === 'up') ? 1 : -1;
    
    // Perform peel
    strips[stripIdx] = true;
    streak++;
    const points = 10 * level * (streak > 1 ? 2 : 1);
    score += points;
    scoreSpan.textContent = score;
    streakSpan.textContent = streak;
    
    // Level up every 5 peels
    if (streak % 5 === 0 && streak > 0) {
      level++;
      levelSpan.textContent = level;
      peelerSpeed = Math.min(12, peelerSpeed + 0.8);
      showFeedback('⭐ LEVEL UP!', true);
    } else {
      showFeedback(`+${points}`, true);
    }
    
    // Trigger peel stroke animation
    peelStrokeActive = true;
    strokeProgress = 0;
    strokeTargetStrip = stripIdx;
    strokeDirection = strokeDir;
    
    // Effects
    spawnJuice(stripIdx);
    playSound();
    vibrate(20);
    
    // Check if all strips peeled → next level or win
    if (strips.every(v => v === true)) {
      // All peeled! Reset with new level
      setTimeout(() => {
        level++;
        levelSpan.textContent = level;
        resetStrips();
        peelerSpeed = Math.min(12, peelerSpeed + 1.2);
        showFeedback('🍎 PERFECT! +1 LEVEL', true);
      }, 300);
    }
  }

  // ---------- Event Listeners ----------
  canvas.addEventListener('click', (e) => {
    e.preventDefault();
    attemptPeel();
  });
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    attemptPeel();
  }, {passive: false});

  // ---------- Start Game ----------
  function startGame() {
    // Read settings
    currentFruit = fruitSelect.value;
    peelerDirection = directionSelect.value;
    peelerSpeed = parseFloat(speedSlider.value);
    
    // Reset state
    score = 0;
    level = 1;
    streak = 0;
    scoreSpan.textContent = '0';
    levelSpan.textContent = '1';
    streakSpan.textContent = '0';
    
    resizeCanvas();
    resetStrips();
    
    // Initial peeler position
    peelerX = canvas.width / 2;
    peelerMoveDir = 1;
    peelStrokeActive = false;
    
    // Hide settings, show game
    settingsPanel.style.display = 'none';
    gameUI.style.display = 'block';
    gameActive = true;
    
    // Start loop
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(gameLoop);
    
    // Initial feedback
    showFeedback('TAP TO PEEL!', true);
  }

  startBtn.addEventListener('click', startGame);

  // Pre-warm audio on first interaction
  document.body.addEventListener('click', function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }, {once: true});

  // Resize on orientation change
  window.addEventListener('resize', () => {
    if (gameActive) {
      resizeCanvas();
      // Keep peeler within bounds
      peelerX = Math.min(canvas.width - PEELER_WIDTH/2, Math.max(PEELER_WIDTH/2, peelerX));
    }
  });

})();
