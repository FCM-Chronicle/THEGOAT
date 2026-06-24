// ============================================================
// events.js — 랜덤 이벤트, 사생활 선택지, 훈련
// ============================================================

// ── 이벤트 풀 ──────────────────────────────────────────────
const EVENT_POOL = [
    // SNS & 미디어
    {
        id: 'twitter_fight', category: 'sns',
        title: '🐦 경기 후 트위터 실언',
        desc: '팬이 내 플레이를 혹평하는 글을 올렸다. 반응해야 할까?',
        choices: [
            { label: 'A. 팬과 키보드 배틀', effects: { hothead: +5, composure: -3 } },
            { label: 'B. 계정 비공개로 전환', effects: { composure: +3, celebrity: -2 } },
        ]
    },
    {
        id: 'youtube_physique', category: 'sns',
        title: '📹 유튜브 피지컬 채널 출연 제안',
        desc: '조회수 보장 피지컬 예능 채널에서 출연 요청이 왔다.',
        choices: [
            { label: 'A. 조회수를 위해 상탈 출연 (뚱자르 스택+1)', effects: { celebrity: +10, professionalism: -3, fatigue_stack: +1 } },
            { label: 'B. 구단 웨이트장에서 운동만', effects: { professionalism: +5 } },
        ]
    },
    {
        id: 'instagram_qa', category: 'sns',
        title: '📸 인스타 Q&A 진행',
        desc: '팔로워들에게 무엇이든 물어보세요 라이브를 켰다.',
        choices: [
            { label: 'A. 악플러 질문에 저격 답장', effects: { hothead: +5, trash_talk: +5 } },
            { label: 'B. 훈훈한 미담 질문만 답변', effects: { celebrity: +3, reputation: +2 } },
        ]
    },
    {
        id: 'tiktok_dance', category: 'sns',
        title: '🎵 틱톡 댄스 챌린지 유행',
        desc: '팀 동료들을 강제 동원해 단체 춤을 출 기회가 왔다.',
        choices: [
            { label: 'A. 팀원 강제 동원 단체 댄스', effects: { celebrity: +10, team_bond: -5 } },
            { label: 'B. 구석에서 유니폼이나 접는다', effects: { professionalism: +3, celebrity: -3 } },
        ]
    },
    // 사생활 & 밤문화
    {
        id: 'club_friday', category: 'lifestyle',
        title: '🎉 불금 강남 클럽 VIP 초청',
        desc: '주급 들어온 날 VIP 입장권이 날아왔다.',
        choices: [
            { label: 'A. 샴페인 샤워! (뚱자르 스택+1)', effects: { celebrity: +10, professionalism: -5, fatigue_stack: +1 } },
            { label: 'B. 집에서 넷플릭스', effects: { composure: +5, professionalism: +3 } },
        ]
    },
    {
        id: 'wedding_party', category: 'lifestyle',
        title: '💍 팀 동료 결혼식 뒤풀이',
        desc: '동료 결혼식 뒤풀이가 새벽까지 이어진다.',
        choices: [
            { label: 'A. 마이크 잡고 끝까지', effects: { team_bond: +5, celebrity: +5, professionalism: -2 } },
            { label: 'B. 축의금만 내고 조용히 퇴장', effects: { composure: +3, team_bond: -3 } },
        ]
    },
    {
        id: 'gaming_binge', category: 'lifestyle',
        title: '🎮 동네 친구들과 밤샘 게임 번개',
        desc: '주말 밤, 친구들이 올나이트 게임 번개를 잡았다.',
        choices: [
            { label: 'A. 승급할 때까지 손을 못 떼겠다', effects: { professionalism: -5, judgment: -3 } },
            { label: 'B. 자정 전에 코드 뽑고 자러 간다', effects: { composure: +3, professionalism: +2 } },
        ]
    },
    {
        id: 'celebrity_dating', category: 'lifestyle',
        title: '💑 탑티어 연예인과의 열애설 기사',
        desc: '갑자기 대형 연예인과의 열애설이 터졌다.',
        choices: [
            { label: 'A. 공개 연애 선언!', effects: { celebrity: +20, judgment: -5 } },
            { label: 'B. 사실무근 전면 부인', effects: { composure: +5, reputation: +5 } },
        ]
    },
    {
        id: 'chicken_temptation', category: 'lifestyle',
        title: '🍗 한밤중 야식 한강 치맥 유혹',
        desc: '친구들이 지금 치킨 먹으러 가자고 카톡을 보낸다.',
        choices: [
            { label: 'A. 튀긴 건 못 참지 (뚱자르 스택+1)', effects: { professionalism: -5, judgment: -2, fatigue_stack: +1 } },
            { label: 'B. 제로 콜라에 오이나 씹는다', effects: { professionalism: +7, composure: +3 } },
        ]
    },
    {
        id: 'supercar', category: 'lifestyle',
        title: '🚗 한정판 슈퍼카 지름신 강림',
        desc: '한정 100대 슈퍼카 구매 알림이 울렸다.',
        choices: [
            { label: 'A. 일시불로 질러버린다 (-2억)', effects: { money: -20000, celebrity: +15, greed: +10 } },
            { label: 'B. 장바구니에서 조용히 삭제', effects: { composure: +5, professionalism: +2 } },
        ]
    },
    // 팬 & 커뮤니티
    {
        id: 'eggs_thrown', category: 'community',
        title: '🥚 패배 후 극성 관중의 달걀 투척',
        desc: '팬이 출근길에 달걀을 던졌다. 어떻게 반응할까?',
        choices: [
            { label: 'A. 멱살 잡으러 달려간다 (심판주적+1)', effects: { hothead: +15, reputation: -30, red_card_stack: +1 } },
            { label: 'B. 경호원 뒤로 묵묵히 들어간다', effects: { composure: +5, celebrity: -5 } },
        ]
    },
    {
        id: 'kid_fan', category: 'community',
        title: '👦 어린이 팬의 유니폼 교환 요청',
        desc: '경기 후 어린이 팬이 유니폼을 바꿔달라고 한다.',
        choices: [
            { label: 'A. 실착 유니폼을 벗어준다', effects: { reputation: +15, celebrity: +5 } },
            { label: 'B. 바삐 지나친다', effects: { reputation: -5, hothead: +2 } },
        ]
    },
    {
        id: 'fan_meeting', category: 'community',
        title: '🤝 소규모 비공개 팬 미팅 개최',
        desc: '팬클럽에서 소규모 팬 미팅 요청이 왔다.',
        choices: [
            { label: 'A. 사비로 역조공 선물 세트 (-500만)', effects: { money: -500, reputation: +20, loyalty: +5 } },
            { label: 'B. 고가 굿즈 판매 중심으로 진행', effects: { money: +1000, greed: +10 } },
        ]
    },
    // 훈련 & 신체
    {
        id: 'flu', category: 'health',
        title: '🤧 환절기 가벼운 독감 증상',
        desc: '훈련 전날부터 콧물이 줄줄 흐른다.',
        choices: [
            { label: 'A. 감기약 먹고 억지로 훈련 (부상 위험↑)', effects: { aggressiveness: +5, professionalism: +5, injury_risk: +1 } },
            { label: 'B. 구단 주치의 소견 듣고 휴식', effects: { composure: +5, judgment: +2 } },
        ]
    },
    {
        id: 'buldak_revenge', category: 'health',
        title: '🌶️ 전날 야식 불닭볶음면의 역습',
        desc: '훈련 아침, 뱃속이 난리가 났다.',
        choices: [
            { label: 'A. 화장실을 들락날락하며 출근', effects: { judgment: -3, composure: -3 } },
            { label: 'B. 지사제 삼키고 이 악물고 버텨낸다', effects: { composure: +4, professionalism: +2 } },
        ]
    },
    {
        id: 'personal_trainer', category: 'health',
        title: '💪 개인 사제 트레이너 고용 제안',
        desc: '전담 피지컬 코치 고용 제안이 왔다. 시즌 비용 3000만.',
        choices: [
            { label: 'A. 거액 투자! (-3000만)', effects: { money: -3000, professionalism: +10, judgment: +3 } },
            { label: 'B. 구단 기본 시스템만 믿는다', effects: {} },
        ]
    },
    {
        id: 'boots_choice', category: 'health',
        title: '👟 랭킹 스폰서 축구화 교체',
        desc: '새 시즌 지급 축구화를 고를 시간이다.',
        choices: [
            { label: 'A. 네온 컬러 화려한 디자인', effects: { celebrity: +5, trash_talk: +2 } },
            { label: 'B. 발볼 편한 클래식 가죽', effects: { professionalism: +5, judgment: +2 } },
        ]
    },
    // 이적 & 비즈니스
    {
        id: 'contract_lowball', category: 'business',
        title: '📝 연봉 협상 구단의 후려치기',
        desc: '구단 수뇌부가 주급을 기존보다 낮게 제안해 왔다.',
        choices: [
            { label: 'A. 훈련 불참 + 이적 요청서 제출', effects: { tactics_familiarity: -20, greed: +10, hothead: +5 } },
            { label: 'B. 구단 재정난 이해하고 도장 찍기', effects: { loyalty: +20, reputation: +10 } },
        ]
    },
    {
        id: 'agent_scandal', category: 'business',
        title: '🕵️ 에이전트 뒷돈 이면 계약 발각',
        desc: '에이전트가 뒷돈을 받았다는 정황이 포착됐다.',
        choices: [
            { label: 'A. 즉시 해지 + 법적 고소', effects: { composure: +5, reputation: +5 } },
            { label: 'B. 모르는 척하고 내 슬롯 지분 요구', effects: { greed: +15, professionalism: -10 } },
        ]
    },
    {
        id: 'loan_offer', category: 'business',
        title: '📋 하위 리그 6개월 임대 제안',
        desc: '실전 감각을 위해 임대를 나갈 기회가 생겼다.',
        choices: [
            { label: 'A. 실전 감각 위해 수락', effects: { professionalism: +5, reputation: -10, aggressiveness: +5 } },
            { label: 'B. 빅클럽 스쿼드로 남아 우승 무임승차', effects: { greed: +10 } },
        ]
    },
    {
        id: 'charity_award', category: 'community',
        title: '❤️ 연말 자선 단체 기부왕 선정',
        desc: '자선 단체에서 올해의 기부왕으로 선정해 인증식에 초대했다.',
        choices: [
            { label: 'A. 거액 기부 + 포토월 참석 (-5000만)', effects: { money: -5000, reputation: +30, celebrity: +5 } },
            { label: 'B. 이름 없이 소액 이체', effects: { reputation: +5, professionalism: +5 } },
        ]
    },
];

