// ============================================================
// match.js — 1분 단위 매치 엔진 (v2 — 골 확률 상향, AI 시뮬 개선)
// ============================================================

// 기본 확률 — 골/어시 2.5배 상향 (경기당 평균 2~4골)
const BASE_PROB = { goal: 0.010, criticalDef: 0.014 };

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

// ── 메인 플레이어 매치 시뮬레이션 ──────────────────────────────
function simulateMatch(player, myTeam, enemyTeam, options = {}) {
    const { isAway = false, badWeather = false } = options;
    const myTeamOvr  = teamAvgOvr(myTeam.players);
    const enemyOvr   = teamAvgOvr(enemyTeam.players);

    const log = [];
    let myGoals = 0, enemyGoals = 0;
    let playerGoals = 0, playerAssists = 0, playerDefs = 0;
    const matchEvents = [];

    const envPenalty = (isAway ? -4 : 0) + (badWeather ? -3 : 0);

    // 팀 강도 비율 (0.7 ~ 1.4 범위로 클램핑 — 압도적 차이도 경기 됨)
    const teamRatio = Math.min(1.4, Math.max(0.7, myTeamOvr / Math.max(enemyOvr, 1)));

    for (let min = 1; min <= 90; min++) {

        // 클러치 보정 (70분 이후)
        const clutchMult = min >= 70
            ? 1 + Math.max(0, ((player.stats.composure || 72) - 72) / 120)
            : 1;

        // ── 우리 팀 골 판정 ──────────────────────────────────────
        const goalAmp = ampFactor(
            (player.stats.shooting || 72) + envPenalty,
            (player.stats.judgment  || 72)
        );
        const myGoalProb = BASE_PROB.goal * goalAmp * clutchMult * teamRatio;

        if (Math.random() < myGoalProb) {
            myGoals++;
            const myShare = calcMyShare(player.rating, player.position);

            if (Math.random() < myShare) {
                // 내 슈팅 — 키퍼 대결
                const gkBase  = rollDice(enemyOvr * 1.05, 12);
                const myShot  = rollDice((player.stats.shooting || 72) + 10 + envPenalty, 12);
                if (myShot >= gkBase) {
                    playerGoals++;
                    player.career.goals = (player.career.goals || 0) + 1;
                    matchEvents.push({ min, type: 'goal', text: `⚽ ${min}' ${player.name} 골!` });
                    log.push(`${min}' ⚽ ${player.name} 골!`);
                } else {
                    // 슈팅은 발생했지만 막힘 — 그래도 팀골로는 카운트
                    matchEvents.push({ min, type: 'shot', text: `🥅 ${min}' ${player.name} 슈팅 — 선방!` });
                }
            } else {
                // 동료 골 — 어시스트 판정
                const passRoll = rollDice((player.stats.passing || 72) + 10 + envPenalty, 10);
                // 패스 스탯 높을수록 어시스트 확률 상승 (기본 45%)
                const assistChance = 0.35 + Math.max(0, (passRoll - 72) / 200);
                if (Math.random() < assistChance) {
                    playerAssists++;
                    player.career.assists = (player.career.assists || 0) + 1;
                    matchEvents.push({ min, type: 'assist', text: `🅰️ ${min}' ${player.name} 어시스트!` });
                    log.push(`${min}' 🅰️ ${player.name} 어시스트!`);
                } else {
                    matchEvents.push({ min, type: 'teamgoal', text: `⚽ ${min}' 팀 득점` });
                    log.push(`${min}' ⚽ 팀 득점`);
                }
            }
        }

        // ── 상대 팀 골 판정 ──────────────────────────────────────
        const enemyRatio = Math.min(1.4, Math.max(0.7, enemyOvr / Math.max(myTeamOvr, 1)));
        const enemyGoalProb = BASE_PROB.goal * enemyRatio * (isAway ? 1.1 : 0.9);

        if (Math.random() < enemyGoalProb) {
            enemyGoals++;
            matchEvents.push({ min, type: 'concede', text: `❌ ${min}' 실점` });
            log.push(`${min}' ❌ 실점`);
        }

        // ── 결정적 수비 이벤트 ───────────────────────────────────
        if (['DF', 'GK'].includes(player.position)) {
            const defAmp = ampFactor(
                (player.stats.speed    || 72) + envPenalty,
                (player.stats.defending || 72) + envPenalty
            );
            if (Math.random() < BASE_PROB.criticalDef * defAmp) {
                playerDefs++;
                player.career.criticalDefenses = (player.career.criticalDefenses || 0) + 1;
                matchEvents.push({ min, type: 'def', text: `🛡️ ${min}' ${player.name} 결정적 수비!` });
                log.push(`${min}' 🛡️ 결정적 수비`);
            }
        }

        // MF/FW도 가끔 결정적 플레이 이벤트 (드리블 돌파 등 — 스탯 로그용)
        if (!['DF','GK'].includes(player.position) && min % 15 === 0) {
            const dribRoll = rollDice((player.stats.dribbling || 72), 10);
            if (dribRoll > 78) {
                matchEvents.push({ min, type: 'dribble', text: `💨 ${min}' ${player.name} 돌파 성공!` });
            }
        }
    }

    const rating = calcMatchRating(player, playerGoals, playerAssists, playerDefs, myGoals, enemyGoals);
    player.career.matchRatings = player.career.matchRatings || [];
    player.career.matchRatings.push(rating);

    return {
        myGoals, enemyGoals, playerGoals, playerAssists, playerDefs,
        matchRating: rating, log, matchEvents,
        win:  myGoals > enemyGoals,
        draw: myGoals === enemyGoals,
    };
}

