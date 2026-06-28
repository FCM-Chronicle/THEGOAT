// ============================================================
// main.js v3 — 버튼 바인딩 버그 수정 + 선수 OVR 랜덤화
// ============================================================

let gameState = null;

// ── 게임 상태 초기화 ─────────────────────────────────────────
function createInitialGameState(playerData, teamKey) {
    const teams = JSON.parse(JSON.stringify(allTeams));
    const team  = teams[teamKey];
    if (!team) throw new Error('팀을 찾을 수 없습니다: ' + teamKey);

    const player   = createPlayer(playerData);
    player.teamKey = teamKey;

    const leagueTeamKeys = Object.entries(teams)
        .filter(([, t]) => t.league === team.league)
        .map(([k]) => k);

    const allFix   = generateFixtures(leagueTeamKeys);
    const perRound = Math.floor(leagueTeamKeys.length / 2);
    const leagueFixtures = {};
    let round = 0;
    for (let i = 0; i < allFix.length; i += perRound) {
        leagueFixtures[round] = allFix.slice(i, i + perRound);
        round++;
    }

    return {
        player,
        teams,
        teamKey,
        leagueTable:         initLeagueTable(teams),
        leagueFixtures,
        totalRounds:         round,
        currentRound:        0,
        date:                { year: 2026, month: 8 },
        seasonStats:         initSeasonStats(),
        sp:                  0,
        playerMoney:         0,
        teamBond:            70,
        tacticsFamiliarity:  50,
        injuryRiskStack:     0,
        fatigueStack:        0,
        usedEvents:          [],
        pendingEvent:        null,
        pendingTransferOffer:null,
        log:                 [],
        trainedThisRound:    false,
        phase:               'pre_match',
    };
}

// ── 세이브 / 로드 ─────────────────────────────────────────────
function saveGame(state) {
    try {
        localStorage.setItem('fg_save', JSON.stringify(state));
        showToast('💾 저장 완료!', 'success');
    } catch (e) {
        showToast('저장 실패: ' + e.message, 'error');
    }
}
function loadGame() {
    try {
        const raw = localStorage.getItem('fg_save');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        showToast('불러오기 실패', 'error');
        return null;
    }
}

