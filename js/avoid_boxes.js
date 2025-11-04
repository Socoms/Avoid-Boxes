// ========================================
// Avoid Boxes 게임 JavaScript 코드
// 떨어지는 상자를 피하는 2D 게임
// ========================================

// ========================================
// Canvas 설정
// ========================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ========================================
// 플레이어 설정
// ========================================
let player = {
  x: 380,          // 플레이어의 x 좌표 (가로 위치, 캔버스 중앙)
  y: 550,          // 플레이어의 y 좌표 (세로 위치, 화면 하단 근처)
  width: 40,       // 플레이어의 너비 (픽셀)
  height: 20,      // 플레이어의 높이 (픽셀)
  speed: 5,        // 플레이어의 이동 속도 (픽셀/키 입력)
  color: null      // 플레이어 색상 (null이면 테마에 따라 자동)
};

// 플레이어 색상 옵션
const PLAYER_COLORS = [
  { name: '자동', value: null }, // 테마에 따라 자동
  { name: '빨강', value: '#ff4444' },
  { name: '파랑', value: '#4444ff' },
  { name: '초록', value: '#44ff44' },
  { name: '노랑', value: '#ffff44' },
  { name: '보라', value: '#ff44ff' },
  { name: '청록', value: '#44ffff' },
  { name: '주황', value: '#ff8844' },
];

// 기본 사이즈(소형화 종료 시 복구용)
const BASE_PLAYER_SIZE = { width: 40, height: 20 };

// ========================================
// 게임 상태 관리 변수
// ========================================
let obstacles = [];       // 떨어지는 장애물들을 저장하는 배열
let items = [];           // 떨어지는 아이템 배열
let gameOver = false;     // 게임 종료 여부를 나타내는 플래그
let paused = false;       // 일시정지 상태
let gameStarted = false;  // 게임이 시작되었는지 여부
let startTime = Date.now();  // 게임 시작 시간 (밀리초)
let animationFrameId = null;  // requestAnimationFrame ID (취소용)
let elapsedTime = 0;      // 경과 시간 (초)
let frameCount = 0;       // 프레임 카운터 (장애물 생성 주기 계산용)

// 점수 시스템
let score = 0;            // 현재 점수
let combo = 0;            // 연속 회피 콤보
let maxCombo = 0;         // 최대 콤보
let scoreMultiplier = 1; // 점수 배율
let lastObstaclePassed = 0; // 마지막 장애물 회피 시간

// 스킬 사용 횟수 추적 (업그레이드용)
let skillUsageCounts = {
  hide: 0,
  invincible: 0,
  shrink: 0,
  slowMotion: 0
};

// 난이도 시스템
let difficultyLevel = 1;  // 난이도 단계
const BASE_SPAWN_RATE = 30; // 기본 장애물 생성 주기
const BASE_SPEED = 2;     // 기본 장애물 속도

// 게임 속도 설정
let gameSpeed = 1.0;      // 게임 전체 속도 배율 (1.0 = 보통, 0.75 = 느림, 1.5 = 빠름)

// 사운드 시스템
let soundEnabled = true;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundQueue = [];

// 사운드 생성 함수
function playSound(type, frequency = 440, duration = 0.1) {
  if (!soundEnabled) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 사운드 타입별 설정
    switch(type) {
      case 'item':
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        duration = 0.1;
        break;
      case 'damage':
        oscillator.frequency.value = 150;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        duration = 0.15;
        break;
      case 'combo':
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        duration = 0.2;
        break;
      case 'boss':
        oscillator.frequency.value = 100;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        duration = 0.3;
        break;
      case 'electric':
        oscillator.frequency.value = 200;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        duration = 0.2;
        break;
      default:
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    }
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    // 오디오 컨텍스트가 일시정지 상태일 수 있음 (사용자 인터랙션 필요)
    console.log('사운드 재생 실패:', e);
  }
}

// 사운드 활성화/비활성화
function toggleSound() {
  soundEnabled = !soundEnabled;
  const soundBtn = document.getElementById('soundToggle');
  if (soundBtn) {
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundBtn.title = soundEnabled ? '사운드 끄기' : '사운드 켜기';
  }
  localStorage.setItem('ab_sound', soundEnabled ? 'on' : 'off');
}

// 새로운 효과 상태
let slowMotionSpeedFactor = 0.5; // 슬로우 모션 속도 배율

// 피버타임 시스템
let feverActiveUntil = 0; // 피버타임 종료 시간
const FEVER_DURATION = 10000; // 피버타임 지속 시간 (10초)
const FEVER_COMBO_THRESHOLD = 100; // 피버타임 발동 콤보 임계값 (100콤보)
const FEVER_SPEED_MULTIPLIER = 1.75; // 피버타임 중 장애물 속도 배율 (1.5~2배 중간값)

// 공격력 시스템
let attackPower = 1; // 발사체 공격력 (기본값 1)

// 파티클 시스템
let particles = [];       // 파티클 배열

// 발사체 시스템 (보스 공격용)
let projectiles = [];     // 발사체 배열
const PROJECTILE_SPEED = -8; // 위로 올라가는 속도 (음수)
const PROJECTILE_WIDTH = 6;
const PROJECTILE_HEIGHT = 12;
const PROJECTILE_COOLDOWN = 300; // 발사 쿨타임 (ms)
let lastProjectileTime = 0;

// 트레일 시스템 제거됨

// 화면 흔들림
let shakeOffset = { x: 0, y: 0 };
let shakeTime = 0;

// 경고 시스템 제거됨

// 보스 시스템
let bossActive = false;
let boss = null; // 보스 객체
let splitBosses = []; // 분할 보스의 작은 보스들 (원래 보스가 없어도 존재 가능)
let lastBossSpawnTime = 0;
const BOSS_SPAWN_INTERVAL = 45000; // 45초마다 보스 등장
const BOSS_WIDTH = 80;
const BOSS_HEIGHT = 40;
const BOSS_SPEED = 0.4; // 보스는 천천히 내려옴
const BOSS_SCORE_BONUS = 500; // 보스 처치 시 보너스 점수
let bossNotificationTime = 0; // 보스 안내 메시지 표시 시간
let bossType = 1; // 보스 타입 (1=일반, 2=빠른, 3=큰, 4=분할)
let bossSpawnCount = 0; // 보스 스폰 횟수 (보스 타입 결정용)

// 웨이브 시스템
let currentWave = 1;
let lastWaveTime = 0;
const WAVE_INTERVAL = 30000; // 30초마다 새로운 웨이브
let waveNotificationTime = 0;

// 생명 관리
const MAX_LIVES = 3;
let lives = MAX_LIVES;
let lastDamageAt = 0;
const DAMAGE_COOLDOWN = 1000; // 일반 장애물 연속 피격 방지(ms)

// 아이템/스킬 기본 지속시간 및 쿨타임(ms)
const BASE_HIDE_DURATION = 1000;       // 1초
const BASE_HIDE_COOLDOWN = 15000;      // 15초
const BASE_INV_DURATION = 5000;        // 5초
const BASE_INV_COOLDOWN = 60000;       // 60초
const BASE_SHRINK_DURATION = 10000;    // 10초
const BASE_SHRINK_COOLDOWN = 45000;    // 45초
const BASE_SLOW_MOTION_DURATION = 5000; // 슬로우 모션 5초
const BASE_SLOW_MOTION_COOLDOWN = 30000; // 슬로우 모션 쿨타임 30초

// 현재 스킬 지속시간 및 쿨타임 (업그레이드 반영)
let HIDE_DURATION = BASE_HIDE_DURATION;
let HIDE_COOLDOWN = BASE_HIDE_COOLDOWN;
let INV_DURATION = BASE_INV_DURATION;
let INV_COOLDOWN = BASE_INV_COOLDOWN;
let SHRINK_DURATION = BASE_SHRINK_DURATION;
let SHRINK_COOLDOWN = BASE_SHRINK_COOLDOWN;
let SLOW_MOTION_DURATION = BASE_SLOW_MOTION_DURATION;
let SLOW_MOTION_COOLDOWN = BASE_SLOW_MOTION_COOLDOWN;

// 상태 값
let hideActiveUntil = 0;
let hideReadyAt = 0;
let invActiveUntil = 0;
let invReadyAt = 0;
let invItemCount = 0;
let shrinkActiveUntil = 0;
let shrinkReadyAt = 0;
let shrinkItemCount = 0;
let slowMotionActiveUntil = 0;
let slowMotionReadyAt = 0;
let slowMotionItemCount = 0;

// HUD 정적 텍스트(지속/쿨) 세팅
function setHUDStatics() {
  function set(slotId, durMs, cdMs) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    const durEl = slot.querySelector('.meta .dur');
    const cdEl = slot.querySelector('.meta .cd-total');
    if (durEl) durEl.textContent = `지속 ${ (durMs/1000).toFixed(1) }s`;
    if (cdEl) cdEl.textContent = `쿨 ${ Math.round(cdMs/1000) }s`;
  }
  set('slot-hide', HIDE_DURATION, HIDE_COOLDOWN);
  set('slot-inv', INV_DURATION, INV_COOLDOWN);
  set('slot-shr', SHRINK_DURATION, SHRINK_COOLDOWN);
  set('slot-slow', SLOW_MOTION_DURATION, SLOW_MOTION_COOLDOWN);
}

// ========================================
// 키보드 입력 처리
// ========================================
// 현재 눌려있는 키들을 추적하는 객체
let keys = {
  ArrowLeft: false, // 왼쪽 화살표 키 상태
  ArrowRight: false // 오른쪽 화살표 키 상태
};

// 키보드 입력 처리 - 키를 눌럿을때
document.addEventListener("keydown", function(e) {
  // ESC 키로 일시정지/재개
  if (e.key === "Escape") {
    togglePause();
    e.preventDefault();
    return;
  }
  
  // 일시정지 중이면 다른 입력 무시
  if (paused || gameOver) return;
  
  // 화살표 키가 눌리면 해당 키의 상태를 true로 설정
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
  keys[e.key] = true;
  e.preventDefault(); // 화살표 키의 기본 동작(스크롤) 방지
}
  // 액티브 스킬 발동 키 처리 (단발성)
  if (e.code === "Space") { // 숨기
    tryActivateHide();
    e.preventDefault();
  }
  if (e.key === "q" || e.key === "Q") { // 무적
    tryActivateInvincible();
    e.preventDefault();
  }
  if (e.key === "w" || e.key === "W") { // 소형화
    tryActivateShrink();
    e.preventDefault();
  }
  if (e.key === "e" || e.key === "E") { // 슬로우 모션
    tryActivateSlowMotion();
    e.preventDefault();
  }
  if (e.key === "a" || e.key === "A") { // 공격 발사체
    fireProjectile();
    e.preventDefault();
  }
  if ((e.key === "r" || e.key === "R") && !gameOver) { // 피버타임 발동 (게임 오버 시에는 재시작 버튼 사용)
    tryActivateFever();
    e.preventDefault();
  }
});

// 키보드 입력 처리 - 키를 뗏을때
document.addEventListener("keyup", function(e) {
  // 화살표 키가 뗏어지면 해당 키의 상태를 false로 설정
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    keys[e.key] = false;
    e.preventDefault(); // 화살표 키의 기본 동작(스크롤) 방지
  }
});

// 플레이어 이동 처리 함수
function movePlayer() {
  // 왼쪽 키가 눌러져 있으면 플레이어를 왼쪽으로 이동
  if (keys.ArrowLeft) {
    player.x -= player.speed;
  }
  // 오른쪽 키가 눌러져 있으면 플레이어를 오른쪽으로 이동
  if (keys.ArrowRight) {
    player.x += player.speed;
  }

  // 플레이어가 화면 밖으로 나가지 않도록 제한
  // 왼쪽 경계 : x 좌표가 0보다 작아지지 않도록
  if (player.x < 0) {
    player.x = 0;
  }
  // 오른쪽 경계 : x 좌표가 (캔버스 너비 - 플레이어 너비)보다 크지 않도록
  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
  }
}

