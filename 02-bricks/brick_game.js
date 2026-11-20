const field = document.querySelector("#field");
const context = field.getContext("2d");
const scoreText = document.querySelector("#score");
const ballCountText = document.querySelector("#ball-count");
const stateText = document.querySelector("#state");
const messageText = document.querySelector("#message");
const playerName = document.querySelector("#player-name");
const playerStyle = document.querySelector("#player-style");
const avatar = document.querySelector("#profile-avatar");
const leaderboard = document.querySelector("#leaderboard");
const personalBest = document.querySelector("#personal-best");
const overlay = document.querySelector("#game-over");
const resultText = document.querySelector("#result");
const restartHint = document.querySelector("#restart-hint");

const brickRows = 4;
const brickColumns = 6;
const brickWidth = 140;
const brickHeight = 50;
const brickGap = 14;
const pointsPerBrick = 10;
const paddleSpeed = 560;
const ballSpeed = 390;
const ballRadius = 11;

function currentBallSpeed() {
  return ballSpeed * Math.min(1.6, 1 + Math.max(0, balls.length - 1) * 0.05);
}

const paddle = { x: 0, y: field.height - 85, width: 150, height: 15 };
let balls = [];
let items = [];
let trail = [];
const trailSpacing = 16;
let trailTick = 0;
const pressedKeys = new Set();

let bricks = [];
let score = 0;
let remainingBricks = 0;
let state = "대기";
let lastTime;
let difficultyTime = 0;
let rowsCleared = 0;
let records = [];
let activePlayer = null;
const storageKey = "brickGameRecordsV1";

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (Array.isArray(saved)) records = saved.filter((record) =>
    record && typeof record.name === "string" && Number.isFinite(record.best) &&
    ["green", "blue", "red"].includes(record.style));
  const profile = JSON.parse(localStorage.getItem("brickGameProfileV1") || "null");
  if (profile && typeof profile.name === "string") playerName.value = profile.name.slice(0, 16);
  if (profile && ["green", "blue", "red"].includes(profile.style)) playerStyle.value = profile.style;
} catch {
  records = [];
}

function updateProfile() {
  const name = playerName.value.trim() || "플레이어";
  avatar.dataset.style = playerStyle.value;
  const ownRecord = records.find((record) => record.name === name);
  personalBest.textContent = `${ownRecord ? ownRecord.best : 0}개`;
  leaderboard.replaceChildren();
  const ranking = [...records].sort((a, b) => b.best - a.best || a.name.localeCompare(b.name, "ko"));
  for (const record of ranking.slice(0, 10)) {
    const entry = document.createElement("li");
    const icon = document.createElement("span");
    icon.className = "rank-avatar";
    icon.dataset.style = record.style;
    icon.textContent = "👤";
    const label = document.createElement("span");
    label.textContent = ` ${record.name} · ${record.best}개`;
    entry.append(icon, label);
    leaderboard.append(entry);
  }
  if (!ranking.length) {
    const entry = document.createElement("li");
    entry.textContent = "아직 기록이 없어요";
    leaderboard.append(entry);
  }
}

function saveRecord(count) {
  const existing = records.find((record) => record.name === activePlayer.name);
  if (existing) {
    if (count > existing.best) {
      existing.best = count;
      existing.style = activePlayer.style;
    }
  } else {
    records.push({ name: activePlayer.name, style: activePlayer.style, best: count });
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(records));
  } catch {
    messageText.textContent = "기록을 브라우저에 저장하지 못했습니다.";
  }
  updateProfile();
}

function showScore() {
  scoreText.textContent = `점수: ${score} (남은 벽돌: ${remainingBricks}개)`;
  ballCountText.textContent = `공 ${balls.length}개`;
}

function showState(nextState, message) {
  state = nextState;
  stateText.textContent = state;
  messageText.textContent = message;
}

