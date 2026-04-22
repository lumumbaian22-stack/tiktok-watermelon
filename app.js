const video = document.getElementById("camera");

// 🎥 CAMERA
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => video.srcObject = stream);

let level = 1;
let score = 0;
let speed = 3;
let peelProgress = 0;
let peeling = false;
let interval;

const peeler = document.getElementById("peeler");
const peelLayer = document.getElementById("peel-layer");
const feedback = document.getElementById("feedback");

const scoreText = document.getElementById("score");
const levelText = document.getElementById("level");

const safeZone = document.getElementById("safe-zone");
const perfectZone = document.getElementById("perfect-zone");

// 🎯 ZONES
function zones() {
  let safeW = Math.max(60, 140 - level * 10);
  let perfectW = safeW / 3;

  let start = (320 - safeW) / 2;
  let pStart = start + (safeW - perfectW) / 2;

  safeZone.style.left = start + "px";
  safeZone.style.width = safeW + "px";

  perfectZone.style.left = pStart + "px";
  perfectZone.style.width = perfectW + "px";

  return {
    safeMin: start,
    safeMax: start + safeW,
    perfectMin: pStart,
    perfectMax: pStart + perfectW
  };
}

// 🔊 SOUND
function playSlice() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  osc.frequency.value = 600;
  osc.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

// 📳 HAPTIC
function vibrate(p) {
  if (navigator.vibrate) navigator.vibrate(p);
}

// 💦 JUICE PARTICLES
const canvas = document.getElementById("juice");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];

function spawnJuice(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * -5,
      life: 30
    });
  }
}

function drawJuice() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life--;

    ctx.fillStyle = "red";
    ctx.fillRect(p.x, p.y, 4, 4);
  });

  particles = particles.filter(p => p.life > 0);
  requestAnimationFrame(drawJuice);
}

drawJuice();

// 🪒 START PEEL
function startPeel() {
  if (peeling) return;

  peeling = true;
  peelProgress = 0;

  const z = zones();

  interval = setInterval(() => {
    peelProgress += speed;

    peeler.style.left = peelProgress + "px";
    peelLayer.style.width = peelProgress + "px";

    spawnJuice(peelProgress + 200, window.innerHeight - 150);

    if (peelProgress >= 320) {
      stopPeel(z);
    }

  }, 16);
}

// ✂️ STOP
function stopPeel(z) {
  clearInterval(interval);
  peeling = false;

  let end = peelProgress;

  if (end >= z.perfectMin && end <= z.perfectMax) {
    feedback.textContent = "🔥 PERFECT";
    score += 20 * level;
    vibrate(30);

  } else if (end >= z.safeMin && end <= z.safeMax) {
    feedback.textContent = "👍 GOOD";
    score += 10 * level;
    vibrate(10);

  } else {
    feedback.textContent = "❌ MISS";
    vibrate([50,50,50]);
  }

  playSlice();

  // 🍃 PEEL FALL EFFECT
  peelLayer.style.transition = "all 0.5s ease";
  peelLayer.style.transform = "translateY(100px) rotate(20deg)";
  peelLayer.style.opacity = 0;

  setTimeout(() => {
    peelLayer.style.transition = "none";
    peelLayer.style.transform = "none";
    peelLayer.style.opacity = 1;
    peelLayer.style.width = "0px";

    peeler.style.left = "0px";

    level++;
    speed += 0.3;

    scoreText.textContent = score;
    levelText.textContent = level;

  }, 600);
}

// 👆 TAP
document.body.addEventListener("click", startPeel);