// ========================================
// 플레이어 그리기 함수
// ========================================
function drawPlayer() {
  const now = Date.now();
  
  ctx.save();
  
  // 피버타임 효과 (글로우)
  if (now < feverActiveUntil) {
    ctx.shadowColor = '#ff6b00';
    ctx.shadowBlur = 20;
  }
  
  // 숨기 활성 시 투명도 낮춤
  if (now < hideActiveUntil) {
    ctx.globalAlpha = 0.25;
  }
  
  // 플레이어 색상 결정
  let playerColor;
  const isLightTheme = document.documentElement.classList.contains('theme-light');
  
  if (player.color) {
    // 커스텀 색상 사용
    playerColor = player.color;
  } else {
    // 테마에 따라 자동 색상
    playerColor = isLightTheme ? "#222" : "#ffffff";
  }
  
  ctx.fillStyle = playerColor;
  ctx.fillRect(player.x + shakeOffset.x, player.y + shakeOffset.y, player.width, player.height);
  ctx.restore();
}

// 트레일 기능 제거됨

// ========================================
// 시간 및 점수 표시 함수
// ========================================
function drawTime() {
  // 경과 시간 계산 (밀리초를 초로 변환)
  elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // 테마 확인
  const isLightTheme = document.documentElement.classList.contains('theme-light');
  
  // 시간 텍스트 스타일 설정
  ctx.fillStyle = isLightTheme ? "#222" : "#e6e6e6"; // 밝은 테마: 어두운 색, 어두운 테마: 밝은 색
  ctx.font = "24px Arial";      
  ctx.textAlign = "left";
  
  // 어두운 테마일 때 텍스트에 그림자 효과 추가 (가독성 향상)
  if (!isLightTheme) {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }
  
  // 화면 왼쪽 상단에 시간 표시
  ctx.fillText(`시간: ${elapsedTime}초`, 10, 30);
  
  // 점수 표시
  ctx.font = "20px Arial";
  ctx.fillText(`점수: ${score.toLocaleString()}`, 10, 60);
  
  // 그림자 효과 초기화
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // 콤보 표시 (콤보가 있을 때만)
  if (combo > 0) {
    ctx.fillStyle = isLightTheme ? "#f57c00" : "#ffeb3b"; // 밝은 테마: 어두운 주황색, 어두운 테마: 노란색
    
    // 어두운 테마일 때 콤보에도 그림자 효과
    if (!isLightTheme) {
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }
    
    ctx.font = "bold 18px Arial";
    const comboText = `콤보: ${combo}x`;
    ctx.fillText(comboText, 10, 90);
    
    // 피버타임 발동 가능 시 "FEVER![R]" 표시
    const now = Date.now();
    if (combo >= FEVER_COMBO_THRESHOLD && now >= feverActiveUntil) {
      ctx.fillStyle = isLightTheme ? "#ff6b00" : "#ff9800"; // 주황색
      ctx.font = "bold 16px Arial";
      // 콤보 텍스트 너비 측정 후 옆에 표시
      const comboTextWidth = ctx.measureText(comboText).width;
      ctx.fillText(`FEVER![R]`, 10 + comboTextWidth + 10, 90);
    }
    
    // 그림자 효과 초기화
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.fillStyle = isLightTheme ? "#222" : "#e6e6e6"; // 원래 색으로 복구
  }
  
  // 경고 표시
  // 웨이브 정보는 drawWaveInfo에서 그리므로 여기서는 호출하지 않음
}

// 웨이브 정보 표시 함수
function drawWaveInfo(isLightTheme) {
  ctx.save();
  ctx.fillStyle = isLightTheme ? "#222" : "#e6e6e6";
  ctx.font = "18px Arial";
  ctx.textAlign = "right";
  
  if (!isLightTheme) {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 3;
  }
  
  ctx.fillText(`웨이브 ${currentWave}`, canvas.width - 10, 25);
  
  ctx.restore();
}

// 미니맵 그리기 함수
// 보스 안내 메시지 표시 함수
function drawBossNotification() {
  if (!bossActive || bossNotificationTime <= 0) return;
  
  const now = Date.now();
  const elapsed = (now - bossNotificationTime) / 1000;
  
  // 5초 동안 표시
  if (elapsed > 5) {
    bossNotificationTime = 0;
    return;
  }
  
  const isLightTheme = document.documentElement.classList.contains('theme-light');
  ctx.save();
  
  // 페이드 효과
  const alpha = elapsed < 1 ? elapsed : (elapsed > 4 ? 1 - (elapsed - 4) : 1);
  
  // 배경 (반투명)
  ctx.fillStyle = isLightTheme ? `rgba(0,0,0,${0.7 * alpha})` : `rgba(0,0,0,${0.8 * alpha})`;
  ctx.fillRect(0, canvas.height / 2 - 80, canvas.width, 160);
  
  // 텍스트 스타일
  ctx.fillStyle = isLightTheme ? "#fff" : "#ff1744";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  if (!isLightTheme) {
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 10;
  }
  
  // 메인 메시지
  ctx.fillText("⚠️ 보스 등장! ⚠️", canvas.width / 2, canvas.height / 2 - 30);
  
  // 안내 메시지
  ctx.font = "18px Arial";
  ctx.fillStyle = isLightTheme ? "#fff" : "#ffeb3b";
  ctx.fillText("Z키를 눌러 발사체로 보스를 공격하세요!", canvas.width / 2, canvas.height / 2 + 10);
  ctx.fillText("발사체가 보스에 닿으면 데미지 (500점 보너스)", canvas.width / 2, canvas.height / 2 + 35);
  
  // 보스 HP 표시
  if (boss) {
    ctx.font = "16px Arial";
    ctx.fillStyle = isLightTheme ? "#ffeb3b" : "#fff";
    ctx.fillText(`보스 HP: ${boss.hp}/${boss.maxHp}`, canvas.width / 2, canvas.height / 2 + 60);
  }
  
  ctx.restore();
}

function drawMinimap(isLightTheme) {
  // 미니맵 기능 제거됨
}

// 경고 기능 제거됨
function drawWarnings_removed(isLightTheme) {
  return; // 기능 제거됨
  if (false && warnings && warnings.length === 0) return;
  
  const isLight = isLightTheme;
  let yPos = 120; // 경고 시작 위치
  
  warnings.forEach((warning, index) => {
    ctx.save();
    
    // 전기줄 경고는 빨간색, 일반 장애물 경고는 노란색
    if (warning.type === 'electric') {
      ctx.fillStyle = "#ff4444";
      ctx.shadowColor = "rgba(255,68,68,0.8)";
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = "#ffeb3b";
      ctx.shadowColor = "rgba(255,235,59,0.8)";
      ctx.shadowBlur = 8;
    }
    
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    
    // 경고 텍스트
    const text = `${warning.message} (${warning.timeLeft.toFixed(1)}초)`;
    ctx.fillText(`⚠ ${text}`, 10, yPos + index * 25);
    
    ctx.restore();
  });
}

// 경고 업데이트 함수 (제거됨)
function updateWarnings_removed() {
  return; // 기능 제거됨
  if (false) warnings = [];
  
  // 가장 가까운 전기줄 찾기
  let nearestElectric = null;
  let minElectricDist = Infinity;
  
  // 가장 가까운 위험 장애물 찾기
  let nearestDanger = null;
  let minDangerDist = Infinity;
  
  obstacles.forEach(ob => {
    if (ob.y < 0) return; // 화면 밖은 무시
    
    const distance = ob.y;
    const timeToHit = distance / ob.speed;
    
    if (ob.type === 'electric') {
      if (distance < minElectricDist && distance > 0) {
        minElectricDist = distance;
        nearestElectric = { obstacle: ob, time: timeToHit };
      }
    } else if (ob.type === 'boss') {
      // 보스는 항상 경고
      if (distance < minDangerDist && distance > 0) {
        minDangerDist = distance;
        nearestDanger = { obstacle: ob, time: timeToHit };
      }
    } else if (ob.type === 'explosive' && distance < minDangerDist && distance > 0) {
      // 폭발형 장애물은 위험
      minDangerDist = distance;
      nearestDanger = { obstacle: ob, time: timeToHit };
    } else if (distance < 150 && distance < minDangerDist && distance > 0) {
      // 가까운 일반 장애물도 경고
      minDangerDist = distance;
      nearestDanger = { obstacle: ob, time: timeToHit };
    }
  });
  
  // 보스가 있으면 추가 경고
  if (boss && boss.y > 0 && boss.y < canvas.height) {
    const bossDist = boss.y;
    const bossTime = bossDist / boss.speed;
    if (bossTime <= 3) {
      warnings.push({
        type: 'electric',
        message: '보스 주의!',
        timeLeft: bossTime
      });
    }
  }
  
  // 경고 추가 (2초 이내 도착하는 경우만)
  if (nearestElectric && nearestElectric.time <= 2) {
    warnings.push({
      type: 'electric',
      message: '전기줄 경고!',
      timeLeft: nearestElectric.time
    });
  }
  
  if (nearestDanger && nearestDanger.time <= 1.5) {
    warnings.push({
      type: 'obstacle',
      message: '위험!',
      timeLeft: nearestDanger.time
    });
  }
}

// ========================================
// 일시정지 함수
// ========================================
let pauseStartTime = 0;
function togglePause() {
  if (gameOver) return;
  paused = !paused;
  const pauseOverlay = document.getElementById('pauseOverlay');
  if (pauseOverlay) {
    pauseOverlay.style.display = paused ? 'flex' : 'none';
  }
  if (paused) {
    pauseStartTime = Date.now();
    // 일시정지 시 현재 프레임 요청 취소
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  } else {
    // 일시정지 시간만큼 시작 시간을 조정
    const pauseDuration = Date.now() - pauseStartTime;
    startTime += pauseDuration;
    // 일시정지 해제 시 새로운 프레임으로 시작
    if (gameStarted && !gameOver) {
      animationFrameId = requestAnimationFrame(update);
    }
  }
}

// ========================================
// 점수 계산 함수
// ========================================
function addScore(points) {
  const now = Date.now();
  // 콤보 유지 시간 체크 (3초 이내)
  if (now - lastObstaclePassed < 3000) {
    combo++;
  } else {
    combo = 1; // 새 콤보 시작
  }
  lastObstaclePassed = now;
  maxCombo = Math.max(maxCombo, combo);
  
  // 피버타임은 R 키로 수동 발동 (콤보 100 이상일 때만 가능)
  
  // 점수 = 기본 점수 * 배율 * 콤보 보너스
  const bonus = 1 + (combo - 1) * 0.1; // 콤보당 10% 보너스
  score += Math.floor(points * scoreMultiplier * bonus);
}

