// ============================================================
// season.js v2 — 승격/강등, 발롱도르 화면, AI 에이징, POTM
// ============================================================

// ── 리그 테이블 초기화 ────────────────────────────────────────
function initLeagueTable(teams) {
    const table = {};
    for (const [key, team] of Object.entries(teams)) {
        table[key] = {
            key,
            displayName: team.displayName,
            league: team.league,
            played: 0, won: 0, drawn: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0, points: 0,
        };
    }
    return table;
}

// ── 리그 테이블 업데이트 ─────────────────────────────────────
function updateTable(table, homeKey, awayKey, homeGoals, awayGoals) {
    const h = table[homeKey];
    const a = table[awayKey];
    if (!h || !a) return;
    h.played++; a.played++;
    h.goalsFor += homeGoals; h.goalsAgainst += awayGoals;
    a.goalsFor += awayGoals; a.goalsAgainst += homeGoals;
    if (homeGoals > awayGoals)      { h.won++; h.points += 3; a.lost++; }
    else if (homeGoals === awayGoals){ h.drawn++; h.points++; a.drawn++; a.points++; }
    else                             { a.won++; a.points += 3; h.lost++; }
}

// ── 리그 순위 정렬 ────────────────────────────────────────────
function getSortedTable(table, league) {
    return Object.values(table)
        .filter(t => t.league === league)
        .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const gdA = a.goalsFor - a.goalsAgainst;
            const gdB = b.goalsFor - b.goalsAgainst;
            if (gdB !== gdA) return gdB - gdA;
            return b.goalsFor - a.goalsFor;
        });
}

// ── 픽스쳐 생성 ──────────────────────────────────────────────
function generateFixtures(teamKeys) {
    const fixtures = [];
    const keys = [...teamKeys];
    for (let i = 0; i < keys.length; i++)
        for (let j = i + 1; j < keys.length; j++) {
            fixtures.push({ home: keys[i], away: keys[j] });
            fixtures.push({ home: keys[j], away: keys[i] });
        }
    for (let i = fixtures.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]];
    }
    return fixtures;
}

// ── AI 라운드 처리 ────────────────────────────────────────────
function processAIRound(gameState, playerTeamKey) {
    const { leagueFixtures, leagueTable, teams, currentRound } = gameState;
    const roundFixtures = leagueFixtures[currentRound] || [];
    for (const fix of roundFixtures) {
        if (fix.home === playerTeamKey || fix.away === playerTeamKey) continue;
        const home = teams[fix.home];
        const away = teams[fix.away];
        if (!home || !away) continue;
        const result = simulateAIMatch(home, away);
        updateTable(leagueTable, fix.home, fix.away, result.homeGoals, result.awayGoals);
    }
}

// ── 시즌 통계 초기화 ─────────────────────────────────────────
function initSeasonStats() {
    return {
        goals: 0, assists: 0, criticalDefs: 0,
        ratings: [], matchesPlayed: 0,
        trophies: 0, topScorer: false, topAssist: false,
        cleanSheets: 0,
    };
}

