// ============================================================
// player.js — 선수 생성 + 스탯 시스템
// 핵심 변경:
//   - 선수 선택 시 OVR이 ±5 랜덤 변동 (재능3이면 낮게 시작)
//   - 재능 3 → 초기 OVR ~75, 재능1 → ~85 수준
// ============================================================

const STAT_NAMES = {
    shooting: '슈팅', passing: '패스', dribbling: '드리블',
    speed: '스피드', defending: '수비', physicality: '몸싸움',
    stamina: '체력', composure: '침착성', aggressiveness: '적극성',
    workRate: '활동량', professionalism: '프로의식', judgment: '판단력',
    diving: '다이빙', ballControl: '볼 컨트롤', injuryResistance: '부상 빈도',
};

const POSITION_STAT_WEIGHTS = {
    FW: { shooting:1.5, dribbling:1.3, speed:1.2, passing:0.8, defending:0.3, physicality:0.9,
          stamina:1.0, composure:1.1, aggressiveness:1.1, workRate:1.0, professionalism:1.0,
          judgment:1.1, diving:0.2, ballControl:1.2, injuryResistance:1.0 },
    MF: { shooting:0.9, dribbling:1.1, speed:1.0, passing:1.4, defending:0.9, physicality:1.0,
          stamina:1.2, composure:1.1, aggressiveness:1.1, workRate:1.3, professionalism:1.0,
          judgment:1.2, diving:0.2, ballControl:1.1, injuryResistance:1.0 },
    DF: { shooting:0.4, dribbling:0.7, speed:1.1, passing:1.0, defending:1.5, physicality:1.3,
          stamina:1.1, composure:1.2, aggressiveness:1.2, workRate:1.0, professionalism:1.0,
          judgment:1.1, diving:0.2, ballControl:0.9, injuryResistance:1.0 },
    GK: { shooting:0.2, dribbling:0.3, speed:0.8, passing:0.8, defending:0.8, physicality:1.0,
          stamina:1.0, composure:1.3, aggressiveness:0.7, workRate:0.7, professionalism:1.0,
          judgment:1.2, diving:1.8, ballControl:0.8, injuryResistance:1.0 },
};

// ── 핵심: 재능별 실제 시작 OVR 계산 ─────────────────────────
// 원본 rating(팀 명단 OVR)은 "잠재력"처럼 취급
// 재능이 높을수록 현재 OVR이 낮고 성장 폭이 큼
function calcStartingOvr(baseRating, hiddenTalent) {
    // 재능 3: 원본보다 최대 -15 낮게 시작 (성장 폭 큼)
    // 재능 2: 원본보다 최대 -8 낮게 시작
    // 재능 1: 원본보다 최대 -3 낮게 시작 (이미 완성형에 가까움)
    const penaltyRange = hiddenTalent === 3 ? 15
                       : hiddenTalent === 2 ? 8
                       : 3;
    const penalty = Math.floor(Math.random() * penaltyRange);
    return Math.max(55, baseRating - penalty);
}

// ── 선수 생성 ─────────────────────────────────────────────────
function createPlayer({ name, position, country, age, rating, isIcon = false, isCustom = false }) {
    const hiddenTalent = Math.floor(Math.random() * 3) + 1; // 1~3
    const startOvr     = calcStartingOvr(rating, hiddenTalent);
    const baseStats    = generateBaseStats(position, startOvr);

    return {
        name,
        position,
        country,
        age,
        rating:       startOvr,   // 실제 게임 내 OVR
        baseRating:   rating,     // 원본 OVR (잠재력 참고용)
        isIcon,
        isCustom,
        hiddenTalent,
        stats: baseStats,
        tendencies: {
            trash_talk: Math.floor(Math.random() * 40),
            celebrity:  Math.floor(Math.random() * 40),
            greed:      Math.floor(Math.random() * 40),
            loyalty:    Math.floor(Math.random() * 60) + 20,
            hothead:    Math.floor(Math.random() * 40),
        },
        career: {
            goals: 0, assists: 0, criticalDefenses: 0,
            matchRatings: [], trophies: 0,
            yellowCards: 0, redCards: 0,
            controversies: 0, sponsorDeals: 0,
            nationalAppearances: 0,
        },
        weeklyWage:   calcWeeklyWage(startOvr),
        totalEarnings:0,
        reputation:   calcInitialReputation(startOvr),
        condition:    100,
        injured:      false,
        injuryWeeksLeft: 0,
        titles:       [],
        activeTitles: [],
        playstyles:   [],
        secondaryPositions: [],
        debuffs:      {},
    };
}

