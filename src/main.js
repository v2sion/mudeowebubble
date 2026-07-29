import {
  getAnonymousKey,
  Analytics,
  SafeAreaInsets,
  closeView,
  openURL,
  saveBase64Data,
  getCurrentLocation,
} from '@apps-in-toss/web-framework';
import html2canvas from 'html2canvas-pro';

// ── 앱인토스로 패키징되면 정적 자산이 Toss 도메인에서 서빙되어
//    상대경로 /api/... 가 깨짐 → 항상 절대 URL (배틀 A1 교훈)
const API_BASE = 'https://mudeowebubble.vercel.app';
const HEATRANK_DEEPLINK = 'intoss://mudeowerank';

// ── 유틸 ────────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

let anonymousKey = '';

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (anonymousKey) headers['x-anon-key'] = anonymousKey;
  const res = await withTimeout(
    fetch(`${API_BASE}${path}`, { ...options, headers }),
    8000
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

function trackScreen(params) { try { Analytics.screen(params); } catch (_) {} }
function trackClick(params)  { try { Analytics.click(params);  } catch (_) {} }

function applySafeAreaInsets(insets) {
  const root = document.documentElement.style;
  root.setProperty('--toss-safe-top',    `${insets.top}px`);
  root.setProperty('--toss-safe-bottom', `${insets.bottom}px`);
}
function initSafeArea() {
  try {
    applySafeAreaInsets(SafeAreaInsets.get());
    SafeAreaInsets.subscribe({ onEvent: applySafeAreaInsets });
  } catch (_) {}
}

// ── 기분 팔레트 ─────────────────────────────────────────────────
const MOODS = [
  { key: 'joy',     label: '기쁨',    emoji: '😊',  color: 'var(--mood-joy)',     tip: '다들 기분 좋은 하루를 보내고 있나 봐요' },
  { key: 'flutter', label: '설렘',    emoji: '🥰',  color: 'var(--mood-flutter)', tip: '설레는 방울이 유독 많은 하늘이에요' },
  { key: 'calm',    label: '평온',    emoji: '😌',  color: 'var(--mood-calm)',    tip: '평온한 방울이 하늘을 채우고 있어요' },
  { key: 'tired',   label: '피곤',    emoji: '😮‍💨', color: 'var(--mood-tired)',   tip: '다들 지친 하루를 보내고 있나 봐요' },
  { key: 'blue',    label: '우울',    emoji: '😔',  color: 'var(--mood-blue)',    tip: '조금 가라앉은 방울이 많은 하늘이에요' },
  { key: 'angry',   label: '화남',    emoji: '😤',  color: 'var(--mood-angry)',   tip: '오늘따라 화가 난 방울이 많네요' },
  { key: 'heat',    label: '더위먹음', emoji: '🥵',  color: 'var(--mood-heat)',    tip: '다들 더위에 지쳐있어요' },
];
const moodOf = k => MOODS.find(m => m.key === k) || MOODS[0];

// ── MOCK 데이터 (API 미배포 상태에서도 동작하게) ─────────────────
const MOCK_POOL = [
  { id: 'm1', mood: 'calm',    nick: '포근한 솜사탕',     text: '퇴근길 바람이 선선해',      time: '5분 전',  likes: 4,  region: '강남구' },
  { id: 'm2', mood: 'tired',   nick: '느긋한 나무늘보',   text: '오늘도 어찌저찌 살아냄',    time: '12분 전', likes: 9,  region: '해운대구' },
  { id: 'm3', mood: 'joy',     nick: '반짝이는 별사탕',   text: '드디어 월급날!!',          time: '23분 전', likes: 12, region: '강남구' },
  { id: 'm4', mood: 'blue',    nick: '잔잔한 빗방울',     text: '',                       time: '31분 전', likes: 6,  region: '수원시' },
  { id: 'm5', mood: 'flutter', nick: '두근두근 딸기우유', text: '내일 소풍 가는 날',         time: '40분 전', likes: 3,  region: '분당구' },
  { id: 'm6', mood: 'angry',   nick: '부글부글 주전자',   text: '지하철에서 발 밟혔다…',    time: '1시간 전', likes: 7,  region: '강남구' },
  { id: 'm7', mood: 'heat',    nick: '헥헥대는 선풍기',   text: '열대야 3일째 못 자요',      time: '19분 전', likes: 15, region: '대구 중구' },
  { id: 'm8', mood: 'heat',    nick: '무더위 체감 랭킹',  text: '비와서 꿉꿉해',           time: '42분 전', likes: 5,  src: 'rank', region: '대구 중구' },
];

// ── DOM 헬퍼 ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── 하늘 씬 ─────────────────────────────────────────────────────
const SCENE_CAPS = {
  day:       '방울은 하늘로 날아가 사라져요',
  dayMild:   '선선한 하루예요',
  sunset:    '오늘 하루도 수고했어요',
  night:     '잠 못 든 방울이 많은 밤이에요',
  nightCool: '창문 열고 잠들 수 있는 밤이에요',
};
const DARK_SCENES = ['night', 'nightCool'];

function setScene(k) {
  const s1 = $('s1');
  s1.classList.remove('scene-dayMild', 'scene-sunset', 'scene-night', 'scene-nightCool', 'sky-dark');
  if (k !== 'day') s1.classList.add('scene-' + k);
  if (DARK_SCENES.includes(k)) s1.classList.add('sky-dark');
  $('skyCap').textContent = SCENE_CAPS[k];
}
function autoScene(feelsLike = 33) {
  const h = new Date().getHours();
  const t = feelsLike;
  if (h >= 21 || h < 6) return t >= 25 ? 'night' : 'nightCool';
  if (h >= 17 && h < 21) return 'sunset';
  return t >= 33 ? 'day' : 'dayMild';
}

// ── 화면 전환 ────────────────────────────────────────────────────
let currentScreen = 0;
let skyMode = 'all';

function goToScreen(i) {
  $('screens').style.transform = `translateX(-${i * 50}%)`;
  currentScreen = i;
  updateNavHighlight();
  if (i !== 0) hidePop();
  if (i === 1) loadMe();
}
function updateNavHighlight() {
  const btns = [...$('appNav').children];
  btns[0].classList.toggle('on', currentScreen === 0 && skyMode === 'all');
  btns[1].classList.toggle('on', currentScreen === 0 && skyMode === 'local');
  btns[2].classList.toggle('on', currentScreen === 1);
}
async function goToSky(mode) {
  await selectSkyTab(mode);
  goToScreen(0);
}

// ── 위치 & 하늘 탭 ───────────────────────────────────────────────
let locationConsent = null;
let myRegion = null;        // 구 단위 (필터·저장용, e.g. "마포구")
let myRegionDisplay = null; // 표시용 (e.g. "서울 마포구")

async function requestLocation() {
  // 토스 앱 환경: SDK 브릿지 우선 사용
  try {
    const loc = await getCurrentLocation({ accuracy: 'FINE' });
    return { latitude: loc.latitude, longitude: loc.longitude };
  } catch (_) {}
  // 브라우저 개발 환경 폴백
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('미지원')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { timeout: 6000 }
    );
  });
}

