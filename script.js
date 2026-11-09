// ===================================================================
// КОНСТАНТЫ
// ===================================================================
const STORAGE_KEY = 'deadlock_overlay_settings_v3';

const DEFAULT_SETTINGS = {
    steamId: '',
    mainHero: 'auto',
    updateInterval: 60,
    useDemoData: true,
};

const RANK_NAMES = [
    'Obscurus', 'Initiate', 'Seeker', 'Alchemist', 'Arcanist', 'Ritualist',
    'Emissary', 'Archon', 'Oracle', 'Phantom', 'Ascendant', 'Eternus',
];

const DEMO_HEROES = [
    { id: '1', name: 'Infernus' },
    { id: '2', name: 'Seven' },
    { id: '3', name: 'Vindicta' },
    { id: '4', name: 'Lady Geist' },
    { id: '6', name: 'Abrams' },
    { id: '7', name: 'Wraith' },
    { id: '8', name: 'McGinnis' },
    { id: '10', name: 'Paradox' },
    { id: '11', name: 'Dynamo' },
    { id: '12', name: 'Kelvin' },
    { id: '13', name: 'Haze' },
    { id: '15', name: 'Bebop' },
    { id: '17', name: 'Grey Talon' },
    { id: '18', name: 'Mo & Krill' },
    { id: '19', name: 'Shiv' },
    { id: '20', name: 'Ivy' },
    { id: '31', name: 'Lash' },
    { id: '35', name: 'Viscous' },
    { id: '50', name: 'Pocket' },
    { id: '52', name: 'Warden' },
    { id: '58', name: 'Yamato' },
];

// ===================================================================
// СОСТОЯНИЕ
// ===================================================================
let currentSettings = { ...DEFAULT_SETTINGS };
let heroList = [...DEMO_HEROES];
let updateTimer = null;

// ===================================================================
// DOM
// ===================================================================
const els = {
    rankName: document.getElementById('rank-name'),
    rankBadge: document.getElementById('rank-badge'),
    rankProgressText: document.getElementById('rank-progress-text'),
    rankProgressBar: document.getElementById('rank-progress-bar'),
    rankNextText: document.getElementById('rank-next-text'),
    sessionWinrate: document.getElementById('session-winrate'),
    sessionWinrateBar: document.getElementById('session-winrate-bar'),
    sessionMatches: document.getElementById('session-matches'),
    heroName: document.getElementById('hero-name'),
    heroIcon: document.getElementById('hero-icon'),
    heroIconFallback: document.getElementById('hero-icon-fallback'),
    heroLabel: document.getElementById('hero-label'),
    heroWinrate: document.getElementById('hero-winrate'),
    heroMatches: document.getElementById('hero-matches'),
    updateIndicator: document.getElementById('update-indicator'),
    overlay: document.getElementById('overlay'),
    settingsModal: document.getElementById('settings-modal'),
};

// ===================================================================
// НАСТРОЙКИ: LOCALSTORAGE
// ===================================================================
function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) { console.warn('Load settings:', e); }
    return currentSettings;
}

function saveSettings(settings) {
    currentSettings = { ...settings };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings)); }
    catch (e) { console.warn('Save settings:', e); }
}

function resetSettings() {
    currentSettings = { ...DEFAULT_SETTINGS };
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

// ===================================================================
// ГЕРОИ: ЗАГРУЗКА СПИСКА
// ===================================================================
async function loadHeroList() {
    try {
        const res = await fetch('https://api.deadlock-api.com/v2/heroes');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            heroList = data.map(h => ({
                id: String(h.id ?? h.hero_id),
                name: h.name ?? 'Unknown',
                image: h.images?.icon_hero_card
                    || h.images?.icon_image_sm
                    || `https://assets.deadlock-api.com/v2/heroes/${h.id ?? h.hero_id}/icon_sm.png`,
            }));
            console.log(`Загружено героев: ${heroList.length}`);
            return;
        }
    } catch (e) {
        console.warn('Не удалось загрузить героев с API, использую fallback:', e);
    }
    heroList = DEMO_HEROES;
}

function populateHeroSelect() {
    const select = document.getElementById('input-hero');
    select.innerHTML = '';
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = 'Авто (по числу матчей)';
    select.appendChild(autoOpt);
    heroList.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = h.name;
        select.appendChild(opt);
    });
}