// ── 포지션/OVR 기반 지분율 ─────────────────────────────────────
// 공격수는 기본 지분 높게, 수비수/GK는 낮게
function calcMyShare(ovr, position) {
    const posBase = position === 'FW' ? 0.45
                  : position === 'MF' ? 0.30
                  : position === 'DF' ? 0.12
                  : 0.05; // GK

    if (ovr <= 72)  return posBase;
    if (ovr <= 90)  return posBase + (ovr - 72) * (0.20 / 18);
    if (ovr <= 102) return posBase + 0.20 + (ovr - 90) * (0.15 / 12);
    return posBase + 0.35;
}

// ── 경기 평점 ──────────────────────────────────────────────────
function calcMatchRating(player, goals, assists, defs, teamGoals, teamConcede) {
    let base = 6.0;
    base += goals   * 1.3;
    base += assists * 0.9;
    base += defs    * 0.45;
    if (teamGoals > teamConcede) base += 0.4;
    if (teamGoals < teamConcede) base -= 0.3;
    if (teamConcede === 0 && ['DF','GK'].includes(player.position)) base += 0.6;
    // 랜덤 변동폭 축소 (-0.3 ~ +0.3)
    const jitter = (Math.random() - 0.5) * 0.6;
    return Math.round(Math.min(10, Math.max(4.5, base + jitter)) * 10) / 10;
}

// ── AI 리그 경기 시뮬레이션 ────────────────────────────────────
// 현실적인 축구 스코어 분포 반영 (0-0 ~ 4-2 수준)
function simulateAIMatch(homeTeam, awayTeam) {
    const homePow = teamAvgOvr(homeTeam.players) + 3; // 홈 어드밴티지
    const awayPow = teamAvgOvr(awayTeam.players);
    const homeDice = rollDice(homePow, 8);
    const awayDice = rollDice(awayPow, 8);
    const diff = homeDice - awayDice; // 양수면 홈 우세

    // 각 팀 기대 골 수 계산 (포아송 근사)
    const homeExpected = Math.max(0.3, 1.5 + diff * 0.08);
    const awayExpected = Math.max(0.3, 1.2 - diff * 0.08);

    const homeGoals = poissonSample(homeExpected);
    const awayGoals = poissonSample(awayExpected);

    return { homeGoals, awayGoals, homeDice, awayDice };
}

// 포아송 분포 샘플링 (축구 골 수 모델링)
function poissonSample(lambda) {
    // Knuth 알고리즘
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return Math.min(k - 1, 7); // 최대 7골 제한
}

// ── 발롱도르 점수 계산 ─────────────────────────────────────────
function calcBallonDorScore(player, season) {
    const avgRating = season.ratings.length > 0
        ? season.ratings.reduce((a, b) => a + b, 0) / season.ratings.length
        : 6.0;
    const trophy = (season.trophies || 0) * 15
                 + (season.topScorer ? 10 : 0)
                 + (season.topAssist ? 5  : 0);

    if (['DF','GK'].includes(player.position)) {
        return (avgRating * 12) + ((season.criticalDefs || 0) * 0.85) + trophy + 15;
    }
    return (avgRating * 10) + (season.goals || 0) + ((season.assists || 0) * 0.8) + trophy;
}