function placeBallOnPaddle() {
  const ball = balls[0];
  ball.x = paddle.x + paddle.width / 2;
  ball.y = paddle.y - ball.radius;
}

function resetRound() {
  const rowWidth = brickColumns * brickWidth + (brickColumns - 1) * brickGap;
  const left = (field.width - rowWidth) / 2;
  bricks = [];
  items = [];
  const itemCells = [[0, 1], [0, 4], [1, 3], [2, 1], [3, 4]];

  for (let row = 0; row < brickRows; row += 1) {
    for (let column = 0; column < brickColumns; column += 1) {
      const x = left + column * (brickWidth + brickGap);
      const y = 24 + row * (brickHeight + brickGap);
      if (itemCells.some(([r, c]) => r === row && c === column)) {
        items.push({ x: x + brickWidth / 2, y: y + brickHeight / 2 });
        continue;
      }
      if ((row === 1 && column === 0) || (row === 2 && column === 5) || (row === 3 && column === 2)) continue;
      bricks.push({
        x,
        y,
        width: brickWidth,
        height: brickHeight,
        active: true,
        hits: 1 + ((row + column) % 3),
        row,
      });
    }
  }

  score = 0;
  difficultyTime = 0;
  rowsCleared = 0;
  remainingBricks = bricks.length;
  paddle.x = (field.width - paddle.width) / 2;
  balls = [{ x: 0, y: 0, radius: ballRadius, vx: 0, vy: 0 }];
  trail = [];
  trailTick = 0;
  placeBallOnPaddle();
  showScore();
}

function startRound() {
  activePlayer = { name: playerName.value.trim() || "플레이어", style: playerStyle.value };
  playerName.disabled = true;
  playerStyle.disabled = true;
  overlay.hidden = true;
  const ball = balls[0];
  const angle = Math.PI / 3;
  ball.vx = currentBallSpeed() * Math.cos(angle);
  ball.vy = -currentBallSpeed() * Math.sin(angle);
  showState("진행 중", "좌우 방향키로 막대를 움직이세요.");
}

function endRound(finalCount) {
  showState("게임 종료", `최종 점수: ${score}점. 스페이스키를 눌러 새 게임을 시작하세요.`);
  saveRecord(finalCount);
  resultText.textContent = `모은 공 ${finalCount}개 · 점수 ${score}점`;
  restartHint.textContent = "스페이스키로 다시 시작";
  overlay.hidden = false;
  playerName.disabled = false;
  playerStyle.disabled = false;
}

function movePaddle(seconds) {
  const right = Number(pressedKeys.has("ArrowRight"));
  const left = Number(pressedKeys.has("ArrowLeft"));
  const nextX = paddle.x + (right - left) * paddleSpeed * seconds;
  paddle.x = Math.max(0, Math.min(nextX, field.width - paddle.width));
}

function collisionWith(ball, rectangle) {
  const nearestX = Math.max(rectangle.x, Math.min(ball.x, rectangle.x + rectangle.width));
  const nearestY = Math.max(rectangle.y, Math.min(ball.y, rectangle.y + rectangle.height));
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;

  if (dx * dx + dy * dy > ball.radius * ball.radius) {
    return null;
  }
  return { dx, dy };
}