// ===================================================================
// РАНГИ
// ===================================================================
function getRankInfo(score) {
    const s = Math.max(0, Math.min(71.999, score));
    const tier = Math.floor(s / 6);
    const sub = Math.floor(s % 6) + 1;
    const progress = Math.round((s % 6) / 6 * 100);

    let nextTier = tier;
    let nextSub = sub + 1;
    if (nextSub > 6) { nextSub = 1; nextTier = Math.min(11, tier + 1); }

    const tierName = RANK_NAMES[Math.min(tier, RANK_NAMES.length - 1)];
    const nextTierName = RANK_NAMES[Math.min(nextTier, RANK_NAMES.length - 1)];

    return {
        name: `${tierName} ${sub}`,
        nextName: `${nextTierName} ${nextSub}`,
        progress,
        badge: tierName.charAt(0),
    };
}

// ===================================================================
// STEAM ID
// ===================================================================
function steamIdToAccountId(steamId64) {
    try {
        const id = BigInt(steamId64);
        const acc = id - 76561197960265728n;
        if (acc < 0n) return null;
        return Number(acc);
    } catch (_) { return null; }
}

// ===================================================================
// ОБНОВЛЕНИЕ UI
// ===================================================================
function updateUI(data) {
    els.rankName.textContent = data.rank.name;
    els.rankBadge.textContent = data.rank.badge;

    els.rankProgressText.textContent = `${data.rank.progress}%`;
    els.rankProgressBar.style.width = `${data.rank.progress}%`;
    els.rankNextText.textContent = `→ ${data.rank.nextName}`;

    const sw = Math.max(0, Math.min(100, data.session.winrate));
    els.sessionWinrate.textContent = `${sw}%`;
    els.sessionWinrateBar.style.width = `${sw}%`;
    els.sessionMatches.textContent = data.session.matches;

    els.heroLabel.textContent = currentSettings.mainHero === 'auto'
        ? 'Авто (топ по матчам)'
        : 'Основной герой';
    els.heroName.textContent = data.hero.name;
    els.heroWinrate.textContent = `${data.hero.winrate}%`;
    els.heroMatches.textContent = data.hero.matches;

    // Иконка героя
    if (data.hero.image) {
        els.heroIcon.src = data.hero.image;
        els.heroIcon.style.display = 'block';
        els.heroIconFallback.textContent = (data.hero.name || '?').charAt(0);
        els.heroIcon.style.zIndex = '1';
    } else {
        els.heroIcon.style.display = 'none';
        els.heroIconFallback.textContent = (data.hero.name || '?').charAt(0);
    }
}

// ===================================================================
// ДЕМО-ДАННЫЕ
// ===================================================================
function getDemoData() {
    const hero = heroList.find(h => h.id === currentSettings.mainHero) || heroList[0] || { name: 'Haze', image: '' };
    return {
        rank: getRankInfo(23.7), // Archon 4 → 70%
        session: { winrate: 68, matches: 12 },
        hero: {
            name: hero.name || 'Haze',
            image: hero.image || '',
            winrate: 62,
            matches: 340,
        },
    };
}

// ===================================================================
// РЕАЛЬНЫЕ ДАННЫЕ
// ===================================================================
async function fetchRealData() {
    const accountId = steamIdToAccountId(currentSettings.steamId);
    if (!accountId) throw new Error('Некорректный SteamID64');

    // MMR-история
    const mmrRes = await fetch(`https://api.deadlock-api.com/v1/players/${accountId}/mmr-history`);
    if (!mmrRes.ok) throw new Error('Ошибка MMR: ' + mmrRes.status);
    const mmrHistory = await mmrRes.json();
    if (!Array.isArray(mmrHistory) || mmrHistory.length === 0) throw new Error('Пустая MMR-история');

    const latest = mmrHistory[mmrHistory.length - 1];
    const score = typeof latest.player_score === 'number' ? latest.player_score : 0;
    const rank = getRankInfo(score);

    // Статистика героев
    const heroRes = await fetch(`https://api.deadlock-api.com/v1/players/${accountId}/hero-stats`);
    if (!heroRes.ok) throw new Error('Ошибка статистики героев: ' + heroRes.status);
    const heroStats = await heroRes.json();
    if (!Array.isArray(heroStats)) throw new Error('Некорректный формат hero-stats');

    // Выбор героя
    let chosenHeroEntry;
    if (currentSettings.mainHero === 'auto') {
        chosenHeroEntry = [...heroStats].sort((a, b) => (b.matches || 0) - (a.matches || 0))[0];
    } else {
        chosenHeroEntry = heroStats.find(h => String(h.hero_id ?? h.heroId) === currentSettings.mainHero);
    }

    if (!chosenHeroEntry) {
        chosenHeroEntry = heroStats[0] || { matches: 0, wins: 0 };
    }

    const heroIdStr = String(chosenHeroEntry.hero_id ?? chosenHeroEntry.heroId ?? '');
    const heroMeta = heroList.find(h => h.id === heroIdStr) || {
        name: chosenHeroEntry.hero_name || `Hero ${heroIdStr}`,
        image: '',
    };
    const heroWinrate = chosenHeroEntry.matches > 0
        ? Math.round((chosenHeroEntry.wins / chosenHeroEntry.matches) * 100)
        : 0;

    // История матчей за сегодня
    const matchRes = await fetch(`https://api.deadlock-api.com/v1/players/${accountId}/match-history`);
    const matches = matchRes.ok ? await matchRes.json() : [];
    const todayStart = Math.floor(new Date(
        new Date().getFullYear(), new Date().getMonth(), new Date().getDate()
    ).getTime() / 1000);

    const todayMatches = Array.isArray(matches)
        ? matches.filter(m => (m.start_time || m.match_start_time || 0) >= todayStart)
        : [];
    const wins = todayMatches.filter(m => m.win === true || m.result === 'win' || m.result === 'Win').length;
    const sessionWinrate = todayMatches.length
        ? Math.round((wins / todayMatches.length) * 100)
        : 0;

    return {
        rank,
        session: { winrate: sessionWinrate, matches: todayMatches.length },
        hero: {
            name: heroMeta.name,
            image: heroMeta.image || '',
            winrate: heroWinrate,
            matches: chosenHeroEntry.matches || 0,
        },
    };
}

