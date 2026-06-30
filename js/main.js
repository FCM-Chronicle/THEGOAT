// ============================================================
// main.js v4 — OVR 기반 명성, 승격/강등, 세이브 슬롯
// ============================================================

let gameState = null;
const SAVE_SLOTS = 3;

// ── 게임 상태 초기화 ─────────────────────────────────────────
function createInitialGameState(playerData, teamKey) {
    const teams = JSON.parse(JSON.stringify(allTeams));
    const team  = teams[teamKey];
    if (!team) throw new Error('팀을 찾을 수 없습니다: ' + teamKey);

    const player   = createPlayer(playerData);
    player.teamKey = teamKey;

    const leagueTeamKeys = Object.entries(teams)
        .filter(([,t]) => t.league === team.league).map(([k]) => k);
    const allFix   = generateFixtures(leagueTeamKeys);
    const perRound = Math.floor(leagueTeamKeys.length / 2);
    const leagueFixtures = {};
    let round = 0;
    for (let i = 0; i < allFix.length; i += perRound)
        leagueFixtures[round++] = allFix.slice(i, i + perRound);

    return {
        player, teams, teamKey,
        leagueTable:          initLeagueTable(teams),
        leagueFixtures,
        totalRounds:          round,
        currentRound:         0,
        date:                 { year: 2026, month: 8 },
        seasonStats:          initSeasonStats(),
        sp:                   0,
        playerMoney:          0,
        teamBond:             70,
        tacticsFamiliarity:   50,
        injuryRiskStack:      0,
        fatigueStack:         0,
        usedEvents:           [],
        pendingEvent:         null,
        pendingTransferOffer: null,
        log:                  [],
        trainedThisRound:     false,
        lastBallonDor:        null,
        phase:                'pre_match',
    };
}

// ── 세이브 / 로드 (슬롯 3개) ────────────────────────────────
function saveGame(state, slot = 0) {
    try {
        localStorage.setItem(`fg_save_${slot}`, JSON.stringify(state));
        showToast(`💾 슬롯 ${slot+1} 저장 완료!`, 'success');
    } catch (e) { showToast('저장 실패: ' + e.message, 'error'); }
}

