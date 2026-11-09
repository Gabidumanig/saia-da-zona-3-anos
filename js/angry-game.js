(() => {
  const BEST_KEY = "sdz3_angry_best";
  const LEVEL_COUNT = 3;

  const LEADERS = [
    { id: "franz", name: "Franz", src: "assets/avatars/franz-bandage.svg?v=91", power: 1.05 },
    { id: "diego", name: "Diego", src: "assets/avatars/diego-v6.svg?v=91", power: 1 },
    { id: "gabi", name: "Gabi", src: "assets/avatars/gabi-v7.svg?v=91", power: 1.08 },
    { id: "jin", name: "Jin", src: "assets/avatars/jin-v6.svg?v=91", power: 1 },
    { id: "caio", name: "Caio", src: "assets/avatars/caio-v7.svg?v=91", power: 1.12 },
    { id: "matheus", name: "Matheus", src: "assets/avatars/matheus-v6.svg?v=91", power: 1.02 },
  ];

  const canvas = document.getElementById("angry-canvas");
  const overlay = document.getElementById("angry-overlay");
  const messageEl = document.getElementById("angry-message");
  const startBtn = document.getElementById("angry-start");
  const scoreEl = document.getElementById("angry-score");
  const levelEl = document.getElementById("angry-level");
  const bestEl = document.getElementById("angry-best");
  const ammoEl = document.getElementById("angry-ammo");

  if (!canvas || !overlay || !startBtn) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 52;
  const SLING = { x: 118, y: GROUND_Y - 78 };
  const MAX_PULL = 118;
  const G = 1680;

  let active = false;
  let running = false;
  let raf = 0;
  let lastTs = 0;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let levelIndex = 0;
  let bodies = [];
  let ammo = [];
  let bird = null;
  let aiming = false;
  let pull = { x: 0, y: 0 };
  let pointerId = null;
  let settledTimer = 0;
  let waitingNext = false;
  let particles = [];
  let clouds = [];
  let shake = 0;
  let leaderImgs = {};
  let runSubmitted = false;

  function loadLeaders() {
    LEADERS.forEach((leader) => {
      const img = new Image();
      img.onload = () => {
        leaderImgs[leader.id] = img;
      };
      img.src = leader.src;
    });
  }

  function updateChrome() {
    if (scoreEl) scoreEl.textContent = `${score} pts`;
    if (levelEl) levelEl.textContent = `Nível ${Math.min(levelIndex + 1, LEVEL_COUNT)} / ${LEVEL_COUNT}`;
    if (bestEl) bestEl.textContent = `Recorde ${best}`;
    if (ammoEl) {
      const left = ammo.length + (bird && bird.state === "ready" ? 1 : 0);
      ammoEl.textContent = `${left} líder${left === 1 ? "" : "es"}`;
    }
  }

  function showOverlay(text, btnLabel = "Continuar") {
    if (messageEl) messageEl.textContent = text;
    if (startBtn) startBtn.textContent = btnLabel;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function makeBox(x, y, w, h, kind) {
    const hp = kind === "stone" ? 2 : kind === "wood" ? 1 : 1;
    const mass = kind === "stone" ? 2.4 : 1.2;
    return {
      type: "box",
      kind,
      x,
      y,
      w,
      h,
      vx: 0,
      vy: 0,
      hp,
      mass,
      restitution: kind === "stone" ? 0.15 : 0.28,
      friction: 0.82,
      alive: true,
      points: kind === "stone" ? 400 : 600,
    };
  }

  function makePig(x, y, label = "Zonado") {
    return {
      type: "circle",
      kind: "pig",
      label,
      x,
      y,
      r: 22,
      vx: 0,
      vy: 0,
      hp: 1,
      mass: 1,
      restitution: 0.35,
      friction: 0.78,
      alive: true,
      points: 5000,
    };
  }

  function makeBird(leader) {
    return {
      type: "circle",
      kind: "bird",
      leader,
      x: SLING.x,
      y: SLING.y,
      r: 24,
      vx: 0,
      vy: 0,
      mass: 1.1,
      restitution: 0.42,
      friction: 0.7,
      alive: true,
      state: "ready",
      launched: false,
      points: 0,
    };
  }

  function stackY(heights) {
    // heights: array from ground up; returns center Y for the top piece
    let top = GROUND_Y;
    let y = GROUND_Y;
    heights.forEach((h) => {
      y = top - h / 2;
      top -= h;
    });
    return y;
  }

  function levelLayout(index) {
    const list = [];
    if (index === 0) {
      // Pedreira da entrada
      list.push(makeBox(560, stackY([34]), 46, 34, "wood"));
      list.push(makeBox(610, stackY([34]), 46, 34, "wood"));
      list.push(makeBox(585, stackY([34, 36]), 52, 36, "wood"));
      list.push(makePig(585, stackY([34, 36]) - 36 / 2 - 22));
      list.push(makeBox(700, stackY([40]), 50, 40, "stone"));
      list.push(makePig(700, stackY([40]) - 20 - 22, "Barraca"));
    } else if (index === 1) {
      // Ponte da cachoeira
      list.push(makeBox(520, stackY([36]), 44, 36, "wood"));
      list.push(makeBox(568, stackY([36]), 44, 36, "wood"));
      list.push(makeBox(616, stackY([36]), 44, 36, "wood"));
      list.push(makeBox(544, stackY([36, 38]), 48, 38, "wood"));
      list.push(makeBox(592, stackY([36, 38]), 48, 38, "wood"));
      list.push(makeBox(568, stackY([36, 38, 38]), 54, 38, "stone"));
      list.push(makePig(545, stackY([36, 38]) - 19 - 22));
      list.push(makePig(600, stackY([36, 38]) - 19 - 22));
      list.push(makePig(568, stackY([36, 38, 38]) - 19 - 22, "Pepino"));
      list.push(makeBox(720, stackY([44]), 56, 44, "stone"));
      list.push(makeBox(720, stackY([44, 42]), 48, 42, "wood"));
      list.push(makePig(720, stackY([44, 42]) - 21 - 22, "Atum"));
    } else {
      // Acampamento zonado
      for (let i = 0; i < 4; i += 1) {
        list.push(makeBox(500 + i * 48, stackY([38]), 44, 38, i % 2 ? "stone" : "wood"));
      }
      for (let i = 0; i < 3; i += 1) {
        list.push(makeBox(524 + i * 48, stackY([38, 38]), 44, 38, "wood"));
      }
      list.push(makeBox(548, stackY([38, 38, 40]), 48, 40, "stone"));
      list.push(makeBox(596, stackY([38, 38, 40]), 48, 40, "stone"));
      list.push(makeBox(572, stackY([38, 38, 40, 40]), 54, 40, "wood"));
      list.push(makePig(548, stackY([38, 38, 40]) - 20 - 22));
      list.push(makePig(600, stackY([38, 38, 40]) - 20 - 22));
      list.push(makePig(572, stackY([38, 38, 40, 40]) - 20 - 22, "Chefe"));
      list.push(makeBox(740, stackY([50]), 60, 50, "stone"));
      list.push(makeBox(740, stackY([50, 48]), 52, 48, "stone"));
      list.push(makePig(740, stackY([50, 48]) - 24 - 22, "Zonado"));
      list.push(makeBox(800, stackY([36]), 42, 36, "wood"));
      list.push(makePig(800, stackY([36]) - 18 - 22, "Barraca"));
    }
    return list;
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildAmmo() {
    const picks = shuffle(LEADERS).slice(0, 3);
    return picks.map((leader) => makeBird(leader));
  }

  function spawnParticles(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 180;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 80,
        life: 0.45 + Math.random() * 0.4,
        color,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function resetClouds() {
    clouds = Array.from({ length: 5 }, (_, i) => ({
      x: 40 + i * 180 + Math.random() * 40,
      y: 36 + (i % 3) * 28,
      w: 70 + Math.random() * 50,
      speed: 8 + Math.random() * 10,
    }));
  }

  function startLevel(index) {
    levelIndex = index;
    bodies = levelLayout(index);
    ammo = buildAmmo();
    bird = null;
    aiming = false;
    pull = { x: 0, y: 0 };
    settledTimer = 0;
    waitingNext = false;
    particles = [];
    shake = 0;
    loadNextBird();
    updateChrome();
    hideOverlay();
    running = true;
    lastTs = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function startRun() {
    if (window.SDZ_RANKING?.requireName && !window.SDZ_RANKING.requireName("angry")) {
      return;
    }
    score = 0;
    runSubmitted = false;
    resetClouds();
    startLevel(0);
  }

  function loadNextBird() {
    if (!ammo.length) {
      bird = null;
      return false;
    }
    bird = ammo.shift();
    bird.x = SLING.x;
    bird.y = SLING.y;
    bird.vx = 0;
    bird.vy = 0;
    bird.state = "ready";
    bird.launched = false;
    updateChrome();
    return true;
  }

  function pigsLeft() {
    return bodies.filter((b) => b.alive && b.kind === "pig").length;
  }

  function dynamicBodies() {
    const list = bodies.filter((b) => b.alive);
    if (bird && bird.alive && bird.launched) list.push(bird);
    return list;
  }

  function awardDestroy(body) {
    score += body.points || 0;
    const color =
      body.kind === "pig" ? "#7BC96F" : body.kind === "stone" ? "#9AA3AE" : "#C48A4A";
    spawnParticles(body.x, body.y, color, body.kind === "pig" ? 16 : 10);
    shake = Math.min(10, shake + (body.kind === "pig" ? 6 : 3));
    updateChrome();
  }

  function damage(body, amount, impact) {
    if (!body.alive || body.kind === "bird") return;
    if (impact < 90 && body.kind === "stone") return;
    if (impact < 70 && body.kind === "wood") return;
    if (impact < 55 && body.kind === "pig") return;
    body.hp -= amount;
    if (body.hp <= 0) {
      body.alive = false;
      awardDestroy(body);
    }
  }

  function resolveCircleCircle(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const min = a.r + b.r;
    if (dist >= min) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = min - dist;
    const invA = 1 / a.mass;
    const invB = 1 / b.mass;
    const invSum = invA + invB;
    a.x -= nx * overlap * (invA / invSum);
    a.y -= ny * overlap * (invA / invSum);
    b.x += nx * overlap * (invB / invSum);
    b.y += ny * overlap * (invB / invSum);
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;
    const e = Math.min(a.restitution, b.restitution);
    const j = (-(1 + e) * velN) / invSum;
    const ix = j * nx;
    const iy = j * ny;
    a.vx -= ix * invA;
    a.vy -= iy * invA;
    b.vx += ix * invB;
    b.vy += iy * invB;
    const impact = Math.abs(velN);
    damage(a, 1, impact);
    damage(b, 1, impact);
  }

  function resolveCircleBox(circle, box) {
    const nearestX = Math.max(box.x - box.w / 2, Math.min(circle.x, box.x + box.w / 2));
    const nearestY = Math.max(box.y - box.h / 2, Math.min(circle.y, box.y + box.h / 2));
    let dx = circle.x - nearestX;
    let dy = circle.y - nearestY;
    let dist = Math.hypot(dx, dy);
    if (dist === 0) {
      dx = 0;
      dy = -1;
      dist = 0.0001;
    }
    if (dist >= circle.r) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = circle.r - dist;
    const invC = 1 / circle.mass;
    const invB = 1 / box.mass;
    const invSum = invC + invB;
    circle.x += nx * overlap * (invC / invSum);
    circle.y += ny * overlap * (invC / invSum);
    box.x -= nx * overlap * (invB / invSum);
    box.y -= ny * overlap * (invB / invSum);
    const rvx = circle.vx - box.vx;
    const rvy = circle.vy - box.vy;
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;
    const e = Math.min(circle.restitution, box.restitution);
    const j = (-(1 + e) * velN) / invSum;
    circle.vx += j * nx * invC;
    circle.vy += j * ny * invC;
    box.vx -= j * nx * invB;
    box.vy -= j * ny * invB;
    const impact = Math.abs(velN);
    damage(box, 1, impact);
    if (circle.kind === "pig") damage(circle, 1, impact);
  }

  function resolveBoxBox(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const overlapX = (a.w + b.w) / 2 - Math.abs(dx);
    const overlapY = (a.h + b.h) / 2 - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) return;
    const invA = 1 / a.mass;
    const invB = 1 / b.mass;
    const invSum = invA + invB;
    let nx = 0;
    let ny = 0;
    let overlap = 0;
    if (overlapX < overlapY) {
      nx = dx < 0 ? -1 : 1;
      overlap = overlapX;
    } else {
      ny = dy < 0 ? -1 : 1;
      overlap = overlapY;
    }
    a.x -= nx * overlap * (invA / invSum);
    a.y -= ny * overlap * (invA / invSum);
    b.x += nx * overlap * (invB / invSum);
    b.y += ny * overlap * (invB / invSum);
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;
    const e = Math.min(a.restitution, b.restitution);
    const j = (-(1 + e) * velN) / invSum;
    a.vx -= j * nx * invA;
    a.vy -= j * ny * invA;
    b.vx += j * nx * invB;
    b.vy += j * ny * invB;
    const impact = Math.abs(velN);
    damage(a, 1, impact);
    damage(b, 1, impact);
  }

  function collideGround(body) {
    if (body.type === "circle") {
      if (body.y + body.r > GROUND_Y) {
        body.y = GROUND_Y - body.r;
        if (body.vy > 0) {
          const impact = body.vy;
          body.vy *= -body.restitution;
          body.vx *= body.friction;
          if (Math.abs(body.vy) < 40) body.vy = 0;
          damage(body, 1, impact);
        }
      }
    } else if (body.y + body.h / 2 > GROUND_Y) {
      body.y = GROUND_Y - body.h / 2;
      if (body.vy > 0) {
        const impact = body.vy;
        body.vy *= -body.restitution;
        body.vx *= body.friction;
        if (Math.abs(body.vy) < 35) body.vy = 0;
        damage(body, 1, impact);
      }
    }
    body.x = Math.max(24, Math.min(W - 24, body.x));
  }

  function integrate(body, dt) {
    body.vy += G * dt;
    body.vx *= 1 - 0.18 * dt;
    body.vy *= 1 - 0.04 * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    collideGround(body);
    if (body.y > H + 80) {
      body.alive = false;
      if (body.kind === "pig") awardDestroy(body);
    }
  }

  function worldSettled() {
    return dynamicBodies().every((b) => Math.hypot(b.vx, b.vy) < 28);
  }

  function finishLevel(cleared) {
    running = false;
    if (cleared) {
      const leftover = ammo.length + (bird && bird.state === "ready" ? 1 : 0);
      score += 8000 + leftover * 2500;
      updateChrome();
      if (levelIndex >= LEVEL_COUNT - 1) {
        finishRun(true);
      } else {
        showOverlay(`Trilha liberada! Próximo: nível ${levelIndex + 2}`, "Próximo nível");
        startBtn.dataset.action = "next-level";
      }
    } else {
      finishRun(false);
    }
  }

  function finishRun(won) {
    running = false;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateChrome();
    if (!runSubmitted && score > 0 && window.SDZ_PLAYER?.submitScore) {
      runSubmitted = true;
      window.SDZ_PLAYER.submitScore("angry", score);
    }
    const title = won
      ? `Missão cumprida! ${score} pts`
      : pigsLeft() > 0
        ? `Os zonados ficaram na trilha… ${score} pts`
        : `Fim da trilha! ${score} pts`;
    showOverlay(title, "Jogar de novo");
    startBtn.dataset.action = "restart";
  }

  function afterShotCheck(dt) {
    if (!bird || !bird.launched || waitingNext) return;
    if (!worldSettled()) {
      settledTimer = 0;
      return;
    }
    settledTimer += dt;
    if (settledTimer < 0.55) return;

    if (pigsLeft() <= 0) {
      finishLevel(true);
      return;
    }

    if (bird && bird.alive) {
      bird.alive = false;
      bird = null;
    }

    if (!loadNextBird()) {
      // última chance: espera um pouco e encerra
      waitingNext = true;
      setTimeout(() => {
        if (pigsLeft() <= 0) finishLevel(true);
        else finishRun(false);
      }, 500);
      return;
    }
    settledTimer = 0;
  }

  function step(dt) {
    const list = dynamicBodies();
    for (let i = 0; i < list.length; i += 1) integrate(list[i], dt);

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a.type === "circle" && b.type === "circle") resolveCircleCircle(a, b);
        else if (a.type === "circle" && b.type === "box") resolveCircleBox(a, b);
        else if (a.type === "box" && b.type === "circle") resolveCircleBox(b, a);
        else resolveBoxBox(a, b);
      }
    }

    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      return p.life > 0;
    });

    clouds.forEach((c) => {
      c.x += c.speed * dt;
      if (c.x > W + 80) c.x = -80;
    });

    if (shake > 0) shake = Math.max(0, shake - dt * 18);
    afterShotCheck(dt);
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#7EC8E8");
    sky.addColorStop(0.55, "#B7DFA8");
    sky.addColorStop(1, "#5F8F4A");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.55, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 24, c.y + 4, c.w * 0.35, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 28, c.y + 2, c.w * 0.32, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // montanhas
    ctx.fillStyle = "#3F6B45";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 40);
    ctx.lineTo(120, GROUND_Y - 150);
    ctx.lineTo(240, GROUND_Y - 60);
    ctx.lineTo(360, GROUND_Y - 180);
    ctx.lineTo(500, GROUND_Y - 70);
    ctx.lineTo(640, GROUND_Y - 160);
    ctx.lineTo(780, GROUND_Y - 55);
    ctx.lineTo(W, GROUND_Y - 120);
    ctx.lineTo(W, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.fill();

    ctx.fillStyle = "#2F5536";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 10);
    ctx.lineTo(90, GROUND_Y - 90);
    ctx.lineTo(180, GROUND_Y - 30);
    ctx.lineTo(300, GROUND_Y - 110);
    ctx.lineTo(420, GROUND_Y - 25);
    ctx.lineTo(560, GROUND_Y - 95);
    ctx.lineTo(700, GROUND_Y - 20);
    ctx.lineTo(W, GROUND_Y - 70);
    ctx.lineTo(W, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.fill();

    // trilha de terra
    ctx.fillStyle = "#8B6A40";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#A88452";
    ctx.fillRect(0, GROUND_Y, W, 10);
    for (let x = 20; x < W; x += 48) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(x, GROUND_Y + 16, 22, 4);
    }

    // árvores simples
    [
      [40, 0.85],
      [210, 1],
      [430, 0.75],
      [860, 0.9],
    ].forEach(([x, s]) => {
      ctx.fillStyle = "#6B4226";
      ctx.fillRect(x - 4 * s, GROUND_Y - 46 * s, 8 * s, 46 * s);
      ctx.fillStyle = "#2F7A3C";
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y - 110 * s);
      ctx.lineTo(x + 28 * s, GROUND_Y - 48 * s);
      ctx.lineTo(x - 28 * s, GROUND_Y - 48 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y - 88 * s);
      ctx.lineTo(x + 24 * s, GROUND_Y - 36 * s);
      ctx.lineTo(x - 24 * s, GROUND_Y - 36 * s);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawSling() {
    // forquilha / bastões de trilha
    ctx.strokeStyle = "#5C3A1E";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(SLING.x - 18, GROUND_Y);
    ctx.lineTo(SLING.x - 10, SLING.y - 34);
    ctx.moveTo(SLING.x + 18, GROUND_Y);
    ctx.lineTo(SLING.x + 10, SLING.y - 34);
    ctx.stroke();

    const anchorL = { x: SLING.x - 14, y: SLING.y - 28 };
    const anchorR = { x: SLING.x + 14, y: SLING.y - 28 };
    const hold =
      bird && bird.state === "ready"
        ? { x: bird.x, y: bird.y }
        : { x: SLING.x, y: SLING.y };

    ctx.strokeStyle = "#2A1A10";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(anchorL.x, anchorL.y);
    ctx.lineTo(hold.x, hold.y);
    ctx.lineTo(anchorR.x, anchorR.y);
    ctx.stroke();

    // base
    ctx.fillStyle = "#6B4423";
    ctx.fillRect(SLING.x - 26, GROUND_Y - 12, 52, 12);
  }

  function drawBox(body) {
    const x = body.x - body.w / 2;
    const y = body.y - body.h / 2;
    if (body.kind === "stone") {
      ctx.fillStyle = "#8B949E";
      ctx.strokeStyle = "#5C6570";
    } else {
      ctx.fillStyle = "#C99555";
      ctx.strokeStyle = "#8A5A2B";
    }
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, body.w, body.h);
    ctx.strokeRect(x, y, body.w, body.h);
    if (body.kind === "wood") {
      ctx.strokeStyle = "rgba(90,50,20,0.35)";
      ctx.beginPath();
      ctx.moveTo(x + 6, y + body.h * 0.35);
      ctx.lineTo(x + body.w - 6, y + body.h * 0.35);
      ctx.moveTo(x + 8, y + body.h * 0.7);
      ctx.lineTo(x + body.w - 8, y + body.h * 0.7);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x + 4, y + 4, body.w * 0.35, 5);
    }
  }

  function drawPig(body) {
    ctx.save();
    ctx.translate(body.x, body.y);
    // barraca / zonado
    ctx.fillStyle = "#5FAF55";
    ctx.beginPath();
    ctx.arc(0, 0, body.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3E8A3A";
    ctx.beginPath();
    ctx.ellipse(0, 4, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#163018";
    ctx.beginPath();
    ctx.arc(-7, -4, 3, 0, Math.PI * 2);
    ctx.arc(7, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 9px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(body.label || "Zonado", 0, body.r + 12);
    ctx.restore();
  }

  function drawBird(body) {
    const img = leaderImgs[body.leader.id];
    const size = body.r * 2.15;
    ctx.save();
    ctx.translate(body.x, body.y);
    if (body.launched) {
      const ang = Math.atan2(body.vy, body.vx);
      ctx.rotate(ang * 0.35);
    }
    ctx.beginPath();
    ctx.arc(0, 0, body.r + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "#1A6BFF";
      ctx.beginPath();
      ctx.arc(0, 0, body.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAimGuide() {
    if (!bird || bird.state !== "ready" || !aiming) return;
    const power = Math.hypot(pull.x, pull.y) / MAX_PULL;
    const vx = (-pull.x / MAX_PULL) * 980 * bird.leader.power * power;
    const vy = (-pull.y / MAX_PULL) * 980 * bird.leader.power * power;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    let x = bird.x;
    let y = bird.y;
    let lv = vx;
    let ly = vy;
    for (let i = 0; i < 14; i += 1) {
      ly += G * 0.035;
      x += lv * 0.035;
      y += ly * 0.035;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAmmoPreview() {
    const queue = [...ammo];
    queue.forEach((b, i) => {
      const x = 36;
      const y = GROUND_Y - 30 - i * 42;
      const img = leaderImgs[b.leader.id];
      if (img) ctx.drawImage(img, x - 16, y - 18, 32, 36);
      else {
        ctx.fillStyle = "#1A6BFF";
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function draw() {
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(ox, oy);
    drawBackground();
    drawSling();
    drawAmmoPreview();
    bodies.forEach((b) => {
      if (!b.alive) return;
      if (b.type === "box") drawBox(b);
      else if (b.kind === "pig") drawPig(b);
    });
    if (bird && bird.alive) drawBird(bird);
    drawAimGuide();
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.restore();

    // HUD no canvas
    ctx.fillStyle = "rgba(8,24,16,0.45)";
    ctx.fillRect(12, 12, 210, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.textAlign = "left";
    const levelNames = ["Pedreira", "Cachoeira", "Acampamento"];
    ctx.fillText(`${levelNames[levelIndex] || "Trilha"} · ${pigsLeft()} zonado(s)`, 22, 34);
  }

  function frame(ts) {
    if (!active) {
      raf = 0;
      return;
    }
    if (!lastTs) lastTs = ts;
    let dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    if (running) {
      const steps = 2;
      for (let i = 0; i < steps; i += 1) step(dt / steps);
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const src = e.touches && e.touches[0] ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(e) {
    if (!running || !bird || bird.state !== "ready") return;
    const p = canvasPoint(e);
    if (Math.hypot(p.x - bird.x, p.y - bird.y) > 56 && Math.hypot(p.x - SLING.x, p.y - SLING.y) > 70) {
      return;
    }
    aiming = true;
    pointerId = e.pointerId;
    canvas.setPointerCapture?.(pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!aiming || !bird || bird.state !== "ready") return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    const p = canvasPoint(e);
    let dx = p.x - SLING.x;
    let dy = p.y - SLING.y;
    // puxa principalmente para trás/baixo
    dx = Math.min(40, dx);
    const len = Math.hypot(dx, dy);
    if (len > MAX_PULL) {
      dx = (dx / len) * MAX_PULL;
      dy = (dy / len) * MAX_PULL;
    }
    pull = { x: dx, y: dy };
    bird.x = SLING.x + dx;
    bird.y = SLING.y + dy;
    e.preventDefault();
  }

  function launchBird() {
    if (!bird || bird.state !== "ready") return;
    const power = Math.min(1, Math.hypot(pull.x, pull.y) / MAX_PULL);
    if (power < 0.12) {
      bird.x = SLING.x;
      bird.y = SLING.y;
      pull = { x: 0, y: 0 };
      return;
    }
    const mult = 980 * bird.leader.power * power;
    bird.vx = (-pull.x / MAX_PULL) * mult;
    bird.vy = (-pull.y / MAX_PULL) * mult;
    bird.state = "flight";
    bird.launched = true;
    settledTimer = 0;
    aiming = false;
    pull = { x: 0, y: 0 };
  }

  function onPointerUp(e) {
    if (!aiming) return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    aiming = false;
    pointerId = null;
    launchBird();
    e.preventDefault();
  }

  startBtn.addEventListener("click", () => {
    const action = startBtn.dataset.action || "start";
    if (action === "next-level") {
      startLevel(levelIndex + 1);
      startBtn.dataset.action = "start";
      return;
    }
    startRun();
    startBtn.dataset.action = "start";
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  function activate() {
    active = true;
    updateChrome();
    if (!raf) {
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    }
    if (!running) draw();
  }

  function deactivate() {
    active = false;
    aiming = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  loadLeaders();
  resetClouds();
  updateChrome();
  showOverlay("Puxe o estilingue e libere a trilha dos zonados!", "Começar");
  startBtn.dataset.action = "start";
  draw();

  window.SDZ_ANGRY_GAME = { activate, deactivate, LEADERS };
})();
