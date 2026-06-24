// ============================================================
// ui.js — UI 렌더링 & 화면 전환
// ============================================================

// ── 화면 전환 ────────────────────────────────────────────────
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

// ── 팀 카드 렌더 ─────────────────────────────────────────────
function renderTeamCards(teams, containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const leagueNames = { 1: '⭐ 1부 리그', 2: '🥈 2부 리그', 3: '🥉 3부 리그' };
    const grouped = { 1: [], 2: [], 3: [] };
    for (const [key, team] of Object.entries(teams)) {
        grouped[team.league]?.push({ key, team });
    }

    for (const league of [1, 2, 3]) {
        if (grouped[league].length === 0) continue;
        const header = document.createElement('div');
        header.className = 'league-header';
        header.textContent = leagueNames[league];
        container.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'team-grid';
        for (const { key, team } of grouped[league]) {
            const avgOvr = teamAvgOvr(team.players);
            const card = document.createElement('div');
            card.className = 'team-card';
            card.innerHTML = `
                <div class="team-logo">${team.logoCode}</div>
                <div class="team-name">${team.displayName}</div>
                <div class="team-city">📍 ${team.city}</div>
                <div class="team-ovr">팀 OVR <span>${Math.round(avgOvr)}</span></div>
                <div class="team-budget">예산 <span>${team.budget}억</span></div>
                <div class="team-desc">${team.description}</div>
            `;
            card.onclick = () => onSelect(key, team);
            grid.appendChild(card);
        }
        container.appendChild(grid);
    }
}

// ── 선수 선택 렌더 ───────────────────────────────────────────
function renderPlayerCards(players, containerId, onSelect, filterFn = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const list = filterFn ? players.filter(filterFn) : players;
    const posOrder = { GK: 0, DF: 1, MF: 2, FW: 3 };
    list.sort((a, b) => (posOrder[a.position] - posOrder[b.position]) || b.rating - a.rating);

    for (const p of list) {
        const card = document.createElement('div');
        card.className = `player-card pos-${p.position}`;
        card.innerHTML = `
            <span class="pos-badge">${p.position}</span>
            <span class="player-name">${p.name}</span>
            <span class="player-ovr">OVR ${p.rating}</span>
            <span class="player-info">${p.country} · ${p.age}세</span>
        `;
        card.onclick = () => onSelect(p);
        container.appendChild(card);
    }
}

// ── HUD 업데이트 ─────────────────────────────────────────────
function updateHUD(gameState) {
    const player = gameState.player;
    if (!player) return;

    safeText('hud-name', player.name);
    safeText('hud-ovr', `OVR ${player.rating}`);
    safeText('hud-pos', player.position);
    safeText('hud-team', gameState.teams[player.teamKey]?.displayName || '-');
    safeText('hud-rep', `명성 ${player.reputation}`);
    safeText('hud-sp', `SP ${gameState.sp || 0}`);
    safeText('hud-date', `${gameState.date.year}/${String(gameState.date.month).padStart(2,'0')}`);
    safeText('hud-round', `라운드 ${gameState.currentRound + 1}/${gameState.totalRounds || '?'}`);

    const team = gameState.teams[player.teamKey];
    if (team) safeText('hud-league', `${team.league}부 리그`);
}

function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ── 매치 로그 렌더 ───────────────────────────────────────────
function renderMatchLog(events, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (const ev of events) {
        const line = document.createElement('div');
        line.className = `match-log-line ${ev.type || ''}`;
        line.textContent = ev.text || ev;
        container.appendChild(line);
    }
    container.scrollTop = container.scrollHeight;
}

// ── 스탯 바 렌더 ─────────────────────────────────────────────
function renderStatBars(player, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const stats = player.stats;
    const order = ['shooting','passing','dribbling','speed','defending','physicality',
                   'stamina','composure','aggressiveness','workRate','professionalism','judgment',
                   'ballControl','diving','injuryResistance'];

    for (const key of order) {
        if (stats[key] === undefined) continue;
        const val = stats[key];
        const pct = Math.round((val / 144) * 100);
        const colorClass = val >= 130 ? 'gold' : val >= 100 ? 'blue' : val >= 80 ? 'green' : 'gray';

        const row = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `
            <span class="stat-label">${STAT_NAMES[key] || key}</span>
            <div class="stat-bar-wrap">
                <div class="stat-bar ${colorClass}" style="width:${pct}%"></div>
            </div>
            <span class="stat-val ${colorClass}">${val}</span>
        `;
        container.appendChild(row);
    }
}

