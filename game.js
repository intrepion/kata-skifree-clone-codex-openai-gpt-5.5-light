(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var distanceEl = document.getElementById("distance");
  var scoreEl = document.getElementById("score");
  var statusEl = document.getElementById("status");
  var menu = document.getElementById("menu");
  var startButton = document.getElementById("start-button");

  var WORLD_WIDTH = 1400;
  var SKIER_Y_RATIO = 0.34;
  var PLAYER_RADIUS = 15;
  var OBSTACLE_AHEAD = 2600;
  var START_SEED = 1936;

  var state = makeInitialState(START_SEED);
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
      crashedAt: 0,
      obstacles: generateObstacles(seed >>> 0, OBSTACLE_AHEAD)
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
    state.score = Math.floor(state.distance);
    checkObstacleCollision();
    updateHud();
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
      var radius = obstacle.type === "tree" ? 20 : obstacle.type === "rock" ? 15 : 13;
      var forgivingRadius = radius + PLAYER_RADIUS - 8;
      if (Math.abs(obstacle.x - state.x) < forgivingRadius && Math.abs(dy) < forgivingRadius) {
        crash();
        return;
      }
    }
  }

  function render() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);
    drawSnow(width, height);
    drawLaneHints(width, height);
    drawObstacles(width, height);
    drawSkier(width / 2 + state.x, height * SKIER_Y_RATIO);
    if (state.mode === "crashed") {
      drawCrashText(width, height);
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
    statusEl.textContent = state.mode === "running" ? "Running" : state.mode === "crashed" ? "Crashed" : "Ready";
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

  Array.prototype.forEach.call(document.querySelectorAll("[data-touch]"), function (button) {
    var action = button.getAttribute("data-touch");
    button.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      if (action === "left") {
        keys.left = true;
      } else if (action === "right") {
        keys.right = true;
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
        obstacleCount: state.obstacles.length,
        testObstacle: state.obstacles.filter(function (obstacle) {
          return obstacle.testObstacle;
        })[0] || null
      };
    },
    forceDistance: function (distance) {
      state.distance = distance;
      state.score = Math.floor(distance);
      updateHud();
    },
    forceCrash: crash
  };

  resize();
  updateHud();
  requestAnimationFrame(loop);
})();