// ===================================================================
// ГЛАВНЫЙ ЦИКЛ ОБНОВЛЕНИЯ
// ===================================================================
async function fetchData() {
    els.updateIndicator.classList.add('active');
    els.updateIndicator.textContent = 'Обновление...';

    try {
        let data;
        if (currentSettings.useDemoData || !currentSettings.steamId) {
            await new Promise(r => setTimeout(r, 400));
            data = getDemoData();
        } else {
            data = await fetchRealData();
        }
        updateUI(data);
        els.updateIndicator.textContent = 'Обновлено';
    } catch (err) {
        console.error('Ошибка загрузки:', err);
        els.updateIndicator.textContent = 'Ошибка: ' + (err.message || 'неизвестно');
    } finally {
        setTimeout(() => els.updateIndicator.classList.remove('active'), 1500);
    }
}

function restartUpdateLoop() {
    if (updateTimer) clearInterval(updateTimer);
    const interval = Math.max(15, currentSettings.updateInterval || 60) * 1000;
    updateTimer = setInterval(fetchData, interval);
}

// ===================================================================
// МОДАЛКА НАСТРОЕК
// ===================================================================
function openSettings() {
    document.getElementById('input-steamid').value = currentSettings.steamId;
    document.getElementById('input-hero').value = currentSettings.mainHero;
    document.getElementById('input-interval').value = currentSettings.updateInterval;
    document.getElementById('input-demo').checked = currentSettings.useDemoData;
    els.settingsModal.classList.add('active');
}

function closeSettings() {
    els.settingsModal.classList.remove('active');
}

function applySettingsFromForm() {
    const interval = parseInt(document.getElementById('input-interval').value) || 60;
    const newSettings = {
        steamId: document.getElementById('input-steamid').value.trim(),
        mainHero: document.getElementById('input-hero').value,
        updateInterval: Math.max(15, Math.min(600, interval)),
        useDemoData: document.getElementById('input-demo').checked,
    };
    saveSettings(newSettings);
    closeSettings();
    restartUpdateLoop();
    fetchData();
}

function resetAndApply() {
    resetSettings();
    openSettings();
    restartUpdateLoop();
    fetchData();
}

// ===================================================================
// ИНИЦИАЛИЗАЦИЯ
// ===================================================================
async function init() {
    loadSettings();
    await loadHeroList();
    populateHeroSelect();

    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-save').addEventListener('click', applySettingsFromForm);
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('settings-reset').addEventListener('click', resetAndApply);

    els.settingsModal.addEventListener('click', (e) => {
        if (e.target === els.settingsModal) closeSettings();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSettings();
        if ((e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы')
            && !els.settingsModal.classList.contains('active')) {
            openSettings();
        }
    });

    if (!currentSettings.steamId) openSettings();

    fetchData();
    restartUpdateLoop();
    console.log('Deadlock Overlay готов. Нажмите "S" для настроек.');
}

document.addEventListener('DOMContentLoaded', init);