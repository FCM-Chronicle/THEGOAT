// ============================================================
// transfer.js v3 — 팀별 이적 요건, OVR 기반 명성
// ============================================================

// ── 팀별 이적 요건 (명성 + 최소 OVR) ─────────────────────────
const TEAM_REQUIREMENTS = {
    // 1부 - 탑클래스
    "레알_마드리드":    { repMin: 1200, ovrMin: 88 },
    "바르셀로나":       { repMin: 1100, ovrMin: 87 },
    "맨체스터_시티":    { repMin: 1000, ovrMin: 86 },
    "파리_생제르맹":    { repMin: 1000, ovrMin: 86 },
    "바이에른_뮌헨":    { repMin: 950,  ovrMin: 85 },
    "리버풀":           { repMin: 900,  ovrMin: 85 },
    "아스널":           { repMin: 850,  ovrMin: 84 },
    "첼시":             { repMin: 850,  ovrMin: 84 },
    "맨체스터_유나이티드": { repMin: 800, ovrMin: 83 },
    "인터_밀란":        { repMin: 750,  ovrMin: 83 },
    "AC_밀란":          { repMin: 750,  ovrMin: 83 },
    "아틀레티코_마드리드": { repMin: 700, ovrMin: 82 },
    "나폴리":           { repMin: 650,  ovrMin: 82 },
    "토트넘_홋스퍼":    { repMin: 650,  ovrMin: 82 },
    "도르트문트":       { repMin: 600,  ovrMin: 81 },
    // 1부 - 중위권
    "뉴캐슬_유나이티드":{ repMin: 500,  ovrMin: 80 },
    "아스톤_빌라":      { repMin: 450,  ovrMin: 79 },
    "라이프치히":       { repMin: 400,  ovrMin: 79 },
    "레버쿠젠":         { repMin: 400,  ovrMin: 79 },
    // 2부
    "유벤투스":         { repMin: 350,  ovrMin: 78 },
    "세비야":           { repMin: 250,  ovrMin: 75 },
    "아약스":           { repMin: 200,  ovrMin: 73 },
    "AS_로마":          { repMin: 250,  ovrMin: 75 },
    "스포르팅_CP":      { repMin: 150,  ovrMin: 72 },
    "벤피카":           { repMin: 150,  ovrMin: 72 },
    "셀틱":             { repMin: 100,  ovrMin: 70 },
    "페예노르트":       { repMin: 100,  ovrMin: 70 },
    "올랭피크_드_마르세유": { repMin: 200, ovrMin: 73 },
    // 3부 (사우디/해외)
    "알_힐랄":          { repMin: 200,  ovrMin: 75 },
    "알_나스르":        { repMin: 200,  ovrMin: 75 },
    "갈라타사라이":     { repMin: 100,  ovrMin: 70 },
    "미국_연합":        { repMin: 80,   ovrMin: 68 },
    "리옹":             { repMin: 120,  ovrMin: 70 },
    // K리그 / 하부
    "FC_서울":          { repMin: 0,    ovrMin: 60 },
    "전북_현대":        { repMin: 0,    ovrMin: 60 },
    "울산_현대":        { repMin: 0,    ovrMin: 60 },
    "포항_스틸러스":    { repMin: 0,    ovrMin: 58 },
    "광주_FC":          { repMin: 0,    ovrMin: 55 },
};

function getTeamReq(teamKey) {
    return TEAM_REQUIREMENTS[teamKey] || { repMin: 50, ovrMin: 60 };
}

// ── 시장가치 계산 ─────────────────────────────────────────────
function calcMarketValue(player) {
    const base = player.rating >= 92 ? 1500
               : player.rating >= 88 ? 800
               : player.rating >= 84 ? 400
               : player.rating >= 80 ? 200
               : player.rating >= 75 ? 80
               : player.rating >= 70 ? 30 : 10;
    const ageMult = player.age <= 21 ? 1.5
                  : player.age <= 25 ? 1.3
                  : player.age <= 29 ? 1.0
                  : player.age <= 32 ? 0.7
                  : player.age <= 35 ? 0.4 : 0.2;
    return Math.round(base * ageMult);
}

// ── 접근 가능 리그 등급 ───────────────────────────────────────
function getAccessibleLeague(reputation) {
    if (reputation >= 1000) return 1;
    if (reputation >= 400)  return 2;
    return 3;
}

// ── 이적 지원 가능 팀 목록 ───────────────────────────────────
function getTransferTargets(player, gameState) {
    return Object.entries(gameState.teams)
        .filter(([key]) => key !== player.teamKey)
        .map(([key, team]) => {
            const req = getTeamReq(key);
            const avgOvr = Math.round(teamAvgOvr(team.players));
            const repOk  = player.reputation >= req.repMin;
            const ovrOk  = player.rating     >= req.ovrMin;
            return {
                key,
                displayName: team.displayName,
                league: team.league,
                avgOvr,
                budget: team.budget || 0,
                repMin: req.repMin,
                ovrMin: req.ovrMin,
                repOk,
                ovrOk,
                eligible: repOk && ovrOk,
            };
        })
        .sort((a, b) => {
            // 가능한 팀 먼저, 그 다음 리그 순
            if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
            return a.league - b.league || b.avgOvr - a.avgOvr;
        });
}

