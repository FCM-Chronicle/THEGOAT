// ============================================================
// cup.js — 컵대회 & 국제대회 토너먼트 시스템
// ============================================================

// ── 대회 종류 상수 ───────────────────────────────────────────
const TOURNAMENT_TYPES = {
    WORLD_CUP:     { name: 'FIFA 월드컵',           teams: 48, groups: 12, groupSize: 4 },
    EURO:          { name: 'UEFA 유로',              teams: 24, groups: 6,  groupSize: 4 },
    COPA_AMERICA:  { name: '코파 아메리카',           teams: 10, groups: 2,  groupSize: 5 },
    ASIAN_CUP:     { name: 'AFC 아시안컵',           teams: 24, groups: 6,  groupSize: 4 },
    AFCON:         { name: '아프리카 네이션스컵',     teams: 24, groups: 6,  groupSize: 4 },
    NATIONS_LEAGUE:{ name: 'UEFA 네이션스리그',      teams: 4,  groups: 0,  groupSize: 0 },
    UCL:           { name: 'UEFA 챔피언스리그',      teams: 32, groups: 8,  groupSize: 4 },
    DOMESTIC_CUP:  { name: '국내 컵대회',            teams: 16, groups: 0,  groupSize: 0 },
};

// ── 국제대회 스케줄러 ─────────────────────────────────────────
function getTournamentSchedule(year) {
    const loop = year % 4;
    const schedule = [];

    if (loop === 2) schedule.push({ type: 'WORLD_CUP',      month: 6 });
    if (loop === 3) { schedule.push({ type: 'ASIAN_CUP', month: 1 }); schedule.push({ type: 'AFCON', month: 1 }); }
    if (loop === 0) { schedule.push({ type: 'EURO', month: 6 }); schedule.push({ type: 'COPA_AMERICA', month: 6 }); }
    if (loop === 1) schedule.push({ type: 'NATIONS_LEAGUE', month: 6 });

    // 매년 UCL / 국내컵
    schedule.push({ type: 'UCL',          month: 3 });
    schedule.push({ type: 'DOMESTIC_CUP', month: 4 });

    return schedule;
}

// ── 국가대표 차출 체크 ─────────────────────────────────────────
function checkNationalCallUp(player, tournamentType, gameState) {
    const countryCode = COUNTRY_CODE_MAP[player.country] || null;
    if (!countryCode) return null;

    const teamsList = TOURNAMENT_TEAMS[tournamentType] || [];
    if (!teamsList.includes(countryCode)) return null;

    // 명성 30 이상이어야 차출
    if (player.reputation < 30) {
        return {
            called: false,
            message: `📰 ${player.country} 국가대표 최종 명단에서 제외되었습니다. (명성 부족)`,
        };
    }

    const repBonus = Math.floor(player.reputation / 50) * 5;
    player.reputation = Math.min(999, player.reputation + 15 + repBonus);

    return {
        called: true,
        countryCode,
        tournamentType,
        message: `🎉 ${player.country} 국가대표 소집! ${TOURNAMENT_TYPES[tournamentType]?.name || tournamentType} 출전!`,
    };
}

// ── 가상 선수 OVR 생성 ─────────────────────────────────────────
const VIRTUAL_NAME_POOL = {
    KOR: { last: ['김','이','박','최','정','강','조','윤','장','임'], first: ['민준','서준','하준','도윤','시우','주원','예준','건우','현우','지우'] },
    ENG: { last: ['Smith','Jones','Taylor','Brown','Wilson'], first: ['James','Oliver','Harry','George','Noah'] },
    FRA: { last: ['Martin','Bernard','Dubois','Thomas','Robert'], first: ['Lucas','Hugo','Arthur','Louis','Jules'] },
    GER: { last: ['Muller','Schmidt','Schneider','Fischer','Weber'], first: ['Lukas','Leon','Felix','Jonas','Finn'] },
    BRA: { last: ['Silva','Santos','Oliveira','Souza','Pereira'], first: ['Gabriel','Lucas','Matheus','Rafael','Bruno'] },
    ARG: { last: ['Gomez','Rodriguez','Gonzalez','Fernandez','Lopez'], first: ['Santiago','Mateo','Joaquin','Nicolas','Benjamin'] },
    SEN: { last: ['Diop','Diallo','Ba','Fall','Cisse'], first: ['Moussa','Ibrahim','Amadou','Ousmane','Cheick'] },
    MAR: { last: ['Traore','Diop','Diallo','Faye','Cisse'], first: ['Mohamed','Youssef','Hamid','Mehdi','Karim'] },
    DEFAULT: { last: ['Lopez','Garcia','Kim','Lee','Da Silva'], first: ['Carlos','Juan','Min','Jun','Pedro'] },
};

