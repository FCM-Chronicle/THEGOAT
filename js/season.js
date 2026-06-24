// ============================================================
// season.js — 시즌 관리, 리그 테이블, 시상식
// ============================================================

// 초기 리그 테이블 생성
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

// 리그 테이블 업데이트
function updateTable(table, homeKey, awayKey, homeGoals, awayGoals) {
    const h = table[homeKey];
    const a = table[awayKey];
    if (!h || !a) return;

    h.played++; a.played++;
    h.goalsFor += homeGoals; h.goalsAgainst += awayGoals;
    a.goalsFor += awayGoals; a.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
        h.won++; h.points += 3;
        a.lost++;
    } else if (homeGoals === awayGoals) {
        h.drawn++; h.points++;
        a.drawn++; a.points++;
    } else {
        a.won++; a.points += 3;
        h.lost++;
    }
}

// 리그 순위 정렬
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

// 시즌 픽스쳐 생성 (각 팀이 서로 홈/어웨이 1번씩)
function generateFixtures(teamKeys) {
    const fixtures = [];
    const keys = [...teamKeys];
    // 라운드 로빈
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            fixtures.push({ home: keys[i], away: keys[j] });
            fixtures.push({ home: keys[j], away: keys[i] });
        }
    }
    // 셔플
    for (let i = fixtures.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]];
    }
    return fixtures;
}

// 1라운드 AI 경기 처리 (플레이어 팀 제외)
function processAIRound(gameState, playerTeamKey) {
    const { leagueFixtures, leagueTable, teams, currentRound } = gameState;
    const roundFixtures = leagueFixtures[currentRound] || [];
    const results = [];

    for (const fix of roundFixtures) {
        if (fix.home === playerTeamKey || fix.away === playerTeamKey) continue;
        const home = teams[fix.home];
        const away = teams[fix.away];
        if (!home || !away) continue;

        const result = simulateAIMatch(home, away);
        updateTable(leagueTable, fix.home, fix.away, result.homeGoals, result.awayGoals);
        results.push({ ...fix, ...result });
    }
    return results;
}

// 시즌 통계 초기화
function initSeasonStats() {
    return {
        goals: 0, assists: 0, criticalDefs: 0,
        ratings: [], matchesPlayed: 0,
        trophies: 0, topScorer: false, topAssist: false,
        cleanSheets: 0,
    };
}

// 시즌 종료 처리
function endSeason(gameState, player) {
    const events = [];
    const season = gameState.seasonStats;
    const table = getSortedTable(gameState.leagueTable, gameState.teams[player.teamKey]?.league || 1);
    const myRank = table.findIndex(t => t.key === player.teamKey) + 1;

    // 우승 여부
    if (myRank === 1) {
        season.trophies++;
        player.career.trophies = (player.career.trophies || 0) + 1;
        events.push('🏆 리그 우승!');
    }

    // 득점왕 체크
    const topScorerGoals = calcLeagueTopScorer(gameState);
    if (season.goals >= topScorerGoals && season.goals > 0) {
        season.topScorer = true;
        events.push(`⚽ 득점왕! (${season.goals}골)`);
    }

    // 도움왕 체크
    const topAssistCount = calcLeagueTopAssist(gameState);
    if (season.assists >= topAssistCount && season.assists > 0) {
        season.topAssist = true;
        events.push(`🅰️ 도움왕! (${season.assists}도움)`);
    }

    // 평균 평점
    const avgRating = season.ratings.length > 0
        ? season.ratings.reduce((a, b) => a + b, 0) / season.ratings.length
        : 6.0;
    events.push(`📊 시즌 평균 평점: ${avgRating.toFixed(1)}`);

    // 발롱도르 체크
    const bdScore = calcBallonDorScore(player, season);
    if (bdScore >= 130) {
        events.push(`🏅 발롱도르 후보 진입! (${Math.round(bdScore)}점)`);
        if (bdScore === Math.max(bdScore, calcAIBallonDor(gameState, season))) {
            player.career.trophies = (player.career.trophies || 0) + 1;
            events.push('🌟 발롱도르 수상!!!');
        }
    }

    // SP 지급
    const opponentAvgOvr = calcLeagueAvgOvr(gameState, player.teamKey);
    const sp = calcSeasonSP(player, avgRating, opponentAvgOvr);
    events.push(`💎 시즌 SP 획득: ${sp}`);

    // 에이징 커브
    const ageEvents = applyAgingCurve(player);
    events.push(...ageEvents);

    // 칭호 체크
    const newTitles = checkTitles(player);
    for (const t of newTitles) {
        events.push(`🎖️ 칭호 해금: ${t.name}`);
    }

    // 명성 리그 기반 조정
    if (myRank <= 3) player.reputation = Math.min(999, player.reputation + 15);
    else if (myRank > table.length - 3) player.reputation = Math.max(0, player.reputation - 10);

    // 리그 승격 체크
    const leagueEvents = checkLeaguePromotion(gameState, player, myRank, table.length);
    events.push(...leagueEvents);

    return { events, sp, avgRating, rank: myRank, bdScore };
}

