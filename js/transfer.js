// ============================================================
// transfer.js — 이적시장 시스템
// ============================================================

// 선수 시장가치 계산
function calcMarketValue(player) {
    const baseByRating = (() => {
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
    return Math.round(baseByRating * ageMult);
}

// 클럽이 선수에게 오퍼를 보내는 로직
function generateTransferOffer(player, targetTeam, gameState) {
    const value = calcMarketValue(player);
    const repBonus = Math.floor(player.reputation / 50) * 10;
    const offerAmount = Math.floor(value * (0.9 + Math.random() * 0.4) + repBonus);
    const newWage = Math.floor(player.weeklyWage * (1.1 + Math.random() * 0.5));

    return {
        team: targetTeam,
        amount: offerAmount,      // 이적료 (억)
        weeklyWage: newWage,
        contractYears: Math.floor(Math.random() * 3) + 2,
        expiresIn: 3,             // 3일(라운드) 안에 결정
    };
}

// 이적 수락 처리
function acceptTransfer(player, offer, currentTeamKey, gameState) {
    const log = [];

    // 재정 처리 — 현재 팀 예산에 이적료 추가 (AI팀 예산 시뮬)
    const currentTeam = gameState.teams[currentTeamKey];
    if (currentTeam) {
        currentTeam.budget = (currentTeam.budget || 0) + offer.amount;
    }

    // 플레이어 이동
    const prevTeam = player.teamKey;
    player.teamKey = offer.team.key;
    player.weeklyWage = offer.weeklyWage;
    player.tendencies.loyalty = Math.max(0, (player.tendencies.loyalty || 50) - 10);

    log.push(`✈️ ${player.name} — ${offer.team.displayName} 이적 완료! 이적료: ${offer.amount}억`);
    log.push(`💰 새 주급: ${offer.weeklyWage.toLocaleString()}만원/주`);

    // 충성심이 낮은 경우 페널티
    if ((player.tendencies.loyalty || 50) < 30) {
        log.push('📰 팬들이 배신자라며 야유를 보냅니다...');
        player.reputation = Math.max(0, player.reputation - 20);
    }

    return { success: true, log, previousTeam: prevTeam };
}

// 이적 거절 처리
function rejectTransfer(player, offer) {
    player.tendencies.loyalty = Math.min(100, (player.tendencies.loyalty || 50) + 5);
    return {
        log: [`🤝 ${offer.team.displayName}의 제안을 거절했습니다. 충성심 +5`]
    };
}

// 자유계약 선수 영입
function signFreeAgent(freeAgent, teamKey, gameState) {
    const team = gameState.teams[teamKey];
    if (!team) return { ok: false, reason: '팀을 찾을 수 없습니다.' };

    const wage = calcWeeklyWage(freeAgent.rating);
    const signingFee = Math.floor(calcMarketValue(freeAgent) * 0.1); // 계약금 10%

    if ((team.budget || 0) < signingFee) {
        return { ok: false, reason: `예산 부족! 필요: ${signingFee}억, 보유: ${team.budget}억` };
    }

    team.budget -= signingFee;
    const newPlayer = createPlayer({ ...freeAgent });
    newPlayer.teamKey = teamKey;
    newPlayer.weeklyWage = wage;
    team.players = team.players || [];
    team.players.push(newPlayer);

    return {
        ok: true,
        player: newPlayer,
        log: [`✍️ ${freeAgent.name} 자유계약 영입! 계약금: ${signingFee}억`]
    };
}

// 선수 방출
function releasePlayer(playerName, teamKey, gameState) {
    const team = gameState.teams[teamKey];
    if (!team) return { ok: false };
    const idx = team.players.findIndex(p => p.name === playerName);
    if (idx === -1) return { ok: false, reason: '선수를 찾을 수 없습니다.' };
    const [released] = team.players.splice(idx, 1);
    return { ok: true, log: [`🚪 ${released.name} 방출 완료`] };
}

// 이적시장 윈도우 상태
function getTransferWindowStatus(gameState) {
    const month = gameState.date.month;
    // 1월 (겨울), 6-8월 (여름) 이적시장 오픈
    const isOpen = month === 1 || (month >= 6 && month <= 8);
    return {
        isOpen,
        label: isOpen ? '🟢 이적시장 오픈' : '🔴 이적시장 마감',
        nextOpen: isOpen ? null : (month < 6 ? `6월` : `내년 1월`),
    };
}

// 사우디 오일머니 오퍼 (랜덤 이벤트)
function checkSaudiOffer(player) {
    if (player.rating < 82 || player.age > 38) return null;
    if (Math.random() > 0.08) return null; // 8% 확률

    const saudiTeams = ['알_힐랄', '알_나스르', '알_이티하드'];
    const teamKey = saudiTeams[Math.floor(Math.random() * saudiTeams.length)];
    const saudiWage = player.weeklyWage * (8 + Math.floor(Math.random() * 5)); // 8~12배

    return {
        type: 'saudi_offer',
        teamKey,
        teamName: teamKey.replace('_', ' '),
        weeklyWage: saudiWage,
        amount: Math.floor(calcMarketValue(player) * 2.5),
        contractYears: 3,
        message: `💰 사우디 오일머니의 메가 오퍼! 주급 ${Math.round(saudiWage/100)}억/주`,
        choices: [
            { label: 'A. 계약서에 사인한다', effect: { reputation: -30, money: saudiWage * 52 * 3, loyalty: -20, event: 'saudi_yes' } },
            { label: 'B. 유럽 무대를 지킨다', effect: { reputation: +20, loyalty: +15, event: 'saudi_no' } },
        ]
    };
}

// 이적 찌라시 이벤트
function generateTransferRumor(player, gameState) {
    const leagueTeams = Object.entries(gameState.teams)
        .filter(([k, t]) => t.league === 1 && k !== player.teamKey)
        .map(([k, t]) => t);

    if (leagueTeams.length === 0) return null;
    const rumor = leagueTeams[Math.floor(Math.random() * leagueTeams.length)];

    return {
        type: 'transfer_rumor',
        targetTeam: rumor.displayName,
        message: `📰 이적 찌라시: ${rumor.displayName}이(가) ${player.name}에 관심?`,
        choices: [
            { label: 'A. 고소장 접수로 참교육', effect: { composure: +5, reputation: +5 } },
            { label: 'B. 기사에 좋아요 눌러 어그로', effect: { trash_talk: +10, celebrity: +5 } },
        ]
    };
}