function showLocConsentModal() {
  return new Promise(resolve => {
    $('locConsentOverlay').classList.add('show');
    const agree = $('locConsentAgree');
    const deny  = $('locConsentDeny');
    function cleanup(val) {
      $('locConsentOverlay').classList.remove('show');
      agree.onclick = null;
      deny.onclick  = null;
      resolve(val);
    }
    agree.onclick = () => cleanup(true);
    deny.onclick  = () => cleanup(false);
  });
}

// 위치 정보를 조용히 취득해서 myRegion/myRegionDisplay 세팅 (모달 없음)
async function fetchRegionSilent() {
  try {
    const coords = await requestLocation();
    const data = await apiFetch(`/api/nearest-region?lat=${coords.latitude}&lon=${coords.longitude}`);
    myRegion = data.city?.nameKo || null;
    if (myRegion) {
      const sidoShort = (data.city?.sido || '').replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '');
      myRegionDisplay = sidoShort ? `${sidoShort} ${myRegion}` : myRegion;
    }
  } catch (_) {}
}

async function selectSkyTab(mode) {
  if (mode === 'all') {
    skyMode = 'all';
    updateSkyTabsUI();
    renderSkyFilterCap();
    await loadSky();
    return;
  }
  if (locationConsent === null) {
    const agreed = await showLocConsentModal();
    if (agreed) {
      try {
        await fetchRegionSilent();
        locationConsent = myRegion ? true : false;
      } catch (_) {
        locationConsent = false;
      }
    } else {
      locationConsent = false;
    }
  }
  skyMode = 'local';
  updateSkyTabsUI();
  renderSkyFilterCap();
  await loadSky();
}

function updateSkyTabsUI() {
  $('tabLocal').textContent = locationConsent === false ? '가장 핫한 하늘' : '우리 동네 하늘';
  updateNavHighlight();
}

function renderSkyFilterCap() {
  if (skyMode !== 'local') { $('skyFilterCap').textContent = ''; return; }
  if (locationConsent === true && myRegion) {
    $('skyFilterCap').textContent = `지금 보고 있는 하늘: ${myRegionDisplay || myRegion}`;
  } else {
    $('skyFilterCap').textContent = '지금 보고 있는 하늘: 방울이 가장 많이 모인 곳';
  }
}