function moveBall(ball, seconds) {
  const previousX = ball.x;
  const previousY = ball.y;
  ball.x += ball.vx * seconds;
  ball.y += ball.vy * seconds;

  if (ball.x <= ball.radius && ball.vx < 0) {
    ball.x = ball.radius;
    ball.vx = -ball.vx;
  }
  if (ball.x >= field.width - ball.radius && ball.vx > 0) {
    ball.x = field.width - ball.radius;
    ball.vx = -ball.vx;
  }
  if (ball.y <= ball.radius && ball.vy < 0) {
    ball.y = ball.radius;
    ball.vy = -ball.vy;
  }

  if (ball.vy > 0 && previousY + ball.radius <= paddle.y + 1 && collisionWith(ball, paddle)) {
    const center = paddle.x + paddle.width / 2;
    const offset = (ball.x - center) / (paddle.width / 2);
    const angle = Math.max(-1, Math.min(offset, 1)) * Math.PI / 3;
    ball.y = paddle.y - ball.radius;
    ball.vx = currentBallSpeed() * Math.sin(angle);
    ball.vy = -currentBallSpeed() * Math.cos(angle);
    return;
  }

  for (const brick of bricks) {
    if (!brick.active) {
      continue;
    }

    const contact = collisionWith(ball, brick);
    if (!contact) {
      continue;
    }

    // 충돌 직전의 위치로 되돌린 뒤, 닿은 면에 수직인 방향을 뒤집습니다.
    if (Math.abs(contact.dx) > Math.abs(contact.dy)) {
      ball.vx = -ball.vx;
      ball.x = previousX;
    } else {
      ball.vy = -ball.vy;
      ball.y = previousY;
    }

    damageBrick(brick);

    return brick;
  }
}

function damageBrick(brick) {
  brick.hits -= 1;
  if (brick.hits === 0) {
    brick.active = false;
    remainingBricks -= 1;
    score += pointsPerBrick;
  }
}

function brickTouchesPaddle(brick) {
  return brick.active &&
    brick.x <= paddle.x + paddle.width && brick.x + brick.width >= paddle.x &&
    brick.y <= paddle.y + paddle.height && brick.y + brick.height >= paddle.y;
}

function advanceRows() {
  const distance = 100;
  let hitsPaddle = false;
  for (const brick of bricks) {
    if (!brick.active) continue;
    const previousBottom = brick.y + brick.height;
    brick.y = Math.min(brick.y + distance, paddle.y - brick.height);
    if (brick.x <= paddle.x + paddle.width && brick.x + brick.width >= paddle.x &&
        brick.y <= paddle.y + paddle.height && previousBottom <= paddle.y + paddle.height &&
        brick.y + brick.height >= paddle.y) {
      hitsPaddle = true;
    }
  }
  items = items.filter((item) => {
    item.y += distance;
    return item.y < field.height;
  });
  bricks = bricks.filter((brick) => brick.active);
  rowsCleared += 1;
  const left = (field.width - (brickColumns * brickWidth + (brickColumns - 1) * brickGap)) / 2;
  const itemColumn = rowsCleared % brickColumns;
  const emptyColumn = (itemColumn + 3) % brickColumns;
  for (let column = 0; column < brickColumns; column += 1) {
    const x = left + column * (brickWidth + brickGap);
    if (column === itemColumn) {
      items.push({ x: x + brickWidth / 2, y: 24 + brickHeight / 2 });
    } else if (column !== emptyColumn) {
      bricks.push({
        x, y: 24, width: brickWidth, height: brickHeight, active: true,
        hits: 1 + ((rowsCleared + column) % 3), row: 0,
      });
      remainingBricks += 1;
    }
  }
  return hitsPaddle;
}