// ── 리그 테이블 렌더 ─────────────────────────────────────────
function renderLeagueTable(table, league, containerId, myTeamKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rows = getSortedTable(table, league);
    container.innerHTML = `
        <table class="league-table">
            <thead><tr>
                <th>#</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th>
                <th>득점</th><th>실점</th><th>득실</th><th>승점</th>
            </tr></thead>
            <tbody>${rows.map((r, i) => `
                <tr class="${r.key === myTeamKey ? 'my-team' : ''}">
                    <td>${i + 1}</td>
                    <td>${r.displayName}</td>
                    <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>
                    <td>${r.goalsFor}</td><td>${r.goalsAgainst}</td>
                    <td>${r.goalsFor - r.goalsAgainst}</td>
                    <td><strong>${r.points}</strong></td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

// ── 이벤트 모달 ─────────────────────────────────────────────
function showEventModal(event, onChoice) {
    const modal = document.getElementById('event-modal');
    if (!modal) return;

    document.getElementById('modal-title').textContent = event.title;
    document.getElementById('modal-desc').textContent = event.desc || event.question || '';

    const choicesEl = document.getElementById('modal-choices');
    choicesEl.innerHTML = '';
    (event.choices || []).forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'modal-choice-btn';
        btn.textContent = c.label;
        btn.onclick = () => { hideModal(); onChoice(i); };
        choicesEl.appendChild(btn);
    });

    modal.classList.add('active');
}

function hideModal() {
    const modal = document.getElementById('event-modal');
    if (modal) modal.classList.remove('active');
}

// ── 알림 토스트 ─────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 400); }, duration);
}

function createToastContainer() {
    const el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
    return el;
}

// ── 경력 카드 렌더 ───────────────────────────────────────────
function renderCareerCard(player, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const c = player.career;
    const avg = c.matchRatings && c.matchRatings.length > 0
        ? (c.matchRatings.reduce((a, b) => a + b, 0) / c.matchRatings.length).toFixed(2) : '-';

    container.innerHTML = `
        <div class="career-grid">
            <div class="career-stat"><span>⚽ 골</span><strong>${c.goals || 0}</strong></div>
            <div class="career-stat"><span>🅰️ 어시스트</span><strong>${c.assists || 0}</strong></div>
            <div class="career-stat"><span>🛡️ 결정적 수비</span><strong>${c.criticalDefenses || 0}</strong></div>
            <div class="career-stat"><span>📊 평균 평점</span><strong>${avg}</strong></div>
            <div class="career-stat"><span>🏆 우승</span><strong>${c.trophies || 0}</strong></div>
            <div class="career-stat"><span>🟨 경고</span><strong>${c.yellowCards || 0}</strong></div>
            <div class="career-stat"><span>🟥 퇴장</span><strong>${c.redCards || 0}</strong></div>
            <div class="career-stat"><span>🌟 명성</span><strong>${player.reputation}</strong></div>
        </div>
        <div class="title-list">
            ${(player.titles || []).map(t => `<span class="title-badge">${t.name}</span>`).join('')}
        </div>
    `;
}

// ── 성향 레이더 텍스트 ───────────────────────────────────────
function renderTendencies(player, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const t = player.tendencies;
    const items = [
        { label: '😈 깐족이', val: t.trash_talk || 0 },
        { label: '⭐ 스타성', val: t.celebrity || 0 },
        { label: '💰 탐욕', val: t.greed || 0 },
        { label: '❤️ 충성심', val: t.loyalty || 0 },
        { label: '🔥 다혈질', val: t.hothead || 0 },
    ];
    container.innerHTML = items.map(({ label, val }) => `
        <div class="tendency-row">
            <span class="tend-label">${label}</span>
            <div class="tend-bar-wrap">
                <div class="tend-bar" style="width:${val}%"></div>
            </div>
            <span class="tend-val">${val}</span>
        </div>
    `).join('');
}

