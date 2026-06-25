// ============================================================
// transfer.js — 이적시장 시스템 v2
// 핵심 변경:
//   - 플레이어가 직접 오퍼를 넣는 "이적 지원" 시스템
//   - 명성 기반으로 클럽에서 오퍼가 오는 "수신 오퍼" 시스템
//   - 자유계약 선수 풀 (별도 탭)
// ============================================================

// ── 시장가치 계산 ─────────────────────────────────────────────
function calcMarketValue(player) {
    const base = (() => {
        if (player.rating >= 92) return 1500;
        if (player.rating >= 88) return 800;
        if (player.rating >= 84) return 400;
        if (player.rating >= 80) return 200;
        if (player.rating >= 75) return 80;
        if (player.rating >= 70) return 30;
        return 10;
    })();
    const ageMult = (() => {
        if (player.age <= 21) return 1.5;
        if (player.age <= 25) return 1.3;
        if (player.age <= 29) return 1.0;
        if (player.age <= 32) return 0.7;
        if (player.age <= 35) return 0.4;
        return 0.2;
    })();
    return Math.round(base * ageMult);
}

// ── 명성 기준 접근 가능 리그 등급 ────────────────────────────
function getAccessibleLeague(reputation) {
    if (reputation >= 750) return 1;
    if (reputation >= 450) return 2;
    return 3;
}

// ── 명성에 맞는 관심 팀 목록 반환 ───────────────────────────
// 플레이어가 "이적 지원" 버튼을 누를 때 보여줄 팀 목록
function getTransferTargets(player, gameState) {
    const accessLeague = getAccessibleLeague(player.reputation);
    const currentLeague = gameState.teams[player.teamKey]?.league || 3;

    return Object.entries(gameState.teams)
        .filter(([key, team]) => {
            if (key === player.teamKey) return false;          // 현재 팀 제외
            if (team.league > accessLeague) return false;      // 명성 미달 리그 제외
            return true;
        })
        .map(([key, team]) => ({
            key,
            displayName: team.displayName,
            league: team.league,
            avgOvr: Math.round(teamAvgOvr(team.players)),
            budget: team.budget || 0,
            // 팀이 감당 가능한지 여부 (예산 기준)
            canAfford: (team.budget || 0) >= calcMarketValue(player) * 0.5,
        }))
        .sort((a, b) => a.league - b.league || b.avgOvr - a.avgOvr);
}

// ── 플레이어 → 팀 지원 (내가 오퍼 넣기) ──────────────────────
function applyToTeam(player, targetTeamKey, gameState) {
    const team = gameState.teams[targetTeamKey];
    if (!team) return { result: 'fail', message: '팀을 찾을 수 없습니다.' };

    const accessLeague = getAccessibleLeague(player.reputation);
    if (team.league < accessLeague) {
        return { result: 'rejected', message: `❌ 명성이 부족합니다. (필요 명성: ${accessLeague === 1 ? 750 : 450})` };
    }

    const mv = calcMarketValue(player);
    const canAfford = (team.budget || 0) >= mv * 0.5;

    // 관심 확률: 명성 + OVR + 팀 여유예산 기반
    const interestScore = (player.reputation / 10) + (player.rating - 70) * 2
                        + (canAfford ? 20 : -10)
                        + (Math.random() * 30 - 15); // 랜덤 변수

    if (interestScore < 30) {
        return {
            result: 'rejected',
            message: `❌ ${team.displayName}이(가) 관심 없다는 답변을 보내왔습니다.`
        };
    }

    // 오퍼 생성
    const offer = buildOffer(player, targetTeamKey, team);
    return {
        result: 'offer',
        offer,
        message: `📨 ${team.displayName}이(가) 정식 오퍼를 보내왔습니다!`
    };
}

// ── 팀 → 플레이어 자동 오퍼 (라운드마다 체크) ───────────────
// 명성 임계값을 넘으면 상위 리그 팀에서 오퍼가 올 수 있음
function checkIncomingOffer(player, gameState) {
    const currentLeague = gameState.teams[player.teamKey]?.league || 3;

    // 1부 리그면 추가 오퍼 없음 (이미 최상위)
    // 단 명성 800+ 이면 타 1부 팀 이적 오퍼 가능
    const repThreshold = currentLeague === 3 ? 450
                       : currentLeague === 2 ? 750
                       : 800;

    if (player.reputation < repThreshold) return null;

    // 6라운드마다 최대 1번 체크 (너무 자주 오면 귀찮음)
    if ((gameState.currentRound % 6) !== 0) return null;
    if (Math.random() > 0.40) return null; // 40% 확률

    // 타깃: 현재보다 높은 리그 or 같은 리그 강팀
    const candidates = Object.entries(gameState.teams).filter(([key, team]) => {
        if (key === player.teamKey) return false;
        if (team.league > currentLeague) return false; // 하위 리그는 제외
        if (team.league === currentLeague && Math.round(teamAvgOvr(team.players)) <= player.rating) return false;
        return true;
    });

    if (candidates.length === 0) return null;

    const [targetKey, targetTeam] = candidates[Math.floor(Math.random() * candidates.length)];
    return buildOffer(player, targetKey, targetTeam);
}