function draw() {
  context.clearRect(0, 0, field.width, field.height);
  for (const brick of bricks) {
    if (brick.active) {
      context.fillStyle = brick.row < 2 ? "#659b36" : brick.row < 5 ? "#98643a" : "#82887f";
      context.fillRect(brick.x, brick.y, brick.width, brick.height);
      context.fillStyle = "#ffffff33";
      context.fillRect(brick.x + 3, brick.y + 3, brick.width - 6, 4);
      context.fillStyle = "#00000025";
      context.fillRect(brick.x + 5, brick.y + 20, 20, 4);
      context.fillStyle = "#fff4cb";
      context.font = 'bold 22px "Courier New", monospace';
      context.textAlign = "center";
      context.fillText(String(brick.hits), brick.x + brick.width / 2, brick.y + 31);
      context.textAlign = "start";
    }
  }
  context.fillStyle = "#59351c";
  context.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  context.fillStyle = "#a77541";
  context.fillRect(paddle.x + 5, paddle.y + 3, paddle.width - 10, 3);
  const x = paddle.x + paddle.width / 2;
  const muscle = Math.max(0, Math.min(2, Math.floor((balls.length - 1) / 2)));
  context.fillStyle = "#825636";
  context.fillRect(x - 40 - muscle * 3, paddle.y + 15, 10 + muscle * 3, 24);
  context.fillRect(x + 30, paddle.y + 15, 10 + muscle * 3, 24);
  context.fillRect(x - 40, paddle.y + 30, 80, 9 + muscle * 2);
  context.fillStyle = "#e0af7c";
  context.fillRect(x - 14, paddle.y + 18, 28, 22);
  context.fillStyle = "#a73537";
  context.fillRect(x - 16, paddle.y + 15, 30, 7);
  context.fillRect(x - 11, paddle.y + 12, 20, 4);
  context.fillRect(x + 8, paddle.y + 19, 12, 3);
  context.fillStyle = "#fff0ce";
  context.fillRect(x - 3, paddle.y + 15, 5, 4);
  context.fillStyle = "#35251f";
  context.fillRect(x - 8, paddle.y + 25, 3, 4);
  context.fillRect(x + 5, paddle.y + 25, 3, 4);
  context.fillStyle = "#ca766a";
  context.fillRect(x - 10, paddle.y + 32, 5, 2);
  context.fillRect(x + 6, paddle.y + 32, 5, 2);
  context.fillStyle = "#7d433a";
  context.fillRect(x - 2, paddle.y + 34, 4, 2);
  const style = activePlayer ? activePlayer.style : playerStyle.value;
  context.fillStyle = { green: "#417342", blue: "#386a91", red: "#a84f42" }[style];
  context.fillRect(x - 17 - muscle * 5, paddle.y + 40, 34 + muscle * 10, 18);
  if (muscle > 0) {
    context.fillStyle = "#d59b69";
    context.fillRect(x - 40 - muscle * 3, paddle.y + 21, 8 + muscle * 3, 10);
    context.fillRect(x + 32, paddle.y + 21, 8 + muscle * 3, 10);
  }
  context.fillStyle = "#413a31";
  context.fillRect(x - 20, paddle.y + 58, 15, 10);
  context.fillRect(x + 5, paddle.y + 58, 15, 10);
  for (const ball of balls) {
    context.fillStyle = "#596b59";
    context.fillRect(ball.x - 11, ball.y - 7, 22, 14);
    context.fillRect(ball.x - 7, ball.y - 11, 14, 22);
    context.fillStyle = "#fffaf0";
    context.fillRect(ball.x - 9, ball.y - 7, 18, 14);
    context.fillRect(ball.x - 7, ball.y - 9, 14, 18);
    context.fillStyle = "#bd3d38";
    context.fillRect(ball.x - 7, ball.y - 6, 3, 4);
    context.fillRect(ball.x - 5, ball.y, 3, 4);
    context.fillRect(ball.x + 4, ball.y - 6, 3, 4);
    context.fillRect(ball.x + 2, ball.y, 3, 4);
  }
  for (const item of items) {
    context.fillStyle = "#805513";
    context.fillRect(item.x - 9, item.y - 6, 18, 12);
    context.fillRect(item.x - 6, item.y - 9, 12, 18);
    context.fillStyle = "#f6cb4b";
    context.fillRect(item.x - 6, item.y - 6, 12, 12);
    context.fillStyle = "#4a310b";
    context.font = "bold 10px monospace";
    context.fillText("+", item.x - 3, item.y + 4);
  }
}

