(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var distanceEl = document.getElementById("distance");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var statusEl = document.getElementById("status");
  var menu = document.getElementById("menu");
  var startButton = document.getElementById("start-button");
  var newSlopeButton = document.getElementById("new-slope-button");
  var resetBestsButton = document.getElementById("reset-bests-button");

  var WORLD_WIDTH = 1400;
  var SKIER_Y_RATIO = 0.34;
  var PLAYER_RADIUS = 15;
  var OBSTACLE_AHEAD = 2600;
  var START_SEED = 1936;
  var BESTS_KEY = "slope-free-bests-v1";
  var YETI_WARNING_DISTANCE = 1200;
  var YETI_DISTANT_DISTANCE = 1450;
  var YETI_CHASE_DISTANCE = 1650;

  var state = makeInitialState(START_SEED);
  var bests = readBests();
  var audioContext = null;
  var lastTime = performance.now();
  var keys = { left: false, right: false };

  function makeInitialState(seed) {
    return {
      seed: seed >>> 0,
      mode: "ready",
      x: 0,
      distance: 0,
      speed: 235,
      steer: 0,
      score: 0,
      gateBonus: 0,
      trickBonus: 0,
      prestigeScore: 0,
      airborneUntil: 0,
      trickHeld: false,
      yetiState: "quiet",
      yetiX: -240,
      yetiGap: 290,
      nextToneAt: 0,
      crashedAt: 0,
      obstacles: generateObstacles(seed >>> 0, OBSTACLE_AHEAD),
      movingHazards: generateMovingHazards(seed >>> 0, OBSTACLE_AHEAD),
      gates: generateGates(seed >>> 0, OBSTACLE_AHEAD),
      jumps: generateJumps(seed >>> 0, OBSTACLE_AHEAD)
    };
  }

  function mulberry32(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateObstacles(seed, depth) {
    var random = mulberry32(seed);
    var obstacles = [];
    var y = 220;
    while (y < depth) {
      var cluster = 2 + Math.floor(random() * 3);
      for (var i = 0; i < cluster; i += 1) {
        var roll = random();
        obstacles.push({
          type: roll < 0.58 ? "tree" : roll < 0.82 ? "rock" : "stump",
          x: Math.round((random() - 0.5) * WORLD_WIDTH),
          y: Math.round(y + random() * 170)
        });
      }
      y += 210 + random() * 190;
    }
    obstacles.push({ type: "tree", x: 0, y: 720, testObstacle: true });
    obstacles.sort(function (a, b) {
      return a.y - b.y;
    });
    return obstacles;
  }

  function generateMovingHazards(seed, depth) {
    var random = mulberry32((seed ^ 0xc2b2ae35) >>> 0);
    var hazards = [];
    for (var y = 780; y < depth; y += 700) {
      hazards.push({
        x: Math.round((random() - 0.5) * (WORLD_WIDTH - 260)),
        y: y + Math.round(random() * 120),
        phase: random() * Math.PI * 2,
        span: 80 + random() * 90
      });
    }
    hazards.push({ x: -160, y: 1120, phase: 0, span: 120, testMovingHazard: true });
    hazards.sort(function (a, b) {
      return a.y - b.y;
    });
    return hazards;
  }

  function generateGates(seed, depth) {
    var random = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    var gates = [];
    for (var y = 380; y < depth; y += 420) {
      gates.push({
        x: Math.round((random() - 0.5) * (WORLD_WIDTH - 360)),
        y: y + Math.round(random() * 80),
        width: 124,
        passed: false
      });
    }
    gates.push({ x: 0, y: 520, width: 124, passed: false, testGate: true });
    gates.sort(function (a, b) {
      return a.y - b.y;
    });
    return gates;
  }

  function generateJumps(seed, depth) {
    var random = mulberry32((seed ^ 0x85ebca6b) >>> 0);
    var jumps = [];
    for (var y = 640; y < depth; y += 620) {
      jumps.push({
        x: Math.round((random() - 0.5) * (WORLD_WIDTH - 300)),
        y: y + Math.round(random() * 110),
        used: false
      });
    }
    jumps.push({ x: 0, y: 900, used: false, testJump: true });
    jumps.sort(function (a, b) {
      return a.y - b.y;
    });
    return jumps;
  }

  function resize() {
    var scale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * scale);
    canvas.height = Math.floor(window.innerHeight * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function startRun(seed) {
    state = makeInitialState(typeof seed === "number" ? seed : state.seed);
    state.mode = "running";
    menu.hidden = true;
    updateHud();
  }

  function restartRun() {
    startRun(state.seed);
  }

  function crash() {
    if (state.mode !== "running") {
      return;
    }
    saveBests();
    playTone(72, 0.18);
    state.mode = "crashed";
    state.crashedAt = performance.now();
    menu.hidden = false;
    startButton.textContent = "Restart Run";
    updateHud();
  }

  function update(dt) {
    if (state.mode !== "running") {
      return;
    }
    state.steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    state.x += state.steer * 340 * dt;
    state.x = clamp(state.x, -WORLD_WIDTH / 2 + 28, WORLD_WIDTH / 2 - 28);
    state.distance += state.speed * dt;
    checkGatePasses();
    checkJumpLaunches();
    updateYeti(dt);
    state.score = Math.floor(state.distance) + state.gateBonus + state.trickBonus + state.prestigeScore;
    checkObstacleCollision();
    checkMovingHazardCollision();
    checkYetiCapture();
    updateHud();
  }

  function updateYeti(dt) {
    if (state.distance >= YETI_CHASE_DISTANCE) {
      if (state.yetiState !== "chase") {
        playTone(128, 0.22);
      }
      state.yetiState = "chase";
      state.yetiGap = Math.max(38, state.yetiGap - 80 * dt);
      state.yetiX += (state.x - state.yetiX) * Math.min(1, dt * 2.1);
      state.prestigeScore += Math.floor(dt * 180);
      if (performance.now() > state.nextToneAt) {
        playTone(96, 0.08);
        state.nextToneAt = performance.now() + 1250;
      }
    } else if (state.distance >= YETI_DISTANT_DISTANCE) {
      if (state.yetiState !== "distant") {
        playTone(180, 0.16);
      }
      state.yetiState = "distant";
      state.yetiX += (state.x - 180 - state.yetiX) * Math.min(1, dt * 0.8);
    } else if (state.distance >= YETI_WARNING_DISTANCE) {
      if (state.yetiState !== "warning") {
        playTone(220, 0.12);
      }
      state.yetiState = "warning";
    }
  }

  function checkGatePasses() {
    for (var i = 0; i < state.gates.length; i += 1) {
      var gate = state.gates[i];
      if (gate.passed) {
        continue;
      }
      var dy = gate.y - state.distance;
      if (dy < -12) {
        if (Math.abs(state.x - gate.x) <= gate.width / 2) {
          gate.passed = true;
          state.gateBonus += 250;
          playTone(392, 0.08);
        } else {
          gate.passed = true;
        }
      } else if (dy > 30) {
        break;
      }
    }
  }

  function checkJumpLaunches() {
    for (var i = 0; i < state.jumps.length; i += 1) {
      var jump = state.jumps[i];
      if (jump.used) {
        continue;
      }
      var dy = jump.y - state.distance;
      if (dy < -10) {
        jump.used = true;
      } else if (dy <= 16 && Math.abs(state.x - jump.x) < 42) {
        jump.used = true;
        state.airborneUntil = state.distance + 170;
        state.trickHeld = false;
        playTone(300, 0.08);
      } else if (dy > 36) {
        break;
      }
    }
  }

  function checkObstacleCollision() {
    for (var i = 0; i < state.obstacles.length; i += 1) {
      var obstacle = state.obstacles[i];
      var dy = obstacle.y - state.distance;
      if (dy < -60) {
        continue;
      }
      if (dy > 42) {
        break;
      }
      if (isAirborne()) {
        continue;
      }
      var radius = obstacle.type === "tree" ? 20 : obstacle.type === "rock" ? 15 : 13;
      var forgivingRadius = radius + PLAYER_RADIUS - 8;
      if (Math.abs(obstacle.x - state.x) < forgivingRadius && Math.abs(dy) < forgivingRadius) {
        crash();
        return;
      }
    }
  }

  function checkMovingHazardCollision() {
    for (var i = 0; i < state.movingHazards.length; i += 1) {
      var hazard = state.movingHazards[i];
      var dy = hazard.y - state.distance;
      if (dy < -60) {
        continue;
      }
      if (dy > 42) {
        break;
      }
      var hazardX = hazard.x + Math.sin(state.distance / 120 + hazard.phase) * hazard.span;
      if (Math.abs(hazardX - state.x) < 26 && Math.abs(dy) < 24) {
        crash();
        return;
      }
    }
  }

  function checkYetiCapture() {
    if (state.yetiState !== "chase") {
      return;
    }
    if (state.yetiGap <= 42 && Math.abs(state.yetiX - state.x) < 60) {
      crash();
    }
  }

  function isAirborne() {
    return state.mode === "running" && state.distance < state.airborneUntil;
  }

  function render() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);
    drawSnow(width, height);
    drawLaneHints(width, height);
    drawGates(width, height);
    drawJumps(width, height);
    drawObstacles(width, height);
    drawMovingHazards(width, height);
    drawYeti(width, height);
    drawSkier(width / 2 + state.x, height * SKIER_Y_RATIO);
    if (state.mode === "crashed") {
      drawCrashText(width, height);
    }
  }

  function drawMovingHazards(width, height) {
    for (var i = 0; i < state.movingHazards.length; i += 1) {
      var hazard = state.movingHazards[i];
      var screenY = height * SKIER_Y_RATIO + (hazard.y - state.distance);
      if (screenY < -50 || screenY > height + 70) {
        continue;
      }
      var hazardX = hazard.x + Math.sin(state.distance / 120 + hazard.phase) * hazard.span;
      var screenX = width / 2 + (hazardX - state.x);
      ctx.fillStyle = "#2e76a8";
      ctx.fillRect(screenX - 18, screenY - 7, 36, 14);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(screenX - 11, screenY - 3, 22, 6);
    }
  }

  function drawYeti(width, height) {
    if (state.yetiState === "quiet") {
      return;
    }
    var y = height * SKIER_Y_RATIO + state.yetiGap;
    if (state.yetiState === "warning") {
      ctx.fillStyle = "#102131";
      ctx.font = "700 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Something is climbing the slope.", width / 2, height - 72);
      return;
    }
    var x = width / 2 + (state.yetiX - state.x);
    ctx.fillStyle = "#f4f7fa";
    ctx.strokeStyle = "#21313f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 22, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(x - 29, y - 14, 58, 62);
    ctx.strokeRect(x - 29, y - 14, 58, 62);
    ctx.fillStyle = "#21313f";
    ctx.fillRect(x - 10, y - 28, 5, 5);
    ctx.fillRect(x + 6, y - 28, 5, 5);
    ctx.fillRect(x - 11, y - 8, 22, 5);
  }

  function drawGates(width, height) {
    for (var i = 0; i < state.gates.length; i += 1) {
      var gate = state.gates[i];
      var screenY = height * SKIER_Y_RATIO + (gate.y - state.distance);
      if (screenY < -40 || screenY > height + 60) {
        continue;
      }
      var screenX = width / 2 + (gate.x - state.x);
      ctx.strokeStyle = gate.passed ? "#b5c6d3" : "#d92d2d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(screenX - gate.width / 2, screenY - 26);
      ctx.lineTo(screenX - gate.width / 2, screenY + 26);
      ctx.moveTo(screenX + gate.width / 2, screenY - 26);
      ctx.lineTo(screenX + gate.width / 2, screenY + 26);
      ctx.stroke();
    }
  }

  function drawJumps(width, height) {
    for (var i = 0; i < state.jumps.length; i += 1) {
      var jump = state.jumps[i];
      var screenY = height * SKIER_Y_RATIO + (jump.y - state.distance);
      if (screenY < -50 || screenY > height + 70) {
        continue;
      }
      var screenX = width / 2 + (jump.x - state.x);
      ctx.fillStyle = jump.used ? "#d6c9ad" : "#d8b46a";
      ctx.beginPath();
      ctx.moveTo(screenX - 34, screenY + 18);
      ctx.lineTo(screenX, screenY - 12);
      ctx.lineTo(screenX + 34, screenY + 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#8e6d2c";
      ctx.stroke();
    }
  }

  function drawSnow(width, height) {
    ctx.fillStyle = "#f8fcff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#d8e7f2";
    ctx.lineWidth = 1;
    for (var y = -40 + ((state.distance * 0.25) % 64); y < height + 40; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + 22);
      ctx.stroke();
    }
  }

  function drawLaneHints(width, height) {
    ctx.strokeStyle = "#e7f0f6";
    ctx.lineWidth = 2;
    var center = width / 2 - state.x;
    for (var offset = -600; offset <= 600; offset += 300) {
      ctx.beginPath();
      ctx.moveTo(center + offset, 0);
      ctx.lineTo(center + offset - 80, height);
      ctx.stroke();
    }
  }

  function drawObstacles(width, height) {
    for (var i = 0; i < state.obstacles.length; i += 1) {
      var obstacle = state.obstacles[i];
      var screenY = height * SKIER_Y_RATIO + (obstacle.y - state.distance);
      if (screenY < -60 || screenY > height + 80) {
        continue;
      }
      var screenX = width / 2 + (obstacle.x - state.x);
      if (screenX < -80 || screenX > width + 80) {
        continue;
      }
      if (obstacle.type === "tree") {
        drawTree(screenX, screenY);
      } else if (obstacle.type === "rock") {
        drawRock(screenX, screenY);
      } else {
        drawStump(screenX, screenY);
      }
    }
  }

  function drawTree(x, y) {
    ctx.fillStyle = "#1f6f43";
    ctx.beginPath();
    ctx.moveTo(x, y - 26);
    ctx.lineTo(x - 19, y + 12);
    ctx.lineTo(x + 19, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#704323";
    ctx.fillRect(x - 4, y + 10, 8, 14);
  }

  function drawRock(x, y) {
    ctx.fillStyle = "#77838d";
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 17, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#41505c";
    ctx.stroke();
  }

  function drawStump(x, y) {
    ctx.fillStyle = "#8d5830";
    ctx.fillRect(x - 11, y - 2, 22, 18);
    ctx.strokeStyle = "#5b351d";
    ctx.strokeRect(x - 11, y - 2, 22, 18);
  }

  function drawSkier(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state.steer * 0.22);
    if (isAirborne()) {
      ctx.translate(0, -18);
      ctx.scale(1.08, 1.08);
    }
    if (state.mode === "crashed") {
      ctx.rotate(1.25);
    }
    ctx.strokeStyle = "#192c3a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 19);
    ctx.lineTo(3, 9);
    ctx.moveTo(18, 19);
    ctx.lineTo(-3, 9);
    ctx.stroke();
    ctx.fillStyle = "#d92828";
    ctx.fillRect(-8, -14, 16, 24);
    ctx.fillStyle = "#102131";
    ctx.beginPath();
    ctx.arc(0, -20, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCrashText(width, height) {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillRect(width / 2 - 140, height / 2 - 34, 280, 68);
    ctx.strokeStyle = "#9fb3c8";
    ctx.strokeRect(width / 2 - 140, height / 2 - 34, 280, 68);
    ctx.fillStyle = "#102131";
    ctx.font = "700 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Tumble. Space to retry.", width / 2, height / 2 + 8);
  }

  function updateHud() {
    distanceEl.textContent = Math.floor(state.distance) + "m";
    scoreEl.textContent = String(state.score);
    bestEl.textContent = bests.score + " / " + bests.distance + "m";
    if (state.mode === "crashed") {
      statusEl.textContent = "Crashed";
    } else if (state.yetiState === "chase") {
      statusEl.textContent = "Yeti chase";
    } else if (state.yetiState === "distant") {
      statusEl.textContent = "Yeti sighted";
    } else if (state.yetiState === "warning") {
      statusEl.textContent = "Warning";
    } else {
      statusEl.textContent = state.mode === "running" ? "Running" : "Ready";
    }
  }

  function readBests() {
    try {
      var parsed = JSON.parse(localStorage.getItem(BESTS_KEY) || "{}");
      return {
        score: Number(parsed.score) || 0,
        distance: Number(parsed.distance) || 0
      };
    } catch (error) {
      return { score: 0, distance: 0 };
    }
  }

  function saveBests() {
    if (state.score > bests.score || state.distance > bests.distance) {
      bests = {
        score: Math.max(bests.score, state.score),
        distance: Math.max(bests.distance, Math.floor(state.distance))
      };
      localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
    }
  }

  function ensureAudio() {
    if (audioContext) {
      return audioContext;
    }
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    audioContext = new AudioCtor();
    return audioContext;
  }

  function playTone(frequency, duration) {
    var audio = ensureAudio();
    if (!audio) {
      return;
    }
    var oscillator = audio.createOscillator();
    var gain = audio.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "square";
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, audio.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration + 0.02);
  }

  function newSlope() {
    var nextSeed = (state.seed + 2654435761) >>> 0;
    startRun(nextSeed);
  }

  function triggerTrick() {
    if (!isAirborne() || state.trickHeld) {
      return;
    }
    state.trickHeld = true;
    state.trickBonus += 400;
    state.score = Math.floor(state.distance) + state.gateBonus + state.trickBonus + state.prestigeScore;
    playTone(520, 0.1);
    updateHud();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loop(now) {
    var dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      keys.left = true;
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      keys.right = true;
      event.preventDefault();
    } else if (event.code === "Space") {
      if (state.mode === "running") {
        return;
      }
      restartRun();
      event.preventDefault();
    } else if (event.key.toLowerCase() === "z") {
      triggerTrick();
    }
  });
  window.addEventListener("keyup", function (event) {
    if (event.key === "ArrowLeft") {
      keys.left = false;
    } else if (event.key === "ArrowRight") {
      keys.right = false;
    }
  });
  startButton.addEventListener("click", restartRun);
  newSlopeButton.addEventListener("click", newSlope);
  resetBestsButton.addEventListener("click", function () {
    bests = { score: 0, distance: 0 };
    localStorage.removeItem(BESTS_KEY);
    updateHud();
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-touch]"), function (button) {
    var action = button.getAttribute("data-touch");
    button.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      if (action === "left") {
        keys.left = true;
      } else if (action === "right") {
        keys.right = true;
      } else if (action === "trick") {
        triggerTrick();
      } else {
        restartRun();
      }
    });
    button.addEventListener("pointerup", function () {
      if (action === "left") {
        keys.left = false;
      } else if (action === "right") {
        keys.right = false;
      }
    });
    button.addEventListener("pointercancel", function () {
      keys.left = false;
      keys.right = false;
    });
  });

  window.skiFreeTest = {
    start: startRun,
    restart: restartRun,
    snapshot: function () {
      return {
        mode: state.mode,
        seed: state.seed,
        x: Math.round(state.x),
        distance: Math.floor(state.distance),
        score: state.score,
        gateBonus: state.gateBonus,
        trickBonus: state.trickBonus,
        prestigeScore: state.prestigeScore,
        airborne: isAirborne(),
        yetiState: state.yetiState,
        yetiGap: Math.round(state.yetiGap),
        bests: {
          score: bests.score,
          distance: bests.distance
        },
        obstacleCount: state.obstacles.length,
        movingHazardCount: state.movingHazards.length,
        gateCount: state.gates.length,
        jumpCount: state.jumps.length,
        testObstacle: state.obstacles.filter(function (obstacle) {
          return obstacle.testObstacle;
        })[0] || null,
        testGate: state.gates.filter(function (gate) {
          return gate.testGate;
        })[0] || null,
        testJump: state.jumps.filter(function (jump) {
          return jump.testJump;
        })[0] || null,
        testMovingHazard: state.movingHazards.filter(function (hazard) {
          return hazard.testMovingHazard;
        })[0] || null
      };
    },
    forceDistance: function (distance) {
      state.distance = distance;
      state.score = Math.floor(distance) + state.gateBonus + state.trickBonus;
      updateHud();
    },
    forceX: function (x) {
      state.x = x;
    },
    forceCrash: function () {
      crash();
      saveBests();
    },
    forceYetiPhase: function (distance) {
      state.distance = typeof distance === "number" ? distance : YETI_CHASE_DISTANCE + 10;
      state.yetiState = "chase";
      state.yetiGap = 40;
      state.yetiX = state.x;
      state.score = Math.floor(state.distance) + state.gateBonus + state.trickBonus + state.prestigeScore;
      updateHud();
    },
    newSlope: newSlope,
    resetBests: function () {
      bests = { score: 0, distance: 0 };
      localStorage.removeItem(BESTS_KEY);
      updateHud();
    }
  };

  resize();
  updateHud();
  requestAnimationFrame(loop);
})();
