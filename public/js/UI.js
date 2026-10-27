/**
 * UI Manager: Handles HUD updates, 2D Radar Minimap, Speedometer gauge, Lobbies, and Modals.
 */
export class UIManager {
  constructor() {
    // DOM Elements
    this.menuModal = document.getElementById('menu-modal');
    this.roomLobbyModal = document.getElementById('room-lobby-modal');
    this.resultsModal = document.getElementById('results-modal');
    this.hudLayer = document.getElementById('hud-layer');
    this.controlsHint = document.getElementById('controls-hint');

    // HUD Elements
    this.speedNum = document.getElementById('hud-speed-num');
    this.speedBar = document.getElementById('hud-speed-bar');
    this.speedGear = document.getElementById('hud-gear');
    this.posRank = document.getElementById('hud-pos-rank');
    this.posTotal = document.getElementById('hud-pos-total');
    this.lapCount = document.getElementById('hud-lap-count');
    this.raceTime = document.getElementById('hud-race-time');
    this.leaderboardList = document.getElementById('leaderboard-list');
    this.countdownBanner = document.getElementById('countdown-banner');
    this.driftBanner = document.getElementById('drift-banner');
    this.pingDisplay = document.getElementById('ping-display');

    // Minimap Canvas
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Lobby Elements
    this.roomCodeText = document.getElementById('room-code-text');
    this.lobbyPlayerList = document.getElementById('lobby-player-list');
    this.playerCountNum = document.getElementById('player-count-num');
    this.btnStartRace = document.getElementById('btn-start-race');
    this.btnReadyToggle = document.getElementById('btn-ready-toggle');
    this.resultsTableBody = document.getElementById('results-table-body');

    this.selectedColor = '#ff0055';
    this.setupColorPicker();
    this.setupRoomCodeCopy();
  }

