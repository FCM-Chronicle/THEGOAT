// ============================================================
// main.js — 게임 상태, 초기화, 메인 루프
// ============================================================

// ── 전역 게임 상태 ───────────────────────────────────────────
let gameState = null;

function createInitialGameState(playerData, teamKey) {
    const teams = JSON.parse(JSON.stringify(allTeams)); // 깊은 복사
    const team = teams[teamKey];
    if (!team) throw new Error('팀을 찾을 수 없습니다: ' + teamKey);

    const player = createPlayer(playerData);
    player.teamKey = teamKey;

    // 리그 테이블 초기화
    const leagueTable = initLeagueTable(teams);

    // 픽스쳐 생성
    const leagueTeamKeys = Object.entries(teams)
        .filter(([, t]) => t.league === team.league)
        .map(([k]) => k);

    const allFixtures = generateFixtures(leagueTeamKeys);
    const perRound = Math.floor(leagueTeamKeys.length / 2);
    const leagueFixtures = {};
    let round = 0;
    for (let i = 0; i < allFixtures.length; i += perRound) {
        leagueFixtures[round] = allFixtures.slice(i, i + perRound);
        round++;
    }

    return {
        player,
        teams,
        teamKey,
        leagueTable,
        leagueFixtures,
        totalRounds: round,
        currentRound: 0,
        date: { year: 2026, month: 8 },
        seasonStats: initSeasonStats(),
        sp: 0,
        playerMoney: 0,
        teamBond: 70,
        tacticsFamiliarity: 50,
        injuryRiskStack: 0,
        fatigueStack: 0,
        usedEvents: [],
        pendingEvent: null,
        pendingTransferOffer: null,
        log: [],
        phase: 'pre_match', // pre_match | match | post_match | end_season
    };
}

// ── 세이브 / 로드 ────────────────────────────────────────────
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
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        showToast('불러오기 실패', 'error');
        return null;
    }
}

// ── 라운드 진행 ──────────────────────────────────────────────
function advanceRound() {
    if (!gameState) return;
    const { player, teams, currentRound, leagueFixtures, leagueTable } = gameState;

    if (currentRound >= gameState.totalRounds) {
        handleSeasonEnd();
        return;
    }

    // 날짜 진행 (약 1라운드 = 7일)
    gameState.date.month = Math.min(12, 8 + Math.floor(currentRound / 4));

    // AI 라운드 처리
    const aiResults = processAIRound(gameState, player.teamKey);

    // 플레이어 매치 찾기
    const roundFixtures = leagueFixtures[currentRound] || [];
    const myFixture = roundFixtures.find(f => f.home === player.teamKey || f.away === player.teamKey);

    gameState.currentRound++;
    updateHUD(gameState);

    if (!myFixture) {
        // 이번 라운드는 쉬는 라운드
        processInterRound(null);
        return;
    }

    // 매치 시뮬레이션
    const isAway = myFixture.away === player.teamKey;
    const enemyKey = isAway ? myFixture.home : myFixture.away;
    const enemyTeam = teams[enemyKey];
    const myTeam = teams[player.teamKey];

    // 뚱자르 디버프 체크
    let tempRatingPenalty = 0;
    if (player.debuffs?.fatigue > 0) {
        tempRatingPenalty = -5;
        player.debuffs.fatigue--;
    }

    const result = simulateMatch(player, myTeam, enemyTeam, {
        isAway,
        badWeather: Math.random() < 0.15,
    });

    // 테이블 업데이트
    const hg = isAway ? result.enemyGoals : result.myGoals;
    const ag = isAway ? result.myGoals : result.enemyGoals;
    updateTable(leagueTable, myFixture.home, myFixture.away, hg, ag);

    // 시즌 스탯 누적
    const ss = gameState.seasonStats;
    ss.goals += result.playerGoals;
    ss.assists += result.playerAssists;
    ss.criticalDefs += result.playerDefs;
    ss.ratings.push(result.matchRating);
    ss.matchesPlayed++;
    if (result.enemyGoals === 0 && ['DF','GK'].includes(player.position)) ss.cleanSheets++;

    // 부상 처리
    if (player.injured) {
        player.injuryWeeksLeft--;
        if (player.injuryWeeksLeft <= 0) {
            player.injured = false;
            showToast('✅ 부상에서 회복했습니다!', 'success');
        }
    }

    // 경기 후 UI 업데이트
    renderMatchResult(result, myTeam, enemyTeam, 'match-result');
    renderMatchLog(result.matchEvents.length > 0 ? result.matchEvents : result.log.map(t => ({ text: t })), 'match-log');

    // 인터뷰 이벤트
    const interviewTrigger = result.win ? 'win' : result.draw ? 'draw' : 'loss';
    const interview = getInterviewEvent(interviewTrigger);
    if (interview && Math.random() < 0.4) {
        gameState.pendingEvent = interview;
    }

    // 라운드 간 이벤트 처리
    processInterRound(result);

    showScreen('screen-match');
}