// ── 방울 풀 & 스트림 ─────────────────────────────────────────────
let skyPool = [...MOCK_POOL];
let myBubbleIds = new Set();

async function loadSky() {
  try {
    const query = skyMode === 'local' && locationConsent === true && myRegion
      ? `?region=${encodeURIComponent(myRegion)}`
      : '';
    const data = await apiFetch(`/api/sky${query}`);
    if (data.bubbles && data.bubbles.length > 0) {
      skyPool = data.bubbles.map(b => ({
        ...b,
        time: relTime(b.createdAt),
        mine: myBubbleIds.has(b.id),
      }));
    }
  } catch (_) {
    // MOCK 폴백 유지
  }
}

async function loadMoodSummary() {
  try {
    const data = await apiFetch('/api/mood-summary');
    if (data.topMood) {
      const top = moodOf(data.topMood);
      $('moodSummaryDot').style.background = top.color;
      $('moodSummaryLabel').textContent = top.label;
      $('moodSummaryPct').textContent = data.pct;
      $('moodSummaryTip').textContent = data.tip;
      return;
    }
  } catch (_) {}
  // MOCK 폴백
  renderMoodSummaryFromPool();
}

function renderMoodSummaryFromPool() {
  const counts = {};
  skyPool.forEach(p => { counts[p.mood] = (counts[p.mood] || 0) + 1; });
  let topKey = null, topCount = 0;
  Object.entries(counts).forEach(([k, c]) => { if (c > topCount) { topKey = k; topCount = c; } });
  const top = moodOf(topKey || 'calm');
  const pct = skyPool.length > 0 ? Math.round((topCount / skyPool.length) * 100) : 0;
  $('moodSummaryDot').style.background = top.color;
  $('moodSummaryLabel').textContent = top.label;
  $('moodSummaryPct').textContent = pct;
  $('moodSummaryTip').textContent = top.tip;
}

