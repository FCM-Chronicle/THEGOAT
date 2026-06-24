// ============================================================
// match.js — 1분 단위 매치 엔진
// ============================================================

const BASE_PROB = { goal: 0.004, assist: 0.004, criticalDef: 0.012 };

function ampFactor(stat1, stat2) {
    const sum = (stat1 || 72) + (stat2 || 72);
    return Math.max(0.1, 1 + (sum - 144) / 48);
}

function rollDice(base, rand = 15) {
    return base + Math.floor(Math.random() * (rand * 2 + 1)) - rand;
}

// 팀 평균 오버롤 계산
function teamAvgOvr(players) {
    if (!players || players.length === 0) return 70;
    const top11 = [...players].sort((a, b) => b.rating - a.rating).slice(0, 11);
    return top11.reduce((s, p) => s + p.rating, 0) / top11.length;
}

// 메인 매치 시뮬레이션
function simulateMatch(player, myTeam, enemyTeam, options = {}) {
    const { isAway = false, badWeather = false } = options;
    const myTeamOvr = teamAvgOvr(myTeam.players);
    const enemyOvr = teamAvgOvr(enemyTeam.players);

    const log = [];
    let myGoals = 0, enemyGoals = 0;
    let playerGoals = 0, playerAssists = 0, playerDefs = 0;
    let matchEvents = [];

    // 이적시장 어드밴티지 등
    const envPenalty = (isAway || badWeather) ? -5 : 0;

    for (let min = 1; min <= 90; min++) {
        // ---- 골 이벤트 판정 ----
        const clutchMult = min >= 70
            ? 1 + ((player.stats.composure || 72) - 72) / 100
            : 1;

        // 우리 팀 골 체크
        const goalAmp = ampFactor(player.stats.shooting + envPenalty, player.stats.judgment);
        if (Math.random() < BASE_PROB.goal * goalAmp * clutchMult * (myTeamOvr / Math.max(enemyOvr, 1))) {
            myGoals++;
            // 누가 골을?
            const myShare = calcMyShare(player.rating);
            if (Math.random() < myShare) {
                // 내 골
                const gkOvr = rollDice(enemyOvr * 1.1);
                const myShot = rollDice((player.stats.shooting || 72) + 10 + envPenalty);
                if (myShot >= gkOvr) {
                    playerGoals++;
                    player.career.goals = (player.career.goals || 0) + 1;
                    matchEvents.push({ min, type: 'goal', text: `⚽ ${min}' ${player.name} 골!` });
                    log.push(`${min}' ⚽ 골! ${player.name}`);
                }
            } else {
                // 동료 골 — 어시스트 체크
                const assistRoll = rollDice((player.stats.passing || 72) + 10);
                if (assistRoll > 80 && Math.random() < 0.4) {
                    playerAssists++;
                    player.career.assists = (player.career.assists || 0) + 1;
                    matchEvents.push({ min, type: 'assist', text: `🅰️ ${min}' ${player.name} 어시스트!` });
                    log.push(`${min}' 🅰️ 어시스트 ${player.name}`);
                }
            }
        }

        // 상대 팀 골 체크
        if (Math.random() < BASE_PROB.goal * (enemyOvr / Math.max(myTeamOvr, 1))) {
            enemyGoals++;
            log.push(`${min}' ❌ 실점`);
        }

        // 결정적 수비 이벤트
        if (['DF', 'GK'].includes(player.position)) {
            const defAmp = ampFactor(player.stats.speed + envPenalty, player.stats.defending + envPenalty);
            if (Math.random() < BASE_PROB.criticalDef * defAmp) {
                playerDefs++;
                player.career.criticalDefenses = (player.career.criticalDefenses || 0) + 1;
                matchEvents.push({ min, type: 'def', text: `🛡️ ${min}' ${player.name} 결정적 수비!` });
                log.push(`${min}' 🛡️ 결정적 수비`);
            }
        }
    }

    // 경기 평점 계산
    const rating = calcMatchRating(player, playerGoals, playerAssists, playerDefs, myGoals, enemyGoals);
    player.career.matchRatings = player.career.matchRatings || [];
    player.career.matchRatings.push(rating);

    return {
        myGoals, enemyGoals, playerGoals, playerAssists, playerDefs,
        matchRating: rating, log, matchEvents,
        win: myGoals > enemyGoals,
        draw: myGoals === enemyGoals,
    };
}

function calcMyShare(ovr) {
    if (ovr <= 72) return 0.30;
    if (ovr <= 90) return 0.30 + (ovr - 72) * (0.20 / 18);
    if (ovr <= 102) return 0.50 + (ovr - 90) * (0.20 / 12);
    return 0.70;
}

function calcMatchRating(player, goals, assists, defs, teamGoals, teamConcede) {
    let base = 6.0;
    base += goals * 1.2;
    base += assists * 0.8;
    base += defs * 0.4;
    if (teamGoals > teamConcede) base += 0.5;
    if (teamGoals < teamConcede) base -= 0.3;
    if (teamConcede === 0 && ['DF','GK'].includes(player.position)) base += 0.5;
    return Math.round(Math.min(10, Math.max(4.5, base + (Math.random() - 0.5))) * 10) / 10;
}

// AI 리그 경기 시뮬레이션 (팀 간)
function simulateAIMatch(homeTeam, awayTeam) {
    const homePow = teamAvgOvr(homeTeam.players) + 3; // 홈 어드밴티지
    const awayPow = teamAvgOvr(awayTeam.players);
    const homeDice = rollDice(homePow, 10);
    const awayDice = rollDice(awayPow, 10);
    const diff = Math.abs(homeDice - awayDice);

    let homeGoals = 0, awayGoals = 0;
    if (diff <= 3) {
        homeGoals = Math.floor(Math.random() * 2);
        awayGoals = Math.floor(Math.random() * 2);
    } else if (diff <= 10) {
        const winner = homeDice >= awayDice ? 'home' : 'away';
        if (winner === 'home') { homeGoals = Math.floor(Math.random() * 2) + 1; awayGoals = Math.floor(Math.random() * 2); }
        else { awayGoals = Math.floor(Math.random() * 2) + 1; homeGoals = Math.floor(Math.random() * 2); }
    } else {
        const winner = homeDice >= awayDice ? 'home' : 'away';
        if (winner === 'home') { homeGoals = Math.floor(Math.random() * 3) + 2; awayGoals = Math.floor(Math.random() * 2); }
        else { awayGoals = Math.floor(Math.random() * 3) + 2; homeGoals = Math.floor(Math.random() * 2); }
    }
    return { homeGoals, awayGoals, homeDice, awayDice };
}

// 발롱도르 점수 계산
function calcBallonDorScore(player, season) {
    const avgRating = season.ratings.length > 0
        ? season.ratings.reduce((a, b) => a + b, 0) / season.ratings.length
        : 6.0;
    const trophy = (season.trophies || 0) * 15 + (season.topScorer ? 10 : 0) + (season.topAssist ? 5 : 0);
    if (['DF','GK'].includes(player.position)) {
        return (avgRating * 12) + ((season.criticalDefs || 0) * 0.85) + trophy + 15;
    }
    return (avgRating * 10) + (season.goals || 0) + ((season.assists || 0) * 0.8) + trophy;
}