// ── 스탯 초기값 생성 ─────────────────────────────────────────
function generateBaseStats(position, ovr) {
    const weights   = POSITION_STAT_WEIGHTS[position] || POSITION_STAT_WEIGHTS.MF;
    const stats     = {};
    const baseValue = Math.max(40, ovr - 18);

    for (const [stat, weight] of Object.entries(weights)) {
        const raw = baseValue + Math.floor(Math.random() * 22 * weight);
        stats[stat] = Math.min(Math.max(raw, 30), 105); // 초기 최대 105
    }
    if (position === 'GK') {
        stats.diving = Math.min(Math.floor(ovr * 1.05 + Math.random() * 8), 105);
    }
    return stats;
}

function calcWeeklyWage(rating) {
    if (rating >= 92) return Math.floor(Math.random() * 200 + 300) * 100;
    if (rating >= 88) return Math.floor(Math.random() * 100 + 150) * 100;
    if (rating >= 84) return Math.floor(Math.random() * 50  + 80)  * 100;
    if (rating >= 80) return Math.floor(Math.random() * 30  + 40)  * 100;
    if (rating >= 75) return Math.floor(Math.random() * 20  + 20)  * 100;
    if (rating >= 70) return Math.floor(Math.random() * 10  + 12)  * 100;
    return Math.floor(Math.random() * 5 + 5) * 100;
}

function calcInitialReputation(rating) {
    if (rating >= 92) return Math.floor(Math.random() * 100 + 600);
    if (rating >= 88) return Math.floor(Math.random() * 100 + 450);
    if (rating >= 84) return Math.floor(Math.random() * 80  + 300);
    if (rating >= 80) return Math.floor(Math.random() * 60  + 200);
    if (rating >= 75) return Math.floor(Math.random() * 50  + 100);
    if (rating >= 70) return Math.floor(Math.random() * 30  + 50);
    return Math.floor(Math.random() * 20 + 15);
}

// ── SP 투자 ──────────────────────────────────────────────────
function upgradeStatSP(player, statKey, amount = 1) {
    const current  = player.stats[statKey];
    const SOFT_CAP = 130;
    const HARD_CAP = 144;

    if (current === undefined) return { ok: false, reason: '존재하지 않는 스탯입니다.' };
    if (current >= HARD_CAP)   return { ok: false, reason: '이미 만렙(144)입니다.' };

    if (current < SOFT_CAP) {
        player.stats[statKey] = Math.min(current + amount, SOFT_CAP);
        recalcOvr(player);
        return { ok: true };
    }

    // 130 이상 → 재능 하드캡 체크
    const above130 = Object.values(player.stats).filter(v => v >= SOFT_CAP).length;
    if (above130 >= player.hiddenTalent) {
        return {
            ok: false,
            reason: `재능(${player.hiddenTalent}) 한계! 이미 ${above130}개 스탯이 130 이상입니다.`
        };
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
            wSum  += w;
        }
    }
    player.rating = Math.round(Math.min(total / wSum, 110));
}

// ── 에이징 커브 ──────────────────────────────────────────────
function applyAgingCurve(player) {
    const events = [];
    if (player.age >= 33) {
        const physicals = ['speed', 'physicality', 'stamina'];
        const mentals   = ['passing', 'judgment', 'composure'];
        for (const s of physicals) {
            const cut = (player.stats[s] || 60) >= 130 ? 3 : Math.floor(Math.random() * 3) + 6;
            player.stats[s] = Math.max(30, (player.stats[s] || 60) - cut);
        }
        for (const s of mentals) {
            const cut = (player.stats[s] || 60) >= 130 ? 1 : Math.floor(Math.random() * 2) + 1;
            player.stats[s] = Math.max(30, (player.stats[s] || 60) - cut);
        }
        events.push('⚠️ 에이징 커브 적용');

        if (Math.random() < 0.15) {
            player.stats.speed        = Math.max(30, (player.stats.speed        || 60) - 7);
            player.stats.physicality  = Math.max(30, (player.stats.physicality  || 60) - 6);
            player.stats.passing      = Math.max(30, (player.stats.passing      || 60) - 3);
            player.stats.ballControl  = Math.max(30, (player.stats.ballControl  || 60) - 4);
            events.push('🩹 아이고 무릎이야! 부상 패널티 발생');
        }
        recalcOvr(player);
    }
    player.age++;
    return events;
}