function generateVirtualPlayer(countryCode, avgOvr) {
    const pool = VIRTUAL_NAME_POOL[countryCode] || VIRTUAL_NAME_POOL.DEFAULT;
    const last = pool.last[Math.floor(Math.random() * pool.last.length)];
    const first = pool.first[Math.floor(Math.random() * pool.first.length)];
    const positions = ['GK','DF','DF','MF','MF','FW'];
    const pos = positions[Math.floor(Math.random() * positions.length)];
    const ovr = Math.max(55, avgOvr - Math.floor(Math.random() * 6));
    const age = 18 + Math.floor(Math.random() * 16);

    return { name: `${last} ${first}`, position: pos, country: countryCode, age, rating: ovr, isVirtual: true };
}

// ── 국제대회 팀 스쿼드 생성 ────────────────────────────────────
function buildNationalTeamSquad(countryCode, allPlayers, avgOvr) {
    const realPlayers = allPlayers.filter(p => (COUNTRY_CODE_MAP[p.country] || '') === countryCode);
    const squad = [...realPlayers];

    // 11명이 안 되면 가상 선수로 채움
    while (squad.length < 11) {
        squad.push(generateVirtualPlayer(countryCode, avgOvr));
    }
    return squad.slice(0, 23); // 최대 23명
}

// ── 조별 리그 생성 ────────────────────────────────────────────
function buildGroups(teams, groupSize) {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const groups = [];
    for (let i = 0; i < shuffled.length; i += groupSize) {
        groups.push(shuffled.slice(i, i + groupSize));
    }
    return groups;
}

// ── 조별 리그 시뮬레이션 ─────────────────────────────────────────
function simulateGroupStage(groups, squadMap) {
    const groupResults = groups.map((group, gi) => {
        const table = {};
        group.forEach(cc => { table[cc] = { cc, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }; });

        // 조 내 모든 경기
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const home = group[i], away = group[j];
                const homeOvr = teamAvgOvr(squadMap[home] || []);
                const awayOvr = teamAvgOvr(squadMap[away] || []);
                const result = simulateAIMatch(
                    { players: squadMap[home] || [] },
                    { players: squadMap[away] || [] }
                );
                updateNationalTable(table, home, away, result.homeGoals, result.awayGoals);
            }
        }

        const sorted = Object.values(table).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            return (b.gf - b.ga) - (a.gf - a.ga);
        });

        return { group: gi, table, sorted, qualifiers: sorted.slice(0, 2).map(t => t.cc) };
    });

    return groupResults;
}

function updateNationalTable(table, home, away, hg, ag) {
    const h = table[home]; const a = table[away];
    if (!h || !a) return;
    h.played++; a.played++;
    h.gf += hg; h.ga += ag;
    a.gf += ag; a.ga += hg;
    if (hg > ag) { h.won++; h.pts += 3; a.lost++; }
    else if (hg === ag) { h.drawn++; h.pts++; a.drawn++; a.pts++; }
    else { a.won++; a.pts += 3; h.lost++; }
}

