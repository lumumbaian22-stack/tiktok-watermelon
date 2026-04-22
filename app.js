let level = 1;
let score = 0;
let combo = 0;
let lives = 3;
let highScore = localStorage.getItem("hs") || 0;

let position = 0;
let speed = 2;
let direction = 1;
let playing = false;
let interval;

const peelBar = document.getElementById("peel-bar");
const safeZone = document.getElementById("safe-zone");
const perfectZone = document.getElementById("perfect-zone");

const feedback = document.getElementById("feedback");
const hint = document.getElementById("hint");

const levelText = document.getElementById("level");
const scoreText = document.getElementById("score");
const comboText = document.getElementById("combo");
const livesText = document.getElementById("lives");
const highScoreText = document.getElementById("highScore");

function updateHUD() {
  levelText.textContent = level;
  scoreText.textContent = score;
  comboText.textContent = combo;
  livesText.textContent = lives;
  highScoreText.textContent = highScore;
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function zones() {
  let safeW = Math.max(50, 140 - level * 10);
  let perfectW = safeW / 3;

  let start = (300 - safeW) / 2;
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

function start() {
  playing = true;
  hint.style.opacity = 0;
  zones();

  interval = setInterval(() => {
    position += speed * direction;
    if (position >= 294 || position <= 0) direction *= -1;
    peelBar.style.left = position + "px";
  }, 10);
}

function stop() {
  clearInterval(interval);
  playing = false;

  const z = zones();

  if (position >= z.perfectMin && position <= z.perfectMax) {
    combo++;
    let pts = 20 * level * (combo + 1);
    score += pts;
    feedback.textContent = `🔥 PERFECT x${combo}`;
    vibrate(30);

  } else if (position >= z.safeMin && position <= z.safeMax) {
    combo = 0;
    score += 10 * level;
    feedback.textContent = `👍 GOOD`;
    vibrate(10);

  } else {
    combo = 0;
    lives--;
    feedback.textContent = `❌ MISS`;
    vibrate([50, 50, 50]);

    if (lives <= 0) {
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("hs", highScore);
      }

      feedback.textContent = "💀 GAME OVER";
      level = 1;
      score = 0;
      lives = 3;
      speed = 2;
    }
  }

  level++;
  speed += 0.25;

  position = 0;
  peelBar.style.left = "0px";

  updateHUD();
}

document.body.addEventListener("click", () => {
  if (!playing) start();
  else stop();
});

updateHUD();
