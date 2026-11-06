(() => {
  const BEST_KEY = "sdz3_trail_best";
  const GRAVITY = 2200;
  const JUMP_V = -780;
  const GROUND_Y = 292;

  const canvas = document.getElementById("trail-canvas");
  const overlay = document.getElementById("trail-overlay");
  const messageEl = document.getElementById("trail-message");
  const startBtn = document.getElementById("trail-start");
  const scoreEl = document.getElementById("trail-score");
  const bestEl = document.getElementById("trail-best");

  if (!canvas || !overlay || !startBtn) return;

  const ctx = canvas.getContext("2d");
  let running = false;
  let alive = false;
  let raf = 0;
  let lastTs = 0;
  let distance = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let speed = 280;
  let spawnTimer = 0;
  let obstacles = [];
  let clouds = [];
  let hills = [];
  let rainDrops = [];
  let walkPhase = 0;
  let avatarImg = null;
  let avatarReady = false;

  const player = {
    x: 110,
    y: GROUND_Y,
    vy: 0,
    w: 34,
    h: 52,
    onGround: true,
  };

  function setAvatar(src) {
    avatarReady = false;
    avatarImg = null;
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      avatarImg = img;
      avatarReady = true;
      if (!running) {
        drawBackground();
        drawPlayer();
      }
    };
    img.src = src;
  }

  function resize() {
    const parent = canvas.parentElement;
    const maxW = Math.min(900, parent.clientWidth);
    const ratio = 360 / 900;
    canvas.style.width = `${maxW}px`;
    canvas.style.height = `${Math.round(maxW * ratio)}px`;
  }

  function resetWorld() {
    distance = 0;
    speed = 280;
    spawnTimer = 0.8;
    obstacles = [];
    rainDrops = [];
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    walkPhase = 0;
    clouds = Array.from({ length: 4 }, (_, i) => ({
      x: 80 + i * 220,
      y: 36 + (i % 2) * 22,
      w: 70 + (i % 3) * 18,
      s: 12 + i * 3,
    }));
    hills = Array.from({ length: 5 }, (_, i) => ({
      x: i * 220,
      h: 40 + (i % 3) * 18,
      w: 180 + (i % 2) * 40,
    }));
    updateHud();
  }

  function updateHud() {
    const meters = Math.floor(distance / 18);
    if (scoreEl) scoreEl.textContent = `${meters} m`;
    if (bestEl) bestEl.textContent = `Recorde ${Math.floor(best)} m`;
  }

  function showOverlay(text, btnLabel = "Começar") {
    messageEl.textContent = text;
    startBtn.textContent = btnLabel;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function jump() {
    if (!alive || !running) return;
    if (player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
    }
  }

  function pickObstacle() {
    const types = ["rock", "snake", "waterfall", "rain", "log"];
    const roll = Math.random();
    if (roll < 0.28) return "rock";
    if (roll < 0.48) return "snake";
    if (roll < 0.66) return "log";
    if (roll < 0.82) return "waterfall";
    return "rain";
  }

  function spawnObstacle() {
    const type = pickObstacle();
    const base = { type, x: canvas.width + 40, hit: false };

    if (type === "rock") {
      obstacles.push({ ...base, w: 36, h: 28, y: GROUND_Y });
    } else if (type === "snake") {
      obstacles.push({ ...base, w: 48, h: 16, y: GROUND_Y, phase: 0 });
    } else if (type === "log") {
      obstacles.push({ ...base, w: 54, h: 22, y: GROUND_Y });
    } else if (type === "waterfall") {
      obstacles.push({ ...base, w: 58, h: 120, y: GROUND_Y });
    } else if (type === "rain") {
      obstacles.push({ ...base, w: 90, h: 24, y: GROUND_Y, cloudY: 48 });
    }
  }

  function hitbox(obs) {
    if (obs.type === "waterfall") {
      return { x: obs.x + 10, y: obs.y - 34, w: obs.w - 20, h: 34 };
    }
    if (obs.type === "rain") {
      return { x: obs.x + 12, y: obs.y - 18, w: obs.w - 24, h: 18 };
    }
    if (obs.type === "snake") {
      return { x: obs.x + 4, y: obs.y - obs.h, w: obs.w - 8, h: obs.h };
    }
    return { x: obs.x, y: obs.y - obs.h, w: obs.w, h: obs.h };
  }

  function playerBox() {
    return {
      x: player.x + 6,
      y: player.y - player.h + 6,
      w: player.w - 10,
      h: player.h - 8,
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function gameOver() {
    alive = false;
    running = false;
    const meters = Math.floor(distance / 18);
    if (meters > best) {
      best = meters;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    showOverlay(`Queda na trilha · ${meters} m`, "Tentar de novo");
  }

  function update(dt) {
    if (!alive) return;

    distance += speed * dt;
    speed = Math.min(520, 280 + distance / 900);
    walkPhase += dt * (player.onGround ? 10 : 0);

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(0.85, 1.7 - distance / 8000) + Math.random() * 0.55;
    }

    obstacles.forEach((obs) => {
      obs.x -= speed * dt;
      if (obs.type === "snake") obs.phase = (obs.phase || 0) + dt * 8;
    });
    obstacles = obstacles.filter((obs) => obs.x + obs.w > -40);

    clouds.forEach((c) => {
      c.x -= c.s * dt;
      if (c.x + c.w < 0) c.x = canvas.width + 40;
    });
    hills.forEach((h) => {
      h.x -= speed * 0.25 * dt;
      if (h.x + h.w < 0) h.x += 220 * hills.length;
    });

    rainDrops = rainDrops.filter((d) => d.y < GROUND_Y + 10);
    obstacles
      .filter((o) => o.type === "rain")
      .forEach((o) => {
        if (Math.random() < 0.45) {
          rainDrops.push({
            x: o.x + 10 + Math.random() * (o.w - 20),
            y: o.cloudY + 28,
            vy: 280 + Math.random() * 120,
          });
        }
      });
    rainDrops.forEach((d) => {
      d.y += d.vy * dt;
      d.x -= speed * 0.2 * dt;
    });

    const pb = playerBox();
    for (const obs of obstacles) {
      if (overlaps(pb, hitbox(obs))) {
        gameOver();
        return;
      }
    }

    updateHud();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#6BA3FF");
    g.addColorStop(0.55, "#B8D4FF");
    g.addColorStop(1, "#8FBF6A");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    hills.forEach((h, i) => {
      ctx.fillStyle = i % 2 ? "#4F8A3A" : "#3E7340";
      ctx.beginPath();
      ctx.moveTo(h.x, GROUND_Y);
      ctx.quadraticCurveTo(h.x + h.w / 2, GROUND_Y - h.h, h.x + h.w, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    });

    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.35, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 22, c.y + 4, c.w * 0.28, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 18, c.y + 6, c.w * 0.25, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // trail ground
    ctx.fillStyle = "#6B4F2A";
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = "#8B6A3D";
    ctx.fillRect(0, GROUND_Y, canvas.width, 10);

    const stripe = ((distance * 0.4) % 40);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let x = -stripe; x < canvas.width; x += 40) {
      ctx.fillRect(x, GROUND_Y + 16, 18, 4);
    }

    // trees far
    for (let i = 0; i < 6; i += 1) {
      const tx = ((i * 170 - distance * 0.15) % (canvas.width + 120)) - 40;
      ctx.fillStyle = "#5A3A1E";
      ctx.fillRect(tx + 10, GROUND_Y - 48, 8, 48);
      ctx.fillStyle = "#2F6B2F";
      ctx.beginPath();
      ctx.moveTo(tx - 8, GROUND_Y - 42);
      ctx.lineTo(tx + 14, GROUND_Y - 88);
      ctx.lineTo(tx + 36, GROUND_Y - 42);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const bob = player.onGround ? Math.sin(walkPhase) * 2 : 0;
    const leg = player.onGround ? Math.sin(walkPhase) * 7 : 4;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 16, GROUND_Y + 4, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.strokeStyle = "#1A2A4A";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 18 + bob);
    ctx.lineTo(x + 10 - leg, y + bob);
    ctx.moveTo(x + 18, y - 18 + bob);
    ctx.lineTo(x + 22 + leg, y + bob);
    ctx.stroke();

    // body
    ctx.fillStyle = "#1A6BFF";
    ctx.fillRect(x + 8, y - 40 + bob, 18, 24);

    // backpack cargueira
    ctx.fillStyle = "#C45C26";
    ctx.fillRect(x - 2, y - 44 + bob, 14, 28);
    ctx.fillStyle = "#8B3E14";
    ctx.fillRect(x, y - 40 + bob, 10, 8);
    ctx.fillRect(x, y - 28 + bob, 10, 6);
    ctx.strokeStyle = "#5A2A0E";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 44 + bob, 14, 28);

    // head / avatar
    if (avatarReady && avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + 17, y - 48 + bob, 14, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, x + 3, y - 62 + bob, 28, 28);
      ctx.restore();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 17, y - 48 + bob, 14, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#F2C7A4";
      ctx.beginPath();
      ctx.arc(x + 17, y - 48 + bob, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0B3D91";
      ctx.beginPath();
      ctx.arc(x + 17, y - 52 + bob, 9, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x + 8, y - 52 + bob, 18, 4);
    }

    // arms
    ctx.strokeStyle = "#F2C7A4";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 34 + bob);
    ctx.lineTo(x + 2, y - 22 + bob + (player.onGround ? -leg * 0.3 : -6));
    ctx.moveTo(x + 24, y - 34 + bob);
    ctx.lineTo(x + 32, y - 22 + bob + (player.onGround ? leg * 0.3 : -6));
    ctx.stroke();
  }

  function drawRock(obs) {
    ctx.fillStyle = "#6E727A";
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y);
    ctx.lineTo(obs.x + 8, obs.y - obs.h);
    ctx.lineTo(obs.x + obs.w - 6, obs.y - obs.h + 4);
    ctx.lineTo(obs.x + obs.w, obs.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9AA0A8";
    ctx.beginPath();
    ctx.ellipse(obs.x + 14, obs.y - 16, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake(obs) {
    const wave = Math.sin(obs.phase || 0) * 3;
    ctx.strokeStyle = "#2F8F3A";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y - 4);
    ctx.quadraticCurveTo(obs.x + 16, obs.y - 14 + wave, obs.x + 32, obs.y - 4);
    ctx.quadraticCurveTo(obs.x + 40, obs.y + 2 - wave, obs.x + obs.w, obs.y - 6);
    ctx.stroke();
    ctx.fillStyle = "#F5E66B";
    ctx.beginPath();
    ctx.arc(obs.x + obs.w - 2, obs.y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.fillRect(obs.x + obs.w, obs.y - 9, 2, 2);
  }

  function drawLog(obs) {
    ctx.fillStyle = "#7A4A22";
    ctx.fillRect(obs.x, obs.y - obs.h, obs.w, obs.h);
    ctx.fillStyle = "#A56B3A";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w, obs.y - obs.h / 2, 7, obs.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5A3214";
    ctx.lineWidth = 2;
    for (let i = 1; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(obs.x + i * 16, obs.y - obs.h + 3);
      ctx.lineTo(obs.x + i * 16, obs.y - 3);
      ctx.stroke();
    }
  }

  function drawWaterfall(obs) {
    const grad = ctx.createLinearGradient(obs.x, obs.y - 120, obs.x, obs.y);
    grad.addColorStop(0, "rgba(180,220,255,0.15)");
    grad.addColorStop(1, "rgba(70,160,255,0.75)");
    ctx.fillStyle = grad;
    ctx.fillRect(obs.x + 8, obs.y - 120, obs.w - 16, 120);

    ctx.fillStyle = "#3D6FB5";
    ctx.fillRect(obs.x, obs.y - 18, obs.w, 18);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 5; i += 1) {
      const ox = obs.x + 12 + i * 8;
      const oy = obs.y - 100 + ((Date.now() / 30 + i * 17) % 90);
      ctx.fillRect(ox, oy, 3, 10);
    }
    ctx.fillStyle = "#8B6A3D";
    ctx.fillRect(obs.x - 8, obs.y - 122, 18, 14);
    ctx.fillRect(obs.x + obs.w - 10, obs.y - 122, 18, 14);
  }

  function drawRain(obs) {
    ctx.fillStyle = "rgba(90,110,140,0.75)";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w / 2, obs.cloudY, obs.w * 0.42, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(obs.x + 22, obs.cloudY + 6, 22, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(obs.x + obs.w - 22, obs.cloudY + 6, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4A6A3A";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w / 2, obs.y - 4, obs.w * 0.4, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(80,140,200,0.45)";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w / 2, obs.y - 6, obs.w * 0.32, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRainDrops() {
    ctx.strokeStyle = "rgba(200,230,255,0.8)";
    ctx.lineWidth = 1.5;
    rainDrops.forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 2, d.y + 10);
      ctx.stroke();
    });
  }

  function drawObstacles() {
    obstacles.forEach((obs) => {
      if (obs.type === "rock") drawRock(obs);
      else if (obs.type === "snake") drawSnake(obs);
      else if (obs.type === "log") drawLog(obs);
      else if (obs.type === "waterfall") drawWaterfall(obs);
      else if (obs.type === "rain") drawRain(obs);
    });
    drawRainDrops();
  }

  function drawHudCorner() {
    if (!alive) return;
    ctx.fillStyle = "rgba(4,24,51,0.35)";
    ctx.fillRect(12, 12, 120, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.fillText(`${Math.floor(distance / 18)} m`, 24, 32);
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    drawBackground();
    drawObstacles();
    drawPlayer();
    drawHudCorner();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    resetWorld();
    alive = true;
    running = true;
    hideOverlay();
    lastTs = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function activate() {
    resize();
    resetWorld();
    drawBackground();
    drawPlayer();
    showOverlay(best > 0 ? `Recorde atual: ${Math.floor(best)} m` : "Pronto para a trilha?", "Começar");
  }

  function deactivate() {
    pause();
    alive = false;
  }

  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    start();
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!alive) return;
    jump();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      if (elsActive()) {
        e.preventDefault();
        if (!alive && !overlay.hidden) start();
        else jump();
      }
    }
  });

  function elsActive() {
    const view = document.getElementById("view-trail");
    return view && view.classList.contains("is-active");
  }

  window.addEventListener("resize", () => {
    resize();
    if (!running) {
      drawBackground();
      drawPlayer();
    }
  });

  resize();
  updateHud();
  showOverlay("Pronto para a trilha?", "Começar");

  window.SDZ_TRAIL_GAME = { activate, deactivate, jump, setAvatar };
})();