function relTime(ts) {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

// ── 방울 스폰 ────────────────────────────────────────────────────
const MAX_CONCURRENT = 7;
let spawnIdx = 0;

function randDx(mag) { return Math.round((Math.random() < 0.5 ? -1 : 1) * (mag * 0.5 + Math.random() * mag)); }
function sizeFromText(text) {
  if (!text) return 44 + Math.floor(Math.random() * 12);
  return Math.round(Math.min(46 + text.length * 3.2, 108));
}

function getActivePool() {
  if (skyMode !== 'local') return skyPool;
  if (locationConsent === true && myRegion) {
    const filtered = skyPool.filter(p => p.region === myRegion);
    return filtered.length ? filtered : skyPool;
  }
  // 거부 시: 방울 수 가장 많은 지역
  const counts = {};
  skyPool.forEach(p => { if (p.region) counts[p.region] = (counts[p.region] || 0) + 1; });
  let topRegion = null, topN = 0;
  Object.entries(counts).forEach(([r, n]) => { if (n > topN) { topRegion = r; topN = n; } });
  if (!topRegion) return skyPool;
  const filtered = skyPool.filter(p => p.region === topRegion);
  return filtered.length ? filtered : skyPool;
}

function spawnBubble(b, opts = {}) {
  if ($('skyField').children.length >= MAX_CONCURRENT && !opts.force) return;
  const el = document.createElement('div');
  el.className = 'fly-bubble' + (b.mine ? ' mine' : '');
  const size = b.size || sizeFromText(b.text);
  const x = opts.x != null ? opts.x : 6 + Math.random() * 72;
  const dur = opts.dur || (16 + Math.random() * 6);
  el.style.cssText = `--mood:${moodOf(b.mood).color}; left:${x}%; width:${size}px; height:${size}px;
    --dx1:${randDx(16)}px; --dx2:${randDx(20)}px; --dx3:${randDx(16)}px; --dx4:${randDx(14)}px; --dx5:${randDx(10)}px;
    animation-duration:${dur}s, 2.6s;`;
  if (b.text) {
    const pill = document.createElement('span');
    pill.className = 'bubble-pill';
    pill.textContent = (b.src === 'rank' ? '🔥 ' : '') + b.text;
    el.appendChild(pill);
  }
  el.onclick = e => { e.stopPropagation(); showPop(b, el); };
  el.addEventListener('animationend', () => { if (el !== pausedEl) el.remove(); });
  $('skyField').appendChild(el);
}

function spawnLoop() {
  const pool = getActivePool();
  if (pool.length === 0) return;
  spawnBubble(pool[spawnIdx % pool.length]);
  spawnIdx++;
}
setInterval(spawnLoop, 1900);

// ── 읽기 카드 ────────────────────────────────────────────────────
let currentBubble = null, liked = false, pausedEl = null;

function showPop(b, el) {
  if (pausedEl && pausedEl !== el) resumePaused();
  currentBubble = b; liked = false; pausedEl = el;
  el.style.animationPlayState = 'paused';
  $('popMood').style.background = moodOf(b.mood).color;
  $('popNick').textContent = b.nick || '';
  $('popSrc').style.display = b.src === 'rank' ? '' : 'none';
  $('popTime').textContent = b.time || relTime(b.createdAt) || '';
  $('popText').textContent = b.text || '말 없이, 그냥 날려봤어요 🫧';
  $('likeCnt').textContent = b.likes || 0;
  $('likeBtn').classList.remove('liked');
  // E: 방울 위치 기반 카드 위치 토글
  const phone = document.querySelector('.phone');
  const relY = (el.getBoundingClientRect().top - phone.getBoundingClientRect().top) / phone.getBoundingClientRect().height;
  $('popCard').classList.toggle('top-anchor', relY >= 0.45);
  $('popCard').classList.add('show');
  updateNavVisibility();
  trackClick({ log_name: 'bubble_open', mood: b.mood });
}
function resumePaused() {
  if (pausedEl) { pausedEl.style.animationPlayState = 'running'; pausedEl = null; }
}
function hidePop() { $('popCard').classList.remove('show'); resumePaused(); updateNavVisibility(); }

function updateNavVisibility() {
  const anyOpen = $('popCard').classList.contains('show') || $('sheetOverlay').classList.contains('show');
  $('appNav').classList.toggle('dimmed', anyOpen);
}

$('s1').addEventListener('click', e => {
  if (!e.target.closest('.pop-card') && !e.target.closest('.fly-bubble')) hidePop();
});
$('likeBtn').addEventListener('click', toggleLike);
$('reportBtn').addEventListener('click', openReportModal);

async function toggleLike() {
  if (!currentBubble) return;
  liked = !liked;
  currentBubble.likes = (currentBubble.likes || 0) + (liked ? 1 : -1);
  $('likeCnt').textContent = currentBubble.likes;
  $('likeBtn').classList.toggle('liked', liked);
  if (liked && currentBubble.id && !currentBubble.id.startsWith('m')) {
    await apiFetch('/api/like', { method: 'POST', body: JSON.stringify({ id: currentBubble.id }) }).catch(() => {});
  }
  trackClick({ log_name: 'bubble_like', mood: currentBubble?.mood });
}

// ── 신고 모달 (prompt() 대체) ────────────────────────────────────
let selectedReason = null;

function openReportModal() {
  if (!currentBubble || !currentBubble.id || currentBubble.id.startsWith('m')) return;
  selectedReason = null;
  $('reasonList').querySelectorAll('.reason-btn').forEach(b => b.classList.remove('on'));
  $('reportSubmitBtn').disabled = true;
  $('reportWrap').classList.add('show');
}
function closeReportModal() {
  $('reportWrap').classList.remove('show');
}

$('reasonList').addEventListener('click', e => {
  const btn = e.target.closest('.reason-btn');
  if (!btn) return;
  $('reasonList').querySelectorAll('.reason-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  selectedReason = btn.dataset.reason;
  $('reportSubmitBtn').disabled = false;
});
$('reportSubmitBtn').addEventListener('click', async () => {
  if (!selectedReason || !currentBubble) return;
  closeReportModal();
  await apiFetch('/api/report', { method: 'POST', body: JSON.stringify({ id: currentBubble.id, reason: selectedReason }) }).catch(() => {});
  hidePop();
  trackClick({ log_name: 'bubble_report', reason: selectedReason });
});
$('reportCancelBtn').addEventListener('click', closeReportModal);

// ── 비눗방울 불기 (F2-a) ─────────────────────────────────────────
const activeBlows = new Map();
let blowCount = 0;
const blowSize = ms => 16 + (ms / 60) * 6;
const POP_SIZE = 300;
const WAND_RING_OFFSET = 37;

function wandSVG() {
  return `<svg width="40" height="52" viewBox="0 0 40 52">
    <defs>
      <linearGradient id="wandHandle2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#EAF4FF"/><stop offset="50%" stop-color="#BFE3FF"/><stop offset="100%" stop-color="#8FCBEF"/>
      </linearGradient>
      <linearGradient id="wandRing2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF"/><stop offset="40%" stop-color="var(--mint-400)"/><stop offset="100%" stop-color="var(--mint-700)"/>
      </linearGradient>
      <radialGradient id="wandFilm2" cx="34%" cy="28%" r="75%">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.95"/><stop offset="42%" stop-color="#fff" stop-opacity="0.2"/>
        <stop offset="78%" stop-color="var(--toss-blue)" stop-opacity="0.1"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="17.4" y="29" width="5.2" height="21" rx="2.4" fill="url(#wandHandle2)"/>
    <rect x="18.3" y="30.5" width="1.1" height="17.5" rx="0.5" fill="#fff" opacity=".55"/>
    <rect x="16.4" y="26" width="7.2" height="5" rx="2" fill="#7FBCE0"/>
    <circle cx="20" cy="15" r="13" fill="url(#wandFilm2)"/>
    <circle cx="20" cy="15" r="13" fill="none" stroke="url(#wandRing2)" stroke-width="2.6"/>
    <ellipse cx="15.3" cy="9.3" rx="4.6" ry="2.1" fill="#fff" opacity=".7" transform="rotate(-25 15.3 9.3)"/>
  </svg>`;
}

function popBubble(rec) {
  cancelAnimationFrame(rec.rafId);
  rec.wand.classList.add('detached');
  setTimeout(() => { if (rec.wand.isConnected) rec.wand.remove(); }, 220);
  const cx = parseFloat(rec.el.style.left), cy = parseFloat(rec.el.style.top);
  const curSize = rec.size || 300;
  rec.el.animate([
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 0.85, offset: 0.3 },
    { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0, offset: 1 },
  ], { duration: 200, easing: 'ease-out' }).onfinish = () => rec.el.remove();
  setTimeout(() => { if (rec.el.isConnected) rec.el.remove(); }, 260);
  const s1 = $('s1');
  const shock = document.createElement('div');
  shock.className = 'pop-shock';
  shock.style.cssText = `left:${cx}px; top:${cy}px; width:${curSize * 0.5}px; height:${curSize * 0.5}px; opacity:.9;`;
  s1.appendChild(shock);
  shock.animate([
    { width: `${curSize * 0.5}px`, height: `${curSize * 0.5}px`, opacity: 0.85 },
    { width: `${curSize * 1.15}px`, height: `${curSize * 1.15}px`, opacity: 0 },
  ], { duration: 320, easing: 'ease-out' }).onfinish = () => shock.remove();
  setTimeout(() => { if (shock.isConnected) shock.remove(); }, 380);
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI * 2 * i / 8) + Math.random() * 0.4;
    const dist = 26 + Math.random() * 24;
    const d = document.createElement('div');
    d.className = 'pop-droplet';
    const sz = 5 + Math.random() * 5;
    d.style.cssText = `left:${cx}px; top:${cy}px; width:${sz}px; height:${sz}px;`;
    s1.appendChild(d);
    d.animate([
      { transform: 'translate(-50%,-50%) translate(0px,0px)', opacity: 1 },
      { transform: `translate(-50%,-50%) translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 10}px)`, opacity: 0 },
    ], { duration: 380, easing: 'ease-out' }).onfinish = () => d.remove();
    setTimeout(() => { if (d.isConnected) d.remove(); }, 440);
  }
  trackClick({ log_name: 'bubble_pop' });
}