// ── 라운드 간 처리 (훈련, 이벤트, 이적 등) ──────────────────
function processInterRound(matchResult) {
    const { player } = gameState;

    // 랜덤 이벤트 체크
    if (!gameState.pendingEvent) {
        const event = rollRandomEvent(gameState);
        if (event) gameState.pendingEvent = event;
    }

    // 사우디 오퍼 체크 (2% 확률)
    if (!gameState.pendingTransferOffer && Math.random() < 0.02) {
        const saudiOffer = checkSaudiOffer(player);
        if (saudiOffer) gameState.pendingEvent = saudiOffer;
    }

    // 이적 찌라시 (5% 확률)
    if (!gameState.pendingEvent && Math.random() < 0.05) {
        const rumor = generateTransferRumor(player, gameState);
        if (rumor) gameState.pendingEvent = rumor;
    }

    saveGame(gameState);
    updateHUD(gameState);
}

// ── 시즌 종료 처리 ──────────────────────────────────────────
function handleSeasonEnd() {
    const { player } = gameState;
    const result = endSeason(gameState, player);

    // 로그 출력
    const logContainer = document.getElementById('season-log');
    if (logContainer) {
        logContainer.innerHTML = result.events.map(e => `<div class="season-event">${e}</div>`).join('');
    }

    // SP 지급
    gameState.sp = (gameState.sp || 0) + result.sp;

    // 컵대회 진행
    const cupResult = runDomesticCup(gameState, player.teamKey);
    cupResult.log.forEach(l => showToast(l, 'info', 4000));

    // 다음 시즌 준비
    gameState = prepareNextSeason(gameState);

    // 국제대회 체크
    const schedule = getTournamentSchedule(gameState.date.year - 1);
    for (const item of schedule) {
        if (item.type !== 'UCL' && item.type !== 'DOMESTIC_CUP') {
            const callUp = checkNationalCallUp(player, item.type, gameState);
            if (callUp) {
                showToast(callUp.message, callUp.called ? 'success' : 'warning', 5000);
            }
        }
    }

    updateHUD(gameState);
    renderLeagueTable(gameState.leagueTable,
        gameState.teams[player.teamKey]?.league || 1,
        'league-table', player.teamKey);

    showScreen('screen-season-end');
}

// ── 훈련 실행 ────────────────────────────────────────────────
function doTrainingRound() {
    if (!gameState?.player) return;
    const result = doTraining(gameState.player, gameState);
    result.log.forEach(l => showToast(l, result.success ? 'success' : 'warning'));
    updateHUD(gameState);
    renderStatBars(gameState.player, 'stat-bars');
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
    const log = applyEventChoice(gameState.player, gameState, event, choiceIdx);
    log.forEach(l => showToast(l, 'info', 3500));
    gameState.pendingEvent = null;
    updateHUD(gameState);
    checkAndShowPendingEvent();
}

function checkAndShowPendingEvent() {
    if (gameState?.pendingEvent) {
        showEventModal(gameState.pendingEvent, handleEventChoice);
    }
}

// ── 이적 수락/거절 ───────────────────────────────────────────
function handleTransferDecision(accept) {
    if (!gameState?.pendingTransferOffer) return;
    const offer = gameState.pendingTransferOffer;
    if (accept) {
        const result = acceptTransfer(gameState.player, offer, gameState.teamKey, gameState);
        result.log.forEach(l => showToast(l, 'success', 4000));
        gameState.teamKey = offer.team.key;
        gameState.player.teamKey = offer.team.key;
    } else {
        const result = rejectTransfer(gameState.player, offer);
        result.log.forEach(l => showToast(l, 'info'));
    }
    gameState.pendingTransferOffer = null;
    updateHUD(gameState);
}

// ── 자유계약 선수 영입 ───────────────────────────────────────
function handleSignFreeAgent(freeAgent) {
    if (!gameState) return;
    const result = signFreeAgent(freeAgent, gameState.teamKey, gameState);
    if (result.ok) {
        result.log.forEach(l => showToast(l, 'success'));
        renderTransferMarket(
            freeAgentPool.filter(p => !gameState.teams[gameState.teamKey]?.players.find(tp => tp.name === p.name)),
            'transfer-market', handleSignFreeAgent
        );
    } else {
        showToast(result.reason, 'error');
    }
}

// ── 시작 화면 초기화 ─────────────────────────────────────────
function initStartScreen() {
    showScreen('screen-start');

    // 불러오기 버튼
    const loadBtn = document.getElementById('btn-load-game');
    if (loadBtn) {
        const saved = localStorage.getItem('fg_save');
        loadBtn.disabled = !saved;
        loadBtn.onclick = () => {
            const state = loadGame();
            if (state) {
                gameState = state;
                initMainGame();
            }
        };
    }

    document.getElementById('btn-new-game')?.addEventListener('click', () => {
        showScreen('screen-team-select');
        renderTeamCards(allTeams, 'team-cards', handleTeamSelect);
    });
}