// ── 라운드 진행 (핵심 함수) ──────────────────────────────────
function advanceRound() {
    if (!gameState) return;

    // 대기 이벤트가 있으면 먼저 처리
    if (gameState.pendingEvent) {
        showEventModal(gameState.pendingEvent, handleEventChoice);
        return;
    }

    const { player, teams, leagueFixtures, leagueTable } = gameState;
    const currentRound = gameState.currentRound;

    // 시즌 종료 체크
    if (currentRound >= gameState.totalRounds) {
        handleSeasonEnd();
        return;
    }

    // 날짜 진행 (8월 시작, 라운드마다 약 1주)
    gameState.date.month = 8 + Math.floor(currentRound / 4);
    if (gameState.date.month > 12) {
        gameState.date.month = gameState.date.month - 12;
        if (gameState.date.month === 1) gameState.date.year++;
    }

    // AI 경기 처리
    processAIRound(gameState, player.teamKey);

    // 내 경기 찾기
    const roundFix  = leagueFixtures[currentRound] || [];
    const myFixture = roundFix.find(f =>
        f.home === player.teamKey || f.away === player.teamKey
    );

    // 라운드 증가 + 훈련 잠금 해제
    gameState.currentRound++;
    gameState.trainedThisRound = false;
    updateTrainBtn();
    updateHUD(gameState);

    // 쉬는 라운드
    if (!myFixture) {
        renderSeasonMini();
        showToast('🛌 이번 주는 쉬는 라운드입니다.', 'info');
        checkIncomingTransfer();
        saveGame(gameState);
        return;
    }

    // ── 매치 시뮬 ──────────────────────────────────────────────
    const isAway    = myFixture.away === player.teamKey;
    const enemyKey  = isAway ? myFixture.home : myFixture.away;
    const enemyTeam = teams[enemyKey];
    const myTeam    = teams[player.teamKey];

    // 뚱자르 디버프 적용
    if (player.debuffs?.fatigue > 0) {
        player.debuffs.fatigue--;
    }
    const ovrPenalty = (player.debuffs?.fatigue > 0) ? -5 : 0;

    const result = simulateMatch(player, myTeam, enemyTeam, {
        isAway,
        badWeather:   Math.random() < 0.12,
        ovrPenalty,
    });

    // 리그 테이블 업데이트
    const hg = isAway ? result.enemyGoals : result.myGoals;
    const ag = isAway ? result.myGoals    : result.enemyGoals;
    updateTable(leagueTable, myFixture.home, myFixture.away, hg, ag);

    // 시즌 누적 스탯
    const ss = gameState.seasonStats;
    ss.goals        += result.playerGoals;
    ss.assists      += result.playerAssists;
    ss.criticalDefs += result.playerDefs;
    ss.ratings.push(result.matchRating);
    ss.matchesPlayed++;
    if (result.enemyGoals === 0 && ['DF','GK'].includes(player.position)) ss.cleanSheets++;

    // 부상 회복 처리
    if (player.injured) {
        player.injuryWeeksLeft--;
        if (player.injuryWeeksLeft <= 0) {
            player.injured = false;
            showToast('✅ 부상 회복!', 'success');
        }
    }

    // ── 메인 탭 (경기) UI 갱신 ────────────────────────────────
    renderMatchResult(result, myTeam, enemyTeam, 'match-result');
    const mainLogEl = document.getElementById('match-log');
    if (mainLogEl) {
        renderMatchLog(
            result.matchEvents.length > 0
                ? result.matchEvents
                : result.log.map(t => ({ text: t })),
            'match-log'
        );
        mainLogEl.style.display = 'block';
    }

    // ── 매치 결과 화면 UI 갱신 ────────────────────────────────
    renderMatchResult(result, myTeam, enemyTeam, 'match-result-detail');
    const detailLogEl = document.getElementById('match-log-detail');
    if (detailLogEl) {
        renderMatchLog(
            result.matchEvents.length > 0
                ? result.matchEvents
                : result.log.map(t => ({ text: t })),
            'match-log-detail'
        );
        detailLogEl.style.display = 'block';
    }

    renderSeasonMini();

    // ── 경기 후 이벤트 ────────────────────────────────────────
    // 인터뷰 (40%)
    if (!gameState.pendingEvent && Math.random() < 0.40) {
        const trigger = result.win ? 'win' : result.draw ? 'draw' : 'loss';
        const iv = getInterviewEvent(trigger);
        if (iv) gameState.pendingEvent = iv;
    }
    // 랜덤 이벤트 (30%)
    if (!gameState.pendingEvent) {
        const ev = rollRandomEvent(gameState);
        if (ev) gameState.pendingEvent = ev;
    }

    checkIncomingTransfer();
    saveGame(gameState);

    // 매치 결과 화면으로 이동
    showScreen('screen-match');
}

// ── 수신 이적 오퍼 체크 ──────────────────────────────────────
function checkIncomingTransfer() {
    if (gameState.pendingTransferOffer) return;
    const offer = checkIncomingOffer(gameState.player, gameState);
    if (!offer) return;
    gameState.pendingTransferOffer = offer;
    setTimeout(() => showTransferOfferModal(offer), 300);
}