function hideHint() { $('blowHint').classList.add('hidden'); }
function showHint() { $('blowHint').classList.remove('hidden'); }

function skyBlowStart(e) {
  if (e.target.closest('.fly-bubble,.pop-card,.sky-top,.action-bar,.sheet-overlay,.app-nav,.heat-widget')) return;
  hideHint();
  const rect = $('s1').getBoundingClientRect();
  const touchX = e.clientX - rect.left, touchY = e.clientY - rect.top;
  const wand = document.createElement('div');
  wand.className = 'blow-wand';
  wand.style.transform = `translate(calc(${touchX}px - 50%), calc(${touchY}px - 100%))`;
  wand.innerHTML = wandSVG();
  $('s1').appendChild(wand);
  const sitX = touchX, sitY = touchY - WAND_RING_OFFSET;
  const el = document.createElement('div');
  el.className = 'blow-bubble';
  el.style.cssText = `left:${sitX}px; top:${sitY}px; width:16px; height:16px;`;
  $('s1').appendChild(el);
  const start = performance.now();
  const pid = e.pointerId;
  const rec = { el, wand, start, rafId: null, x: sitX, y: sitY, size: 16 };
  activeBlows.set(pid, rec);
  function grow() {
    const r = activeBlows.get(pid);
    if (!r) return;
    const s = blowSize(performance.now() - start);
    if (s >= POP_SIZE) {
      popBubble(r);
      activeBlows.delete(pid);
      blowCount++; renderBlowCount();
      if (activeBlows.size === 0) showHint();
      return;
    }
    r.size = s;
    r.el.style.width = r.el.style.height = s + 'px';
    r.el.style.left = r.x + 'px';
    r.el.style.top = (r.y - s / 2) + 'px';
    r.rafId = requestAnimationFrame(grow);
  }
  rec.rafId = requestAnimationFrame(grow);
}
function skyBlowMove(e) {
  const b = activeBlows.get(e.pointerId);
  if (!b) return;
  const rect = $('s1').getBoundingClientRect();
  const touchX = e.clientX - rect.left, touchY = e.clientY - rect.top;
  b.x = touchX; b.y = touchY - WAND_RING_OFFSET;
  b.wand.style.transform = `translate(calc(${touchX}px - 50%), calc(${touchY}px - 100%))`;
  b.el.style.left = b.x + 'px';
  b.el.style.top = (b.y - (b.size || 16) / 2) + 'px';
}
function skyBlowEnd(e) {
  const b = activeBlows.get(e.pointerId);
  if (!b) return;
  activeBlows.delete(e.pointerId);
  if (activeBlows.size === 0) showHint();
  cancelAnimationFrame(b.rafId);
  const size = blowSize(performance.now() - b.start);
  blowCount++; renderBlowCount();
  b.el.style.width = b.el.style.height = size + 'px';
  b.wand.classList.add('detached');
  setTimeout(() => { if (b.wand.isConnected) b.wand.remove(); }, 220);
  const centerY = b.y - size / 2;
  const rise = centerY + size + 80;
  const mag = 14 + Math.random() * 16;
  const d1 = randDx(mag), d2 = randDx(mag * 1.1), d3 = randDx(mag), d4 = randDx(mag * 0.8), d5 = randDx(mag * 0.6);
  const dur = 3200 + size * 22;
  b.el.animate([
    { transform: 'translate(-50%,-50%) translate(0px,0px) rotate(-3deg)', opacity: 1, offset: 0 },
    { transform: `translate(-50%,-50%) translate(${d1}px,${-rise * 0.22}px) rotate(3deg)`, opacity: 1, offset: 0.22 },
    { transform: `translate(-50%,-50%) translate(${d2}px,${-rise * 0.46}px) rotate(-3deg)`, opacity: 1, offset: 0.46 },
    { transform: `translate(-50%,-50%) translate(${d3}px,${-rise * 0.7}px) rotate(2deg)`, opacity: 1, offset: 0.7 },
    { transform: `translate(-50%,-50%) translate(${d4}px,${-rise * 0.9}px) rotate(-2deg)`, opacity: 0.75, offset: 0.9 },
    { transform: `translate(-50%,-50%) translate(${d5}px,${-rise}px) rotate(2deg)`, opacity: 0, offset: 1 },
  ], { duration: dur, easing: 'ease-in-out' }).onfinish = () => b.el.remove();
  setTimeout(() => { if (b.el.isConnected) b.el.remove(); }, dur + 600);
  trackClick({ log_name: 'bubble_blow', size: Math.round(size) });
}