// ── SP 투자 UI ────────────────────────────────────────────────
function renderSPUpgradePanel(player, sp, containerId, onUpgrade) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="sp-header">💎 보유 SP: <strong>${sp}</strong> | 재능: <strong>${player.hiddenTalent}</strong></div>`;

    const above130 = Object.values(player.stats).filter(v => v >= 130).length;
    container.innerHTML += `<div class="sp-cap-info">130+ 스탯: ${above130}/${player.hiddenTalent} (하드캡)</div>`;

    const order = ['shooting','passing','dribbling','speed','defending','physicality',
                   'stamina','composure','aggressiveness','workRate','professionalism','judgment',
                   'ballControl','diving','injuryResistance'];

    for (const key of order) {
        if (player.stats[key] === undefined) continue;
        const val = player.stats[key];
        const isMaxed = val >= 144;
        const isAtSoftCap = val >= 130;
        const row = document.createElement('div');
        row.className = 'sp-row';
        row.innerHTML = `
            <span class="sp-stat-name">${STAT_NAMES[key] || key}</span>
            <span class="sp-stat-val ${val >= 130 ? 'gold' : val >= 100 ? 'blue' : ''}">${val}</span>
            <button class="sp-btn" ${isMaxed || sp <= 0 ? 'disabled' : ''} data-stat="${key}">
                ${isMaxed ? 'MAX' : isAtSoftCap ? '↑ (재능 소모)' : '↑ +1'}
            </button>
        `;
        row.querySelector('.sp-btn')?.addEventListener('click', () => onUpgrade(key));
        container.appendChild(row);
    }
}

// ── 포지션 필터 탭 ──────────────────────────────────────────
function renderPositionFilter(positions, containerId, onFilter) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const all = ['ALL', ...positions];
    container.innerHTML = all.map(p => `
        <button class="pos-filter-btn ${p === 'ALL' ? 'active' : ''}" data-pos="${p}">${p}</button>
    `).join('');
    container.querySelectorAll('.pos-filter-btn').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.pos-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onFilter(btn.dataset.pos === 'ALL' ? null : btn.dataset.pos);
        };
    });
}

// ── 이적 시장 UI ─────────────────────────────────────────────
function renderTransferMarket(freeAgents, containerId, onSign) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (freeAgents.length === 0) {
        container.innerHTML = '<p class="empty-msg">현재 이용 가능한 자유계약 선수가 없습니다.</p>';
        return;
    }

    freeAgents.forEach(p => {
        const mv = calcMarketValue(p);
        const wage = calcWeeklyWage(p.rating);
        const card = document.createElement('div');
        card.className = `transfer-card pos-${p.position}`;
        card.innerHTML = `
            <span class="pos-badge">${p.position}</span>
            <span class="player-name">${p.name}</span>
            <span class="player-ovr">OVR ${p.rating}</span>
            <span class="player-info">${p.country} · ${p.age}세</span>
            <div class="transfer-info">계약금 ${Math.round(mv * 0.1)}억 / 주급 ${wage}만</div>
            <button class="sign-btn">영입</button>
        `;
        card.querySelector('.sign-btn').onclick = () => onSign(p);
        container.appendChild(card);
    });
}

// ── 매치 결과 요약 렌더 ─────────────────────────────────────
function renderMatchResult(result, myTeam, enemyTeam, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const outcome = result.win ? '🏆 승리' : result.draw ? '🤝 무승부' : '💀 패배';
    const outcomeClass = result.win ? 'win' : result.draw ? 'draw' : 'loss';

    container.innerHTML = `
        <div class="match-result-header ${outcomeClass}">
            <div class="match-teams">
                <span>${myTeam?.displayName || '우리팀'}</span>
                <span class="score">${result.myGoals} - ${result.enemyGoals}</span>
                <span>${enemyTeam?.displayName || '상대팀'}</span>
            </div>
            <div class="outcome-label">${outcome}</div>
        </div>
        <div class="player-stats-summary">
            <div>⚽ 득점: ${result.playerGoals}</div>
            <div>🅰️ 어시스트: ${result.playerAssists}</div>
            <div>🛡️ 결정적 수비: ${result.playerDefs}</div>
            <div>📊 평점: <strong>${result.matchRating}</strong></div>
        </div>
    `;
}