// ── 이적 오퍼 모달 ───────────────────────────────────────────
function showTransferOfferModal(offer) {
    const lg = offer.teamLeague === 1 ? '1부' : offer.teamLeague === 2 ? '2부' : '3부';
    showEventModal(
        {
            title: '📨 이적 오퍼 수신!',
            desc:  `${offer.teamName} (${lg} 리그)에서 공식 오퍼!\n\n이적료: ${offer.fee}억\n주급: ${offer.weeklyWage.toLocaleString()}만/주\n계약: ${offer.contractYears}년`,
            choices: [
                { label: '✅ 수락한다', effects: {} },
                { label: '❌ 거절한다', effects: {} },
            ],
        },
        (idx) => {
            if (idx === 0) {
                const r = acceptOffer(gameState.player, gameState.pendingTransferOffer, gameState);
                r.log.forEach(l => showToast(l, 'success', 4000));
                renderLeagueTable(
                    gameState.leagueTable,
                    gameState.teams[gameState.player.teamKey]?.league || 1,
                    'league-table', gameState.player.teamKey
                );
            } else {
                const r = rejectOffer(gameState.player, gameState.pendingTransferOffer);
                r.log.forEach(l => showToast(l, 'info'));
                gameState.pendingTransferOffer = null;
            }
            updateHUD(gameState);
        }
    );
}

// ── 직접 이적 지원 ───────────────────────────────────────────
function applyTransfer(targetTeamKey) {
    if (!gameState?.player) return;
    const { result, offer, message } = applyToTeam(gameState.player, targetTeamKey, gameState);
    showToast(message, result === 'offer' ? 'success' : 'warning', 4000);
    if (result === 'offer') {
        gameState.pendingTransferOffer = offer;
        showTransferOfferModal(offer);
    }
}

// ── 훈련 (경기당 1회 제한) ────────────────────────────────────
function doTrainingRound() {
    if (!gameState?.player) return;
    if (gameState.trainedThisRound) {
        showToast('⛔ 이번 라운드 훈련은 이미 완료했습니다.', 'warning');
        return;
    }
    const result = doTraining(gameState.player, gameState);
    result.log.forEach(l => showToast(l, result.success ? 'success' : 'warning'));
    gameState.trainedThisRound = true;
    updateTrainBtn();
    updateHUD(gameState);
    // 스탯 탭 열려 있으면 갱신
    if (document.getElementById('tab-stats')?.classList.contains('active')) {
        renderStatBars(gameState.player, 'stat-bars');
    }
}

// 훈련 버튼 상태 동기화
function updateTrainBtn() {
    const ids = ['btn-training', 'btn-training-from-match'];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const done = gameState?.trainedThisRound;
        btn.disabled     = !!done;
        btn.textContent  = done ? '🏃 훈련 완료 (다음 경기 후 가능)' : '🏃 훈련';
        btn.style.opacity = done ? '0.5' : '1';
    });
}

// ── SP 투자 ──────────────────────────────────────────────────
function spUpgrade(statKey) {
    if (!gameState?.player) return;
    if ((gameState.sp || 0) <= 0) { showToast('SP가 부족합니다!', 'error'); return; }
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

// ── 이벤트 선택 처리 ─────────────────────────────────────────
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

    renderLeagueTable(
        gameState.leagueTable,
        gameState.teams[player.teamKey]?.league || 1,
        'final-table', player.teamKey
    );

    const logEl = document.getElementById('season-log');
    if (logEl) {
        logEl.innerHTML = result.events
            .map(e => `<div class="season-event">${e}</div>`)
            .join('');
    }

    gameState.sp = (gameState.sp || 0) + result.sp;

    const cupResult = runDomesticCup(gameState, player.teamKey);
    cupResult.log.forEach(l => showToast(l, 'info', 4000));

    const schedule = getTournamentSchedule(gameState.date.year);
    for (const item of schedule) {
        if (item.type !== 'UCL' && item.type !== 'DOMESTIC_CUP') {
            const callUp = checkNationalCallUp(player, item.type, gameState);
            if (callUp) showToast(callUp.message, callUp.called ? 'success' : 'warning', 5000);
        }
    }

    gameState = prepareNextSeason(gameState);
    updateHUD(gameState);
    showScreen('screen-season-end');
}

// ── 시즌 미니 카드 갱신 ──────────────────────────────────────
function renderSeasonMini() {
    if (!gameState?.seasonStats) return;
    const ss  = gameState.seasonStats;
    const avg = ss.ratings.length > 0
        ? (ss.ratings.reduce((a, b) => a + b, 0) / ss.ratings.length).toFixed(1)
        : '-';
    safeText('s-goals',   ss.goals   || 0);
    safeText('s-assists', ss.assists || 0);
    safeText('s-rating',  avg);
    safeText('s-matches', ss.matchesPlayed || 0);
}