// ── 시즌 종료 처리 (핵심) ────────────────────────────────────
function endSeason(gameState, player) {
    const events = [];
    const season  = gameState.seasonStats;
    const myLeague = gameState.teams[player.teamKey]?.league || 3;
    const table    = getSortedTable(gameState.leagueTable, myLeague);
    const myRank   = table.findIndex(t => t.key === player.teamKey) + 1;
    const total    = table.length;

    // ── 우승 ────────────────────────────────────────────────
    if (myRank === 1) {
        season.trophies++;
        player.career.trophies = (player.career.trophies || 0) + 1;
        player.reputation = Math.min(999, player.reputation + 40);
        events.push('🏆 리그 우승!');
    } else if (myRank <= 3) {
        player.reputation = Math.min(999, player.reputation + 15);
        events.push(`🥈 리그 ${myRank}위 마감`);
    } else if (myRank > total - 2) {
        player.reputation = Math.max(0, player.reputation - 15);
        events.push(`📉 리그 ${myRank}위 마감`);
    } else {
        events.push(`📋 리그 ${myRank}위 마감`);
    }

    // ── 득점왕 / 도움왕 ─────────────────────────────────────
    const topGoals   = calcLeagueTopScorer(gameState);
    const topAssists = calcLeagueTopAssist(gameState);
    if (season.goals >= topGoals && season.goals > 0) {
        season.topScorer = true;
        player.reputation = Math.min(999, player.reputation + 20);
        events.push(`⚽ 득점왕! (${season.goals}골)`);
    }
    if (season.assists >= topAssists && season.assists > 0) {
        season.topAssist = true;
        player.reputation = Math.min(999, player.reputation + 10);
        events.push(`🅰️ 도움왕! (${season.assists}도움)`);
    }

    // ── 평균 평점 ────────────────────────────────────────────
    const avgRating = season.ratings.length > 0
        ? season.ratings.reduce((a, b) => a + b, 0) / season.ratings.length
        : 6.0;
    events.push(`📊 시즌 평균 평점: ${avgRating.toFixed(1)}`);

    // ── 발롱도르 ─────────────────────────────────────────────
    const bdScore   = calcBallonDorScore(player, season);
    const aiBdScore = calcAIBallonDor(gameState);
    if (bdScore >= 130) {
        if (bdScore > aiBdScore) {
            player.career.trophies = (player.career.trophies || 0) + 1;
            player.reputation = Math.min(999, player.reputation + 60);
            gameState.lastBallonDor = { winner: player.name, score: Math.round(bdScore), year: gameState.date.year };
            events.push(`🌟 발롱도르 수상!!! (${Math.round(bdScore)}점)`);
        } else {
            events.push(`🏅 발롱도르 후보 (${Math.round(bdScore)}점 / AI ${Math.round(aiBdScore)}점)`);
        }
    }

    // ── SP 지급 ──────────────────────────────────────────────
    const opponentAvgOvr = calcLeagueAvgOvr(gameState, player.teamKey);
    const sp = calcSeasonSP(player, avgRating, opponentAvgOvr);
    events.push(`💎 시즌 SP 획득: ${sp}`);

    // ── 에이징 커브 ──────────────────────────────────────────
    const ageEvents = applyAgingCurve(player);
    events.push(...ageEvents);

    // ── AI 선수 성장/에이징 ───────────────────────────────────
    applyAIAgingAndGrowth(gameState);

    // ── 칭호 체크 ────────────────────────────────────────────
    const newTitles = checkTitles(player);
    for (const t of newTitles) events.push(`🎖️ 칭호 해금: ${t.name}`);

    // ── 승격/강등 처리 ───────────────────────────────────────
    const promoEvents = processPromotionRelegation(gameState, player.teamKey, myRank, total, myLeague);
    events.push(...promoEvents);

    // ── 주급 지급 (연간) ─────────────────────────────────────
    const annualWage = player.weeklyWage * 38;
    gameState.playerMoney = (gameState.playerMoney || 0) + annualWage;
    events.push(`💵 연봉 수령: ${annualWage.toLocaleString()}만원`);

    return { events, sp, avgRating, rank: myRank, bdScore };
}

// ── 승격/강등 처리 ────────────────────────────────────────────
// 각 리그 상위 2팀 → 상위 리그로, 하위 2팀 → 하위 리그로
function processPromotionRelegation(gameState, playerTeamKey, playerRank, totalTeams, playerLeague) {
    const events = [];
    const PROMO_SPOTS = 2;   // 상위 2팀 승격
    const RELEGATE_SPOTS = 2; // 하위 2팀 강등

    // 각 리그별 순위 처리
    for (const league of [1, 2, 3]) {
        const sorted = getSortedTable(gameState.leagueTable, league);
        const count  = sorted.length;
        if (count < 4) continue; // 팀 수 부족하면 스킵

        sorted.forEach((entry, idx) => {
            const rank = idx + 1;
            const team = gameState.teams[entry.key];
            if (!team) return;

            const isPlayerTeam = entry.key === playerTeamKey;

            // 승격 (1부는 올라갈 곳 없음)
            if (rank <= PROMO_SPOTS && league > 1) {
                const newLeague = league - 1;
                team.league = newLeague;
                if (isPlayerTeam) {
                    gameState.teamKey = playerTeamKey;
                    events.push(`🚀 ${team.displayName} 승격! ${league}부 → ${newLeague}부 리그`);
                }
            }

            // 강등 (3부는 내려갈 곳 없음)
            if (rank > count - RELEGATE_SPOTS && league < 3) {
                const newLeague = league + 1;
                team.league = newLeague;
                if (isPlayerTeam) {
                    gameState.teamKey = playerTeamKey;
                    events.push(`📉 ${team.displayName} 강등... ${league}부 → ${newLeague}부 리그`);
                }
            }
        });
    }

    // 플레이어 팀 승격/강등 명성 보정
    if (playerLeague > 1 && playerRank <= PROMO_SPOTS) {
        gameState.player.reputation = Math.min(999, (gameState.player?.reputation || 0) + 50);
    }
    if (playerLeague < 3 && playerRank > totalTeams - RELEGATE_SPOTS) {
        gameState.player.reputation = Math.max(0, (gameState.player?.reputation || 0) - 30);
    }

    return events;
}