// 리그 평균 오버롤 (상대팀 기준)
function calcLeagueAvgOvr(gameState, myTeamKey) {
    const myLeague = gameState.teams[myTeamKey]?.league || 1;
    const rivals = Object.entries(gameState.teams)
        .filter(([k, t]) => t.league === myLeague && k !== myTeamKey);
    if (rivals.length === 0) return 75;
    const total = rivals.reduce((s, [, t]) => s + teamAvgOvr(t.players), 0);
    return total / rivals.length;
}

// AI 득점왕 골 수 추정
function calcLeagueTopScorer(gameState) {
    // 간단 추정: 평균 OVR 기반
    const best = Object.values(gameState.teams).reduce((max, t) => {
        const ovr = teamAvgOvr(t.players);
        return Math.max(max, ovr);
    }, 70);
    return Math.floor((best / 90) * 38 * 1.5 + 5); // 38라운드 기준
}

function calcLeagueTopAssist(gameState) {
    return Math.floor(calcLeagueTopScorer(gameState) * 0.7);
}

// 발롱도르 AI 경쟁자 점수
function calcAIBallonDor(gameState, season) {
    const topOvr = Object.values(gameState.teams).reduce((max, t) => {
        const best = t.players ? Math.max(...t.players.map(p => p.rating)) : 70;
        return Math.max(max, best);
    }, 70);
    return topOvr * 10 + Math.random() * 50;
}

// 리그 승격/강등 체크
function checkLeaguePromotion(gameState, player, rank, totalTeams) {
    const events = [];
    const myTeam = gameState.teams[player.teamKey];
    if (!myTeam) return events;

    const repNeeded = { 1: 750, 2: 450, 3: 0 };
    const currentLeague = myTeam.league;

    // 1부 진입 조건
    if (currentLeague === 2 && player.reputation >= 750) {
        myTeam.league = 1;
        events.push('🚀 명성 750 달성! 1부 리그 클럽 제안이 들어왔습니다!');
    } else if (currentLeague === 3 && player.reputation >= 450) {
        myTeam.league = 2;
        events.push('📈 명성 450 달성! 2부 리그 클럽 제안이 들어왔습니다!');
    }

    // 우승 시 명성 보너스
    if (rank === 1) player.reputation = Math.min(999, player.reputation + 30);

    return events;
}

// 이달의 선수 (POTM) 계산
function calcPOTM(players, monthData) {
    // monthData: { playerKey: { ratings, goals, assists, wins } }
    let best = null, bestScore = -Infinity;
    for (const [key, data] of Object.entries(monthData)) {
        const avg = data.ratings.length > 0
            ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length : 6.0;
        const score = avg + (data.goals || 0) * 2.0 + (data.assists || 0) * 1.5 + (data.wins || 0) * 1.0;
        if (score > bestScore) { bestScore = score; best = key; }
    }
    return best;
}

// 라운드 베스트11 점수
function calcBest11Score(player, matchData) {
    const { rating, goals, assists, cleanSheet, position } = matchData;
    if (['DF','GK'].includes(position)) {
        return rating + (cleanSheet ? 1.5 : 0);
    }
    return rating + (goals || 0) * 1.5 + (assists || 0) * 1.0;
}

// 다음 시즌 준비
function prepareNextSeason(gameState) {
    const leagueTeamKeys = {};

    // 리그별 팀 분류
    for (const [key, team] of Object.entries(gameState.teams)) {
        const l = team.league;
        if (!leagueTeamKeys[l]) leagueTeamKeys[l] = [];
        leagueTeamKeys[l].push(key);
    }

    const newFixtures = {};
    for (const [league, keys] of Object.entries(leagueTeamKeys)) {
        const allFixtures = generateFixtures(keys);
        // 라운드당 fixtures 분배
        const perRound = Math.floor(keys.length / 2);
        let round = 0;
        for (let i = 0; i < allFixtures.length; i += perRound) {
            newFixtures[round] = allFixtures.slice(i, i + perRound);
            round++;
        }
    }

    gameState.leagueFixtures = newFixtures;
    gameState.totalRounds = Object.keys(newFixtures).length;
    gameState.currentRound = 0;
    gameState.leagueTable = initLeagueTable(gameState.teams);
    gameState.seasonStats = initSeasonStats();
    gameState.date.year++;
    gameState.date.month = 8; // 새 시즌 8월 시작

    return gameState;
}