// ── 공통 오퍼 생성 ────────────────────────────────────────────
function buildOffer(player, targetKey, targetTeam) {
    const mv = calcMarketValue(player);
    const fee = Math.round(mv * (0.85 + Math.random() * 0.4));  // 시장가 85~125%
    const newWage = Math.round(player.weeklyWage * (1.15 + Math.random() * 0.6));
    const years = Math.floor(Math.random() * 3) + 2;

    return {
        teamKey: targetKey,
        teamName: targetTeam.displayName,
        teamLeague: targetTeam.league,
        fee,           // 이적료 (억)
        weeklyWage: newWage,
        contractYears: years,
        deadline: 3,   // 3라운드 내 결정
    };
}

// ── 오퍼 수락 ─────────────────────────────────────────────────
function acceptOffer(player, offer, gameState) {
    const log = [];
    const prevTeamKey = player.teamKey;
    const prevTeam = gameState.teams[prevTeamKey];

    // 이적료 현재 팀 예산에 추가
    if (prevTeam) prevTeam.budget = (prevTeam.budget || 0) + offer.fee;

    // 플레이어 소속 변경
    player.teamKey = offer.teamKey;
    gameState.teamKey = offer.teamKey;
    player.weeklyWage = offer.weeklyWage;
    player.reputation = Math.min(999, player.reputation + 15);
    player.tendencies.loyalty = Math.max(0, (player.tendencies.loyalty || 50) - 8);

    log.push(`✈️ ${offer.teamName} 이적 완료!`);
    log.push(`💰 이적료: ${offer.fee}억 / 주급: ${offer.weeklyWage.toLocaleString()}만`);
    log.push(`📅 계약 기간: ${offer.contractYears}년`);

    if ((player.tendencies.loyalty || 50) < 25) {
        player.reputation = Math.max(0, player.reputation - 15);
        log.push('📰 원클럽 팬들이 배신자라며 야유를 보냅니다...');
    }

    // 새 팀 픽스쳐 재설정 (리그가 바뀐 경우)
    const newLeague = gameState.teams[offer.teamKey]?.league;
    const oldLeague = gameState.teams[prevTeamKey]?.league;
    if (newLeague !== oldLeague) {
        log.push(`🆕 ${newLeague}부 리그로 이동!`);
        rebuildFixturesForLeague(gameState, newLeague);
    }

    gameState.pendingTransferOffer = null;
    return { ok: true, log };
}

// ── 오퍼 거절 ─────────────────────────────────────────────────
function rejectOffer(player, offer) {
    player.tendencies.loyalty = Math.min(100, (player.tendencies.loyalty || 50) + 5);
    return {
        ok: false,
        log: [`🤝 ${offer.teamName}의 오퍼를 거절했습니다. 충성심 +5`]
    };
}

// ── 리그 변경 시 픽스쳐 재생성 ──────────────────────────────
function rebuildFixturesForLeague(gameState, league) {
    const keys = Object.entries(gameState.teams)
        .filter(([, t]) => t.league === league)
        .map(([k]) => k);
    const allFix = generateFixtures(keys);
    const perRound = Math.floor(keys.length / 2);
    const newFix = {};
    let r = 0;
    for (let i = 0; i < allFix.length; i += perRound) {
        newFix[r++] = allFix.slice(i, i + perRound);
    }
    gameState.leagueFixtures = newFix;
    gameState.totalRounds = r;
    gameState.currentRound = 0;
    gameState.leagueTable = initLeagueTable(gameState.teams);
    gameState.seasonStats = initSeasonStats();
}

// ── 이적 윈도우 상태 ─────────────────────────────────────────
function getTransferWindowStatus(gameState) {
    const month = gameState.date.month;
    const isOpen = month === 1 || (month >= 6 && month <= 8);
    return {
        isOpen,
        label: isOpen ? '🟢 이적시장 오픈' : '🔴 이적시장 마감',
        nextOpen: isOpen ? null : (month < 6 ? '6월' : '내년 1월'),
    };
}

// ── 시장가치 포맷 헬퍼 ───────────────────────────────────────
function formatValue(v) {
    if (v >= 1000) return `${(v/1000).toFixed(1)}조`;
    return `${v}억`;
}