// ── 이적 탭 렌더 ─────────────────────────────────────────────
function renderTransferTab() {
    if (!gameState?.player) return;

    const statusEl = document.getElementById('transfer-window-status');
    if (statusEl) {
        const ws = getTransferWindowStatus(gameState);
        statusEl.textContent = ws.label;
        statusEl.style.color = ws.isOpen ? 'var(--green)' : 'var(--red)';
    }

    const infoEl = document.getElementById('my-transfer-info');
    if (infoEl) {
        const mv = calcMarketValue(gameState.player);
        const al = getAccessibleLeague(gameState.player.reputation);
        infoEl.innerHTML = `
            <div class="career-stat"><span>💰 시장가치</span><strong>${formatValue(mv)}</strong></div>
            <div class="career-stat"><span>⭐ 명성</span><strong>${gameState.player.reputation}</strong></div>
            <div class="career-stat"><span>🎯 접근 가능</span><strong>${al}부 리그 이상</strong></div>
            <div class="career-stat"><span>💵 주급</span><strong>${gameState.player.weeklyWage.toLocaleString()}만</strong></div>
        `;
    }

    const targets = getTransferTargets(gameState.player, gameState);
    const listEl  = document.getElementById('transfer-target-list');
    if (!listEl) return;

    if (targets.length === 0) {
        listEl.innerHTML = '<p class="empty-msg">명성을 올려 더 많은 팀에 지원할 수 있습니다.</p>';
        return;
    }

    const ll = l => l === 1 ? '⭐1부' : l === 2 ? '🥈2부' : '🥉3부';
    listEl.innerHTML = '';
    targets.forEach(t => {
        const card = document.createElement('div');
        card.className = 'transfer-card';
        card.innerHTML = `
            <div style="flex:1;">
                <span class="player-name">${t.displayName}</span>
                <span style="margin-left:8px;font-size:0.75rem;color:var(--text3);">${ll(t.league)}</span>
                <div class="transfer-info">팀 OVR ${t.avgOvr} · 예산 ${t.budget}억 ${t.canAfford ? '✅' : '⚠️예산부족'}</div>
            </div>
            <button class="sign-btn">지원</button>
        `;
        card.querySelector('.sign-btn').onclick = () => applyTransfer(t.key);
        listEl.appendChild(card);
    });
}

// ── 메인 게임 초기화 ─────────────────────────────────────────
function initMainGame() {
    if (!gameState) return;
    showScreen('screen-main');

    // 버튼 바인딩 — 매번 cloneNode로 중복 방지
    bindBtn('btn-next-round', advanceRound);
    bindBtn('btn-training',   doTrainingRound);
    bindBtn('btn-save',       () => saveGame(gameState));

    updateHUD(gameState);
    updateTrainBtn();
    renderSeasonMini();
    renderStatBars(gameState.player, 'stat-bars');
    renderSPUpgradePanel(gameState.player, gameState.sp, 'sp-panel', spUpgrade);
    renderCareerCard(gameState.player, 'career-card');
    renderTendencies(gameState.player, 'tendencies');
    renderLeagueTable(
        gameState.leagueTable,
        gameState.teams[gameState.player.teamKey]?.league || 1,
        'league-table', gameState.player.teamKey
    );
    renderTransferTab();
    initTabs();

    // 커리어 탭 재능 표시
    refreshTalentDisplay();
}

// 버튼 중복 바인딩 방지 유틸
function bindBtn(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', handler);
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
            if (tab === 'tab-league') {
                renderLeagueTable(
                    gameState.leagueTable,
                    gameState.teams[gameState.player.teamKey]?.league || 1,
                    'league-table', gameState.player.teamKey
                );
            }
            if (tab === 'tab-transfer') renderTransferTab();
        };
    });
}

