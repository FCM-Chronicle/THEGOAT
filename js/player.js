// ============================================================
// player.js — 플레이어 캐릭터 생성 및 스탯 시스템
// ============================================================

const STAT_NAMES = {
    shooting: '슈팅', passing: '패스', dribbling: '드리블',
    speed: '스피드', defending: '수비', physicality: '몸싸움',
    stamina: '체력', composure: '침착성', aggressiveness: '적극성',
    workRate: '활동량', professionalism: '프로의식', judgment: '판단력',
    diving: '다이빙', ballControl: '볼 컨트롤', injuryResistance: '부상 빈도',
};

const POSITION_STAT_WEIGHTS = {
    FW: { shooting: 1.5, dribbling: 1.3, speed: 1.2, passing: 0.8, defending: 0.4, physicality: 0.9, stamina: 1.0, composure: 1.1, aggressiveness: 1.0, workRate: 1.0, professionalism: 1.0, judgment: 1.1, diving: 0.3, ballControl: 1.2, injuryResistance: 1.0 },
    MF: { shooting: 0.9, dribbling: 1.1, speed: 1.0, passing: 1.4, defending: 0.9, physicality: 1.0, stamina: 1.2, composure: 1.1, aggressiveness: 1.1, workRate: 1.3, professionalism: 1.0, judgment: 1.2, diving: 0.3, ballControl: 1.1, injuryResistance: 1.0 },
    DF: { shooting: 0.4, dribbling: 0.7, speed: 1.1, passing: 1.0, defending: 1.5, physicality: 1.3, stamina: 1.1, composure: 1.2, aggressiveness: 1.2, workRate: 1.0, professionalism: 1.0, judgment: 1.1, diving: 0.3, ballControl: 0.9, injuryResistance: 1.0 },
    GK: { shooting: 0.2, dribbling: 0.3, speed: 0.8, passing: 0.8, defending: 0.8, physicality: 1.0, stamina: 1.0, composure: 1.3, aggressiveness: 0.7, workRate: 0.7, professionalism: 1.0, judgment: 1.2, diving: 1.8, ballControl: 0.8, injuryResistance: 1.0 },
};

function createPlayer({ name, position, country, age, rating, isIcon = false, isCustom = false }) {
    const hiddenTalent = Math.floor(Math.random() * 3) + 1; // 1~3
    const baseStats = generateBaseStats(position, rating);

    return {
        name,
        position,
        country,
        age,
        rating,
        isIcon,
        isCustom,
        hiddenTalent,
        stats: baseStats,
        // 성향 (0~100)
        tendencies: {
            trash_talk: Math.floor(Math.random() * 40),
            celebrity: Math.floor(Math.random() * 40),
            greed: Math.floor(Math.random() * 40),
            loyalty: Math.floor(Math.random() * 60) + 20,
            hothead: Math.floor(Math.random() * 40),
        },
        // 커리어 누적
        career: {
            goals: 0, assists: 0, criticalDefenses: 0,
            matchRatings: [], trophies: 0,
            yellowCards: 0, redCards: 0,
            controversies: 0, sponsorDeals: 0,
            nationalAppearances: 0,
        },
        // 재무
        weeklyWage: calcWeeklyWage(rating),
        totalEarnings: 0,
        // 상태
        reputation: calcInitialReputation(rating),
        condition: 100,
        injured: false,
        injuryWeeksLeft: 0,
        // 칭호
        titles: [],
        activeTitles: [],
        // 플레이스타일
        playstyles: [],
        // 부 포지션
        secondaryPositions: [],
    };
}

function generateBaseStats(position, ovr) {
    const weights = POSITION_STAT_WEIGHTS[position] || POSITION_STAT_WEIGHTS.MF;
    const stats = {};
    const baseValue = Math.max(40, ovr - 15);

    for (const [stat, weight] of Object.entries(weights)) {
        const raw = baseValue + Math.floor(Math.random() * 20 * weight);
        stats[stat] = Math.min(Math.max(raw, 30), 110);
    }
    // GK 전용 보정
    if (position === 'GK') {
        stats.diving = Math.min(Math.floor(ovr * 1.1 + Math.random() * 10), 110);
    }
    return stats;
}

function calcWeeklyWage(rating) {
    if (rating >= 92) return Math.floor(Math.random() * 200 + 300) * 100; // 3~5억
    if (rating >= 88) return Math.floor(Math.random() * 100 + 150) * 100; // 1.5~2.5억
    if (rating >= 84) return Math.floor(Math.random() * 50 + 80) * 100;
    if (rating >= 80) return Math.floor(Math.random() * 30 + 40) * 100;
    if (rating >= 75) return Math.floor(Math.random() * 20 + 20) * 100;
    return Math.floor(Math.random() * 10 + 10) * 100;
}

function calcInitialReputation(rating) {
    if (rating >= 92) return Math.floor(Math.random() * 100 + 600);
    if (rating >= 88) return Math.floor(Math.random() * 100 + 450);
    if (rating >= 84) return Math.floor(Math.random() * 80 + 300);
    if (rating >= 80) return Math.floor(Math.random() * 60 + 200);
    if (rating >= 75) return Math.floor(Math.random() * 50 + 100);
    return Math.floor(Math.random() * 40 + 30);
}