// 배경 그리기 함수 (난이도별 애니메이션)
function drawBackground() {
  const isLightTheme = document.documentElement.classList.contains('theme-light');
  const elapsed = parseFloat(elapsedTime);
  
  // 기본 배경 색상 (캔버스 전체 덮기)
  ctx.save();
  ctx.fillStyle = isLightTheme ? '#f2f2f2' : '#1b1f2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 난이도에 따른 배경 패턴
  if (difficultyLevel >= 2) {
    const patternOpacity = Math.min(0.15, (difficultyLevel - 1) * 0.05);
    
    // 움직이는 패턴 (시간 기반 애니메이션)
    const timeOffset = (Date.now() % 10000) / 10000; // 10초 주기
    const patternColor = isLightTheme ? 
      `rgba(0,0,0,${patternOpacity})` : 
      `rgba(255,255,255,${patternOpacity})`;
    
    ctx.save();
    ctx.globalAlpha = patternOpacity;
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 1;
    
    // 수직선 패턴 (난이도 증가에 따라 더 많아짐)
    // 파형 길이를 더 길게 하기 위해 주기를 줄임 (Math.PI * 2 -> Math.PI * 0.5)
    for (let i = 0; i < difficultyLevel * 2; i++) {
      const x = (canvas.width / (difficultyLevel * 2 + 1)) * (i + 1) + Math.sin(timeOffset * Math.PI * 0.5 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // 수평선 패턴 (시간에 따라 움직임)
    // 파형 길이를 더 길게 하기 위해 주기를 줄임
    if (difficultyLevel >= 3) {
      for (let i = 0; i < Math.floor(difficultyLevel / 2); i++) {
        const y = (canvas.height / (Math.floor(difficultyLevel / 2) + 1)) * (i + 1) + 
                  Math.cos(timeOffset * Math.PI * 0.5 + i * 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }
  
  // 보스 등장 시 특별한 배경 효과
  if (bossActive && boss) {
    const pulse = Math.sin(Date.now() / 200) * 0.05 + 0.95;
    ctx.fillStyle = isLightTheme ? 
      `rgba(255,23,68,${0.05 * pulse})` : 
      `rgba(255,23,68,${0.1 * pulse})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  ctx.restore();
}

// ========================================
// 장애물 그리기 및 이동 함수
// ========================================
function drawObstacles() {
  const now = Date.now();
  const slowFactor = now < slowMotionActiveUntil ? slowMotionSpeedFactor : 1;
  // 피버타임 중 장애물 속도 증가
  const feverSpeedMultiplier = now < feverActiveUntil ? FEVER_SPEED_MULTIPLIER : 1;
  
  // 모든 장애물을 순회하며 그리고 이동시킴
  obstacles.forEach(ob => {
    // 전기줄 효과 렌더링
    if (ob.type === 'electric') {
      ctx.save();
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 10;
      ctx.fillStyle = ob.color || '#ffeb3b';
      ctx.fillRect(ob.x + shakeOffset.x, ob.y + shakeOffset.y, ob.width, ob.height);
      ctx.restore();
    } else if (ob.type === 'moving') {
      // 좌우로 움직이는 장애물
      ob.x += ob.horizontalSpeed * slowFactor;
      if (ob.x <= 0 || ob.x + ob.width >= canvas.width) {
        ob.horizontalSpeed *= -1;
      }
      ctx.fillStyle = ob.color;
      ctx.fillRect(ob.x + shakeOffset.x, ob.y + shakeOffset.y, ob.width, ob.height);
    } else if (ob.type === 'explosive') {
      // 폭발형 장애물 (빨간색 테두리)
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.fillStyle = ob.color;
      ctx.fillRect(ob.x + shakeOffset.x, ob.y + shakeOffset.y, ob.width, ob.height);
      ctx.strokeRect(ob.x + shakeOffset.x, ob.y + shakeOffset.y, ob.width, ob.height);
    } else if (ob.type === 'bomb') {
      // 폭탄 블럭 (빨간색, 큰 크기)
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(ob.x + shakeOffset.x, ob.y + shakeOffset.y, ob.width, ob.height);
      
      // 폭탄 표시 (흰색 폭탄 이모지 또는 X)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('💣', ob.x + ob.width/2 + shakeOffset.x, ob.y + ob.height/2 + 10 + shakeOffset.y);
      ctx.textAlign = 'left'; // 원복
    } else if (ob.type === 'boss') {
      // 보스 장애물 (큰 크기, 특별한 효과)
      ctx.save();
      // 보스는 그라데이션과 글로우 효과
      const gradient = ctx.createLinearGradient(ob.x, ob.y, ob.x + ob.width, ob.y + ob.height);
      gradient.addColorStop(0, '#ff1744');
      gradient.addColorStop(1, '#c51162');
      ctx.fillStyle = gradient;
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 15;
      
      // 보스 몸체
      ctx.fillRect(ob.x + shakeOffset.x, ob.y + shakeOffset.y, ob.width, ob.height);
      
      // 보스 눈 (악랄한 느낌)
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.fillRect(ob.x + shakeOffset.x + ob.width * 0.2, ob.y + shakeOffset.y + ob.height * 0.3, 8, 8);
      ctx.fillRect(ob.x + shakeOffset.x + ob.width * 0.7, ob.y + shakeOffset.y + ob.height * 0.3, 8, 8);
      
      // 보스 입
      ctx.fillStyle = '#000000';
      ctx.fillRect(ob.x + shakeOffset.x + ob.width * 0.4, ob.y + shakeOffset.y + ob.height * 0.6, ob.width * 0.2, 6);
      
      ctx.restore();
    } else {
      ctx.fillStyle = ob.color;   // 장애물의 색상 설정.
      ctx.fillRect(ob.x + shakeOffset.x, ob.y + shakeOffset.y, ob.width, ob.height);    // 장애물을 현재 위치에 그리기
    }
    ob.y += ob.speed * slowFactor * feverSpeedMultiplier * gameSpeed;    // 장애물을 아래로 이동 (y 좌표 증가)
  });
  
  // 보스 그리기 (별도 처리)
  if (boss && boss.y < canvas.height) {
    const slowFactor = Date.now() < slowMotionActiveUntil ? slowMotionSpeedFactor : 1;
    const feverSpeedMultiplier = Date.now() < feverActiveUntil ? FEVER_SPEED_MULTIPLIER : 1;
    ctx.save();
    
    // 보스 타입별 그라데이션 색상
    const gradient = ctx.createLinearGradient(boss.x, boss.y, boss.x + boss.width, boss.y + boss.height);
    gradient.addColorStop(0, boss.color || '#ff1744');
    gradient.addColorStop(1, boss.color === '#ff6b00' ? '#ff8f00' : 
                               boss.color === '#c51162' ? '#e91e63' : 
                               boss.color === '#9c27b0' ? '#7b1fa2' : '#c51162');
    ctx.fillStyle = gradient;
    ctx.shadowColor = boss.color || '#ff1744';
    ctx.shadowBlur = 20;
    
    // 보스 몸체
    ctx.fillRect(boss.x + shakeOffset.x, boss.y + shakeOffset.y, boss.width, boss.height);
    
    // 보스 눈
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    const eyeSize = Math.max(8, boss.width * 0.15);
    ctx.fillRect(boss.x + shakeOffset.x + boss.width * 0.2, boss.y + shakeOffset.y + boss.height * 0.3, eyeSize, eyeSize);
    ctx.fillRect(boss.x + shakeOffset.x + boss.width * 0.7, boss.y + shakeOffset.y + boss.height * 0.3, eyeSize, eyeSize);
    
    // 보스 입
    ctx.fillStyle = '#000000';
    ctx.fillRect(boss.x + shakeOffset.x + boss.width * 0.4, boss.y + shakeOffset.y + boss.height * 0.6, boss.width * 0.2, Math.max(6, boss.height * 0.2));
    
    // 보스 HP 바
    ctx.fillStyle = '#333';
    ctx.fillRect(boss.x + shakeOffset.x, boss.y + shakeOffset.y - 10, boss.width, 6);
    ctx.fillStyle = boss.color || '#ff1744';
    ctx.fillRect(boss.x + shakeOffset.x, boss.y + shakeOffset.y - 10, boss.width * (boss.hp / boss.maxHp), 6);
    
    ctx.restore();
    
    boss.y += boss.speed * slowFactor * feverSpeedMultiplier * gameSpeed;
    
    // 보스가 플레이어 Y선 아래로 도달하면 게임 오버
    if (boss.y + boss.height >= player.y) {
      lives = 0;
      gameOver = true;
      shakeScreen(10, 20);
      playSound('electric');
      updateHUD();
      saveStats();
      setTimeout(() => {
        alert(`Game Over! 보스에게 당했습니다!\n생존 시간: ${elapsedTime}초\n최종 점수: ${score.toLocaleString()}\n최대 콤보: ${maxCombo}x`);
      }, 100);
    }
  }
  
  // 분할 보스의 작은 보스들 그리기 (원래 보스가 없어도 작은 보스들은 존재 가능)
  if (splitBosses && splitBosses.length > 0) {
    const slowFactor = Date.now() < slowMotionActiveUntil ? slowMotionSpeedFactor : 1;
    const feverSpeedMultiplier = Date.now() < feverActiveUntil ? FEVER_SPEED_MULTIPLIER : 1;
    splitBosses.forEach((smallBoss, index) => {
      if (smallBoss.y < canvas.height) {
        ctx.save();
        const gradient = ctx.createLinearGradient(smallBoss.x, smallBoss.y, smallBoss.x + smallBoss.width, smallBoss.y + smallBoss.height);
        gradient.addColorStop(0, '#9c27b0');
        gradient.addColorStop(1, '#7b1fa2');
        ctx.fillStyle = gradient;
        ctx.shadowColor = '#9c27b0';
        ctx.shadowBlur = 10;
        ctx.fillRect(smallBoss.x + shakeOffset.x, smallBoss.y + shakeOffset.y, smallBoss.width, smallBoss.height);
        
        // 작은 보스 눈
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.fillRect(smallBoss.x + shakeOffset.x + smallBoss.width * 0.25, smallBoss.y + shakeOffset.y + smallBoss.height * 0.3, 6, 6);
        ctx.fillRect(smallBoss.x + shakeOffset.x + smallBoss.width * 0.65, smallBoss.y + shakeOffset.y + smallBoss.height * 0.3, 6, 6);
        
        ctx.restore();
        
        smallBoss.y += smallBoss.speed * slowFactor * feverSpeedMultiplier * gameSpeed;
        
        // 작은 보스도 플레이어 Y선 아래로 도달하면 게임 오버
        if (smallBoss.y + smallBoss.height >= player.y) {
          lives = 0;
          gameOver = true;
          shakeScreen(10, 20);
          playSound('electric');
          updateHUD();
          saveStats();
          setTimeout(() => {
            alert(`Game Over! 보스에게 당했습니다!\n생존 시간: ${elapsedTime}초\n최종 점수: ${score.toLocaleString()}\n최대 콤보: ${maxCombo}x`);
          }, 100);
        }
      }
    });
  }
}

// 아이템 그리기 및 이동
function drawItems() {
  const slowFactor = Date.now() < slowMotionActiveUntil ? slowMotionSpeedFactor : 1;
  
  items.forEach(it => {
    // 배경 타일
    const x = it.x + shakeOffset.x, y = it.y + shakeOffset.y, w = it.width, h = it.height;
    ctx.save();
    // 라운드 사각형 배경
    const r = 3;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    
    if (it.type === 'invincible') {
      const grd = ctx.createLinearGradient(x, y, x+w, y+h);
      grd.addColorStop(0, '#26c6da');
      grd.addColorStop(1, '#0097a7');
      ctx.fillStyle = grd;
    } else if (it.type === 'shrink') {
      const grd = ctx.createLinearGradient(x, y, x+w, y+h);
      grd.addColorStop(0, '#9ccc65');
      grd.addColorStop(1, '#558b2f');
      ctx.fillStyle = grd;
    } else if (it.type === 'heart') {
      // 생명 회복 아이템 (빨간색)
      const grd = ctx.createLinearGradient(x, y, x+w, y+h);
      grd.addColorStop(0, '#ff5c8a');
      grd.addColorStop(1, '#c2185b');
      ctx.fillStyle = grd;
    } else if (it.type === 'slow') {
      // 슬로우 모션 아이템 (보라색)
      const grd = ctx.createLinearGradient(x, y, x+w, y+h);
      grd.addColorStop(0, '#9c27b0');
      grd.addColorStop(1, '#6a1b9a');
      ctx.fillStyle = grd;
    } else if (it.type === 'attack') {
      // 공격력+1 아이템 (주황색)
      const grd = ctx.createLinearGradient(x, y, x+w, y+h);
      grd.addColorStop(0, '#ff9800');
      grd.addColorStop(1, '#f57c00');
      ctx.fillStyle = grd;
    }
    ctx.fill();

    // 아이콘 심볼 (흰색)
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'transparent';
    ctx.translate(x, y);
    ctx.scale(w/20, h/20); // 기본 20x20 좌표로 도형 그림

    if (it.type === 'invincible') {
      // 방패 모양
      ctx.beginPath();
      ctx.moveTo(10, 2);
      ctx.lineTo(18, 5.5);
      ctx.lineTo(18, 12);
      ctx.quadraticCurveTo(15, 18, 10, 20);
      ctx.quadraticCurveTo(5, 18, 2, 12);
      ctx.lineTo(2, 5.5);
      ctx.closePath();
      ctx.fill();
    } else if (it.type === 'shrink') {
      // 소형화: 양방향 화살표
      ctx.beginPath();
      ctx.moveTo(4,6); ctx.lineTo(10,6); ctx.lineTo(10,3); ctx.lineTo(16,9); ctx.lineTo(10,15); ctx.lineTo(10,12); ctx.lineTo(4,12); ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(16,14); ctx.lineTo(10,14); ctx.lineTo(10,17); ctx.lineTo(4,11); ctx.lineTo(10,5); ctx.lineTo(10,8); ctx.lineTo(16,8); ctx.closePath();
      ctx.fill();
    } else if (it.type === 'heart') {
      // 하트 모양
      ctx.beginPath();
      ctx.moveTo(10, 6);
      ctx.bezierCurveTo(10, 4, 8, 2, 6, 2);
      ctx.bezierCurveTo(3, 2, 1, 4, 1, 7);
      ctx.bezierCurveTo(1, 9, 2, 11, 4, 13);
      ctx.bezierCurveTo(6, 15, 10, 18, 10, 18);
      ctx.bezierCurveTo(10, 18, 14, 15, 16, 13);
      ctx.bezierCurveTo(18, 11, 19, 9, 19, 7);
      ctx.bezierCurveTo(19, 4, 17, 2, 14, 2);
      ctx.bezierCurveTo(12, 2, 10, 4, 10, 6);
      ctx.closePath();
      ctx.fill();
    } else if (it.type === 'slow') {
      // 느린 모션 아이콘 (시계)
      ctx.beginPath();
      ctx.arc(10, 10, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillRect(9.5, 5, 1, 4);
      ctx.fillRect(9.5, 9.5, 3, 1);
    } else if (it.type === 'attack') {
      // 공격력 아이콘 (검 모양)
      ctx.beginPath();
      // 검날
      ctx.moveTo(10, 2);
      ctx.lineTo(12, 2);
      ctx.lineTo(12, 10);
      ctx.lineTo(10, 10);
      ctx.closePath();
      ctx.fill();
      // 검 손잡이
      ctx.fillRect(9, 10, 4, 6);
      // 검 가드
      ctx.fillRect(8, 8, 6, 2);
      // 손잡이 장식
      ctx.fillRect(10, 14, 2, 2);
    }

    ctx.restore();
    it.y += it.speed * slowFactor * gameSpeed;
  });
}

// 랜덤 색상 생성 함수(밝은색상만)
function getRandomColor() {
  // 밝은 색상을 생성하기 위해 최소값을 설정
  // 100 ~ 255 범위로 제한하여 어두운 색상 제외
  const r = Math.floor(Math.random() * 156) + 100; // red : 100~255
  const g = Math.floor(Math.random() * 156) + 100; // green : 100~255
  const b = Math.floor(Math.random() * 156) + 100; // blue : 100~255
  
  // RGB값의 평균이 너무 낮으면 (회색 계열) 다시생성
  const average = (r + g + b) / 3;

  // 평균이 150 이하 이거나, RGB값의 차이가 너무 작으면 (회색 계열) 재귀 호출
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));

  if (average < 150 || maxDiff < 50) {
    return getRandomColor();
  }

// RGB값을 CSS 색상 문자열로 변환
  return `rgb(${r}, ${g}, ${b})`;
}

// ========================================
// 새로운 장애물 생성 함수
// ========================================
function generateObstacle() {
  // 난이도에 따른 속도 계산
  const speedMultiplier = 1 + (difficultyLevel - 1) * 0.2;
  const baseSpeed = BASE_SPEED * speedMultiplier;
  
  // 랜덤한 x 좌표 생성 (캔버스 너비 내에서, 장애물 크기를 고려)
  const x = Math.random() * (canvas.width - 40);
  const rand = Math.random();
  
  // 장애물 타입 결정 (난이도에 따라)
  if (rand < 0.7) {
    // 일반 장애물
    obstacles.push({
      type: 'normal',
      x: x,
      y: 0,
      width: 40,
      height: 20,
      speed: baseSpeed + Math.random() * 2,
      color: getRandomColor()
    });
  } else if (rand < 0.85 && difficultyLevel >= 2) {
    // 움직이는 장애물 (난이도 2 이상)
    obstacles.push({
      type: 'moving',
      x: x,
      y: 0,
      width: 40,
      height: 20,
      speed: baseSpeed + Math.random() * 1.5,
      horizontalSpeed: (Math.random() < 0.5 ? -1 : 1) * 1.5,
      color: getRandomColor()
    });
  } else if (rand < 0.92 && difficultyLevel >= 3) {
    // 폭발형 장애물 (난이도 3 이상)
    obstacles.push({
      type: 'explosive',
      x: x,
      y: 0,
      width: 40,
      height: 20,
      speed: baseSpeed + Math.random() * 2,
      color: getRandomColor()
    });
  } else if (rand < 1.0 && difficultyLevel >= 2) {
    // 폭탄 블럭 (난이도 2 이상)
    obstacles.push({
      type: 'bomb',
      x: x,
      y: 0,
      width: 40,
      height: 40,
      speed: baseSpeed + Math.random() * 1.5,
      color: '#ff4444'
    });
  } else {
    // 일반 장애물로 대체
    obstacles.push({
      type: 'normal',
      x: x,
      y: 0,
      width: 40,
      height: 20,
      speed: baseSpeed + Math.random() * 2,
      color: getRandomColor()
    });
  }
}

// 보스 생성 함수
function spawnBoss() {
  bossSpawnCount++;
  
  // 보스 타입 결정 (스폰 횟수에 따라)
  if (bossSpawnCount <= 2) {
    bossType = 1; // 일반 보스
  } else if (bossSpawnCount <= 4) {
    bossType = 2; // 빠른 보스
  } else if (bossSpawnCount <= 6) {
    bossType = 3; // 큰 보스
  } else {
    bossType = 4; // 분할 보스 (특수 패턴)
  }
  
  const x = Math.random() * (canvas.width - BOSS_WIDTH);
  
  // 보스 타입별 속성
  let bossWidth = BOSS_WIDTH;
  let bossHeight = BOSS_HEIGHT;
  let bossSpeed = BOSS_SPEED;
  // 기본 HP를 웨이브에 따라 증가시킴 (웨이브당 +2씩)
  let baseHp = 3 + (currentWave - 1) * 2;
  let bossHp = baseHp;
  let bossColor = '#ff1744';
  
  if (bossType === 2) {
    // 빠른 보스: 더 빠르게, HP는 기본값의 0.7배
    bossSpeed = BOSS_SPEED * 1.5;
    bossHp = Math.max(1, Math.floor(baseHp * 0.7));
    bossColor = '#ff6b00';
  } else if (bossType === 3) {
    // 큰 보스: 크기가 큼, HP는 기본값의 1.5배
    bossWidth = BOSS_WIDTH * 1.5;
    bossHeight = BOSS_HEIGHT * 1.5;
    bossHp = Math.floor(baseHp * 1.5);
    bossColor = '#c51162';
  } else if (bossType === 4) {
    // 분할 보스: HP는 기본값과 동일
    bossHp = baseHp;
    bossColor = '#9c27b0';
  }
  
  boss = {
    type: 'boss',
    bossType: bossType, // 보스 타입 저장
    x: x,
    y: 0,
    width: bossWidth,
    height: bossHeight,
    speed: bossSpeed,
    hp: bossHp,
    maxHp: bossHp,
    color: bossColor
  };
  bossActive = true;
  bossNotificationTime = Date.now(); // 보스 안내 메시지 시작
  splitBosses = []; // 분할 보스 배열 초기화
}

// 전기줄 패턴: 얇은 가로줄 + 2개의 통로(플레이어 너비보다 조금 큼)
function generateElectricLine() {
  const lineHeight = 8; // 전기줄 두께
  const margin = 40; // 플레이어보다 여유 폭 (20 -> 40으로 증가하여 구멍을 더 넓게)
  const gapWidth = BASE_PLAYER_SIZE.width + margin; // 통로 너비 (항상 기본 크기 기준)
  const y = 0;
  const speed = 2.5 + Math.random() * 1.5;

  // 두 개의 통로 시작 위치 선택 (겹치지 않도록 정렬)
  const maxStart = Math.max(1, canvas.width - gapWidth - 1);
  let g1 = Math.floor(Math.random() * maxStart);
  let g2 = Math.floor(Math.random() * maxStart);
  if (g1 > g2) { const t = g1; g1 = g2; g2 = t; }
  // 충분한 간격 보장 (통로 사이 최소 간격도 증가)
  if (g2 < g1 + gapWidth + 40) g2 = Math.min(canvas.width - gapWidth, g1 + gapWidth + 40);

  const segments = [];
  // 왼쪽 구간
  if (g1 > 0) segments.push([0, g1]);
  // 가운데 구간 (g1 끝 ~ g2 시작 사이에 통로 제외)
  const midStart = g1 + gapWidth;
  if (g2 > midStart) segments.push([midStart, g2 - midStart]);
  // 오른쪽 구간
  const rightStart = g2 + gapWidth;
  if (rightStart < canvas.width) segments.push([rightStart, canvas.width - rightStart]);

  segments.forEach(([sx, w]) => {
    obstacles.push({
      type: 'electric',
      x: sx,
      y: y,
      width: w,
      height: lineHeight,
      speed: speed,
      color: '#ffd54f'
    });
  });
}

// 낮은 확률로 아이템 생성
function generateRandomItem() {
  // 120프레임마다 약 10% 확률로 1개 스폰
  if (frameCount % 120 !== 0) return;
  if (Math.random() >= 0.1) return;

  const rand = Math.random();
  let type;
  
  // 아이템 타입 확률 분배 (공격력 아이템 추가)
  if (rand < 0.4) type = 'invincible';      // 40%
  else if (rand < 0.8) type = 'shrink';     // 40%
  else if (rand < 0.85) type = 'heart';     // 5%
  else if (rand < 0.95) type = 'slow';      // 10%
  else type = 'attack';                    // 5% (공격력+1)
  
  const x = Math.random() * (canvas.width - 22);
  const speedMultiplier = 1 + (difficultyLevel - 1) * 0.2;
  items.push({
    type: type,
    x: x,
    y: 0,
    width: 22,
    height: 22,
    speed: (2 + Math.random() * 1.5) * speedMultiplier
  });
}

// ========================================
// 충돌 감지 함수 (AABB 충돌 검사 : Axis-Aligned Bounding Box (축에 정렬된 경계 상자))
// ========================================
// 두 사각형이 겹치는지 확인하는 함수
function checkCollision(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&      // rect1의 왼쪽이 rect2의 오른쪽보다 왼쪽에 있고
         rect1.x + rect1.width > rect2.x &&      // rect1의 오른쪽이 rect2의 왼쪽보다 오른쪽에 있고
         rect1.y < rect2.y + rect2.height &&     // rect1의 위쪽이 rect2의 아래쪽보다 위에 있고
         rect1.y + rect1.height > rect2.y;       // rect1의 아래쪽이 rect2의 위쪽보다 아래에 있으면
  // 위 4가지 조건이 모두 참이면 두 사각형이 겹침 (충돌)
}

// 플레이어가 피격 가능한지 여부
function isPlayerVulnerable() {
  const now = Date.now();
  return !(now < invActiveUntil || now < hideActiveUntil);
}

// 효과 종료/유지 및 소형화 복구
function tickEffects() {
  const now = Date.now();
  if (now >= shrinkActiveUntil && (player.width !== BASE_PLAYER_SIZE.width || player.height !== BASE_PLAYER_SIZE.height)) {
    player.width = BASE_PLAYER_SIZE.width;
    player.height = BASE_PLAYER_SIZE.height;
  }
  
}

// 난이도 업데이트
function updateDifficulty() {
  const elapsed = parseFloat(elapsedTime);
  const newLevel = Math.floor(elapsed / 20) + 1; // 20초마다 난이도 증가
  if (newLevel > difficultyLevel) {
    difficultyLevel = newLevel;
  }
}

// 피버타임 발동 함수
function tryActivateFever() {
  const now = Date.now();
  // 콤보 100 이상이고 피버타임이 끝났을 때만 발동 가능
  if (combo >= FEVER_COMBO_THRESHOLD && now >= feverActiveUntil) {
    feverActiveUntil = now + FEVER_DURATION;
    playSound('boss', 300, 0.2); // 피버타임 발동 사운드
    // 피버타임 알림 표시
    showFeverNotification();
  }
}

// 발동 시도 함수들
function tryActivateHide() {
  const now = Date.now();
  if (now >= hideReadyAt) {
    hideActiveUntil = now + HIDE_DURATION;
    hideReadyAt = now + HIDE_COOLDOWN;
    skillUsageCounts.hide++;
    updateHUD();
    updateSkillUpgrades(); // 스킬 사용 횟수 기반 업그레이드 체크
  }
}

function tryActivateInvincible() {
  const now = Date.now();
  if (invItemCount <= 0) return;
  if (now >= invReadyAt) {
    invItemCount -= 1;
    invActiveUntil = now + INV_DURATION;
    invReadyAt = now + INV_COOLDOWN;
    
    skillUsageCounts.invincible++;
    updateHUD();
    updateSkillUpgrades(); // 스킬 사용 횟수 기반 업그레이드 체크
  }
}

function tryActivateShrink() {
  const now = Date.now();
  if (shrinkItemCount <= 0) return;
  if (now >= shrinkReadyAt) {
    shrinkItemCount -= 1;
    shrinkActiveUntil = now + SHRINK_DURATION;
    shrinkReadyAt = now + SHRINK_COOLDOWN;
    // 즉시 크기 축소 적용
    player.width = Math.max(14, Math.floor(BASE_PLAYER_SIZE.width * 0.5));
    player.height = Math.max(8, Math.floor(BASE_PLAYER_SIZE.height * 0.5));
    
    skillUsageCounts.shrink++;
    updateHUD();
    updateSkillUpgrades(); // 스킬 사용 횟수 기반 업그레이드 체크
  }
}

function tryActivateSlowMotion() {
  const now = Date.now();
  if (slowMotionItemCount <= 0) return;
  if (now >= slowMotionReadyAt) {
    slowMotionItemCount -= 1;
    slowMotionActiveUntil = now + SLOW_MOTION_DURATION;
    slowMotionReadyAt = now + SLOW_MOTION_COOLDOWN;
    
    skillUsageCounts.slowMotion++;
    updateHUD();
    updateSkillUpgrades(); // 스킬 사용 횟수 기반 업그레이드 체크
  }
}

// 스킬 사용 횟수 기반 업그레이드 (추가 보너스)
function updateSkillUpgrades() {
  // 각 스킬 사용 횟수에 따라 추가 강화 (레벨업 보너스에 추가)
  // 숨기: 10회 사용마다 쿨타임 2% 감소 (최대 20%까지)
  const hideBonus = Math.min(0.2, Math.floor(skillUsageCounts.hide / 10) * 0.02);
  HIDE_COOLDOWN = Math.max(BASE_HIDE_COOLDOWN * 0.3, Math.floor(BASE_HIDE_COOLDOWN * (1 - hideBonus)));
  
  // 무적: 5회 사용마다 지속시간 3% 증가 (최대 30%까지)
  const invBonus = Math.min(0.3, Math.floor(skillUsageCounts.invincible / 5) * 0.03);
  INV_DURATION = Math.floor(BASE_INV_DURATION * (1 + invBonus));
  
  // 소형화: 7회 사용마다 지속시간 4% 증가 (최대 28%까지)
  const shrinkBonus = Math.min(0.28, Math.floor(skillUsageCounts.shrink / 7) * 0.04);
  SHRINK_DURATION = Math.floor(BASE_SHRINK_DURATION * (1 + shrinkBonus));
  
  // 슬로우 모션: 8회 사용마다 지속시간 5% 증가 (최대 25%까지)
  const slowBonus = Math.min(0.25, Math.floor(skillUsageCounts.slowMotion / 8) * 0.05);
  SLOW_MOTION_DURATION = Math.floor(BASE_SLOW_MOTION_DURATION * (1 + slowBonus));
}

// 발사체 발사 함수
function fireProjectile() {
  const now = Date.now();
  if (now - lastProjectileTime < PROJECTILE_COOLDOWN) return; // 쿨타임 체크
  
  lastProjectileTime = now;
  
  // 플레이어 위치에서 발사체 생성
  projectiles.push({
    x: player.x + player.width / 2 - PROJECTILE_WIDTH / 2,
    y: player.y,
    width: PROJECTILE_WIDTH,
    height: PROJECTILE_HEIGHT,
    speed: PROJECTILE_SPEED,
    color: '#ffeb3b'
  });
  
  playSound('damage', 300, 0.05); // 발사 소리
}

// 발사체 그리기 및 업데이트
function drawProjectiles() {
  const slowFactor = Date.now() < slowMotionActiveUntil ? slowMotionSpeedFactor : 1;
  
  projectiles = projectiles.filter(proj => {
    // 발사체 이동
    proj.y += proj.speed * slowFactor * gameSpeed;
    
    // 화면 밖으로 나가면 제거
    if (proj.y + proj.height < 0) {
      return false;
    }
    
    // 발사체 그리기
    ctx.save();
    const gradient = ctx.createLinearGradient(proj.x, proj.y, proj.x, proj.y + proj.height);
    gradient.addColorStop(0, '#ffeb3b');
    gradient.addColorStop(1, '#ffc107');
    ctx.fillStyle = gradient;
    ctx.shadowColor = '#ffeb3b';
    ctx.shadowBlur = 5;
    ctx.fillRect(proj.x + shakeOffset.x, proj.y + shakeOffset.y, proj.width, proj.height);
    ctx.restore();
    
    // 보스와 충돌 체크
    if (boss && bossActive) {
      if (checkCollision(proj, boss)) {
        // 보스에게 데미지 (공격력 적용)
        damageBoss(attackPower);
        return false; // 발사체 제거
      }
      
      // 분할 보스의 작은 보스들과 충돌 체크
      if (splitBosses && splitBosses.length > 0) {
        for (let i = splitBosses.length - 1; i >= 0; i--) {
          const smallBoss = splitBosses[i];
          if (checkCollision(proj, smallBoss)) {
            smallBoss.hp -= attackPower; // 공격력 적용
            createParticles(smallBoss.x + smallBoss.width/2, smallBoss.y + smallBoss.height/2, 'boss');
            
            if (smallBoss.hp <= 0) {
              addScore(BOSS_SCORE_BONUS / 2); // 작은 보스 처치 보너스
              createParticles(smallBoss.x + smallBoss.width/2, smallBoss.y + smallBoss.height/2, 'boss');
              splitBosses.splice(i, 1);
              
              // 모든 작은 보스 처치 시 보스 완전 처치
              if (splitBosses.length === 0) {
                addScore(BOSS_SCORE_BONUS / 2); // 추가 보너스
                playSound('boss');
                bossActive = false;
                bossNotificationTime = 0;
                
                // 보스 처치 업적 체크
                if (typeof checkAchievements === 'function') {
                  checkAchievements();
                }
              }
            }
            return false; // 발사체 제거
          }
        }
      }
    }
    
    // 장애물과 충돌 체크
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const ob = obstacles[i];
      if (ob.type === 'electric' || ob.type === 'boss') continue; // 전기줄과 보스는 파괴 불가
      
      if (checkCollision(proj, ob)) {
        // 폭탄 블럭인 경우 폭발 처리
        if (ob.type === 'bomb') {
          explodeBomb(ob.x + ob.width/2, ob.y + ob.height/2);
          obstacles.splice(i, 1); // 폭탄 블럭 제거
          return false; // 발사체 제거
        }
        // 일반 장애물은 발사체만 제거
        return false; // 발사체 제거
      }
    }
    
    return true;
  });
}

// 보스에게 데미지 주는 함수
function damageBoss(damage = 1) {
  if (!boss || !bossActive) return;
  
  const now = Date.now();
  if (now - lastDamageAt > DAMAGE_COOLDOWN) {
    lastDamageAt = now;
    boss.hp -= damage;
    shakeScreen(10, 20);
    createParticles(boss.x + boss.width/2, boss.y + boss.height/2, 'boss');
    
    if (boss.hp <= 0) {
      // 보스 처치!
      createParticles(boss.x + boss.width/2, boss.y + boss.height/2, 'boss');
      playSound('boss');
      
      // 분할 보스인 경우 작은 보스 2개 생성
      if (boss.bossType === 4 && splitBosses.length === 0) {
        const centerX = boss.x + boss.width / 2;
        const centerY = boss.y + boss.height / 2;
        const smallBossWidth = BOSS_WIDTH * 0.6;
        splitBosses = [
          {
            type: 'boss',
            bossType: 4,
            x: centerX - smallBossWidth / 2 - 15,
            y: centerY,
            width: smallBossWidth,
            height: BOSS_HEIGHT * 0.6,
            speed: BOSS_SPEED * 1.2,
            hp: 1,
            maxHp: 1,
            color: '#9c27b0'
          },
          {
            type: 'boss',
            bossType: 4,
            x: centerX + smallBossWidth / 2 + 15,
            y: centerY,
            width: smallBossWidth,
            height: BOSS_HEIGHT * 0.6,
            speed: BOSS_SPEED * 1.2,
            hp: 1,
            maxHp: 1,
            color: '#9c27b0'
          }
        ];
        // 원래 보스는 제거 (작은 보스들로 대체)
        boss = null;
        // bossActive는 유지 (작은 보스들이 모두 처치될 때까지)
        // 작은 보스들이 모두 처치되면 보스 완전 처치
      } else {
        // 일반 보스 처치
        addScore(BOSS_SCORE_BONUS);
        boss = null;
        bossActive = false;
        bossNotificationTime = 0; // 안내 메시지 숨기기
        
        // 보스 처치 업적 체크
        if (typeof checkAchievements === 'function') {
          checkAchievements();
        }
      }
    } else {
      playSound('boss', 120, 0.1);
    }
  }
}

// 폭탄 폭발 처리 함수
function explodeBomb(centerX, centerY) {
  const EXPLOSION_RADIUS = 80; // 폭발 반경
  const now = Date.now();
  
  // 폭발 파티클 효과
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: centerX,
      y: centerY,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 40,
      color: '#ff4444',
      size: 4 + Math.random() * 4
    });
  }
  
  playSound('damage', 200, 0.2); // 폭발 소리
  shakeScreen(15, 25); // 강한 화면 흔들림
  
  // 폭발 범위 내 장애물 제거
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    if (ob.type === 'electric' || ob.type === 'boss') continue; // 전기줄과 보스는 제외
    
    // 장애물 중심점
    const obCenterX = ob.x + ob.width / 2;
    const obCenterY = ob.y + ob.height / 2;
    
    // 거리 계산
    const distance = Math.sqrt(
      Math.pow(centerX - obCenterX, 2) + Math.pow(centerY - obCenterY, 2)
    );
    
    // 폭발 범위 내에 있으면 제거
    if (distance <= EXPLOSION_RADIUS) {
      obstacles.splice(i, 1);
      addScore(10); // 장애물 파괴 보너스
      createParticles(obCenterX, obCenterY, 'bomb');
    }
  }
  
  // 폭발 범위 내 보스 데미지 (5 피해)
  if (boss && bossActive) {
    const bossCenterX = boss.x + boss.width / 2;
    const bossCenterY = boss.y + boss.height / 2;
    const distance = Math.sqrt(
      Math.pow(centerX - bossCenterX, 2) + Math.pow(centerY - bossCenterY, 2)
    );
    
    if (distance <= EXPLOSION_RADIUS) {
      damageBoss(5); // 보스에게 5 피해
      createParticles(bossCenterX, bossCenterY, 'boss');
    }
  }
  
  // 폭발 범위 내 플레이어 데미지 (목숨 1개)
  const playerCenterX = player.x + player.width / 2;
  const playerCenterY = player.y + player.height / 2;
  const distance = Math.sqrt(
    Math.pow(centerX - playerCenterX, 2) + Math.pow(centerY - playerCenterY, 2)
  );
  
  if (distance <= EXPLOSION_RADIUS && isPlayerVulnerable()) {
    if (now - lastDamageAt > DAMAGE_COOLDOWN) {
      lastDamageAt = now;
      lives = Math.max(0, lives - 1);
      shakeScreen(12, 20);
      playSound('damage');
      combo = 0;
      updateHUD();
      
      if (lives === 0) {
        gameOver = true;
        shakeScreen(15, 25);
        saveStats();
        setTimeout(() => {
          alert(`Game Over! 폭발로 인해 사망\n생존 시간: ${elapsedTime}초\n최종 점수: ${score.toLocaleString()}\n최대 콤보: ${maxCombo}x`);
        }, 100);
      }
    }
  }
}

// 보스 공격 함수: 스킬 사용 시 보스가 근처에 있으면 데미지 (제거 가능)
function attackBossWithSkill(skillType) {
  if (!boss || !bossActive) return;
  
  // 보스가 화면에 있는지 확인
  if (boss.y < 0 || boss.y > canvas.height) return;
  
  // 플레이어와 보스의 X 좌표 거리 계산
  const playerCenterX = player.x + player.width / 2;
  const bossCenterX = boss.x + boss.width / 2;
  const distanceX = Math.abs(playerCenterX - bossCenterX);
  
  // 보스의 공격 범위: 보스 너비 + 여유 범위
  const attackRange = boss.width / 2 + player.width;
  
  // 플레이어가 보스 근처에 있으면 데미지
  if (distanceX <= attackRange) {
    const now = Date.now();
    if (now - lastDamageAt > DAMAGE_COOLDOWN) {
      lastDamageAt = now;
      boss.hp -= 1;
      shakeScreen(10, 20);
      createParticles(boss.x + boss.width/2, boss.y + boss.height/2, 'boss');
      
      // 스킬 타입에 따른 추가 파티클 효과
      if (skillType === 'invincible') {
        createParticles(boss.x + boss.width/2, boss.y + boss.height/2, 'invincible');
      } else if (skillType === 'shrink') {
        createParticles(boss.x + boss.width/2, boss.y + boss.height/2, 'shrink');
      } else if (skillType === 'slow') {
        createParticles(boss.x + boss.width/2, boss.y + boss.height/2, 'slow');
      }
      
      if (boss.hp <= 0) {
        // 보스 처치!
        addScore(BOSS_SCORE_BONUS);
        createParticles(boss.x + boss.width/2, boss.y + boss.height/2, 'boss');
        playSound('boss');
        boss = null;
        bossActive = false;
        bossNotificationTime = 0; // 안내 메시지 숨기기
        // 보스 처치 업적 체크
        if (typeof checkAchievements === 'function') {
          checkAchievements();
        }
      } else {
        playSound('boss', 120, 0.1);
      }
    }
  }
}

// 아이템 획득 처리
function handleItemPickup() {
  const now = Date.now();
  items = items.filter(it => {
    if (checkCollision(player, it)) {
      let itemType = it.type;
      let comboBonus = 1;
      
      // 조합 가능한 아이템 타입들
      const combinableTypes = ['invincible', 'shrink', 'slow'];
      
      // 아이템 조합 체크
      if (combinableTypes.includes(itemType)) {
        if (itemType === lastItemType && (now - lastItemPickupTime) < ITEM_COMBO_TIMEOUT) {
          itemCombo++;
          // 콤보에 따른 보너스 (최대 5콤보까지)
          comboBonus = Math.min(5, itemCombo);
          
          // 콤보 보너스 효과
          if (comboBonus >= 2) {
            // 2콤보 이상: 추가 점수
          addScore(50 * comboBonus);
          // 화면에 콤보 표시
          showItemComboNotification(comboBonus);
          playSound('combo');
          }
          
          if (comboBonus >= 3) {
            // 3콤보 이상: 아이템 효과 시간 50% 증가
            if (itemType === 'invincible' && invItemCount > 0) {
              invActiveUntil = Math.max(invActiveUntil, now + INV_DURATION * 1.5);
            } else if (itemType === 'shrink' && shrinkItemCount > 0) {
              shrinkActiveUntil = Math.max(shrinkActiveUntil, now + SHRINK_DURATION * 1.5);
            } else if (itemType === 'slow' && slowMotionItemCount > 0) {
              slowMotionActiveUntil = Math.max(slowMotionActiveUntil, now + SLOW_MOTION_DURATION * 1.5);
            }
          }
        } else {
          // 다른 아이템이거나 시간 초과
          itemCombo = 1;
          lastItemType = itemType;
        }
        lastItemPickupTime = now;
      } else {
        // 조합 불가능한 아이템은 콤보 리셋
        itemCombo = 0;
        lastItemType = null;
      }
      
      // 아이템 효과 적용
      if (itemType === 'invincible') {
        invItemCount += 1;
        itemsCollectedThisGame++;
      } else if (itemType === 'shrink') {
        shrinkItemCount += 1;
        itemsCollectedThisGame++;
      } else if (itemType === 'heart') {
        // 생명 회복
        lives = Math.min(MAX_LIVES, lives + 1);
      } else if (itemType === 'slow') {
        // 슬로우 모션 아이템 획득 (개수 증가)
        slowMotionItemCount += 1;
        itemsCollectedThisGame++;
      } else if (itemType === 'attack') {
        // 공격력+1 아이템 획득
        attackPower += 1;
        itemsCollectedThisGame++;
      }
      
      // 파티클 효과 생성
      createParticles(it.x + it.width/2, it.y + it.height/2, it.type);
      playSound('item');
      updateHUD();
      return false; // 제거
    }
    return it.y < canvas.height;
  });
  
  // 아이템 조합 타임아웃 체크
  if ((now - lastItemPickupTime) > ITEM_COMBO_TIMEOUT && itemCombo > 0) {
    itemCombo = 0;
    lastItemType = null;
  }
}

// 피버타임 알림 표시
function showFeverNotification() {
  const notification = document.createElement('div');
  notification.className = 'item-combo-notification';
  notification.style.background = 'linear-gradient(135deg, #ff6b00, #ff8f00)';
  notification.textContent = '🔥 피버타임! 🔥';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// 아이템 조합 콤보 알림 표시
function showItemComboNotification(comboLevel) {
  const notification = document.createElement('div');
  notification.className = 'item-combo-notification';
  notification.textContent = `${comboLevel}콤보!`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 1500);
}

// 파티클 생성 함수
function createParticles(x, y, type) {
  const colors = {
    invincible: '#26c6da',
    shrink: '#9ccc65',
    heart: '#ff5c8a',
    slow: '#9c27b0',
    attack: '#ff9800',
    bomb: '#ff4444',
    boss: '#ff1744'
  };
  const color = colors[type] || '#ffffff';
  
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 30,
      color: color,
      size: 3 + Math.random() * 3
    });
  }
}

// 파티클 그리기 및 업데이트
function drawParticles() {
  particles = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    
    ctx.globalAlpha = p.life / 30;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x + shakeOffset.x, p.y + shakeOffset.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    return p.life > 0;
  });
}

// 화면 흔들림 효과
function shakeScreen(intensity = 5, duration = 10) {
  shakeTime = duration;
  const maxIntensity = intensity;
  let frame = 0;
  const shakeInterval = setInterval(() => {
    shakeOffset.x = (Math.random() - 0.5) * maxIntensity;
    shakeOffset.y = (Math.random() - 0.5) * maxIntensity;
    frame++;
    if (frame >= duration) {
      shakeOffset.x = 0;
      shakeOffset.y = 0;
      clearInterval(shakeInterval);
    }
  }, 16);
}

// HUD 도우미
function formatRemain(ms) {
  if (ms <= 0) return '';
  return `${(ms/1000).toFixed(1)}s`;
}

// 초기화 시 모든 쿨타임 오버레이 숨기기
function hideAllOverlays() {
  const slotIds = ['slot-hide', 'slot-inv', 'slot-shr', 'slot-slow'];
  slotIds.forEach(slotId => {
    const slot = document.getElementById(slotId);
    if (slot) {
      const icon = slot.querySelector('.icon');
      const overlay = icon ? icon.querySelector('.cool-overlay') : slot.querySelector('.cool-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        overlay.style.background = 'rgba(0, 0, 0, 0.6)';
        overlay.style.backdropFilter = 'blur(2px)';
        const remainEl = overlay.querySelector('.remain');
        if (remainEl) remainEl.textContent = '';
        const pieEl = overlay.querySelector('.pie');
        if (pieEl) pieEl.style.background = 'none';
      }
    }
  });
}

function updateHUD() {
  const now = Date.now();

  // 유틸: 슬롯 갱신
  function setSlot(slotId, remainMs, totalMs, isActive, activeRemainMs, count, disabledWhenZero) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    const icon = slot.querySelector('.icon');
    const overlay = icon ? icon.querySelector('.cool-overlay') : slot.querySelector('.cool-overlay');
    const remainEl = overlay ? overlay.querySelector('.remain') : null;
    const pieEl = overlay ? overlay.querySelector('.pie') : null;
    const countEl = slot.querySelector('.count');
    
    if (!overlay) return; // 오버레이가 없으면 처리하지 않음

    // 원형(풍차형) 쿨다운: conic-gradient로 표시
    // 쿨타임이 0.1초 미만이면 완전히 끝난 것으로 간주
    const effectiveRemainMs = remainMs > 100 ? remainMs : 0;
    const pct = totalMs > 0 ? Math.min(1, Math.max(0, effectiveRemainMs / totalMs)) : 0;
    const angle = Math.round(pct * 360);
    
    // 쿨타임 진행 중인 경우에만 오버레이 표시
    if (effectiveRemainMs > 0) {
      // 쿨타임 진행 중 - 검은색 배경과 파이 차트 표시
      overlay.style.display = 'flex';
      overlay.style.background = 'rgba(0, 0, 0, 0.6)';
      overlay.style.backdropFilter = 'blur(2px)';
      if (pieEl) pieEl.style.background = `conic-gradient(from 0deg, rgba(0,0,0,.55) 0deg ${angle}deg, rgba(0,0,0,0) ${angle}deg 360deg)`;
      remainEl.textContent = `${(remainMs/1000).toFixed(1)}s`;
    } else if (isActive && activeRemainMs > 100) {
      // 스킬 활성화 중 (지속 시간 표시) - 배경 없이 시간만 표시
      overlay.style.display = 'flex';
      overlay.style.background = 'transparent';
      overlay.style.backdropFilter = 'none';
      if (pieEl) pieEl.style.background = 'none';
      const act = Math.max(0, activeRemainMs || 0);
      remainEl.textContent = `${(act/1000).toFixed(1)}s`;
    } else {
      // 쿨타임 끝나고 활성 상태도 아님 - 오버레이 완전히 숨김
      overlay.style.display = 'none';
      overlay.style.background = 'rgba(0, 0, 0, 0.6)'; // 기본값 복원
      overlay.style.backdropFilter = 'blur(2px)'; // 기본값 복원
      if (pieEl) pieEl.style.background = 'none';
      remainEl.textContent = '';
    }

    // 활성 효과 테두리
    slot.classList.toggle('active', isActive);

    // 개수 표기
    if (countEl) {
      countEl.textContent = String(count ?? 0);
      countEl.style.display = typeof count === 'number' ? (count > 0 ? 'block' : (disabledWhenZero ? 'block' : 'none')) : 'none';
    }

    // 비활성(미보유) 표기
    const disabled = disabledWhenZero && (!count || count <= 0) && !isActive && remainMs <= 0;
    slot.classList.toggle('disabled', !!disabled);
  }

  // 숨기 (Space)
  setSlot(
    'slot-hide',
    Math.max(0, hideReadyAt - now),
    HIDE_COOLDOWN,
    now < hideActiveUntil,
    Math.max(0, hideActiveUntil - now),
    undefined,
    false
  );

  // 무적 (Q)
  setSlot(
    'slot-inv',
    Math.max(0, invReadyAt - now),
    INV_COOLDOWN,
    now < invActiveUntil,
    Math.max(0, invActiveUntil - now),
    invItemCount,
    true
  );

  // 소형화 (W)
  setSlot(
    'slot-shr',
    Math.max(0, shrinkReadyAt - now),
    SHRINK_COOLDOWN,
    now < shrinkActiveUntil,
    Math.max(0, shrinkActiveUntil - now),
    shrinkItemCount,
    true
  );

  // 슬로우 모션 (E)
  setSlot(
    'slot-slow',
    Math.max(0, slowMotionReadyAt - now),
    SLOW_MOTION_COOLDOWN,
    now < slowMotionActiveUntil,
    Math.max(0, slowMotionActiveUntil - now),
    slowMotionItemCount,
    true
  );

  // 라이프 표시
  const livesHud = document.getElementById('livesHud');
  if (livesHud) {
    const heart = "<svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path fill='#ff5c8a' d='M12 21s-6.7-4.2-9.4-7.2C.6 11.6 1 8.3 3.2 6.6c2-1.6 4.8-1.1 6.3.9L12 9.4l2.5-1.9c1.5-2 4.3-2.5 6.3-.9 2.2 1.7 2.6 5 0.6 7.2C18.7 16.8 12 21 12 21z'/></svg>";
    const empty = "<svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path fill='none' stroke='#666' d='M12 21s-6.7-4.2-9.4-7.2C.6 11.6 1 8.3 3.2 6.6c2-1.6 4.8-1.1 6.3.9L12 9.4l2.5-1.9c1.5-2 4.3-2.5 6.3-.9 2.2 1.7 2.6 5 0.6 7.2C18.7 16.8 12 21 12 21z'/></svg>";
    let html = '';
    for (let i = 0; i < MAX_LIVES; i++) html += i < lives ? heart : empty;
    livesHud.innerHTML = html;
  }
}

// ========================================
// 게임 메인 루프 (업데이트 함수)
// ========================================
function update() {
  // 게임 시작 확인
  if (!gameStarted) {
    // 게임이 시작되지 않았으면 루프 중단
    return;
  }
  
  // 게임 오버/일시정지 확인
  if (gameOver || paused) {
    if (paused) {
      // 일시정지 중에도 파티클은 계속 그리기
      drawParticles();
      drawPlayer();
      drawTime();
      // 일시정지 중에는 requestAnimationFrame 호출하지 않음 (누적 방지)
      // togglePause에서 해제 시 다시 시작됨
    }
    // gameOver일 때는 루프 중단 (재시작 버튼 사용)
    return;
  }

  // 이전 프레임의 그림을 모두 지움 (캔버스 전체를 투명하게)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 배경 그리기 (clearRect 후에 그려야 배경이 보임)
  drawBackground();

  // 난이도 업데이트
  updateDifficulty();

  // 키 입력 상태에 따라 플레이어 이동
  movePlayer();
  
  // 게임 요소 그리기
  drawPlayer();      // 플레이어 그리기
  drawObstacles();   // 모든 장애물 그리기 및 이동
  drawItems();       // 아이템 그리기 및 이동
  drawProjectiles(); // 발사체 그리기 및 업데이트
  drawParticles();   // 파티클 그리기
  drawTime();        // 시간 표시
  
  // 웨이브 알림 표시
  drawWaveNotification();
  
  // 보스 안내 메시지 표시
  drawBossNotification();
  
  // 웨이브 정보 표시 (우측 상단)
  const isLightTheme = document.documentElement.classList.contains('theme-light');
  drawWaveInfo(isLightTheme);

  // 화면 밖으로 나간 장애물 체크 및 점수 추가
  obstacles = obstacles.filter(ob => {
    if (ob.y > canvas.height && ob.y - ob.speed <= canvas.height) {
      // 장애물이 화면 밖으로 나갔을 때 점수 추가
      addScore(10);
      return false; // 제거
    }
    return ob.y < canvas.height;
  });

  // 보스와 플레이어 충돌 확인
  const now = Date.now();
  if (boss && bossActive && checkCollision(player, boss)) {
    // 보스와 충돌 시 즉사 (무적/숨기 무시)
    if (isPlayerVulnerable() && now - lastDamageAt > DAMAGE_COOLDOWN) {
      lastDamageAt = now;
      lives = 0;
      gameOver = true;
      shakeScreen(15, 25);
      playSound('damage');
      updateHUD();
      saveStats();
      setTimeout(() => {
        alert(`Game Over! 보스와 충돌\n생존 시간: ${elapsedTime}초\n최종 점수: ${score.toLocaleString()}\n최대 콤보: ${maxCombo}x`);
      }, 100);
      return;
    }
  }
  
  // 분할 보스의 작은 보스들과 플레이어 충돌 확인
  if (splitBosses && splitBosses.length > 0) {
    for (const smallBoss of splitBosses) {
      if (checkCollision(player, smallBoss)) {
        if (isPlayerVulnerable() && now - lastDamageAt > DAMAGE_COOLDOWN) {
          lastDamageAt = now;
          lives = Math.max(0, lives - 1);
          shakeScreen(10, 20);
          playSound('damage');
          combo = 0;
          updateHUD();
          
          if (lives === 0) {
            gameOver = true;
            shakeScreen(15, 25);
            saveStats();
            setTimeout(() => {
              alert(`Game Over! 보스와 충돌\n생존 시간: ${elapsedTime}초\n최종 점수: ${score.toLocaleString()}\n최대 콤보: ${maxCombo}x`);
            }, 100);
            return;
          }
        }
      }
    }
  }
  
  // 모든 장애물에 대해 플레이어와의 충돌 확인
  for (let ob of obstacles) {
    if (!checkCollision(player, ob)) continue;
    // 전기줄은 즉사(무적/숨기 무시)
    if (ob.type === 'electric') {
      // 무적 또는 숨기 활성 중이면 무효 처리
      if (now < invActiveUntil || now < hideActiveUntil) {
        continue;
      }
      lives = 0;
      gameOver = true;
      shakeScreen(10, 20);
      playSound('electric');
      updateHUD();
      saveStats();
      // 게임 오버 처리 - 루프는 자동으로 중단됨
      setTimeout(() => {
        alert(`Game Over! 전기줄에 감전됨\n생존 시간: ${elapsedTime}초\n최종 점수: ${score.toLocaleString()}\n최대 콤보: ${maxCombo}x`);
      }, 100);
      return;
    }
    // 보스 충돌 처리 (보스는 obstacles에 포함되지 않으므로 여기서는 처리 안 함)
    if (ob.type === 'boss') {
      continue;
    }
    
    // 폭발형 장애물은 더 큰 피해
    if (ob.type === 'explosive' && isPlayerVulnerable()) {
      if (now - lastDamageAt > DAMAGE_COOLDOWN) {
        lastDamageAt = now;
        lives = Math.max(0, lives - 2); // 폭발형은 2데미지
        shakeScreen(8, 15);
        updateHUD();
        if (lives === 0) {
          gameOver = true;
          shakeScreen(10, 20);
          saveStats();
          setTimeout(() => {
            alert(`Game Over! 생존 시간: ${elapsedTime}초\n최종 점수: ${score.toLocaleString()}\n최대 콤보: ${maxCombo}x`);
          }, 100);
          return;
        }
      }
      continue;
    }
    // 일반/움직이는 장애물: 무적/숨기 중이면 피해 없음, 아니면 생명 -1 (쿨다운)
    if (isPlayerVulnerable()) {
      if (now - lastDamageAt > DAMAGE_COOLDOWN) {
        lastDamageAt = now;
        lives = Math.max(0, lives - 1);
        shakeScreen(5, 10);
        playSound('damage');
        combo = 0; // 콤보 리셋
        updateHUD();
        if (lives === 0) {
          gameOver = true;
          shakeScreen(10, 20);
          saveStats();
          setTimeout(() => {
            alert(`Game Over! 생존 시간: ${elapsedTime}초\n최종 점수: ${score.toLocaleString()}\n최대 콤보: ${maxCombo}x`);
          }, 100);
          return;
        }
      }
    }
  }

  // 아이템 획득/제거 처리
  handleItemPickup();
  // 프레임마다 카운터 1씩 증가
  frameCount++;

  // 난이도에 따른 장애물 생성 주기 조절
  const spawnRate = Math.max(15, BASE_SPAWN_RATE - difficultyLevel * 2);
  if (frameCount % spawnRate === 0) generateObstacle();
  // 주기적으로 아이템 생성 시도
  generateRandomItem();
  // 가끔 전기줄 패턴 생성
  if (frameCount % 180 === 0 && Math.random() < 0.35) {
    generateElectricLine();
  }
  
  // 보스 생성 체크 (일시정지 고려)
  const elapsed = parseFloat(elapsedTime);
  if (!bossActive && elapsed >= 15) {
    // 일시정지 시간을 고려한 보스 스폰 체크
    const actualElapsedTime = (Date.now() - startTime) / 1000;
    if ((actualElapsedTime >= 15 && lastBossSpawnTime === 0) || 
        (Date.now() - lastBossSpawnTime >= BOSS_SPAWN_INTERVAL && lastBossSpawnTime > 0)) {
      spawnBoss();
      lastBossSpawnTime = Date.now();
    }
  }
  
  // 보스 처치는 스킬 사용 방식으로 변경됨 (충돌 방식 제거)
  
  // 보스 업데이트
  if (boss) {
    if (boss.y > canvas.height) {
      // 보스가 화면 밖으로 나감 (피한 경우 보너스 점수)
      addScore(BOSS_SCORE_BONUS / 2);
      boss = null;
      bossActive = false;
      bossNotificationTime = 0;
    }
    
    // 분할 보스의 작은 보스들 업데이트
    if (splitBosses && splitBosses.length > 0) {
      for (let i = splitBosses.length - 1; i >= 0; i--) {
        const smallBoss = splitBosses[i];
        if (smallBoss.y > canvas.height) {
          splitBosses.splice(i, 1);
          
          // 모든 작은 보스 제거 시 보스 완전 제거
          if (splitBosses.length === 0) {
            boss = null;
            bossActive = false;
            bossNotificationTime = 0;
          }
        }
      }
    }
  }

  // 효과 상태 갱신 및 HUD 업데이트
  tickEffects();
  updateHUD();
  
  // 업적 체크 (1초마다)
  if (frameCount % 60 === 0) {
    checkAchievements();
  }
  
  // 웨이브 업데이트
  updateWave();

  // requestAnimationFrame: 브라우저에게 다음 프레임에 update 함수 호출 요청
  animationFrameId = requestAnimationFrame(update);
}

// 웨이브 업데이트 함수
function updateWave() {
  const now = Date.now();
  const elapsed = parseFloat(elapsedTime);
  
  // 새로운 웨이브 시작 (30초마다)
  const newWave = Math.floor(elapsed / 30) + 1;
  if (newWave > currentWave) {
    currentWave = newWave;
    waveNotificationTime = now + 2000; // 2초간 웨이브 표시
    lastWaveTime = now;
    
    // 웨이브 보너스 점수
    addScore(100 * currentWave);
  }
}

// 웨이브 표시 그리기
function drawWaveNotification() {
  const now = Date.now();
  if (now > waveNotificationTime) return;
  
  const isLightTheme = document.documentElement.classList.contains('theme-light');
  const remainingTime = (waveNotificationTime - now) / 1000;
  const alpha = Math.min(1, remainingTime);
  
  if (alpha <= 0) return;
  
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = isLightTheme ? "#222" : "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.textAlign = "center";
  
  if (!isLightTheme) {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 5;
  }
  
  ctx.fillText(`웨이브 ${currentWave}`, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

// 업적 시스템
const achievements = [
  { id: 'survive_10s', name: '생존자', desc: '10초 이상 생존', check: () => parseFloat(elapsedTime) >= 10 },
  { id: 'survive_30s', name: '고수', desc: '30초 이상 생존', check: () => parseFloat(elapsedTime) >= 30 },
  { id: 'survive_60s', name: '전설', desc: '60초 이상 생존', check: () => parseFloat(elapsedTime) >= 60 },
  { id: 'score_1000', name: '점수 마스터', desc: '1000점 달성', check: () => score >= 1000 },
  { id: 'score_5000', name: '점수 신', desc: '5000점 달성', check: () => score >= 5000 },
  { id: 'combo_10', name: '콤보 초보', desc: '10콤보 달성', check: () => maxCombo >= 10 },
  { id: 'combo_50', name: '콤보 마스터', desc: '50콤보 달성', check: () => maxCombo >= 50 },
  { id: 'combo_100', name: '콤보 신', desc: '100콤보 달성', check: () => maxCombo >= 100 },
  { id: 'perfect_run', name: '완벽한 플레이', desc: '생명 손실 없이 20초 생존', check: () => parseFloat(elapsedTime) >= 20 && lives === MAX_LIVES },
  { id: 'item_collector', name: '수집가', desc: '한 게임에서 아이템 10개 획득', check: () => false }, // 별도 추적 필요
];

let itemsCollectedThisGame = 0;
let achievementsUnlocked = [];

// 아이템 조합 시스템
let lastItemType = null;
let itemCombo = 0;
const ITEM_COMBO_TIMEOUT = 3000; // 3초 이내에 같은 아이템을 먹어야 콤보 유지
let lastItemPickupTime = 0;

function getUnlockedAchievements() {
  const saved = localStorage.getItem('ab_achievements');
  return saved ? JSON.parse(saved) : [];
}

function unlockAchievement(achievementId) {
  const unlocked = getUnlockedAchievements();
  if (!unlocked.includes(achievementId)) {
    unlocked.push(achievementId);
    localStorage.setItem('ab_achievements', JSON.stringify(unlocked));
    showAchievementNotification(achievementId);
    return true;
  }
  return false;
}

function checkAchievements() {
  achievements.forEach(ach => {
    const unlocked = getUnlockedAchievements();
    if (!unlocked.includes(ach.id) && ach.check()) {
      unlockAchievement(ach.id);
    }
  });
  
  // 아이템 수집 업적 체크
  const unlocked = getUnlockedAchievements();
  if (!unlocked.includes('item_collector') && itemsCollectedThisGame >= 10) {
    unlockAchievement('item_collector');
  }
}

function showAchievementNotification(achievementId) {
  const ach = achievements.find(a => a.id === achievementId);
  if (!ach) return;
  
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-icon">🏆</div>
    <div class="achievement-text">
      <div class="achievement-name">업적 달성!</div>
      <div class="achievement-desc">${ach.name}: ${ach.desc}</div>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// 통계 저장 및 로드
function saveStats() {
  const stats = {
    bestScore: Math.max(getStats().bestScore || 0, score),
    bestTime: Math.max(getStats().bestTime || 0, parseFloat(elapsedTime)),
    bestCombo: Math.max(getStats().bestCombo || 0, maxCombo),
    totalGames: (getStats().totalGames || 0) + 1,
    totalPlayTime: (getStats().totalPlayTime || 0) + parseFloat(elapsedTime)
  };
  localStorage.setItem('ab_stats', JSON.stringify(stats));
  
  // 업적 체크
  checkAchievements();
}

function getStats() {
  const saved = localStorage.getItem('ab_stats');
  return saved ? JSON.parse(saved) : {};
}

function resetGame() {
  // 게임 오버 후 시작 메뉴로 돌아가기
  gameStarted = false;
  gameOver = false;
  paused = false;
  obstacles = [];
  items = [];
  particles = [];
  projectiles = [];
  lastProjectileTime = 0;
  
  const startMenu = document.getElementById('startMenu');
  const itemHud = document.getElementById('itemHud');
  
  if (startMenu) {
    startMenu.style.display = 'flex';
    updateMenuStats(); // 메뉴 통계 업데이트
  }
  
  // 메뉴 표시 시 스킬창 숨기기
  if (itemHud) {
    itemHud.style.display = 'none';
  }
  
  // 화면 초기화
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateHUD();
  resizeGameArea();
  fitStartMenuDynamic();
}

// 게임 시작 함수
function startGame() {
  gameStarted = true;
  gameOver = false;
  paused = false;
  obstacles = [];
  items = [];
  particles = [];
  projectiles = [];
  lastProjectileTime = 0;
  startTime = Date.now();
  elapsedTime = 0;
  frameCount = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  scoreMultiplier = 1;
  lastObstaclePassed = 0;
  difficultyLevel = 1;
  skillUsageCounts = { hide: 0, invincible: 0, shrink: 0, slowMotion: 0 };
  // 스킬 값 초기화
  HIDE_DURATION = BASE_HIDE_DURATION;
  HIDE_COOLDOWN = BASE_HIDE_COOLDOWN;
  INV_DURATION = BASE_INV_DURATION;
  INV_COOLDOWN = BASE_INV_COOLDOWN;
  SHRINK_DURATION = BASE_SHRINK_DURATION;
  SHRINK_COOLDOWN = BASE_SHRINK_COOLDOWN;
  SLOW_MOTION_DURATION = BASE_SLOW_MOTION_DURATION;
  SLOW_MOTION_COOLDOWN = BASE_SLOW_MOTION_COOLDOWN;
  lives = MAX_LIVES;
  currentWave = 1;
  bossSpawnCount = 0;
  bossType = 1;
  splitBosses = [];
  lastWaveTime = 0;
  waveNotificationTime = 0;
  itemsCollectedThisGame = 0;
  lastDamageAt = 0;
  itemCombo = 0;
  lastItemType = null;
  lastItemPickupTime = 0;
  hideActiveUntil = 0;
  hideReadyAt = 0;
  invActiveUntil = 0;
  invReadyAt = 0;
  invItemCount = 0;
  shrinkActiveUntil = 0;
  shrinkReadyAt = 0;
  shrinkItemCount = 0;
  slowMotionActiveUntil = 0;
  slowMotionReadyAt = 0;
  slowMotionItemCount = 0;
  attackPower = 1; // 공격력 초기화
  feverActiveUntil = 0;
  shakeOffset = { x: 0, y: 0 };
  bossActive = false;
  bossNotificationTime = 0;
  boss = null;
  splitBosses = [];
  lastBossSpawnTime = 0;
  player.x = Math.max(0, Math.min(canvas.width - BASE_PLAYER_SIZE.width, canvas.width / 2 - BASE_PLAYER_SIZE.width / 2));
  // 플레이어를 화면 아래쪽으로 배치(하단에서 50px 위)
  player.y = Math.max(0, canvas.height - BASE_PLAYER_SIZE.height - 50);
  player.width = BASE_PLAYER_SIZE.width;
  player.height = BASE_PLAYER_SIZE.height;
  
  // 게임 속도 설정
  const speedSelect = document.getElementById('speedSelect');
  if (speedSelect) {
    // localStorage에서 저장된 값이 있으면 사용, 없으면 선택된 값 사용
    const savedSpeed = localStorage.getItem('ab_gameSpeed');
    if (savedSpeed) {
      gameSpeed = parseFloat(savedSpeed);
      speedSelect.value = savedSpeed;
    } else {
      gameSpeed = parseFloat(speedSelect.value);
      localStorage.setItem('ab_gameSpeed', speedSelect.value);
    }
  }
  
  // 플레이어 색상 설정
  const colorSelect = document.getElementById('playerColorSelect');
  if (colorSelect) {
    // localStorage에서 저장된 값이 있으면 사용, 없으면 선택된 값 사용
    const savedColor = localStorage.getItem('ab_playerColor');
    if (savedColor !== null) {
      player.color = savedColor || null;
      colorSelect.value = savedColor || '';
    } else {
      player.color = colorSelect.value || null;
      localStorage.setItem('ab_playerColor', player.color || '');
    }
  }
  
  const startMenu = document.getElementById('startMenu');
  const itemHud = document.getElementById('itemHud');
  
  if (startMenu) {
    startMenu.style.display = 'none';
  }
  
  // 게임 시작 시 스킬창 표시
  if (itemHud) {
    itemHud.style.display = 'block';
  }
  
  // 게임 시작 시 모든 오버레이 초기화
  hideAllOverlays();
  updateHUD();
  
  // 첫 프레임 즉시 렌더링
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlayer();
  drawTime();
  
  // 게임 루프 시작
  animationFrameId = requestAnimationFrame(update);
  // 레이아웃 크기 적용
  resizeGameArea();
  fitStartMenuDynamic();
}

// 메뉴 통계 업데이트
function updateMenuStats() {
  const stats = getStats();
  const bestScoreEl = document.getElementById('menuBestScore');
  const bestTimeEl = document.getElementById('menuBestTime');
  const bestComboEl = document.getElementById('menuBestCombo');
  
  if (bestScoreEl) bestScoreEl.textContent = (stats.bestScore || 0).toLocaleString();
  if (bestTimeEl) bestTimeEl.textContent = `${(stats.bestTime || 0).toFixed(1)}초`;
  if (bestComboEl) bestComboEl.textContent = `${stats.bestCombo || 0}x`;
}

// 게임 초기화
setHUDStatics();
hideAllOverlays();
updateHUD(); // 초기 HUD 표시 (생명 포함)
updateMenuStats(); // 메뉴 통계 업데이트

// 저장된 플레이어 색상 불러오기 (페이지 로드 시)
// DOMContentLoaded 이벤트로 감싸서 DOM이 준비된 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadSavedSettings);
} else {
  loadSavedSettings();
}

function loadSavedSettings() {
  const savedColor = localStorage.getItem('ab_playerColor');
  if (savedColor !== null) {
    player.color = savedColor || null;
    const colorSelect = document.getElementById('playerColorSelect');
    if (colorSelect) {
      colorSelect.value = savedColor || '';
    }
  }

  const savedSpeed = localStorage.getItem('ab_gameSpeed');
  if (savedSpeed) {
    gameSpeed = parseFloat(savedSpeed);
    const speedSelect = document.getElementById('speedSelect');
    if (speedSelect) {
      speedSelect.value = savedSpeed;
    }
  }
}

// 시작 메뉴는 보여주고, 게임은 시작하지 않음
const startMenu = document.getElementById('startMenu');
if (startMenu) {
  startMenu.style.display = 'flex';
}

// 게임 루프 - 게임이 시작되지 않았으면 업데이트하지 않음
function gameLoop() {
  if (gameStarted && !gameOver && !paused) {
    update();
  } else if (paused || gameOver) {
    requestAnimationFrame(gameLoop);
  }
}

// 게임이 시작되지 않았을 때는 업데이트하지 않음
if (!gameStarted) {
  // 빈 화면만 그리기
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ================================
// 테마 토글 (다크/라이트)
// ================================
(function initThemeToggle(){
  const toggleBtn = document.getElementById('themeToggle');
  const saved = localStorage.getItem('ab_theme');
  const apply = (theme) => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    if (toggleBtn) toggleBtn.textContent = theme === 'light' ? 'Light' : 'Dark';
  };
  const current = saved === 'light' ? 'light' : 'dark';
  apply(current);
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('theme-light') ? 'dark' : 'light';
      localStorage.setItem('ab_theme', next);
      apply(next);
      resizeGameArea();
    });
  }
})();

// ========================================
// 반응형 캔버스/레이아웃 크기 설정
// ========================================
function resizeGameArea() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // HUD 표시 여부
  const hud = document.getElementById('itemHud');
  const hudVisible = hud && hud.style.display !== 'none';

  // HUD가 보일 땐 우측 패널 폭을 고려해서 캔버스 최대폭 계산
  const sideGap = 40; // 좌우 여백
  const topBottomGap = 40; // 상하 여백
  const hudWidth = hudVisible ? 320 + 20 : 0; // HUD 320 + 간격 20

  // 비율 고정 없이 가능한 영역을 가득 채움
  const targetW = Math.max(200, vw - hudWidth - sideGap);
  const targetH = Math.max(150, vh - topBottomGap);

  // CSS 크기와 실제 렌더링 픽셀 크기를 모두 설정
  canvas.style.width = `${targetW}px`;
  canvas.style.height = `${targetH}px`;
  canvas.width = targetW;
  canvas.height = targetH;

  // HUD 패널 높이를 캔버스와 동기화
  const itemHudEl = document.getElementById('itemHud');
  if (itemHudEl) {
    itemHudEl.style.height = `${targetH}px`;
  }

  // 시작 메뉴는 CSS 반응형으로 맞춤 (스케일 사용 안 함)
}

window.addEventListener('resize', resizeGameArea);
document.addEventListener('DOMContentLoaded', resizeGameArea);
document.addEventListener('DOMContentLoaded', fitStartMenuDynamic);
window.addEventListener('resize', fitStartMenuDynamic);

// 시작 메뉴가 화면 높이를 넘지 않도록 스케일을 미세 조정 (최대 0.9)
function fitStartMenuDynamic() {
  const startMenu = document.getElementById('startMenu');
  if (!startMenu || startMenu.style.display === 'none') return;
  const content = startMenu.querySelector('.menu-content');
  if (!content) return;

  // 우선 기본 스케일 0.9 적용 후 실제 높이 측정
  content.style.transform = 'none';
  const baseScale = 0.9;
  const vh = window.innerHeight;
  const verticalPadding = 48; // 상하 패딩 여유 (CSS와 맞춤)
  const naturalHeight = content.scrollHeight;
  let scale = Math.min(baseScale, (vh - verticalPadding) / naturalHeight);
  // 너무 크게 되는 상황 방지
  scale = Math.min(scale, baseScale);
  // 너무 작아지지 않도록 하한 설정
  scale = Math.max(0.82, scale);

  document.documentElement.style.setProperty('--menu-scale', String(scale));
  // 실제 적용
  content.style.transform = `scale(${scale})`;
  content.style.transformOrigin = 'top center';
}