function refreshTalentDisplay() {
    const el = document.getElementById('talent-display');
    if (!el || !gameState?.player) return;
    const t = gameState.player.hiddenTalent;
    el.textContent = `${'⭐'.repeat(t)} 재능 ${t} (${
        t === 1 ? '원툴 메타' : t === 2 ? '월클 메타' : '신계 메타'
    })`;
}

// ── 팀 선택 ──────────────────────────────────────────────────
function handleTeamSelect(teamKey, team) {
    const screen = document.getElementById('screen-player-select');
    if (screen) screen.dataset.teamkey = teamKey;
    showScreen('screen-player-select');
    safeText('selected-team-name', team.displayName);

    renderPlayerCards(team.players || [], 'player-cards', handlePlayerSelect);
    renderPositionFilter(['GK','DF','MF','FW'], 'pos-filter', pos => {
        renderPlayerCards(
            team.players || [], 'player-cards', handlePlayerSelect,
            pos ? p => p.position === pos : null
        );
    });

    // 버튼 바인딩 — 중복 방지
    bindBtn('btn-free-agents', () => {
        renderPlayerCards(freeAgentPool, 'player-cards', handlePlayerSelect);
    });
    bindBtn('btn-back-team', () => showScreen('screen-team-select'));
    bindBtn('btn-custom-player', () => showCustomPlayerForm(teamKey));
}

// ── 선수 선택 ────────────────────────────────────────────────
function handlePlayerSelect(playerData) {
    const teamKey = document.getElementById('screen-player-select')?.dataset.teamkey;
    if (!teamKey) { showToast('팀 선택 오류', 'error'); return; }
    try {
        gameState = createInitialGameState(playerData, teamKey);
    } catch (e) {
        showToast(e.message, 'error'); return;
    }
    initMainGame();
}

// ── 커스텀 선수 ──────────────────────────────────────────────
function showCustomPlayerForm(teamKey) {
    showScreen('screen-custom-player');
    document.getElementById('screen-custom-player').dataset.teamkey = teamKey;
    bindBtn('btn-create-custom', () => {
        const name     = document.getElementById('custom-name')?.value.trim() || '무명 선수';
        const position = document.getElementById('custom-position')?.value || 'FW';
        const country  = document.getElementById('custom-country')?.value.trim() || '대한민국';
        const age      = parseInt(document.getElementById('custom-age')?.value) || 18;
        const rating   = Math.min(85, Math.max(60, parseInt(document.getElementById('custom-rating')?.value) || 70));
        try {
            gameState = createInitialGameState({ name, position, country, age, rating, isCustom: true }, teamKey);
            initMainGame();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

// ── 시작 화면 ────────────────────────────────────────────────
function initStartScreen() {
    showScreen('screen-start');
    const loadBtn = document.getElementById('btn-load-game');
    if (loadBtn) {
        loadBtn.disabled = !localStorage.getItem('fg_save');
        loadBtn.onclick = () => {
            const state = loadGame();
            if (state) { gameState = state; initMainGame(); }
        };
    }
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
        showScreen('screen-team-select');
        renderTeamCards(allTeams, 'team-cards', handleTeamSelect);
    });
}

// ── 진입점 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initStartScreen();

    // 매치 화면 버튼
    document.getElementById('btn-back-to-main')?.addEventListener('click', () => {
        showScreen('screen-main');
        if (gameState) { updateHUD(gameState); renderSeasonMini(); }
    });

    document.getElementById('btn-confirm-match')?.addEventListener('click', () => {
        showScreen('screen-main');
        if (!gameState) return;
        updateHUD(gameState);
        renderSeasonMini();
        // 대기 이벤트 자동 오픈
        if (gameState.pendingEvent) {
            showEventModal(gameState.pendingEvent, handleEventChoice);
        }
    });

    document.getElementById('btn-training-from-match')?.addEventListener('click', doTrainingRound);

    // 다음 시즌
    document.getElementById('btn-next-season')?.addEventListener('click', () => {
        initMainGame();
        renderSeasonMini();
        showToast('🆕 새 시즌 시작!', 'success');
    });
});