// 현재 시즌 발생 이벤트 추적 (중복 방지)
function getAvailableEvents(usedEventIds, category = null) {
    return EVENT_POOL.filter(e => {
        if (usedEventIds.includes(e.id)) return false;
        if (category && e.category !== category) return false;
        return true;
    });
}

// 랜덤 이벤트 뽑기 (라운드당 30% 확률)
function rollRandomEvent(gameState) {
    if (Math.random() > 0.30) return null;
    const used = gameState.usedEvents || [];
    const pool = getAvailableEvents(used);
    if (pool.length === 0) return null;
    const event = pool[Math.floor(Math.random() * pool.length)];
    return event;
}

// 이벤트 효과 적용
function applyEventChoice(player, gameState, event, choiceIdx) {
    const choice = event.choices[choiceIdx];
    if (!choice) return [];
    const effects = choice.effects || {};
    const log = [`📌 [${event.title}] — ${choice.label}`];

    for (const [key, val] of Object.entries(effects)) {
        switch (key) {
            case 'reputation':
                player.reputation = Math.max(0, Math.min(999, player.reputation + val));
                log.push(`명성 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'money':
                // 만원 단위
                gameState.playerMoney = (gameState.playerMoney || 0) + val;
                log.push(`자금 ${val > 0 ? '+' : ''}${val}만`);
                break;
            case 'professionalism':
                player.stats.professionalism = Math.max(30, Math.min(144, (player.stats.professionalism || 70) + val));
                log.push(`프로의식 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'composure':
                player.stats.composure = Math.max(30, Math.min(144, (player.stats.composure || 70) + val));
                log.push(`침착성 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'judgment':
                player.stats.judgment = Math.max(30, Math.min(144, (player.stats.judgment || 70) + val));
                log.push(`판단력 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'celebrity':
                player.tendencies.celebrity = Math.max(0, Math.min(100, (player.tendencies.celebrity || 0) + val));
                log.push(`스타성 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'loyalty':
                player.tendencies.loyalty = Math.max(0, Math.min(100, (player.tendencies.loyalty || 50) + val));
                log.push(`충성심 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'hothead':
                player.tendencies.hothead = Math.max(0, Math.min(100, (player.tendencies.hothead || 0) + val));
                log.push(`다혈질 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'greed':
                player.tendencies.greed = Math.max(0, Math.min(100, (player.tendencies.greed || 0) + val));
                log.push(`탐욕 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'trash_talk':
                player.tendencies.trash_talk = Math.max(0, Math.min(100, (player.tendencies.trash_talk || 0) + val));
                if ((player.tendencies.trash_talk || 0) >= 30) {
                    player.career.controversies = (player.career.controversies || 0) + 1;
                }
                log.push(`깐족이 ${val > 0 ? '+' : ''}${val}`);
                break;
            case 'team_bond':
                gameState.teamBond = Math.max(0, Math.min(100, (gameState.teamBond || 70) + val));
                log.push(`팀 결속력 ${val > 0 ? '+' : ''}${val}%`);
                break;
            case 'injury_risk':
                gameState.injuryRiskStack = (gameState.injuryRiskStack || 0) + val;
                log.push(`⚠️ 부상 위험 증가`);
                break;
            case 'fatigue_stack':
                gameState.fatigueStack = (gameState.fatigueStack || 0) + val;
                if (gameState.fatigueStack >= 3) {
                    log.push(`🍩 뚱자르 디버프 발동! 다음 5경기 OVR -5`);
                    player.debuffs = player.debuffs || {};
                    player.debuffs.fatigue = 5;
                    gameState.fatigueStack = 0;
                }
                break;
            case 'red_card_stack':
                player.career.redCards = (player.career.redCards || 0) + val;
                log.push(`🟥 레드카드 누적`);
                break;
            case 'tactics_familiarity':
                gameState.tacticsFamiliarity = Math.max(0, Math.min(100, (gameState.tacticsFamiliarity || 50) + val));
                log.push(`전술 친숙도 ${val > 0 ? '+' : ''}${val}`);
                break;
            default:
                break;
        }
    }

    // 이벤트 사용 기록
    gameState.usedEvents = gameState.usedEvents || [];
    if (!gameState.usedEvents.includes(event.id)) {
        gameState.usedEvents.push(event.id);
    }

    return log;
}

// 훈련 시도 (match.js의 attemptTraining 래퍼 — UI에서 호출)
function doTraining(player, gameState) {
    const result = attemptTraining(player);
    const log = [];

    if (result.success) {
        gameState.sp = (gameState.sp || 0) + 1;
        log.push('✅ 훈련 성공! SP +1 획득');
    } else {
        log.push('❌ 훈련 실패... 오늘은 운이 없었다.');
    }

    // 부상 위험 체크
    const injuryChance = 0.02 + (gameState.injuryRiskStack || 0) * 0.05;
    if (!player.injured && Math.random() < injuryChance) {
        player.injured = true;
        player.injuryWeeksLeft = Math.floor(Math.random() * 4) + 1;
        log.push(`🩹 부상 발생! ${player.injuryWeeksLeft}라운드 결장`);
        gameState.injuryRiskStack = 0;
    }

    return { ...result, log };
}

// 인터뷰 이벤트 (경기 후)
const INTERVIEW_EVENTS = [
    {
        id: 'post_win', trigger: 'win',
        question: '오늘 승리 소감은?',
        choices: [
            { label: '팀 동료들 덕분입니다', effects: { loyalty: +5, reputation: +3 } },
            { label: '내가 팀을 이끌었죠', effects: { greed: +5, celebrity: +3 } },
        ]
    },
    {
        id: 'post_loss', trigger: 'loss',
        question: '오늘 패배 원인이 무엇이라 생각하나요?',
        choices: [
            { label: '우리 팀이 더 노력해야 합니다', effects: { loyalty: +3, professionalism: +2 } },
            { label: '심판 판정이 아쉬웠습니다', effects: { hothead: +5, reputation: -5 } },
        ]
    },
    {
        id: 'rival_taunt', trigger: 'any',
        question: '다음 라이벌 전에 대해 한마디?',
        choices: [
            { label: '그들을 존중합니다', effects: { composure: +3 } },
            { label: '우리가 무조건 이깁니다', effects: { trash_talk: +8, celebrity: +5 } },
        ]
    },
];

function getInterviewEvent(trigger) {
    const pool = INTERVIEW_EVENTS.filter(e => e.trigger === trigger || e.trigger === 'any');
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}
