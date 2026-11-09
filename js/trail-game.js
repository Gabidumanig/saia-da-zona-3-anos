(() => {
  const BEST_KEY = "sdz3_trail_best";
  const AVATAR_KEY = "sdz3_trail_avatar";
  const GRAVITY = 2200;
  const JUMP_V = -780;
  const SLOPE = 0.22; // sobe da esquerda pra direita
  const BASE_Y = 330; // chão sob o jogador

  const AVATARS = [
    { id: "franz", name: "Franz", src: "assets/avatars/franz-v6.svg?v=85" },
    { id: "diego", name: "Diego", src: "assets/avatars/diego-v6.svg?v=85" },
    { id: "gabi", name: "Gabi", src: "assets/avatars/gabi-v6.svg?v=85" },
    { id: "jin", name: "Jin", src: "assets/avatars/jin-v6.svg?v=85" },
    { id: "caio", name: "Caio", src: "assets/avatars/caio-v7.svg?v=85" },
    { id: "matheus", name: "Matheus", src: "assets/avatars/matheus-v6.svg?v=85" },
  ];

  const canvas = document.getElementById("trail-canvas");
  const overlay = document.getElementById("trail-overlay");
  const messageEl = document.getElementById("trail-message");
  const startBtn = document.getElementById("trail-start");
  const scoreEl = document.getElementById("trail-score");
  const bestEl = document.getElementById("trail-best");
  const avatarGrid = document.getElementById("avatar-grid");
  const avatarStatus = document.getElementById("avatar-status");

  if (!canvas || !overlay || !startBtn || !avatarGrid) return;

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
  let selectedAvatarId = localStorage.getItem(AVATAR_KEY) || null;
  let avatarImg = null;
  let avatarReady = false;
  let avatarName = "";

  const player = {
    x: 110,
    y: BASE_Y,
    vy: 0,
    w: 46,
    h: 64,
    onGround: true,
  };

  function groundY(x) {
    return BASE_Y - (x - player.x) * SLOPE;
  }

  function avatarById(id) {
    return AVATARS.find((a) => a.id === id) || null;
  }

  function setAvatar(id) {
    const avatar = avatarById(id);
    selectedAvatarId = avatar ? avatar.id : null;
    avatarReady = false;
    avatarImg = null;
    avatarName = avatar ? avatar.name : "";
    if (!avatar) return;
    localStorage.setItem(AVATAR_KEY, avatar.id);
    const img = new Image();
    img.onload = () => {
      avatarImg = img;
      avatarReady = true;
      if (!running) {
        drawBackground();
        drawPlayer();
      }
    };
    img.src = avatar.src;
  }

  function renderAvatarGrid() {
    avatarGrid.innerHTML = "";
    AVATARS.forEach((avatar) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "avatar-card";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", avatar.name);
      if (selectedAvatarId === avatar.id) btn.classList.add("is-selected");
      btn.innerHTML = `<strong>${avatar.name}</strong><img src="${avatar.src}" alt="${avatar.name}" width="96" height="112" />`;
      btn.addEventListener("click", () => {
        setAvatar(avatar.id);
        renderAvatarGrid();
        if (avatarStatus) avatarStatus.textContent = `Avatar selecionado: ${avatar.name}. Agora toque em Começar.`;
        if (!alive) showOverlay(`Vamos com ${avatar.name}!`, "Começar");
      });
      avatarGrid.appendChild(btn);
    });

    if (avatarStatus && !selectedAvatarId) {
      avatarStatus.textContent = "Toque em um avatar para selecionar.";
    }
  }

  function resize() {
    const parent = canvas.parentElement;
    const maxW = Math.min(900, parent.clientWidth);
    const ratio = 420 / 900;
    canvas.style.width = `${maxW}px`;
    canvas.style.height = `${Math.round(maxW * ratio)}px`;
  }

  function resetWorld() {
    distance = 0;
    speed = 280;
    spawnTimer = 0.8;
    obstacles = [];
    rainDrops = [];
    player.y = groundY(player.x);
    player.vy = 0;
    player.onGround = true;
    walkPhase = 0;
    clouds = Array.from({ length: 4 }, (_, i) => ({
      x: 80 + i * 220,
      y: 28 + (i % 2) * 18,
      w: 70 + (i % 3) * 18,
      s: 12 + i * 3,
    }));
    hills = Array.from({ length: 5 }, (_, i) => ({
      x: i * 220,
      h: 50 + (i % 3) * 20,
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
    const roll = Math.random();
    if (roll < 0.28) return "rock";
    if (roll < 0.48) return "snake";
    if (roll < 0.66) return "log";
    if (roll < 0.82) return "waterfall";
    return "rain";
  }

  function spawnObstacle() {
    const type = pickObstacle();
    const x = canvas.width + 40;
    const y = groundY(x);
    const base = { type, x, y, hit: false };

    if (type === "rock") {
      obstacles.push({ ...base, w: 36, h: 28 });
    } else if (type === "snake") {
      obstacles.push({ ...base, w: 62, h: 18, phase: 0 });
    } else if (type === "log") {
      obstacles.push({ ...base, w: 54, h: 22 });
    } else if (type === "waterfall") {
      obstacles.push({ ...base, w: 58, h: 120 });
    } else if (type === "rain") {
      obstacles.push({ ...base, w: 90, h: 24, cloudY: y - 120 });
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
      x: player.x + 8,
      y: player.y - player.h + 10,
      w: player.w - 14,
      h: player.h - 14,
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
    if (window.SDZ_PLAYER?.submitScore) {
      window.SDZ_PLAYER.submitScore("trail", meters, { avatar: selectedAvatarId || null });
    }
    showOverlay(`Queda na subida · ${meters} m`, "Tentar de novo");
  }

  function update(dt) {
    if (!alive) return;

    distance += speed * dt;
    speed = Math.min(520, 280 + distance / 900);
    walkPhase += dt * (player.onGround ? 10 : 0);

    const gy = groundY(player.x);
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= gy) {
      player.y = gy;
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
      obs.y = groundY(obs.x);
      if (obs.type === "snake") obs.phase = (obs.phase || 0) + dt * 8;
      if (obs.type === "rain") obs.cloudY = obs.y - 120;
    });
    obstacles = obstacles.filter((obs) => obs.x + obs.w > -40);

    clouds.forEach((c) => {
      c.x -= c.s * dt;
      if (c.x + c.w < 0) {
        c.x = canvas.width + 40;
        c.y = 24 + Math.random() * 40;
      }
    });
    hills.forEach((h) => {
      h.x -= speed * 0.25 * dt;
      if (h.x + h.w < 0) h.x += 220 * hills.length;
    });

    rainDrops = rainDrops.filter((d) => d.y < canvas.height + 10);
    obstacles
      .filter((o) => o.type === "rain")
      .forEach((o) => {
        if (Math.random() < 0.45) {
          rainDrops.push({
            x: o.x + 10 + Math.random() * (o.w - 20),
            y: (o.cloudY || o.y - 120) + 28,
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

  function drawTree(tx, baseY, scale, dark) {
    const trunkH = 70 * scale;
    const trunkW = 12 * scale;
    ctx.fillStyle = dark ? "#3A2414" : "#5A3A1E";
    ctx.fillRect(tx - trunkW / 2, baseY - trunkH, trunkW, trunkH);

    const greens = dark
      ? ["#1A4A24", "#245C30", "#1F5530"]
      : ["#2F7A3A", "#3D9148", "#2A6B34"];
    for (let layer = 0; layer < 3; layer += 1) {
      const top = baseY - trunkH - 18 * scale - layer * 28 * scale;
      const half = (42 - layer * 6) * scale;
      ctx.fillStyle = greens[layer];
      ctx.beginPath();
      ctx.moveTo(tx - half, baseY - trunkH + 10 * scale - layer * 22 * scale);
      ctx.lineTo(tx, top);
      ctx.lineTo(tx + half, baseY - trunkH + 10 * scale - layer * 22 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBackground() {
    const W = canvas.width;
    const H = canvas.height;
    const y0 = groundY(0);
    const y1 = groundY(W);

    // céu de serra
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7EC8E8");
    g.addColorStop(0.35, "#4F9A6A");
    g.addColorStop(0.7, "#3D7A48");
    g.addColorStop(1, "#2F5A34");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // morros distantes inclinados
    hills.forEach((h, i) => {
      const hy = groundY(h.x + h.w / 2) - h.h - 20;
      ctx.fillStyle = i % 2 ? "#2E5A34" : "#244A2C";
      ctx.beginPath();
      ctx.moveTo(h.x - 20, groundY(h.x - 20));
      ctx.quadraticCurveTo(h.x + h.w / 2, hy, h.x + h.w + 20, groundY(h.x + h.w + 20));
      ctx.lineTo(h.x + h.w + 20, H);
      ctx.lineTo(h.x - 20, H);
      ctx.closePath();
      ctx.fill();
    });

    // árvores ao longo da encosta
    for (let i = 0; i < 10; i += 1) {
      const span = W + 160;
      const tx = ((i * 110 - distance * 0.12) % span + span) % span - 40;
      drawTree(tx, groundY(tx) + 4, 0.7 + (i % 3) * 0.08, true);
    }
    for (let i = 0; i < 8; i += 1) {
      const span = W + 200;
      const tx = ((i * 140 - distance * 0.28) % span + span) % span - 50;
      drawTree(tx, groundY(tx) + 2, 1 + (i % 2) * 0.15, false);
    }

    // nuvens
    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.45, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 22, c.y + 4, 22, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 24, c.y + 4, 24, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // faixa de terra inclinada (abaixo da trilha)
    ctx.fillStyle = "#5A3A1E";
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(W, y1);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // trilha de terra
    ctx.fillStyle = "#6B4A28";
    ctx.beginPath();
    ctx.moveTo(0, y0 - 6);
    ctx.lineTo(W, y1 - 6);
    ctx.lineTo(W, y1 + 28);
    ctx.lineTo(0, y0 + 28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#8B6438";
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(W, y1);
    ctx.lineTo(W, y1 + 16);
    ctx.lineTo(0, y0 + 16);
    ctx.closePath();
    ctx.fill();

    // gramado na borda superior da trilha
    ctx.fillStyle = "#3D6B32";
    ctx.beginPath();
    ctx.moveTo(0, y0 - 10);
    ctx.lineTo(W, y1 - 10);
    ctx.lineTo(W, y1 - 2);
    ctx.lineTo(0, y0 - 2);
    ctx.closePath();
    ctx.fill();

    // pegadas / pedras na trilha
    const stripe = (distance * 0.55) % 48;
    ctx.fillStyle = "rgba(50, 32, 16, 0.28)";
    for (let x = -stripe; x < W; x += 48) {
      const gy = groundY(x);
      ctx.beginPath();
      ctx.ellipse(x + 10, gy + 10, 10, 4, -Math.atan(SLOPE), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 28, gy + 18, 8, 3.5, -Math.atan(SLOPE) + 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // arbustos na beira
    for (let i = 0; i < 7; i += 1) {
      const span = W + 90;
      const bx = ((i * 130 - distance * 0.55) % span + span) % span - 30;
      const by = groundY(bx);
      ctx.fillStyle = i % 2 ? "#2A6B34" : "#1F5530";
      ctx.beginPath();
      ctx.ellipse(bx, by + 4, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - 8, by);
      ctx.quadraticCurveTo(bx - 18, by - 22, bx - 2, by - 14);
      ctx.quadraticCurveTo(bx + 4, by - 26, bx + 10, by - 8);
      ctx.fill();
    }
  }

  function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const bob = player.onGround ? Math.sin(walkPhase) * 2 : 0;
    const tilt = -Math.atan(SLOPE);

    ctx.save();
    ctx.translate(x + 22, y);
    ctx.rotate(tilt);
    ctx.translate(-(x + 22), -y);

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 22, y + 4, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (avatarReady && avatarImg) {
      const h = 72;
      const w = 62;
      ctx.drawImage(avatarImg, x - 4, y - h + bob, w, h);

      if (avatarName) {
        ctx.font = "700 13px Manrope, sans-serif";
        const tw = ctx.measureText(avatarName).width;
        const labelX = x + w / 2 - 4;
        const labelY = y - h + bob - 8;
        ctx.fillStyle = "rgba(4, 24, 51, 0.7)";
        ctx.beginPath();
        ctx.roundRect(labelX - tw / 2 - 8, labelY - 14, tw + 16, 20, 10);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(avatarName, labelX, labelY);
        ctx.textAlign = "left";
      }
      ctx.restore();
      return;
    }

    const leg = player.onGround ? Math.sin(walkPhase) * 7 : 4;
    ctx.strokeStyle = "#1A2A4A";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 18 + bob);
    ctx.lineTo(x + 10 - leg, y + bob);
    ctx.moveTo(x + 18, y - 18 + bob);
    ctx.lineTo(x + 22 + leg, y + bob);
    ctx.stroke();
    ctx.fillStyle = "#1A6BFF";
    ctx.fillRect(x + 8, y - 40 + bob, 18, 24);
    ctx.fillStyle = "#C45C26";
    ctx.fillRect(x - 2, y - 44 + bob, 14, 28);
    ctx.fillStyle = "#F2C7A4";
    ctx.beginPath();
    ctx.arc(x + 17, y - 48 + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    const wave = Math.sin(obs.phase || 0) * 3.5;
    const bands = ["#E23B2F", "#1A1A1A", "#F5D76E", "#1A1A1A"];
    const segs = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // corpo ondulado com faixas de coral (vermelho / preto / amarelo)
    for (let i = 0; i < segs; i += 1) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const x0 = obs.x + obs.w * t0;
      const x1 = obs.x + obs.w * t1;
      const y0 = obs.y - 6 + Math.sin(t0 * Math.PI * 2 + (obs.phase || 0)) * wave;
      const y1 = obs.y - 6 + Math.sin(t1 * Math.PI * 2 + (obs.phase || 0)) * wave;
      ctx.strokeStyle = bands[i % bands.length];
      ctx.lineWidth = 9 - (i === 0 || i === segs - 1 ? 1.5 : 0);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // cabeca preta + olho
    const hx = obs.x + obs.w - 2;
    const hy = obs.y - 8 + Math.sin((obs.phase || 0) + 1.2) * 1.5;
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(hx, hy, 6.5, 5, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F5D76E";
    ctx.beginPath();
    ctx.arc(hx + 2, hy - 1.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(hx + 2.4, hy - 1.5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // linguinha
    ctx.strokeStyle = "#E23B2F";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(hx + 6, hy);
    ctx.lineTo(hx + 11, hy - 2);
    ctx.moveTo(hx + 6, hy);
    ctx.lineTo(hx + 11, hy + 2);
    ctx.stroke();
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
    const cloudY = obs.cloudY || obs.y - 120;
    ctx.fillStyle = "rgba(90,110,140,0.75)";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w / 2, cloudY, obs.w * 0.42, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(obs.x + 22, cloudY + 6, 22, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(obs.x + obs.w - 22, cloudY + 6, 22, 12, 0, 0, Math.PI * 2);
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
    if (window.SDZ_RANKING?.requireName && !window.SDZ_RANKING.requireName("trail")) {
      showOverlay("Salva teu nome acima pra jogar", "Começar");
      return;
    }
    if (!selectedAvatarId || !avatarReady) {
      showOverlay("Escolha um avatar para começar", "Começar");
      return;
    }
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
    renderAvatarGrid();
    if (selectedAvatarId) setAvatar(selectedAvatarId);
    resetWorld();
    drawBackground();
    drawPlayer();
    const av = avatarById(selectedAvatarId);
    showOverlay(
      av
        ? best > 0
          ? `${av.name} · recorde ${Math.floor(best)} m`
          : `Vamos com ${av.name}!`
        : "Escolha um avatar para começar",
      "Começar"
    );
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
    const t = e.target;
    const tag = (t && t.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
    if (document.getElementById("name-modal")?.classList.contains("is-open")) return;
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
      player.y = groundY(player.x);
      drawBackground();
      drawPlayer();
    }
  });

  resize();
  renderAvatarGrid();
  if (selectedAvatarId) setAvatar(selectedAvatarId);
  resetWorld();
  updateHud();
  showOverlay(
    selectedAvatarId ? "Jogo: Trilha" : "Escolha um avatar para começar",
    "Começar"
  );

  window.SDZ_TRAIL_GAME = { activate, deactivate, jump, setAvatar, AVATARS };
})();