// ── 시즌 SP 계산 ─────────────────────────────────────────────
function calcSeasonSP(player, avgRating, opponentAvgOvr) {
    const base     = (avgRating - 5.0) * 20;
    const adjusted = base * (opponentAvgOvr / Math.max(player.rating, 1));
    const agePhase = player.age < 27 ? 1.0
                   : player.age < 33 ? 0.4
                   : 0.1;
    return Math.max(0, Math.floor(adjusted * agePhase));
}

// ── 칭호 체크 ────────────────────────────────────────────────
function checkTitles(player) {
    const titles = [];
    const { career, stats, tendencies } = player;

    if ((career.goals || 0) >= 900) titles.push({ id:'emperor',      name:'⚽ 축구 황제' });
    if ((career.trophies||0)>=15 && (career.goals||0)>=500) titles.push({ id:'iconic', name:'👑 아이코닉' });
    if ((career.trophies||0) >= 20) titles.push({ id:'trophy_col',   name:'🏆 트로피 수집가' });
    if ((stats.stamina  ||0) >= 95) titles.push({ id:'two_hearts',   name:'❤️❤️ 2개의 심장, 3개의 폐' });
    if ((stats.dribbling||0) >= 95) titles.push({ id:'alien',        name:'👽 외계인' });
    if ((stats.diving   ||0) >= 95 && player.position === 'GK')
        titles.push({ id:'new_yashin', name:`🧤 제1의 ${player.name}` });
    if ((stats.passing  ||0) >= 95) titles.push({ id:'pass_master',  name:'🎯 패스마스터' });
    if ((stats.judgment ||0) >= 95) titles.push({ id:'judgment_goat',name:'🧠 판단력 GOAT' });
    if ((career.yellowCards||0)>=30||(career.redCards||0)>=10)
        titles.push({ id:'ref_enemy',  name:'🟥 심판의 주적' });
    if ((career.controversies||0) >= 30) titles.push({ id:'trash_talk', name:'😈 깐족이' });
    if ((career.sponsorDeals ||0) >= 5)  titles.push({ id:'sponsor_king',name:'💰 스폰서의 황제' });

    // NO HATER
    if ((stats.professionalism||0)>=120 && (stats.composure||0)>=100
        && (tendencies.loyalty||0)>=80  && (tendencies.trash_talk||0)<=20
        && (tendencies.hothead||0)<=15  && (career.redCards||0)<=1
        && (career.controversies||0)===0) {
        titles.push({ id:'no_hater', name:'😇 NO HATER' });
    }

    for (const t of titles) {
        if (!player.titles.find(x => x.id === t.id)) player.titles.push(t);
    }
    return titles;
}

// ── 훈련 ─────────────────────────────────────────────────────
function attemptTraining(player) {
    const successRate = Math.min(0.99, 0.85 + (player.stats.professionalism || 70) / 1000);
    return { success: Math.random() < successRate, sp: 0 };
}

function doTraining(player, gameState) {
    const result = attemptTraining(player);
    const log    = [];
    if (result.success) {
        gameState.sp = (gameState.sp || 0) + 1;
        log.push('✅ 훈련 성공! SP +1 획득');
    } else {
        log.push('❌ 훈련 실패... 오늘은 컨디션이 좋지 않았다.');
    }

    // 부상 위험 체크
    const injuryChance = 0.02 + (gameState.injuryRiskStack || 0) * 0.05;
    if (!player.injured && Math.random() < injuryChance) {
        player.injured         = true;
        player.injuryWeeksLeft = Math.floor(Math.random() * 4) + 1;
        log.push(`🩹 부상 발생! ${player.injuryWeeksLeft}라운드 결장`);
        gameState.injuryRiskStack = 0;
    }

    return { ...result, log };
}