// ── 팀 선택 ──────────────────────────────────────────────────
function handleTeamSelect(teamKey, team) {
    gameState = null;
    const teamsPlayers = team.players || [];

    // 팀 선수 목록 표시
    showScreen('screen-player-select');
    document.getElementById('selected-team-name').textContent = team.displayName;
    renderPlayerCards(teamsPlayers, 'player-cards', handlePlayerSelect);

    // 포지션 필터
    renderPositionFilter(['GK','DF','MF','FW'], 'pos-filter', (pos) => {
        renderPlayerCards(teamsPlayers, 'player-cards', handlePlayerSelect,
            pos ? p => p.position === pos : null);
    });

    // 자유계약 선수 탭
    document.getElementById('btn-free-agents')?.addEventListener('click', () => {
        renderPlayerCards(freeAgentPool, 'player-cards', handlePlayerSelect);
    });

    // 뒤로가기
    document.getElementById('btn-back-team')?.addEventListener('click', () => {
        showScreen('screen-team-select');
    });

    // 커스텀 선수 생성 버튼
    document.getElementById('btn-custom-player')?.addEventListener('click', () => {
        showCustomPlayerForm(teamKey);
    });
}

// ── 선수 선택 ────────────────────────────────────────────────
function handlePlayerSelect(playerData) {
    if (!gameState) {
        // teamKey를 어떻게 기억하느냐: 화면 전환 시 data-teamkey 속성 활용
        const teamKey = document.getElementById('screen-player-select')?.dataset.teamkey;
        if (!teamKey) { showToast('팀 선택 오류', 'error'); return; }

        try {
            gameState = createInitialGameState(playerData, teamKey);
        } catch (e) {
            showToast(e.message, 'error');
            return;
        }
    }
    initMainGame();
}

// ── 커스텀 선수 생성 폼 ──────────────────────────────────────
function showCustomPlayerForm(teamKey) {
    showScreen('screen-custom-player');
    document.getElementById('screen-custom-player').dataset.teamkey = teamKey;

    document.getElementById('btn-create-custom')?.addEventListener('click', () => {
        const name = document.getElementById('custom-name')?.value.trim() || '무명 선수';
        const position = document.getElementById('custom-position')?.value || 'FW';
        const country = document.getElementById('custom-country')?.value.trim() || '대한민국';
        const age = parseInt(document.getElementById('custom-age')?.value) || 18;
        const rating = Math.min(85, Math.max(60, parseInt(document.getElementById('custom-rating')?.value) || 70));

        const playerData = { name, position, country, age, rating, isCustom: true };
        try {
            gameState = createInitialGameState(playerData, teamKey);
            initMainGame();
        } catch (e) {
            showToast(e.message, 'error');
        }
    });
}

// ── 메인 게임 초기화 ─────────────────────────────────────────
function initMainGame() {
    if (!gameState) return;
    showScreen('screen-main');
    updateHUD(gameState);
    renderStatBars(gameState.player, 'stat-bars');
    renderCareerCard(gameState.player, 'career-card');
    renderTendencies(gameState.player, 'tendencies');
    renderLeagueTable(
        gameState.leagueTable,
        gameState.teams[gameState.player.teamKey]?.league || 1,
        'league-table', gameState.player.teamKey
    );
    renderTransferMarket(freeAgentPool, 'transfer-market', handleSignFreeAgent);
    renderSPUpgradePanel(gameState.player, gameState.sp, 'sp-panel', spUpgrade);

    // 이벤트 버튼 연결
    document.getElementById('btn-next-round')?.addEventListener('click', () => {
        if (gameState.pendingEvent) {
            showEventModal(gameState.pendingEvent, handleEventChoice);
            return;
        }
        advanceRound();
    });

    document.getElementById('btn-training')?.addEventListener('click', doTrainingRound);
    document.getElementById('btn-save')?.addEventListener('click', () => saveGame(gameState));

    // 탭 전환
    initTabs();

    checkAndShowPendingEvent();
}

// ── 탭 시스템 ────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            const target = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(target)?.classList.add('active');

            // 탭별 렌더 갱신
            if (target === 'tab-stats' && gameState) {
                renderStatBars(gameState.player, 'stat-bars');
                renderSPUpgradePanel(gameState.player, gameState.sp, 'sp-panel', spUpgrade);
            }
            if (target === 'tab-career' && gameState) {
                renderCareerCard(gameState.player, 'career-card');
                renderTendencies(gameState.player, 'tendencies');
            }
            if (target === 'tab-league' && gameState) {
                renderLeagueTable(
                    gameState.leagueTable,
                    gameState.teams[gameState.player.teamKey]?.league || 1,
                    'league-table', gameState.player.teamKey
                );
            }
            if (target === 'tab-transfer' && gameState) {
                renderTransferMarket(freeAgentPool, 'transfer-market', handleSignFreeAgent);
            }
        };
    });
}

// ── 진입점 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initStartScreen();
});