// ── 토너먼트 (녹아웃) 시뮬레이션 ────────────────────────────────
function simulateKnockout(teams, squadMap, playerCountry = null) {
    let bracket = [...teams];
    const rounds = [];
    let playerEliminated = false;
    let playerRound = null;

    while (bracket.length > 1) {
        const round = { matches: [], winners: [] };
        for (let i = 0; i < bracket.length; i += 2) {
            const home = bracket[i], away = bracket[i + 1];
            if (!away) { round.winners.push(home); continue; }

            const homeOvr = teamAvgOvr(squadMap[home] || []);
            const awayOvr = teamAvgOvr(squadMap[away] || []);
            let result = simulateAIMatch({ players: squadMap[home] || [] }, { players: squadMap[away] || [] });

            // 플레이어 팀 경기 처리
            const isPlayerMatch = playerCountry && (home === playerCountry || away === playerCountry);

            // 동점이면 승부차기 (50:50)
            let winner;
            if (result.homeGoals === result.awayGoals) {
                winner = Math.random() < 0.5 ? home : away;
                round.matches.push({ home, away, hg: result.homeGoals, ag: result.awayGoals, pens: true, winner });
            } else {
                winner = result.homeGoals > result.awayGoals ? home : away;
                round.matches.push({ home, away, hg: result.homeGoals, ag: result.awayGoals, winner });
            }

            round.winners.push(winner);

            if (isPlayerMatch && playerCountry && winner !== playerCountry) {
                playerEliminated = true;
                playerRound = rounds.length + 1;
            }
        }
        rounds.push(round);
        bracket = round.winners;
    }

    const champion = bracket[0];
    return { rounds, champion, playerEliminated, playerRound };
}

// ── 국제대회 개인상 ───────────────────────────────────────────
function calcTournamentAwards(player, tournamentStats, isChampion) {
    const awards = [];
    const champBonus = isChampion ? 20 : 0;

    const avgRating = tournamentStats.ratings.length > 0
        ? tournamentStats.ratings.reduce((a, b) => a + b, 0) / tournamentStats.ratings.length : 6.0;

    // 골든볼 (MVP)
    let mvpScore;
    if (['DF','GK'].includes(player.position)) {
        mvpScore = (avgRating * 15) + (tournamentStats.criticalDefs || 0) + champBonus;
    } else {
        mvpScore = (avgRating * 12) + (tournamentStats.goals || 0) * 2.5 + (tournamentStats.assists || 0) * 2.0 + champBonus;
    }
    if (mvpScore >= 100) awards.push({ name: '🥇 골든볼 (대회 MVP)', score: Math.round(mvpScore) });

    // 골든부트 (득점왕) — 간단 체크
    if ((tournamentStats.goals || 0) >= 3) {
        awards.push({ name: `⚽ 골든부트 (${tournamentStats.goals}골)`, score: tournamentStats.goals });
    }

    return awards;
}

// ── 가상 국가별 평균 OVR 맵 ────────────────────────────────────
function buildNationalAvgOvrMap(allTeams) {
    const map = {};
    for (const team of Object.values(allTeams)) {
        for (const p of (team.players || [])) {
            const cc = COUNTRY_CODE_MAP[p.country] || p.country;
            if (!map[cc]) map[cc] = { total: 0, count: 0 };
            map[cc].total += p.rating;
            map[cc].count++;
        }
    }
    const result = {};
    for (const [cc, data] of Object.entries(map)) {
        result[cc] = data.count > 0 ? data.total / data.count : 72;
    }
    return result;
}

// ── 국내 컵대회 ───────────────────────────────────────────────
function runDomesticCup(gameState, playerTeamKey) {
    const leagueTeams = Object.entries(gameState.teams)
        .filter(([, t]) => t.league === (gameState.teams[playerTeamKey]?.league || 1))
        .map(([k]) => k);

    if (leagueTeams.length < 4) return { log: ['컵대회 참가 팀 부족'], winner: null };

    const squadMap = {};
    for (const key of leagueTeams) {
        squadMap[key] = gameState.teams[key]?.players || [];
    }

    const result = simulateKnockout(leagueTeams, squadMap, playerTeamKey);
    const log = [];

    if (result.champion === playerTeamKey) {
        log.push('🏆 국내 컵대회 우승!');
        gameState.seasonStats.trophies = (gameState.seasonStats.trophies || 0) + 1;
        const player = gameState.player;
        if (player) {
            player.career.trophies = (player.career.trophies || 0) + 1;
            player.reputation = Math.min(999, player.reputation + 20);
        }
    } else if (result.playerEliminated) {
        log.push(`컵대회 ${result.playerRound}라운드에서 탈락했습니다.`);
    }

    return { log, winner: result.champion, rounds: result.rounds };
}