// ── AI 선수 성장 / 에이징 ────────────────────────────────────
function applyAIAgingAndGrowth(gameState) {
    for (const team of Object.values(gameState.teams)) {
        if (!team.players) continue;
        for (const p of team.players) {
            p.age = (p.age || 18) + 1;

            if (p.age <= 25) {
                // 성장: 유망주는 OVR +1~2
                const growth = Math.floor(Math.random() * 2) + (p.age <= 21 ? 1 : 0);
                p.rating = Math.min(99, (p.rating || 70) + growth);
            } else if (p.age >= 33) {
                // 에이징: 33세+ OVR -1~2
                const decay = Math.floor(Math.random() * 2) + 1;
                p.rating = Math.max(55, (p.rating || 70) - decay);
            }
            // 26~32세 전성기는 변동 없음
        }
    }
}

// ── 발롱도르 점수 ─────────────────────────────────────────────
function calcBallonDorScore(player, season) {
    const avgRating = season.ratings.length > 0
        ? season.ratings.reduce((a, b) => a + b, 0) / season.ratings.length
        : 6.0;
    const trophy = (season.trophies || 0) * 15
                 + (season.topScorer ? 10 : 0)
                 + (season.topAssist ? 5 : 0);
    if (['DF','GK'].includes(player.position))
        return (avgRating * 12) + ((season.criticalDefs || 0) * 0.85) + trophy + 15;
    return (avgRating * 10) + (season.goals || 0) + ((season.assists || 0) * 0.8) + trophy;
}

function calcAIBallonDor(gameState) {
    // 1부 리그 최고 OVR 선수 기준으로 AI 발롱도르 점수 계산
    let topOvr = 70;
    for (const [, team] of Object.entries(gameState.teams)) {
        if (team.league !== 1) continue;
        for (const p of (team.players || [])) {
            if (p.rating > topOvr) topOvr = p.rating;
        }
    }
    // AI 경쟁자 시즌 성적 추정
    const estGoals  = Math.floor(topOvr * 0.4 + Math.random() * 15);
    const estRating = 6.5 + Math.random() * 2.0;
    const estTrophy = Math.random() < 0.5 ? 15 : 0;
    return (estRating * 10) + estGoals + estTrophy + Math.random() * 20;
}

// ── 리그 평균 OVR ────────────────────────────────────────────
function calcLeagueAvgOvr(gameState, myTeamKey) {
    const myLeague = gameState.teams[myTeamKey]?.league || 1;
    const rivals = Object.entries(gameState.teams)
        .filter(([k, t]) => t.league === myLeague && k !== myTeamKey);
    if (rivals.length === 0) return 75;
    return rivals.reduce((s, [, t]) => s + teamAvgOvr(t.players), 0) / rivals.length;
}

function calcLeagueTopScorer(gameState) {
    const best = Object.values(gameState.teams)
        .reduce((max, t) => Math.max(max, teamAvgOvr(t.players)), 70);
    return Math.floor(best * 0.25 + 5);
}
function calcLeagueTopAssist(gameState) {
    return Math.floor(calcLeagueTopScorer(gameState) * 0.7);
}

// ── 다음 시즌 준비 ────────────────────────────────────────────
function prepareNextSeason(gameState) {
    // 리그별 팀 재분류 (승격/강등 반영)
    const leagueTeamKeys = {};
    for (const [key, team] of Object.entries(gameState.teams)) {
        const l = team.league;
        if (!leagueTeamKeys[l]) leagueTeamKeys[l] = [];
        leagueTeamKeys[l].push(key);
    }

    // 플레이어 팀 리그 기반으로 픽스쳐 생성
    const playerLeague = gameState.teams[gameState.teamKey]?.league || 3;
    const myLeagueKeys = leagueTeamKeys[playerLeague] || [gameState.teamKey];

    const allFix   = generateFixtures(myLeagueKeys);
    const perRound = Math.floor(myLeagueKeys.length / 2);
    const newFix   = {};
    let r = 0;
    for (let i = 0; i < allFix.length; i += perRound) {
        newFix[r++] = allFix.slice(i, i + perRound);
    }

    gameState.leagueFixtures  = newFix;
    gameState.totalRounds     = r;
    gameState.currentRound    = 0;
    gameState.leagueTable     = initLeagueTable(gameState.teams);
    gameState.seasonStats     = initSeasonStats();
    gameState.date.year++;
    gameState.date.month      = 8;
    gameState.trainedThisRound = false;
    gameState.usedEvents      = [];

    return gameState;
}