$('s1').addEventListener('pointerdown', skyBlowStart);
$('s1').addEventListener('pointermove', skyBlowMove);
$('s1').addEventListener('pointerup', skyBlowEnd);
$('s1').addEventListener('pointercancel', skyBlowEnd);
$('s1').addEventListener('pointerleave', skyBlowEnd);

// ── 한마디 시트 (F2-b) ───────────────────────────────────────────
let selMood = 'calm';
let inputBlocked = false;

const SIMPLE_BLOCKLIST = ['바보', '멍청', '광고', 'http', '씨발', '시발', '병신'];

function renderMoodGrid() {
  $('moodGrid').innerHTML = MOODS.map(m => `
    <button class="mood-chip ${m.key === selMood ? 'on' : ''}" style="--mood-c:${m.color}" data-mood="${m.key}">
      <div class="mc-dot" style="background:${m.color}"></div>${m.emoji} ${m.label}
    </button>`).join('');
  document.documentElement.style.setProperty('--sel-mood', moodOf(selMood).color);
}

$('moodGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-mood]');
  if (btn) {
    selMood = btn.dataset.mood;
    renderMoodGrid();
    const onChip = $('moodGrid').querySelector('.mood-chip.on');
    if (onChip) {
      onChip.classList.add('bounce');
      onChip.addEventListener('animationend', () => onChip.classList.remove('bounce'), { once: true });
    }
  }
});