  setupColorPicker() {
    const dots = document.querySelectorAll('.color-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        dots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.selectedColor = dot.getAttribute('data-color');
      });
    });
  }

  setupRoomCodeCopy() {
    const badge = document.getElementById('room-code-display');
    if (badge) {
      badge.addEventListener('click', () => {
        const code = this.roomCodeText.innerText;
        if (code && code !== '------') {
          navigator.clipboard.writeText(code).then(() => {
            alert(`Room Code ${code} copied to clipboard!`);
          }).catch(() => {});
        }
      });
    }
  }

  getSelectedColor() {
    return this.selectedColor;
  }

  getPlayerName() {
    const input = document.getElementById('player-name-input');
    return (input?.value || 'SpeedRacer').trim();
  }

  showMainMenu() {
    this.menuModal.style.display = 'flex';
    this.roomLobbyModal.style.display = 'none';
    this.resultsModal.style.display = 'none';
    this.hudLayer.style.display = 'none';
    this.controlsHint.style.display = 'none';
  }

  showRoomLobby(roomData, localPlayerId) {
    this.menuModal.style.display = 'none';
    this.roomLobbyModal.style.display = 'flex';
    this.resultsModal.style.display = 'none';
    this.hudLayer.style.display = 'none';
    this.controlsHint.style.display = 'none';

    this.updateRoomLobby(roomData, localPlayerId);
  }

  updateRoomLobby(roomData, localPlayerId) {
    if (!roomData) return;

    this.roomCodeText.innerText = roomData.roomId || '------';
    this.playerCountNum.innerText = (roomData.players || []).length;

    // Check if local player is host
    const isHost = roomData.hostId === localPlayerId;
    this.btnStartRace.style.display = isHost ? 'block' : 'none';

    // Populate player list
    this.lobbyPlayerList.innerHTML = '';
    (roomData.players || []).forEach(player => {
      const li = document.createElement('li');
      li.className = 'player-item';

      const isMe = player.id === localPlayerId;
      const hostBadge = player.isHost ? '<span class="player-badge badge-host">HOST</span>' : '';
      const readyBadge = player.ready ? '<span class="player-badge badge-ready">READY</span>' : '';

      li.innerHTML = `
        <div class="player-info">
          <div class="player-color-preview" style="background:${player.color}; color:${player.color};"></div>
          <span class="player-name">${player.name} ${isMe ? '(You)' : ''}</span>
        </div>
        <div style="display:flex; gap:6px;">
          ${hostBadge}
          ${readyBadge}
        </div>
      `;
      this.lobbyPlayerList.appendChild(li);
    });
  }

  showGameHUD() {
    this.menuModal.style.display = 'none';
    this.roomLobbyModal.style.display = 'none';
    this.resultsModal.style.display = 'none';
    this.hudLayer.style.display = 'block';
    this.controlsHint.style.display = 'flex';
  }

  updateSpeedometer(speedMps) {
    // Convert m/s to KM/H (1 m/s = 3.6 km/h)
    const kmh = Math.round(Math.abs(speedMps) * 3.6);
    this.speedNum.innerText = kmh;

    // Speed bar fill (0 - 240 km/h)
    const percent = Math.min(100, (kmh / 240) * 100);
    this.speedBar.style.width = `${percent}%`;

    // Gear indicator
    let gear = '1';
    if (speedMps < -0.5) gear = 'R';
    else if (kmh < 40) gear = '1';
    else if (kmh < 80) gear = '2';
    else if (kmh < 125) gear = '3';
    else if (kmh < 170) gear = '4';
    else if (kmh < 210) gear = '5';
    else gear = '6';

    this.speedGear.innerText = gear;
  }

  updatePosition(rank, total) {
    this.posRank.innerText = rank || 1;
    this.posTotal.innerText = `/ ${total || 1}`;
  }

  updateLap(currentLap, totalLaps) {
    this.lapCount.innerText = `${Math.min(currentLap, totalLaps)} / ${totalLaps}`;
  }

  updateRaceTime(elapsedSeconds) {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = Math.floor(elapsedSeconds % 60);
    const ms = Math.floor((elapsedSeconds % 1) * 100);

    const pad = (n) => String(n).padStart(2, '0');
    this.raceTime.innerText = `${pad(mins)}:${pad(secs)}.${pad(ms)}`;
  }

  updateLeaderboard(leaderboard, localPlayerId) {
    if (!leaderboard) return;
    this.leaderboardList.innerHTML = '';

    leaderboard.forEach(item => {
      const isMe = item.id === localPlayerId;
      const row = document.createElement('div');
      row.className = `lb-entry ${isMe ? 'is-me' : ''}`;

      const status = item.finished ? '🏁' : `L${item.lap}`;

      row.innerHTML = `
        <div class="lb-left">
          <span class="lb-rank">P${item.rank}</span>
          <span class="lb-color-tag" style="background:${item.color};"></span>
          <span class="lb-name">${item.name}</span>
        </div>
        <span class="lb-lap">${status}</span>
      `;
      this.leaderboardList.appendChild(row);
    });
  }

  showCountdown(count) {
    this.countdownBanner.style.display = 'block';
    this.countdownBanner.innerText = count;

    if (count === 'GO') {
      this.countdownBanner.style.color = '#39ff14';
      setTimeout(() => {
        this.countdownBanner.style.display = 'none';
        this.countdownBanner.style.color = '#ffe600';
      }, 1200);
    }
  }

  showDrift(isDrifting) {
    if (isDrifting) {
      this.driftBanner.classList.add('active');
    } else {
      this.driftBanner.classList.remove('active');
    }
  }

  updatePing(ms) {
    if (this.pingDisplay) {
      this.pingDisplay.innerText = `${ms} ms`;
    }
  }

  /**
   * Draws top-down circular radar minimap
   */
  renderMinimap(waypoints, players, localPlayerId) {
    if (!waypoints || waypoints.length === 0) return;

    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Map bounds calculation
    // Racetrack bounds are approximately X: -60 to 320, Z: -250 to 280
    const minX = -80, maxX = 330;
    const minZ = -260, maxZ = 300;
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;

    const mapX = (x) => 18 + ((x - minX) / spanX) * (w - 36);
    const mapY = (z) => 18 + ((z - minZ) / spanZ) * (h - 36);

    // 1. Draw track circuit line
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    waypoints.forEach((wp, idx) => {
      const mx = mapX(wp.x);
      const my = mapY(wp.z);
      if (idx === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.stroke();

    // 2. Draw Start/Finish marker
    const startX = mapX(waypoints[0].x);
    const startY = mapY(waypoints[0].z);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(startX - 3, startY - 3, 6, 6);

    // 3. Draw Remote Players
    for (const [id, p] of Object.entries(players)) {
      if (id === localPlayerId) continue;
      const px = mapX(p.x);
      const py = mapY(p.z);

      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color || '#ff0055';
      ctx.fill();
    }

    // 4. Draw Local Player (Bright pulsing cyan with heading arrow)
    const local = players[localPlayerId];
    if (local) {
      const lx = mapX(local.x);
      const ly = mapY(local.z);

      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Heading indicator
      const forwardX = Math.sin(local.angle || 0);
      const forwardZ = Math.cos(local.angle || 0);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + forwardX * 8, ly + forwardZ * 8);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  showResultsPodium(leaderboard) {
    this.resultsModal.style.display = 'flex';
    this.resultsTableBody.innerHTML = '';

    (leaderboard || []).forEach(item => {
      const tr = document.createElement('tr');

      let rankClass = '';
      if (item.rank === 1) rankClass = 'rank-gold';
      else if (item.rank === 2) rankClass = 'rank-silver';
      else if (item.rank === 3) rankClass = 'rank-bronze';

      const timeText = item.finishTime ? `${item.finishTime.toFixed(2)}s` : 'DNF';

      tr.innerHTML = `
        <td class="${rankClass}">#${item.rank}</td>
        <td style="color:${item.color}; font-weight:700;">${item.name}</td>
        <td>${item.finished ? 'FINISHED' : `Lap ${item.lap}`}</td>
        <td>${timeText}</td>
      `;
      this.resultsTableBody.appendChild(tr);
    });
  }
}