// SP 투자 — 스탯 올리기
function upgradeStatSP(player, statKey, amount = 1) {
    const current = player.stats[statKey];
    const SOFT_CAP = 130;
    const HARD_CAP = 144;

    if (current >= HARD_CAP) return { ok: false, reason: '이미 만렙입니다.' };

    // 130 소프트캡 이하: 무조건 통과
    if (current < SOFT_CAP) {
        player.stats[statKey] = Math.min(current + amount, SOFT_CAP);
        recalcOvr(player);
        return { ok: true };
    }

    // 130 이상 → 재능 하드캡 체크
    const above130Count = Object.values(player.stats).filter(v => v >= SOFT_CAP).length;
    if (above130Count >= player.hiddenTalent) {
        return { ok: false, reason: `재능(${player.hiddenTalent}) 한계! 이미 ${above130Count}개 스탯이 130 이상입니다.` };
    }

    player.stats[statKey] = Math.min(current + amount, HARD_CAP);
    recalcOvr(player);
    return { ok: true };
}

function recalcOvr(player) {
    const weights = POSITION_STAT_WEIGHTS[player.position] || POSITION_STAT_WEIGHTS.MF;
    let total = 0, wSum = 0;
    for (const [stat, w] of Object.entries(weights)) {
        if (player.stats[stat] !== undefined) {
            total += player.stats[stat] * w;
            wSum += w;
        }
    }
    player.rating = Math.round(Math.min(total / wSum, 110));
}

// 에이징 커브 처리 (시즌 종료 후 호출)
function applyAgingCurve(player) {
    const events = [];
    if (player.age < 27) {
        // 성장기 — 아무것도 깎지 않음
    } else if (player.age < 33) {
        // 황금 안정기 — SP 40%만
    } else {
        // 에이징 커브
        const physicals = ['speed', 'physicality', 'stamina'];
        const mentals = ['passing', 'judgment', 'composure'];
        for (const s of physicals) {
            const cut = player.stats[s] >= 130 ? 3 : Math.floor(Math.random() * 3) + 6;
            player.stats[s] = Math.max(30, (player.stats[s] || 60) - cut);
        }
        for (const s of mentals) {
            const cut = player.stats[s] >= 130 ? 1 : Math.floor(Math.random() * 2) + 1;
            player.stats[s] = Math.max(30, (player.stats[s] || 60) - cut);
        }
        events.push('⚠️ 에이징 커브 적용');

        // 돌발 부상 이벤트 (33세 이상 15% 확률)
        if (Math.random() < 0.15) {
            player.stats.speed = Math.max(30, (player.stats.speed || 60) - 7);
            player.stats.physicality = Math.max(30, (player.stats.physicality || 60) - 6);
            player.stats.passing = Math.max(30, (player.stats.passing || 60) - 3);
            player.stats.ballControl = Math.max(30, (player.stats.ballControl || 60) - 4);
            events.push('🩹 아이고 무릎이야! 부상 페널티 발생');
        }
        recalcOvr(player);
    }
    player.age += 1;
    return events;
}

// SP 획득 계산
function calcSeasonSP(player, avgRating, opponentAvgOvr) {
    const base = (avgRating - 5.0) * 20;
    const adjusted = base * (opponentAvgOvr / Math.max(player.rating, 1));
    const agePhase = player.age < 27 ? 1.0 : player.age < 33 ? 0.4 : 0.1;
    return Math.max(0, Math.floor(adjusted * agePhase));
}

// 칭호 체크
function checkTitles(player) {
    const titles = [];
    const { career, stats, tendencies } = player;

    if ((career.goals || 0) >= 900) titles.push({ id: 'emperor', name: '⚽ 축구 황제' });
    if ((career.trophies || 0) >= 15 && (career.goals || 0) >= 500) titles.push({ id: 'iconic', name: '👑 아이코닉' });
    if ((career.trophies || 0) >= 20) titles.push({ id: 'trophy_collector', name: '🏆 트로피 수집가' });
    if ((stats.stamina || 0) >= 95) titles.push({ id: 'two_hearts', name: '❤️❤️ 2개의 심장, 3개의 폐' });
    if ((stats.dribbling || 0) >= 95) titles.push({ id: 'alien', name: '👽 외계인' });
    if ((stats.diving || 0) >= 95 && player.position === 'GK') titles.push({ id: 'new_yashin', name: '🧤 제 1의 ' + player.name });
    if ((stats.passing || 0) >= 95) titles.push({ id: 'pass_master', name: '🎯 패스마스터' });
    if ((career.yellowCards || 0) >= 30 || (career.redCards || 0) >= 10) titles.push({ id: 'ref_enemy', name: '🟥 심판의 주적' });
    if ((career.controversies || 0) >= 30) titles.push({ id: 'trash_talk', name: '😈 깐족이' });
    if ((career.sponsorDeals || 0) >= 5) titles.push({ id: 'sponsor_king', name: '💰 스폰서의 황제' });

    // NO HATER 칭호
    if ((stats.professionalism || 0) >= 120 && (stats.composure || 0) >= 100 &&
        (tendencies.loyalty || 0) >= 80 && (tendencies.trash_talk || 0) <= 20 &&
        (tendencies.hothead || 0) <= 15 && (career.redCards || 0) <= 1 &&
        (career.controversies || 0) === 0) {
        titles.push({ id: 'no_hater', name: '😇 NO HATER' });
    }

    // 기존에 없는 칭호만 추가
    for (const t of titles) {
        if (!player.titles.find(x => x.id === t.id)) {
            player.titles.push(t);
        }
    }
    return titles;
}

// 훈련 시도
function attemptTraining(player) {
    const successRate = Math.min(0.99, 0.85 + (player.stats.professionalism || 70) / 1000);
    const success = Math.random() < successRate;
    return { success, sp: success ? 1 : 0 };
}