// F: 쿨다운 카운트다운
let _cdTimer = null;
function _updateCooldownNote() {
  const until = parseInt(localStorage.getItem('bubbleCooldownUntil') || '0');
  const rem = until - Date.now();
  const note = $('cooldownNote');
  const btn = $('submitBtn');
  if (rem > 0) {
    const m = Math.floor(rem / 60000);
    const s = Math.ceil((rem % 60000) / 1000);
    note.textContent = `🕐 ${m}분 ${s}초 후 다시 날릴 수 있어요`;
    btn.disabled = true;
  } else {
    note.textContent = '🕐 마음 방울은 10분에 1개 · 후— 불기는 무제한이에요';
    btn.disabled = false;
    clearInterval(_cdTimer);
  }
}
function startCooldownTicker() {
  clearInterval(_cdTimer);
  _updateCooldownNote();
  _cdTimer = setInterval(_updateCooldownNote, 1000);
}
function stopCooldownTicker() { clearInterval(_cdTimer); }

function openSheet() { hidePop(); $('sheetOverlay').classList.add('show'); updateNavVisibility(); startCooldownTicker(); }
function closeSheet() { $('sheetOverlay').classList.remove('show'); updateNavVisibility(); stopCooldownTicker(); }
$('sheetOverlay').addEventListener('click', e => { if (e.target === $('sheetOverlay')) closeSheet(); });
$('btnComment').addEventListener('click', () => { openSheet(); trackClick({ log_name: 'sheet_open' }); });

$('writeInput').addEventListener('input', e => {
  const v = e.target.value;
  $('charCnt').textContent = `${v.length}/20`;
  $('charCnt').classList.toggle('over', v.length >= 20);
  const blocked = SIMPLE_BLOCKLIST.some(w => v.toLowerCase().includes(w));
  inputBlocked = blocked;
  $('filterWarn').classList.toggle('show', blocked);
  $('submitBtn').disabled = blocked;
});

$('submitBtn').addEventListener('click', submitBubble);

async function submitBubble() {
  if (inputBlocked) return;
  const text = $('writeInput').value.trim();
  closeSheet();
  const localBubble = {
    id: 'local_' + Date.now(),
    mood: selMood, nick: myNick || '내 방울',
    text, time: '방금', likes: 0, mine: true,
    region: myRegion || '',
    createdAt: Date.now(),
  };
  skyPool.unshift(localBubble);
  myBubbleIds.add(localBubble.id);
  renderMoodSummaryFromPool();
  spawnBubble(localBubble, { force: true, x: 40, dur: 17 });
  $('writeInput').value = '';
  $('writeInput').dispatchEvent(new Event('input'));

  try {
    const data = await apiFetch('/api/bubble', {
      method: 'POST',
      body: JSON.stringify({ mood: selMood, text, region: localBubble.region }),
    });
    localBubble.id = data.id;
    if (data.nick) { myNick = data.nick; }
    myBubbleIds.add(data.id);
    if (data.crisis) {
      $('crisisBanner').classList.add('show');
    }
    trackClick({ log_name: 'bubble_submit', mood: selMood, has_text: !!text });
  } catch (err) {
    if (err.status === 429) {
      const secs = err.data?.retryAfterSec || 600;
      localStorage.setItem('bubbleCooldownUntil', Date.now() + secs * 1000);
      showSkyToast(err.data?.error || '마음 방울은 10분에 1개예요 🕐');
    }
  }
}