function loadGame(slot = 0) {
    try {
        const raw = localStorage.getItem(`fg_save_${slot}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { showToast('불러오기 실패', 'error'); return null; }
}

function getSaveSlotInfo(slot) {
    try {
        const raw = localStorage.getItem(`fg_save_${slot}`);
        if (!raw) return null;
        const s = JSON.parse(raw);
        return {
            name:   s.player?.name || '?',
            team:   s.teams?.[s.teamKey]?.displayName || '?',
            ovr:    s.player?.rating || '?',
            date:   `${s.date?.year}/${String(s.date?.month).padStart(2,'0')}`,
            league: s.teams?.[s.teamKey]?.league || '?',
        };
    } catch { return null; }
}

// ── 라운드 진행 ──────────────────────────────────────────────
function advanceRound() {
    if (!gameState) return;

    if (gameState.pendingEvent) {
        showEventModal(gameState.pendingEvent, handleEventChoice);
        return;
    }

    const { player, teams, leagueFixtures, leagueTable } = gameState;
    const currentRound = gameState.currentRound;

    if (currentRound >= gameState.totalRounds) {
        handleSeasonEnd();
        return;
    }

    // 날짜 진행
    gameState.date.month = 8 + Math.floor(currentRound / 4);
    if (gameState.date.month > 12) {
        gameState.date.month -= 12;
        gameState.date.year++;
    }

    // AI 경기
    processAIRound(gameState, player.teamKey);

    // 내 경기
    const roundFix  = leagueFixtures[currentRound] || [];
    const myFixture = roundFix.find(f =>
        f.home === player.teamKey || f.away === player.teamKey);

    gameState.currentRound++;
    gameState.trainedThisRound = false;
    updateTrainBtn();
    updateHUD(gameState);

    if (!myFixture) {
        renderSeasonMini();
        showToast('🛌 이번 주는 쉬는 라운드', 'info');
        checkIncomingTransfer();
        saveGame(gameState, gameState.activeSaveSlot || 0);
        return;
    }

    // 매치 시뮬
    const isAway    = myFixture.away === player.teamKey;
    const enemyKey  = isAway ? myFixture.home : myFixture.away;
    const enemyTeam = teams[enemyKey];
    const myTeam    = teams[player.teamKey];
    const enemyLeague = enemyTeam?.league || 3;

    const result = simulateMatch(player, myTeam, enemyTeam, {
        isAway, badWeather: Math.random() < 0.12,
    });

    // 테이블 업데이트
    updateTable(leagueTable,
        myFixture.home, myFixture.away,
        isAway ? result.enemyGoals : result.myGoals,
        isAway ? result.myGoals    : result.enemyGoals);

    // 시즌 스탯
    const ss = gameState.seasonStats;
    ss.goals        += result.playerGoals;
    ss.assists      += result.playerAssists;
    ss.criticalDefs += result.playerDefs;
    ss.ratings.push(result.matchRating);
    ss.matchesPlayed++;
    if (result.enemyGoals === 0 && ['DF','GK'].includes(player.position)) ss.cleanSheets++;

    // ── OVR 기반 명성 증가 (핵심) ────────────────────────────
    const repGain = calcReputationGain(player, result, enemyLeague);
    player.reputation = Math.min(999, player.reputation + repGain);
    if (repGain > 0 && repGain >= 5) showToast(`⭐ 명성 +${repGain}`, 'info', 2000);

    // 부상 회복
    if (player.injured) {
        player.injuryWeeksLeft--;
        if (player.injuryWeeksLeft <= 0) {
            player.injured = false;
            showToast('✅ 부상 회복!', 'success');
        }
    }

    // UI 갱신
    renderMatchResult(result, myTeam, enemyTeam, 'match-result');
    const mainLog = document.getElementById('match-log');
    if (mainLog) {
        renderMatchLog(
            result.matchEvents.length > 0 ? result.matchEvents : result.log.map(t=>({text:t})),
            'match-log');
        mainLog.style.display = 'block';
    }
    renderMatchResult(result, myTeam, enemyTeam, 'match-result-detail');
    const detailLog = document.getElementById('match-log-detail');
    if (detailLog) {
        renderMatchLog(
            result.matchEvents.length > 0 ? result.matchEvents : result.log.map(t=>({text:t})),
            'match-log-detail');
        detailLog.style.display = 'block';
    }

    renderSeasonMini();

    // 경기 후 이벤트
    if (!gameState.pendingEvent && Math.random() < 0.35) {
        const trigger = result.win ? 'win' : result.draw ? 'draw' : 'loss';
        const iv = getInterviewEvent(trigger);
        if (iv) gameState.pendingEvent = iv;
    }
    if (!gameState.pendingEvent) {
        const ev = rollRandomEvent(gameState);
        if (ev) gameState.pendingEvent = ev;
    }

    checkIncomingTransfer();
    saveGame(gameState, gameState.activeSaveSlot || 0);
    showScreen('screen-match');
}

// ── 수신 이적 오퍼 ───────────────────────────────────────────
function checkIncomingTransfer() {
    if (gameState.pendingTransferOffer) return;
    const offer = checkIncomingOffer(gameState.player, gameState);
    if (!offer) return;
    gameState.pendingTransferOffer = offer;
    setTimeout(() => showTransferOfferModal(offer), 400);
}

function showTransferOfferModal(offer) {
    const lg = ['','1부','2부','3부'][offer.teamLeague] || '';
    showEventModal({
        title: '📨 이적 오퍼 수신!',
        desc:  `${offer.teamName} (${lg} 리그)\n\n이적료: ${offer.fee}억\n주급: ${offer.weeklyWage.toLocaleString()}만/주\n계약: ${offer.contractYears}년`,
        choices: [
            { label: '✅ 수락한다', effects: {} },
            { label: '❌ 거절한다', effects: {} },
        ],
    }, (idx) => {
        if (idx === 0) {
            const r = acceptOffer(gameState.player, gameState.pendingTransferOffer, gameState);
            r.log.forEach(l => showToast(l, 'success', 4000));
            renderLeagueTable(gameState.leagueTable,
                gameState.teams[gameState.player.teamKey]?.league||1,
                'league-table', gameState.player.teamKey);
        } else {
            const r = rejectOffer(gameState.player, gameState.pendingTransferOffer);
            r.log.forEach(l => showToast(l, 'info'));
            gameState.pendingTransferOffer = null;
        }
        updateHUD(gameState);
    });
}

function applyTransfer(targetTeamKey) {
    if (!gameState?.player) return;
    const { result, offer, message } = applyToTeam(gameState.player, targetTeamKey, gameState);
    showToast(message, result === 'offer' ? 'success' : 'warning', 4000);
    if (result === 'offer') {
        gameState.pendingTransferOffer = offer;
        showTransferOfferModal(offer);
    }
}

// ── 훈련 (1회 제한) ──────────────────────────────────────────
function doTrainingRound() {
    if (!gameState?.player) return;
    if (gameState.trainedThisRound) {
        showToast('⛔ 이번 라운드 훈련 완료. 다음 경기 후 가능.', 'warning');
        return;
    }
    const result = doTraining(gameState.player, gameState);
    result.log.forEach(l => showToast(l, result.success ? 'success' : 'warning'));
    gameState.trainedThisRound = true;
    updateTrainBtn();
    updateHUD(gameState);
    if (document.getElementById('tab-stats')?.classList.contains('active'))
        renderStatBars(gameState.player, 'stat-bars');
}

function updateTrainBtn() {
    ['btn-training','btn-training-from-match'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const done = !!gameState?.trainedThisRound;
        btn.disabled    = done;
        btn.textContent = done ? '🏃 훈련 완료 (다음 경기 후)' : '🏃 훈련';
        btn.style.opacity = done ? '0.5' : '1';
    });
}

// ── SP 투자 ──────────────────────────────────────────────────
function spUpgrade(statKey) {
    if (!gameState?.player) return;
    if ((gameState.sp||0) <= 0) { showToast('SP 부족!', 'error'); return; }
    const result = upgradeStatSP(gameState.player, statKey);
    if (result.ok) {
        gameState.sp--;
        showToast(`✅ ${STAT_NAMES[statKey]} +1`, 'success');
        renderSPUpgradePanel(gameState.player, gameState.sp, 'sp-panel', spUpgrade);
        renderStatBars(gameState.player, 'stat-bars');
        updateHUD(gameState);
    } else {
        showToast(`❌ ${result.reason}`, 'error');
    }
}

// ── 이벤트 처리 ──────────────────────────────────────────────
function handleEventChoice(choiceIdx) {
    if (!gameState?.pendingEvent) return;
    const event = gameState.pendingEvent;
    gameState.pendingEvent = null;
    const log = applyEventChoice(gameState.player, gameState, event, choiceIdx);
    log.forEach(l => showToast(l, 'info', 3500));
    updateHUD(gameState);
}

// ── 시즌 종료 ────────────────────────────────────────────────
function handleSeasonEnd() {
    const { player } = gameState;
    const result = endSeason(gameState, player);

    renderLeagueTable(gameState.leagueTable,
        gameState.teams[player.teamKey]?.league||1,
        'final-table', player.teamKey);

    const logEl = document.getElementById('season-log');
    if (logEl) logEl.innerHTML = result.events.map(e=>`<div class="season-event">${e}</div>`).join('');

    // 발롱도르 특별 연출
    const bdEl = document.getElementById('ballon-dor-banner');
    if (bdEl && gameState.lastBallonDor?.year === gameState.date.year) {
        bdEl.innerHTML = `<div class="ballon-dor-win">🌟 ${gameState.lastBallonDor.year} 발롱도르 수상! 점수: ${gameState.lastBallonDor.score}</div>`;
        bdEl.style.display = 'block';
    } else if (bdEl) { bdEl.style.display = 'none'; }

    gameState.sp = (gameState.sp||0) + result.sp;

    const cupResult = runDomesticCup(gameState, player.teamKey);
    cupResult.log.forEach(l => showToast(l, 'info', 4000));

    const schedule = getTournamentSchedule(gameState.date.year);
    for (const item of schedule) {
        if (item.type !== 'UCL' && item.type !== 'DOMESTIC_CUP') {
            const callUp = checkNationalCallUp(player, item.type, gameState);
            if (callUp) showToast(callUp.message, callUp.called ? 'success' : 'warning', 5000);
        }
    }

    // 승격/강등 알림
    const myTeam    = gameState.teams[player.teamKey];
    const myLeague  = myTeam?.league;
    const promoNote = document.getElementById('promo-note');
    if (promoNote) {
        const leagueNames = {1:'1부',2:'2부',3:'3부'};
        promoNote.textContent = `📋 현재 소속: ${myTeam?.displayName} (${leagueNames[myLeague]||''} 리그)`;
    }

    gameState = prepareNextSeason(gameState);
    updateHUD(gameState);
    showScreen('screen-season-end');
}

// ── 시즌 미니 카드 ───────────────────────────────────────────
function renderSeasonMini() {
    if (!gameState?.seasonStats) return;
    const ss  = gameState.seasonStats;
    const avg = ss.ratings.length > 0
        ? (ss.ratings.reduce((a,b)=>a+b,0)/ss.ratings.length).toFixed(1) : '-';
    safeText('s-goals',   ss.goals   || 0);
    safeText('s-assists', ss.assists || 0);
    safeText('s-rating',  avg);
    safeText('s-matches', ss.matchesPlayed || 0);
}

// ── 이적 탭 (요건 표시 포함) ─────────────────────────────────
function renderTransferTab() {
    if (!gameState?.player) return;
    const player = gameState.player;

    const statusEl = document.getElementById('transfer-window-status');
    if (statusEl) {
        const ws = getTransferWindowStatus(gameState);
        statusEl.textContent = ws.label;
        statusEl.style.color = ws.isOpen ? 'var(--green)' : 'var(--red)';
    }

    const infoEl = document.getElementById('my-transfer-info');
    if (infoEl) {
        const mv = calcMarketValue(player);
        infoEl.innerHTML = `
            <div class="career-stat"><span>💰 시장가치</span><strong>${formatValue(mv)}</strong></div>
            <div class="career-stat"><span>⭐ 명성</span><strong>${player.reputation}</strong></div>
            <div class="career-stat"><span>🎯 OVR</span><strong>${player.rating}</strong></div>
            <div class="career-stat"><span>💵 주급</span><strong>${player.weeklyWage.toLocaleString()}만</strong></div>
        `;
    }

    const targets = getTransferTargets(player, gameState);
    const listEl  = document.getElementById('transfer-target-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (targets.length === 0) {
        listEl.innerHTML = '<p class="empty-msg">이적 가능한 팀이 없습니다.</p>';
        return;
    }

    const ll = l => ['','⭐1부','🥈2부','🥉3부'][l] || '';

    targets.forEach(t => {
        const card = document.createElement('div');
        card.className = `transfer-card ${t.eligible ? '' : 'transfer-card--locked'}`;

        // 요건 미달 항목 표시
        const repStatus = t.repOk
            ? `<span class="req-ok">명성 ✅ ${t.repMin}</span>`
            : `<span class="req-fail">명성 ❌ ${player.reputation}/${t.repMin}</span>`;
        const ovrStatus = t.ovrOk
            ? `<span class="req-ok">OVR ✅ ${t.ovrMin}</span>`
            : `<span class="req-fail">OVR ❌ ${player.rating}/${t.ovrMin}</span>`;

        card.innerHTML = `
            <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="player-name">${t.displayName}</span>
                    <span style="font-size:0.72rem;color:var(--text3);">${ll(t.league)}</span>
                </div>
                <div class="transfer-req">${repStatus} ${ovrStatus}</div>
                <div class="transfer-info">팀 OVR ${t.avgOvr} · 예산 ${t.budget}억</div>
            </div>
            <button class="sign-btn" ${t.eligible ? '' : 'disabled'}>
                ${t.eligible ? '지원' : '🔒'}
            </button>
        `;
        if (t.eligible) card.querySelector('.sign-btn').onclick = () => applyTransfer(t.key);
        listEl.appendChild(card);
    });
}

// ── 메인 게임 초기화 ─────────────────────────────────────────
function initMainGame() {
    if (!gameState) return;
    showScreen('screen-main');

    bindBtn('btn-next-round', advanceRound);
    bindBtn('btn-training',   doTrainingRound);
    bindBtn('btn-save',       () => showSaveModal());

    updateHUD(gameState);
    updateTrainBtn();
    renderSeasonMini();
    renderStatBars(gameState.player, 'stat-bars');
    renderSPUpgradePanel(gameState.player, gameState.sp, 'sp-panel', spUpgrade);
    renderCareerCard(gameState.player, 'career-card');
    renderTendencies(gameState.player, 'tendencies');
    renderLeagueTable(gameState.leagueTable,
        gameState.teams[gameState.player.teamKey]?.league||1,
        'league-table', gameState.player.teamKey);
    renderTransferTab();
    initTabs();
    refreshTalentDisplay();
}

function bindBtn(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', handler);
}

// ── 세이브 모달 ──────────────────────────────────────────────
function showSaveModal() {
    const choices = Array.from({length:SAVE_SLOTS}, (_,i) => {
        const info = getSaveSlotInfo(i);
        const label = info
            ? `슬롯 ${i+1}: ${info.name} (OVR ${info.ovr}) ${info.team} ${info.date}`
            : `슬롯 ${i+1}: 비어있음`;
        return { label, effects: {} };
    });
    showEventModal({ title: '💾 저장 슬롯 선택', desc: '저장할 슬롯을 선택하세요', choices },
        (idx) => {
            gameState.activeSaveSlot = idx;
            saveGame(gameState, idx);
        });
}

// ── 탭 시스템 ────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab)?.classList.add('active');
            const tab = btn.dataset.tab;
            if (!gameState) return;
            if (tab === 'tab-stats') {
                renderStatBars(gameState.player, 'stat-bars');
                renderSPUpgradePanel(gameState.player, gameState.sp, 'sp-panel', spUpgrade);
            }
            if (tab === 'tab-career') {
                renderCareerCard(gameState.player, 'career-card');
                renderTendencies(gameState.player, 'tendencies');
                refreshTalentDisplay();
            }
            if (tab === 'tab-league')
                renderLeagueTable(gameState.leagueTable,
                    gameState.teams[gameState.player.teamKey]?.league||1,
                    'league-table', gameState.player.teamKey);
            if (tab === 'tab-transfer') renderTransferTab();
        };
    });
}

function refreshTalentDisplay() {
    const el = document.getElementById('talent-display');
    if (!el || !gameState?.player) return;
    const t = gameState.player.hiddenTalent;
    el.textContent = `${'⭐'.repeat(t)} 재능 ${t} (${
        t===1?'원툴 메타':t===2?'월클 메타':'신계 메타'})`;
}

// ── 팀/선수 선택 ─────────────────────────────────────────────
function handleTeamSelect(teamKey, team) {
    const screen = document.getElementById('screen-player-select');
    if (screen) screen.dataset.teamkey = teamKey;
    showScreen('screen-player-select');
    safeText('selected-team-name', team.displayName);
    renderPlayerCards(team.players||[], 'player-cards', handlePlayerSelect);
    renderPositionFilter(['GK','DF','MF','FW'], 'pos-filter', pos =>
        renderPlayerCards(team.players||[], 'player-cards', handlePlayerSelect,
            pos ? p=>p.position===pos : null));
    bindBtn('btn-free-agents',   () => renderPlayerCards(freeAgentPool, 'player-cards', handlePlayerSelect));
    bindBtn('btn-back-team',     () => showScreen('screen-team-select'));
    bindBtn('btn-custom-player', () => showCustomPlayerForm(teamKey));
}

function handlePlayerSelect(playerData) {
    const teamKey = document.getElementById('screen-player-select')?.dataset.teamkey;
    if (!teamKey) { showToast('팀 선택 오류', 'error'); return; }
    try {
        gameState = createInitialGameState(playerData, teamKey);
    } catch (e) { showToast(e.message, 'error'); return; }
    initMainGame();
}

function showCustomPlayerForm(teamKey) {
    showScreen('screen-custom-player');
    document.getElementById('screen-custom-player').dataset.teamkey = teamKey;
    bindBtn('btn-create-custom', () => {
        const name     = document.getElementById('custom-name')?.value.trim()||'무명 선수';
        const position = document.getElementById('custom-position')?.value||'FW';
        const country  = document.getElementById('custom-country')?.value.trim()||'대한민국';
        const age      = parseInt(document.getElementById('custom-age')?.value)||18;
        const rating   = Math.min(85,Math.max(60,parseInt(document.getElementById('custom-rating')?.value)||70));
        try {
            gameState = createInitialGameState({name,position,country,age,rating,isCustom:true}, teamKey);
            initMainGame();
        } catch (e) { showToast(e.message,'error'); }
    });
}

// ── 시작 화면 ────────────────────────────────────────────────
function initStartScreen() {
    showScreen('screen-start');

    // 이어하기 버튼 — 슬롯 선택 모달
    document.getElementById('btn-load-game')?.addEventListener('click', () => {
        const hasAny = Array.from({length:SAVE_SLOTS},(_,i)=>getSaveSlotInfo(i)).some(Boolean);
        if (!hasAny) { showToast('저장 데이터 없음', 'warning'); return; }
        showLoadModal();
    });

    // 새 게임
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
        showScreen('screen-team-select');
        renderTeamCards(allTeams, 'team-cards', handleTeamSelect);
    });

    // 이어하기 버튼 활성화 체크
    const loadBtn = document.getElementById('btn-load-game');
    if (loadBtn) {
        const hasAny = Array.from({length:SAVE_SLOTS},(_,i)=>getSaveSlotInfo(i)).some(Boolean);
        loadBtn.disabled = !hasAny;
    }
}

function showLoadModal() {
    const choices = Array.from({length:SAVE_SLOTS}, (_,i) => {
        const info = getSaveSlotInfo(i);
        const label = info
            ? `슬롯 ${i+1}: ${info.name} (OVR ${info.ovr}) | ${info.team} | ${info.date}`
            : `슬롯 ${i+1}: 비어있음`;
        return { label, effects: {}, disabled: !info };
    }).filter(c => !c.disabled);

    if (choices.length === 0) { showToast('저장 데이터 없음', 'warning'); return; }

    showEventModal({ title: '📂 불러올 슬롯 선택', desc: '', choices }, (idx) => {
        // choices 배열이 필터됐으므로 실제 슬롯 번호 역산
        const slots = Array.from({length:SAVE_SLOTS},(_,i)=>i).filter(i=>getSaveSlotInfo(i)!==null);
        const slot = slots[idx];
        const state = loadGame(slot);
        if (state) {
            gameState = state;
            gameState.activeSaveSlot = slot;
            initMainGame();
        }
    });
}

// ── 진입점 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initStartScreen();

    document.getElementById('btn-back-to-main')?.addEventListener('click', () => {
        showScreen('screen-main');
        if (gameState) { updateHUD(gameState); renderSeasonMini(); }
    });

    document.getElementById('btn-confirm-match')?.addEventListener('click', () => {
        showScreen('screen-main');
        if (!gameState) return;
        updateHUD(gameState);
        renderSeasonMini();
        if (gameState.pendingEvent) showEventModal(gameState.pendingEvent, handleEventChoice);
    });

    document.getElementById('btn-training-from-match')?.addEventListener('click', doTrainingRound);

    document.getElementById('btn-next-season')?.addEventListener('click', () => {
        initMainGame();
        renderSeasonMini();
        showToast('🆕 새 시즌 시작!', 'success');
    });
});