function frame(now) {
  const seconds = lastTime === undefined ? 0 : Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (state === "대기") {
    movePaddle(seconds);
    placeBallOnPaddle();
  } else if (state === "진행 중") {
    difficultyTime += seconds;
    if (difficultyTime >= 30) {
      difficultyTime -= 30;
      for (const brick of bricks) {
        if (brick.active) brick.hits += 1;
      }
    }
    // 한 번에 조금씩 움직여 공이 얇은 물체를 건너뛰지 않게 합니다.
    const steps = Math.max(1, Math.ceil(seconds * 240 * currentBallSpeed() / ballSpeed));
    for (let step = 0; step < steps && state === "진행 중"; step += 1) {
      movePaddle(seconds / steps);
      if (bricks.some(brickTouchesPaddle)) {
        endRound(balls.length);
        break;
      }
      const elapsed = seconds / steps;
      const leader = balls[0];
      const bottomY = Math.max(...bricks.filter((brick) => brick.active).map((brick) => brick.y));
      const hitBrick = moveBall(leader, elapsed);
      trailTick += 1;
      trail.unshift({ x: leader.x, y: leader.y, hitBrick, tick: trailTick });
      trail.length = Math.min(trail.length, (balls.length + 1) * trailSpacing);
      for (let i = 1; i < balls.length; i += 1) {
        const ball = balls[i];
        const position = trail[Math.min(i * trailSpacing, trail.length - 1)];
        ball.x = position.x;
        ball.y = position.y;
        if (trail.length > i * trailSpacing && position.tick >= ball.birthTick &&
            position.hitBrick && position.hitBrick.active) {
          damageBrick(position.hitBrick);
        }
      }
      items = items.filter((item) => {
        const touched = balls.some((ball) => Math.hypot(ball.x - item.x, ball.y - item.y) <= ball.radius + 9);
        if (touched) {
          const tail = balls[balls.length - 1];
          balls.push({ x: tail.x, y: tail.y, radius: ballRadius, birthTick: trailTick });
          const speed = Math.hypot(leader.vx, leader.vy);
          if (speed > 0) {
            const multiplier = currentBallSpeed() / speed;
            leader.vx *= multiplier;
            leader.vy *= multiplier;
          }
        }
        return !touched;
      });
      const bottomCleared = !bricks.some((brick) => brick.active && brick.y === bottomY);
      const hitsPaddle = bottomCleared && advanceRows();
      showScore();
      if (hitsPaddle || bricks.some(brickTouchesPaddle)) {
        endRound(balls.length);
      } else if (leader.y - leader.radius >= field.height) {
        placeBallOnPaddle();
        leader.vx = currentBallSpeed() * Math.cos(Math.PI / 3);
        leader.vy = -currentBallSpeed() * Math.sin(Math.PI / 3);
        trail = [];
        trailTick = 0;
        for (const ball of balls.slice(1)) {
          ball.x = leader.x;
          ball.y = leader.y;
          ball.birthTick = 0;
        }
      }
    }
  }

  draw();
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (event) => {
  if (event.target === playerName || event.target === playerStyle) return;
  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    event.preventDefault();
    pressedKeys.add(event.code);
  } else if (event.code === "Space") {
    event.preventDefault();
    if (event.repeat || state === "진행 중") {
      return;
    }

    if (state !== "대기") {
      resetRound();
    }
    startRound();
  }
});

document.addEventListener("keyup", (event) => pressedKeys.delete(event.code));
window.addEventListener("blur", () => pressedKeys.clear());
function saveProfile() {
  try {
    localStorage.setItem("brickGameProfileV1", JSON.stringify({ name: playerName.value, style: playerStyle.value }));
  } catch {
    messageText.textContent = "프로필을 브라우저에 저장하지 못했습니다.";
  }
  updateProfile();
}
playerName.addEventListener("input", saveProfile);
playerStyle.addEventListener("change", saveProfile);

resetRound();
updateProfile();
showState("대기", "스페이스키를 눌러 게임을 시작하세요.");
draw();
requestAnimationFrame(frame);