function showSkyToast(msg) {
  const el = $('skyToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── 내 방울함 (화면 2) ───────────────────────────────────────────
let myNick = '';

async function loadMe() {
  try {
    const data = await apiFetch('/api/me');
    myNick = data.nick || myNick;
    $('meNick').textContent = data.nick || '';
    $('meTotalLikes').textContent = data.totalLikes || 0;

    // 주간 기분 분포
    const weekMoods = data.weekMoods || {};
    const total = Object.values(weekMoods).reduce((a, b) => a + b, 0);
    $('meWeekCount').textContent = total;
    if (total > 0) {
      $('weekBar').innerHTML = Object.entries(weekMoods).map(([k, n]) =>
        `<div style="flex:${n};background:${moodOf(k).color}"></div>`).join('');
      $('weekLegend').innerHTML = Object.entries(weekMoods).map(([k, n]) =>
        `<span><i style="background:${moodOf(k).color}"></i>${moodOf(k).label} ${n}</span>`).join('');
      // 가장 많은 기분으로 위로 코멘트
      const topMoodKey = Object.entries(weekMoods).sort((a, b) => b[1] - a[1])[0][0];
      const top = moodOf(topMoodKey);
      $('weekComment').textContent = `${top.label}이 많은 한 주였어요 — 오늘은 평온한 방울 하나 어때요?`;
    } else {
      $('weekBar').innerHTML = '<div style="flex:1;background:var(--ink-100)"></div>';
      $('weekLegend').innerHTML = '';
      $('weekComment').textContent = '이번 주 첫 방울을 날려보세요 🫧';
    }

    // 방울 목록
    const bubbles = data.bubbles || [];
    myBubbleIds = new Set(bubbles.map(b => b.id));
    $('myList').innerHTML = bubbles.length === 0
      ? '<div style="color:var(--ink-300);font-size:var(--font-size-caption);font-weight:600;margin-top:16px;line-height:1.7">아직 날린 방울이 없어요 🫧<br>첫 방울을 하늘로 띄워보세요</div>'
      : bubbles.map(b => `
        <div class="my-bubble-row ${b.expired ? 'gone' : ''}" data-id="${b.id}">
          <span class="bd" style="background:${moodOf(b.mood).color}"></span>
          <p>${b.text || '말 없이 날린 방울'}</p>
          <span class="meta">${relTime(b.createdAt)} · 공감 ${b.likes}</span>
        </div>`).join('');

    // 길게 누르면 삭제
    $('myList').querySelectorAll('.my-bubble-row').forEach(row => {
      let pressTimer;
      row.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(async () => {
          if (!confirm('이 방울을 즉시 삭제할까요?')) return;
          const id = row.dataset.id;
          await apiFetch('/api/me', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) }).catch(() => {});
          row.remove();
        }, 600);
      });
      row.addEventListener('pointerup', () => clearTimeout(pressTimer));
      row.addEventListener('pointercancel', () => clearTimeout(pressTimer));
    });

    trackScreen({ log_name: 'my_bubbles' });
  } catch (_) {
    // MOCK 폴백
    $('meNick').textContent = '몽글몽글 구름술사';
    $('meTotalLikes').textContent = 23;
    $('meWeekCount').textContent = 7;
    $('weekBar').innerHTML = '<div style="flex:3;background:var(--bg-gray-300)"></div><div style="flex:2;background:var(--mint-400)"></div><div style="flex:1;background:var(--toss-yellow)"></div><div style="flex:1;background:var(--toss-blue)"></div>';
    $('weekLegend').innerHTML = '<span><i style="background:var(--bg-gray-300)"></i>피곤 3</span><span><i style="background:var(--mint-400)"></i>평온 2</span><span><i style="background:var(--toss-yellow)"></i>기쁨 1</span><span><i style="background:var(--toss-blue)"></i>우울 1</span>';
    $('weekComment').textContent = '피곤이 많은 한 주였어요 — 오늘은 평온한 방울 하나 어때요?';
  }
  renderBlowCount();
}

function renderBlowCount() {
  const card = $('blowCountCard');
  if (blowCount === 0) { card.style.display = 'none'; return; }
  card.style.display = 'flex';
  $('blowCountText').textContent = `오늘 후— 불기 ${blowCount}번 · 방울을 많이 불수록 좋은 일이 생길 거예요`;
}

// ── 닉네임 리롤 ─────────────────────────────────────────────────
$('rerollBtn').addEventListener('click', async () => {
  try {
    const data = await apiFetch('/api/me', { method: 'POST', body: JSON.stringify({ action: 'reroll' }) });
    myNick = data.nick;
    $('meNick').textContent = data.nick;
    trackClick({ log_name: 'nick_reroll' });
  } catch (_) {}
});

// ── 더위 위젯 (F7 딥링크) ───────────────────────────────────────
$('heatWidget').addEventListener('click', () => {
  trackClick({ log_name: 'heatrank_deeplink_click' });
  openURL(HEATRANK_DEEPLINK).catch(() => {});
});

// ── 하단 내비 이벤트 ─────────────────────────────────────────────
$('tabAll').addEventListener('click',  () => goToSky('all'));
$('tabLocal').addEventListener('click', () => goToSky('local'));
$('tabMe').addEventListener('click',   () => goToScreen(1));

// ── 초기화 ──────────────────────────────────────────────────────
async function init() {
  initSafeArea();

  try {
    anonymousKey = await withTimeout(getAnonymousKey(), 3000);
  } catch (_) {
    anonymousKey = 'dev-' + Math.random().toString(36).slice(2);
  }

  setScene(autoScene());
  renderMoodGrid();
  updateNavHighlight();
  spawnLoop(); spawnLoop(); spawnLoop();

  // 조용히 위치 취득 — 성공하면 방울 제출 시 region 첨부됨
  fetchRegionSilent();

  loadSky().then(() => {
    renderMoodSummaryFromPool();
    spawnIdx = 0;
    initCoachMark();
  });
  loadMoodSummary();
  trackScreen({ log_name: 'sky_home', sky_mode: skyMode });
}

// D: 첫 방문 코치마크
function initCoachMark() {
  if (localStorage.getItem('bubbleVisited')) return;
  const wrap = $('coachWrap');
  wrap.classList.add('show');
  wrap.addEventListener('click', () => {
    wrap.classList.remove('show');
    localStorage.setItem('bubbleVisited', '1');
  }, { once: true });
}

init();