// ── 팀에 직접 지원 ───────────────────────────────────────────
function applyToTeam(player, targetTeamKey, gameState) {
    const team = gameState.teams[targetTeamKey];
    if (!team) return { result: 'fail', message: '팀을 찾을 수 없습니다.' };

    const req = getTeamReq(targetTeamKey);

    if (player.reputation < req.repMin)
        return { result: 'rejected', message: `❌ 명성 부족 (필요: ${req.repMin} / 현재: ${player.reputation})` };
    if (player.rating < req.ovrMin)
        return { result: 'rejected', message: `❌ OVR 부족 (필요: ${req.ovrMin} / 현재: ${player.rating})` };

    // 예산 + 랜덤 관심도
    const mv = calcMarketValue(player);
    const canAfford = (team.budget||0) >= mv * 0.4;
    const interestScore = (player.reputation / 8) + (player.rating - 70)*2
                        + (canAfford ? 20 : -15) + (Math.random()*30 - 15);

    if (interestScore < 35)
        return { result: 'rejected', message: `❌ ${team.displayName}이(가) 현재 관심 없다고 합니다.` };

    const offer = buildOffer(player, targetTeamKey, team);
    return { result: 'offer', offer, message: `📨 ${team.displayName}에서 정식 오퍼가 도착했습니다!` };
}

// ── 수신 오퍼 (라운드마다 자동 체크) ────────────────────────
function checkIncomingOffer(player, gameState) {
    const currentLeague = gameState.teams[player.teamKey]?.league || 3;

    // 6라운드마다 + 35% 확률
    if ((gameState.currentRound % 6) !== 0) return null;
    if (Math.random() > 0.35) return null;

    // 현재보다 좋은 팀 후보
    const candidates = Object.entries(gameState.teams).filter(([key, team]) => {
        if (key === player.teamKey) return false;
        const req = getTeamReq(key);
        // 요건 충족 + 현재 팀보다 리그가 높거나 같은 강팀
        return player.reputation >= req.repMin
            && player.rating >= req.ovrMin
            && (team.league < currentLeague ||
               (team.league === currentLeague && Math.round(teamAvgOvr(team.players)) > player.rating));
    });

    if (candidates.length === 0) return null;
    const [targetKey, targetTeam] = candidates[Math.floor(Math.random() * candidates.length)];
    return buildOffer(player, targetKey, targetTeam);
}

// ── 오퍼 생성 ────────────────────────────────────────────────
function buildOffer(player, targetKey, targetTeam) {
    const mv      = calcMarketValue(player);
    const fee     = Math.round(mv * (0.85 + Math.random()*0.4));
    const newWage = Math.round(player.weeklyWage * (1.15 + Math.random()*0.6));
    const years   = Math.floor(Math.random()*3)+2;
    return {
        teamKey:       targetKey,
        teamName:      targetTeam.displayName,
        teamLeague:    targetTeam.league,
        fee, weeklyWage: newWage,
        contractYears: years,
        deadline: 3,
    };
}

// ── 오퍼 수락 ────────────────────────────────────────────────
function acceptOffer(player, offer, gameState) {
    const log = [];
    const prevTeamKey = player.teamKey;
    const prevTeam    = gameState.teams[prevTeamKey];
    if (prevTeam) prevTeam.budget = (prevTeam.budget||0) + offer.fee;

    player.teamKey    = offer.teamKey;
    gameState.teamKey = offer.teamKey;
    player.weeklyWage = offer.weeklyWage;
    player.reputation = Math.min(999, player.reputation + 20);
    player.tendencies.loyalty = Math.max(0, (player.tendencies.loyalty||50) - 8);

    log.push(`✈️ ${offer.teamName} 이적 완료!`);
    log.push(`💰 이적료: ${offer.fee}억 / 주급: ${offer.weeklyWage.toLocaleString()}만`);
    log.push(`📅 계약: ${offer.contractYears}년`);
    if ((player.tendencies.loyalty||50) < 25) {
        player.reputation = Math.max(0, player.reputation - 15);
        log.push('📰 팬들이 배신자라 야유합니다...');
    }

    // 리그 변경 시 픽스쳐 재빌드
    const newLeague = gameState.teams[offer.teamKey]?.league;
    const oldLeague = gameState.teams[prevTeamKey]?.league;
    if (newLeague && newLeague !== oldLeague) {
        log.push(`🆕 ${newLeague}부 리그로 이동!`);
        rebuildFixturesForLeague(gameState, newLeague);
    }
    gameState.pendingTransferOffer = null;
    return { ok: true, log };
}

// ── 오퍼 거절 ────────────────────────────────────────────────
function rejectOffer(player, offer) {
    player.tendencies.loyalty = Math.min(100, (player.tendencies.loyalty||50)+5);
    return { ok: false, log: [`🤝 ${offer.teamName}의 오퍼를 거절. 충성심 +5`] };
}

// ── 픽스쳐 재빌드 ────────────────────────────────────────────
function rebuildFixturesForLeague(gameState, league) {
    const keys = Object.entries(gameState.teams)
        .filter(([,t]) => t.league === league).map(([k]) => k);
    const allFix = generateFixtures(keys);
    const per    = Math.floor(keys.length / 2);
    const fix    = {};
    let r = 0;
    for (let i = 0; i < allFix.length; i += per) fix[r++] = allFix.slice(i, i+per);
    gameState.leagueFixtures  = fix;
    gameState.totalRounds     = r;
    gameState.currentRound    = 0;
    gameState.leagueTable     = initLeagueTable(gameState.teams);
    gameState.seasonStats     = initSeasonStats();
}

// ── 이적시장 윈도우 ──────────────────────────────────────────
function getTransferWindowStatus(gameState) {
    const month  = gameState.date.month;
    const isOpen = month === 1 || (month >= 6 && month <= 8);
    return {
        isOpen,
        label:    isOpen ? '🟢 이적시장 오픈' : '🔴 이적시장 마감',
        nextOpen: isOpen ? null : (month < 6 ? '6월' : '내년 1월'),
    };
}

// ── 포맷 헬퍼 ────────────────────────────────────────────────
function formatValue(v) {
    if (v >= 1000) return `${(v/1000).toFixed(1)}조`;
    return `${v}억`;
}
