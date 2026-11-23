(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const PLAT_LABELS = { pc: 'Steam', ps: 'PlayStation', xbox: 'Xbox' };

  // Official monochrome brand SVGs (Steam & PlayStation via Simple Icons; Xbox via Font Awesome Free)
  const OFFICIAL_LOGOS = {
    pc: {
      vb: '0 0 24 24',
      d: 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z',
    },
    ps: {
      vb: '0 0 24 24',
      d: 'M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z',
    },
    xbox: {
      vb: '0 0 512 512',
      d: 'M369.9 318.2c44.3 54.3 64.7 98.8 54.4 118.7-7.9 15.1-56.7 44.6-92.6 55.9-29.6 9.3-68.4 13.3-100.4 10.2-38.2-3.7-76.9-17.4-110.1-39C93.3 445.8 87 438.3 87 423.4c0-29.9 32.9-82.3 89.2-142.1 32-33.9 76.5-73.7 81.4-72.6 9.4 2.1 84.3 75.1 112.3 109.5zM188.6 143.8c-29.7-26.9-58.1-53.9-86.4-63.4-15.2-5.1-16.3-4.8-28.7 8.1-29.2 30.4-53.5 79.7-60.3 122.4-5.4 34.2-6.1 43.8-4.2 60.5 5.6 50.5 17.3 85.4 40.5 120.9 9.5 14.6 12.1 17.3 9.3 9.9-4.2-11-.3-37.5 9.5-64 14.3-39 53.9-112.9 120.3-194.4zm311.6 63.5C483.3 127.3 432.7 77 425.6 77c-7.3 0-24.2 6.5-36 13.9-23.3 14.5-41 31.4-64.3 52.8C367.7 197 427.5 283.1 448.2 346c6.8 20.7 9.7 41.1 7.4 52.3-1.7 8.5-1.7 8.5 1.4 4.6 6.1-7.7 19.9-31.3 25.4-43.5 7.4-16.2 15-40.2 18.6-58.7 4.3-22.5 3.9-70.8-.8-93.4zM141.3 43C189 40.5 251 77.5 255.6 78.4c.7.1 10.4-4.2 21.6-9.7 63.9-31.1 94-25.8 107.4-25.2-63.9-39.3-152.7-50-233.9-11.7-23.4 11.1-24 11.9-9.4 11.2z',
    },
  };

  function platIcon(plat, extraClass = '') {
    const spec = OFFICIAL_LOGOS[plat];
    if (!spec) return '';
    return `<svg class="plat-svg plat-svg-${plat} ${extraClass}" viewBox="${spec.vb}" fill="currentColor" aria-hidden="true"><path d="${spec.d}"/></svg>`;
  }

  const SORT_TITLES = {
    trend: 'Trending now',
    new: 'Newest releases',
    old: 'Oldest releases',
    top: 'Top rated',
    most: 'Most reviewed',
    az: 'Games A to Z',
    za: 'Games Z to A',
  };

  const ST1 = 'https://cdn.akamai.steamstatic.com/steam/apps/';
  const ST2 = 'https://cdn.cloudflare.steamstatic.com/steam/apps/';

  // Major 2026 releases cycling in the hero showcase (verified 4K key art + Playtested catalog IDs)
  const HERO_RECENT_GAMES = [
    {
      id: '3764200',
      name: 'Resident Evil Requiem',
      sub: '2026 RELEASE',
      art: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3764200/90d7401b621e98bd61b2f66616ffafcb58d75fd7/library_hero_2x.jpg?t=1779840172',
      pos: 'center 24%',
    },
    {
      id: 'wd-Q23648408',
      name: 'Grand Theft Auto VI',
      sub: '2026 RELEASE',
      art: '/images/hero-gta6.jpg',
      pos: 'center center',
    },
    {
      id: '3321460',
      name: 'Crimson Desert',
      sub: '2026 RELEASE',
      art: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3321460/fa05258232b2b970e2730d2ad5917842e914283c/library_hero_2x.jpg?t=1794478066',
      pos: 'center 24%',
    },
    {
      id: '2483190',
      name: 'Forza Horizon 6',
      sub: '2026 RELEASE',
      art: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2483190/3eeb9970d8a8b6634d114b43e0edba78a7ee1eb6/library_hero_2x.jpg?t=1795104806',
      pos: 'center 42%',
    },
    {
      id: '3357650',
      name: 'PRAGMATA',
      sub: '2026 RELEASE',
      art: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3357650/91c6fc49c0d73d54e798a7a11ad5f6625734a703/library_hero_2x.jpg?t=1791454600',
      pos: 'center 26%',
    },
    {
      id: '3751260',
      name: 'The Blood of Dawnwalker',
      sub: '2026 RELEASE',
      art: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3751260/c96d68e6fdef6c58bc1b6f46dcdc4362227b6fa9/library_hero_2x.jpg?t=1795190297',
      pos: 'center 24%',
    },
  ];

  function initHeroShowcase() {
    const slideA = $('#hero-slide-a');
    const slideB = $('#hero-slide-b');
    const captionBtn = $('#hero-caption');
    const captionTitle = $('#hero-caption-title');
    const captionSub = $('#hero-caption-sub');
    const indexNum = $('#hero-index-num');
    const dotsWrap = $('#hero-dots');
    if (!slideA || !slideB || !HERO_RECENT_GAMES.length) return;

    const slides = HERO_RECENT_GAMES;
    let current = 0;
    let frontIsA = true;
    let timer = null;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function pad2(n) {
      return String(n).padStart(2, '0');
    }

    function preloadNext(idx) {
      const nextItem = slides[(idx + 1) % slides.length];
      if (!nextItem) return;
      const img = new Image();
      img.src = nextItem.art;
    }

    function renderMeta(idx) {
      const item = slides[idx];
      if (captionTitle) captionTitle.textContent = item.name;
      if (captionSub) captionSub.textContent = item.sub;
      if (captionBtn) captionBtn.setAttribute('aria-label', `Open featured game ${item.name}`);
      if (indexNum) indexNum.textContent = `${pad2(idx + 1)} / ${pad2(slides.length)}`;
      if (dotsWrap) {
        $$('.hero-dot-btn', dotsWrap).forEach((btn, i) => {
          btn.classList.toggle('is-active', i === idx);
          btn.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
        });
      }
    }

    function goTo(nextIdx) {
      const targetIdx = ((nextIdx % slides.length) + slides.length) % slides.length;
      if (targetIdx === current) return;
      const item = slides[targetIdx];
      const incoming = frontIsA ? slideB : slideA;
      const outgoing = frontIsA ? slideA : slideB;

      const swap = () => {
        incoming.style.objectPosition = item.pos || 'center 24%';
        incoming.classList.add('is-active');
        outgoing.classList.remove('is-active');
        frontIsA = !frontIsA;
        current = targetIdx;
        renderMeta(current);
        preloadNext(current);
      };

      incoming.onload = swap;
      incoming.onerror = () => {
        current = targetIdx;
        renderMeta(current);
      };
      if (incoming.src === item.art && incoming.complete && incoming.naturalWidth > 0) {
        swap();
      } else {
        incoming.src = item.art;
      }
    }

    function restartTimer() {
      if (timer) clearInterval(timer);
      if (reducedMotion) return;
      timer = setInterval(() => {
        if (!document.hidden && state.view === 'discover') {
          goTo(current + 1);
        }
      }, 6500);
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = slides
        .map(
          (s, i) =>
            `<button type="button" class="hero-dot-btn${i === 0 ? ' is-active' : ''}" data-idx="${i}" aria-label="Show ${esc(s.name)}" aria-pressed="${i === 0 ? 'true' : 'false'}"></button>`
        )
        .join('');
      dotsWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.hero-dot-btn');
        if (!btn) return;
        goTo(Number(btn.dataset.idx));
        restartTimer();
      });
    }

    if (captionBtn) {
      captionBtn.addEventListener('click', () => {
        const item = slides[current];
        if (item?.id) openGameModal(item.id);
      });
    }

    slideA.style.objectPosition = slides[0].pos || 'center 24%';
    renderMeta(0);
    preloadNext(0);
    restartTimer();
  }

  const state = {
    view: 'discover',
    me: null,
    stats: null,
    games: [],
    platform: 'all',
    sort: 'trend',
    page: 1,
    pages: 1,
    size: 30,
    reqId: 0,
    revFeedPlat: 'all',
    revFeedSort: 'recent',
    library: null,
    librariesByPlat: { pc: null, ps: null, xbox: null },
    libraryPromises: {},
    eligibilityCache: {},
    libPlatform: 'pc',
    libFilter: 'all',
    libQuery: '',
    currentModalGame: null,
    currentModalPayload: null,
    modalReviewSort: 'recent',
    modalRatePlatform: 'pc',
    modalEligibility: null,
    psnPanelOpen: false,
    psnMode: 'bio',
    psnChallenge: null,
    xboxPanelOpen: false,
    xboxChallenge: null,
    lastModalCloseTs: 0,
    utm: null,
  };

  // ---- Privacy-First Zero-Cookie UTM Attribution ----
  function initUtmAttribution(params) {
    let utm = null;
    try {
      const saved = sessionStorage.getItem('pt_utm');
      if (saved) utm = JSON.parse(saved);
    } catch {}

    const qSource = params.get('utm_source');
    const qCampaign = params.get('utm_campaign');
    if (qSource) {
      utm = {
        source: qSource.trim().toLowerCase().slice(0, 40),
        campaign: (qCampaign || 'launch').trim().toLowerCase().slice(0, 40),
      };
    } else if (!utm && document.referrer) {
      try {
        const refHost = new URL(document.referrer).hostname.replace(/^www\./, '').toLowerCase();
        if (refHost && refHost !== window.location.hostname.toLowerCase()) {
          const mapped = refHost.includes('reddit')
            ? 'reddit'
            : refHost.includes('youtube') || refHost.includes('youtu.be')
              ? 'youtube'
              : refHost.includes('tiktok')
                ? 'tiktok'
                : refHost.includes('instagram')
                  ? 'instagram'
                  : refHost.includes('google')
                    ? 'google'
                    : refHost.replace(/[^a-z0-9_-]+/g, '_').slice(0, 32);
          utm = { source: mapped, campaign: 'referral' };
        }
      } catch {}
    }

    if (utm) {
      state.utm = utm;
      try {
        sessionStorage.setItem('pt_utm', JSON.stringify(utm));
      } catch {}
    }

    // Record one visit per browser session
    try {
      if (!sessionStorage.getItem('pt_utm_visited')) {
        sessionStorage.setItem('pt_utm_visited', '1');
        trackMarketingEvent('visit');
      }
    } catch {}
  }

  function trackMarketingEvent(event, platform = '') {
    const src = state.utm?.source || 'direct';
    const cmp = state.utm?.campaign || 'organic';
    fetch('/api/marketing/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, source: src, campaign: cmp, ...(platform ? { platform } : {}) }),
      keepalive: true,
    }).catch(() => {});
  }

  // ---- Utilities ----
  const scoreClass = (s) => (s == null ? 'na' : s >= 75 ? 'hi' : s >= 50 ? 'mid' : 'lo');

  function verdictFor(score) {
    if (score >= 95) return 'Essential';
    if (score >= 85) return 'Great';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Mixed';
    if (score >= 30) return 'Rough';
    return 'Poor';
  }

  function formatCompact(n) {
    if (!n) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${Math.round(n / 1000)}k`;
    if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  }

  function formatDate(ts) {
    if (!ts) return '';
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ts));
    } catch {
      return '';
    }
  }

  function placeholderSvg(name) {
    const safe = String(name || 'Playtested').replace(/[<>&"]/g, '').slice(0, 26);
    const dark = document.documentElement.dataset.theme !== 'light';
    const bg = dark ? '#1b1f26' : '#e8e3d6';
    const fg = dark ? '#969ca8' : '#5c606b';
    const accent = dark ? '#ff6b35' : '#cf3b14';
    return (
      'data:image/svg+xml,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">` +
          `<rect width="600" height="900" fill="${bg}"/>` +
          `<circle cx="300" cy="370" r="56" fill="none" stroke="${accent}" stroke-width="4" opacity="0.35"/>` +
          `<text x="300" y="470" fill="${fg}" font-family="sans-serif" font-size="30" font-weight="600" text-anchor="middle">${safe}</text>` +
          `<text x="300" y="514" fill="${accent}" font-family="sans-serif" font-size="18" opacity="0.7" text-anchor="middle">PLAYTESTED</text>` +
          `</svg>`
      )
    );
  }

  window.handleCoverError = function (el) {
    const id = el.dataset.id;
    const hdr = el.dataset.hdr || '';
    if (!el._fallbacks) {
      const isSteam = /^\d+$/.test(String(id || ''));
      el._fallbacks = [
        ...(isSteam ? [`${ST2}${id}/library_600x900.jpg`] : []),
        hdr,
        ...(isSteam ? [`${ST1}${id}/header.jpg`] : []),
      ].filter((u) => u && u !== el.src);
    }
    const next = el._fallbacks.shift();
    if (next) {
      el.src = next;
      return;
    }
    el.onerror = () => {
      el.onerror = null;
      el.src = placeholderSvg(el.dataset.name);
    };
    fetch(`/api/broken/${encodeURIComponent(id)}`, { method: 'POST' })
      .then((r) => r.json())
      .then((j) => {
        if (j && j.cover && j.cover !== el.src) el.src = j.cover;
        else el.onerror();
      })
      .catch(() => el.onerror());
  };

  function coverImg(game, className = '') {
    const isSteam = /^\d+$/.test(String(game.id || ''));
    const src = game.cover || (isSteam ? `${ST1}${game.id}/library_600x900.jpg` : placeholderSvg(game.name));
    return `<img class="${className}" loading="lazy" referrerpolicy="no-referrer" alt="${esc(game.name)} cover" src="${esc(src)}" data-id="${esc(game.id)}" data-name="${esc(game.name)}" data-hdr="${esc(game.hdr || '')}" onerror="handleCoverError(this)" />`;
  }

  function scoreTrioHtml(scores) {
    return `<div class="score-trio">${['pc', 'ps', 'xbox']
      .map((p) => {
        const entry = scores && scores[p];
        const tip = entry
          ? `${PLAT_LABELS[p]} score: ${entry.score}/100 from ${entry.n} verified ${entry.n === 1 ? 'review' : 'reviews'}${entry.avgHours ? ` (avg ${entry.avgHours}h played)` : ''}`
          : `${PLAT_LABELS[p]}: no verified reviews yet`;
        return `<span class="score-pill ${scoreClass(entry && entry.score)}" title="${esc(tip)}">
          <strong>${entry ? entry.score : '–'}</strong>
          <i>${platIcon(p)}</i>
        </span>`;
      })
      .join('')}</div>`;
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3400);
  }

  function connectedPlatforms() {
    if (!state.me?.accounts) return [];
    return ['pc', 'ps', 'xbox'].filter((p) => Boolean(state.me.accounts[p]));
  }

  // ---- Theme Switch ----
  function themeSwitchHtml() {
    const isDark = document.documentElement.dataset.theme !== 'light';
    return `<button type="button" class="theme-toggle" role="switch" aria-checked="${isDark}" aria-label="Toggle dark mode" title="Switch light or dark theme" data-action="toggle-theme">
      <span class="theme-toggle-knob">
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
        </svg>
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
        </svg>
      </span>
    </button>`;
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('playtested_theme', next);
    } catch {}
    $$('.theme-toggle').forEach((btn) => btn.setAttribute('aria-checked', String(next === 'dark')));
  }

  // ---- User Controls ----
  function renderUserControls() {
    const host = $('#user-controls');
    if (state.me) {
      const linked = connectedPlatforms();
      const initial = esc((state.me.name || 'P').trim().charAt(0).toUpperCase());
      const avatarHtml = state.me.avatar
        ? `<img src="${esc(state.me.avatar)}" referrerpolicy="no-referrer" alt="${esc(state.me.name)}" />`
        : `<span class="user-avatar-fallback" aria-hidden="true">${initial}</span>`;
      host.innerHTML = `
        <button type="button" class="user-chip" data-action="open-auth" title="Manage connected Steam, PlayStation, and Xbox accounts">
          ${avatarHtml}
          <span class="user-name">${esc(state.me.name)}</span>
          <span class="user-plat-dots" aria-label="Connected platforms">${linked.map((p) => platIcon(p)).join('')}</span>
        </button>
        ${themeSwitchHtml()}
        <button type="button" class="btn-outline" data-action="confirm-logout">Sign out</button>
      `;
      $('#hero-auth-btn').innerHTML = `Open my libraries <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
      $('#banner-cta-btn').innerHTML = `Manage accounts &amp; rate <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
    } else {
      host.innerHTML = `
        ${themeSwitchHtml()}
        <button type="button" class="btn-primary" data-action="open-auth">Sign in</button>
      `;
      $('#hero-auth-btn').innerHTML = `Sign in to rate games <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
      $('#banner-cta-btn').innerHTML = `Connect gaming accounts <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
    }
  }

  // ---- Navigation Views ----
  function switchView(nextView) {
    state.view = nextView;
    $$('.nav-tab').forEach((tab) => {
      const active = tab.dataset.view === nextView;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-current', active ? 'page' : 'false');
    });
    $('#view-discover').hidden = nextView !== 'discover';
    $('#view-reviews').hidden = nextView !== 'reviews';
    $('#view-library').hidden = nextView !== 'library';

    if (nextView === 'reviews') {
      loadReviewsFeed();
    } else if (nextView === 'library') {
      loadLibraryView();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Stats & Spotlight ----
  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      state.stats = data;
      $('#stat-games').textContent = data.indexed.toLocaleString();
      $('#stat-reviews').textContent = data.totalReviews.toLocaleString();
      $('#stat-hours').textContent = `${formatCompact(data.totalVerifiedHours)}h`;
      const coffeeBtn = $('#coffee-donate-btn');
      if (coffeeBtn) {
        if (data.donateUrl) {
          coffeeBtn.href = data.donateUrl;
          coffeeBtn.dataset.configured = '1';
        } else {
          coffeeBtn.href = '#support';
          coffeeBtn.dataset.configured = '0';
        }
      }
      renderSpotlight(data.spotlight || []);
    } catch (err) {
      console.warn('Could not load stats:', err);
    }
  }

  function renderSpotlight(items) {
    const sec = $('#spotlight-section');
    const q = $('#search-input').value.trim();
    if (!items.length || q) {
      sec.hidden = true;
      return;
    }
    sec.hidden = false;
    $('#spotlight-grid').innerHTML = items
      .map((g) => {
        const plat = g.highlightPlatform || 'pc';
        const score = g.highlightPlatformScore;
        const imgSrc = g.hdr || g.cover || `${ST1}${g.id}/header.jpg`;
        const hl = g.highlight;
        return `<button type="button" class="spotlight-card" data-open-game="${esc(g.id)}">
          <div class="spotlight-media">
            <img loading="lazy" referrerpolicy="no-referrer" src="${esc(imgSrc)}" alt="${esc(g.name)}" data-id="${esc(g.id)}" data-name="${esc(g.name)}" data-hdr="${esc(g.hdr || '')}" onerror="handleCoverError(this)" />
            ${
              score != null
                ? `<span class="spotlight-score-float ${scoreClass(score)}" title="${PLAT_LABELS[plat]} isolated score">${platIcon(plat)} ${score} <small>/ 100</small></span>`
                : ''
            }
          </div>
          <div class="spotlight-body">
            <div class="spotlight-title">${esc(g.name)}</div>
            ${hl ? `<p class="spotlight-quote">“${esc(hl.text)}”</p>` : `<p class="spotlight-quote">${g.reviews} verified player ${g.reviews === 1 ? 'review' : 'reviews'}</p>`}
            <div class="spotlight-author">
              ${hl?.avatar ? `<img src="${esc(hl.avatar)}" referrerpolicy="no-referrer" alt="" />` : ''}
              <span><strong>${esc(hl ? hl.name : g.developer)}</strong></span>
              ${hl ? `<span class="spotlight-hours">${hl.hours}h played</span>` : `<span>${esc(g.date.slice(0, 4))}</span>`}
            </div>
          </div>
        </button>`;
      })
      .join('');
  }

  // ---- Catalog Loading & Rendering ----
  function renderSkeletons(count = 12) {
    $('#game-grid').innerHTML = Array.from({ length: count })
      .map(
        () => `<div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-img"></div>
          <div class="skeleton-lines">
            <div class="skeleton-bar"></div>
            <div class="skeleton-bar short"></div>
          </div>
        </div>`
      )
      .join('');
  }

  function updateActiveFilterPills() {
    const pills = [];
    const q = $('#search-input').value.trim();
    const from = $('#f-from').value.trim();
    const to = $('#f-to').value.trim();
    const dev = $('#f-dev').value.trim();
    const pub = $('#f-pub').value.trim();
    const min = $('#f-min').value.trim();
    const rev = $('#f-reviewed').checked;

    if (q) pills.push({ key: 'q', label: `Search: “${q}”` });
    if (state.platform !== 'all') pills.push({ key: 'platform', label: `Platform: ${PLAT_LABELS[state.platform]}` });
    if (from || to) pills.push({ key: 'year', label: `Year: ${from || 'Any'} – ${to || 'Any'}` });
    if (dev) pills.push({ key: 'dev', label: `Dev: ${dev}` });
    if (pub) pills.push({ key: 'pub', label: `Pub: ${pub}` });
    if (min) pills.push({ key: 'min', label: `Score ≥ ${min}` });
    if (rev) pills.push({ key: 'reviewed', label: 'Reviewed only' });

    const badge = $('#filter-count-badge');
    badge.textContent = String(pills.length);
    badge.hidden = pills.length === 0;

    const host = $('#active-filters');
    if (!pills.length) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    host.innerHTML = pills
      .map(
        (p) => `<span class="filter-pill">${esc(p.label)} <button type="button" data-clear-filter="${p.key}" aria-label="Remove filter">✕</button></span>`
      )
      .join('');
  }

  async function loadCatalog() {
    const id = ++state.reqId;
    const q = $('#search-input').value.trim();
    $('#search-clear').hidden = !q;

    $('#hero-section').hidden = Boolean(q);
    if (state.stats) {
      $('#spotlight-section').hidden = Boolean(q) || !(state.stats.spotlight || []).length;
    }

    updateActiveFilterPills();
    renderSkeletons(Math.min(12, state.size));

    const params = new URLSearchParams({
      platform: state.platform,
      sort: state.sort,
      page: String(state.page),
      size: String(state.size),
    });

    const fieldMap = [
      ['q', '#search-input'],
      ['from', '#f-from'],
      ['to', '#f-to'],
      ['dev', '#f-dev'],
      ['pub', '#f-pub'],
      ['min', '#f-min'],
    ];
    for (const [k, sel] of fieldMap) {
      const val = $(sel).value.trim();
      if (val) params.set(k, val);
    }
    if ($('#f-reviewed').checked) params.set('reviewed', '1');

    try {
      const res = await fetch('/api/games?' + params.toString());
      const data = await res.json();
      if (id !== state.reqId) return;

      state.games = data.items || [];
      state.page = data.page;
      state.pages = data.pages;
      if (typeof data.indexed === 'number') {
        $('#stat-games').textContent = data.indexed.toLocaleString();
      }

      const titleText = q ? `Results for “${q}”` : SORT_TITLES[state.sort] || 'Catalog';
      $('#catalog-title').innerHTML = `${esc(titleText)}<span class="accent-dot">.</span>`;
      $('#catalog-count').textContent =
        `${data.total.toLocaleString()} unique ${data.total === 1 ? 'game' : 'games'} matching · ` +
        `${data.indexed.toLocaleString()}${data.known ? ' of ' + data.known.toLocaleString() : ''} cross-platform titles indexed & deduplicated.`;

      if (!state.games.length) {
        $('#game-grid').innerHTML = `<div class="empty-state">
          <h3>${data.indexed ? 'No games match these filters.' : 'Indexing catalog…'}</h3>
          <p>${
            data.indexed
              ? 'Try widening your year range, clearing developer filters, or searching another title.'
              : 'Playtested is validating covers and deduplicating metadata in the background.'
          }</p>
          ${data.indexed ? '<button type="button" class="btn-outline" id="empty-reset-btn">Reset all filters</button>' : ''}
        </div>`;
        if (!data.indexed) setTimeout(loadCatalog, 5000);
      } else {
        $('#game-grid').innerHTML = state.games
          .map((g) => {
            const year = g.date ? g.date.slice(0, 4) : '—';
            const peakBadge =
              g.trend && g.trend >= 15000
                ? `<span class="card-badge-peak" title="Peak concurrent players this week"><span class="peak-dot"></span>${formatCompact(g.trend)}</span>`
                : '';
            return `<button type="button" class="game-card" data-open-game="${esc(g.id)}">
              <div class="card-cover">
                ${coverImg(g)}
                ${peakBadge}
                <span class="card-hover-cta">Inspect &amp; rate →</span>
              </div>
              <div class="card-body">
                <h3 class="card-title">${esc(g.name)}</h3>
                <div class="card-meta">
                  <span>${esc(year)}</span>
                  <span>${g.reviews} ${g.reviews === 1 ? 'review' : 'reviews'}</span>
                </div>
                ${scoreTrioHtml(g.scores)}
              </div>
            </button>`;
          })
          .join('');
      }

      renderPager();
    } catch (err) {
      if (id !== state.reqId) return;
      $('#game-grid').innerHTML = `<div class="empty-state">
        <h3>Could not load catalog</h3>
        <p>${esc(err.message || 'Check that the Playtested server is running and try again.')}</p>
        <button type="button" class="btn-primary" id="retry-catalog-btn">Retry</button>
      </div>`;
    }
  }

  function renderPager() {
    const pager = $('#pager');
    if (state.pages <= 1) {
      pager.innerHTML = '';
      return;
    }
    pager.innerHTML = `
      <button type="button" class="btn-outline" data-page-delta="-1" ${state.page <= 1 ? 'disabled' : ''}>
        ← Previous
      </button>
      <label class="pager-jump">
        Page
        <input id="page-jump-input" type="number" min="1" max="${state.pages}" value="${state.page}" aria-label="Jump to page number" />
        of ${state.pages.toLocaleString()}
      </label>
      <button type="button" class="btn-outline" data-page-delta="1" ${state.page >= state.pages ? 'disabled' : ''}>
        Next →
      </button>
    `;
  }

  function resetAllFilters() {
    $('#search-input').value = '';
    $('#f-from').value = '';
    $('#f-to').value = '';
    $('#f-dev').value = '';
    $('#f-pub').value = '';
    $('#f-min').value = '';
    $('#f-reviewed').checked = false;
    state.platform = 'all';
    state.sort = 'trend';
    state.page = 1;
    $('#f-sort').value = 'trend';
    syncPlatformChips();
    syncQuickSorts();
    loadCatalog();
  }

  function syncPlatformChips() {
    $$('.platform-chips .chip[data-platform]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.platform === state.platform));
    });
  }

  function syncQuickSorts() {
    $$('.quick-sort[data-sort]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.sort === state.sort);
    });
    $('#f-sort').value = state.sort;
  }

  // ---- Reviews Feed View ----
  async function loadReviewsFeed() {
    const host = $('#reviews-feed-list');
    host.innerHTML = '<p class="section-description">Loading verified player reviews…</p>';
    try {
      const params = new URLSearchParams({ sort: state.revFeedSort, platform: state.revFeedPlat });
      const res = await fetch('/api/reviews?' + params.toString());
      const data = await res.json();
      $('#reviews-feed-count').textContent = `${data.total.toLocaleString()} verified owner ${
        data.total === 1 ? 'review' : 'reviews'
      }${state.revFeedPlat !== 'all' ? ' on ' + PLAT_LABELS[state.revFeedPlat] : ' across Steam, PlayStation, and Xbox'}. Every score is strictly isolated to its platform.`;

      if (!data.items.length) {
        host.innerHTML = `<div class="empty-state">
          <h3>No verified reviews for this platform yet.</h3>
          <p>Connect your Steam, PlayStation, or Xbox account to publish the first verified owner score here.</p>
          <button type="button" class="btn-primary" data-action="open-auth">Connect gaming accounts</button>
        </div>`;
        return;
      }

      host.innerHTML = data.items
        .map((r) => {
          const fakeGame = {
            id: r.gameId,
            name: r.gameName,
            cover: r.gameCover,
            hdr: r.gameHdr,
          };
          return `<article class="feed-card">
            <button type="button" class="feed-game-row" data-open-game="${esc(r.gameId)}">
              ${coverImg(fakeGame)}
              <div class="feed-game-info">
                <h3 class="feed-game-title">${esc(r.gameName)}</h3>
                <div class="feed-game-meta">
                  ${esc(r.gameDeveloper || 'Verified title')}${r.gameYear ? ' · ' + esc(r.gameYear) : ''}
                </div>
              </div>
              <span class="feed-score-badge ${scoreClass(r.score)}" title="${PLAT_LABELS[r.platform] || r.platform} verified score">${r.score}</span>
            </button>
            ${
              r.text
                ? `<p class="feed-review-text">${esc(r.text)}</p>`
                : `<p class="feed-review-text" style="color:var(--muted);font-style:italic;">Score-only verified rating.</p>`
            }
            <div class="feed-review-footer">
              ${r.avatar ? `<img src="${esc(r.avatar)}" referrerpolicy="no-referrer" alt="" />` : ''}
              <strong>${esc(r.name)}</strong>
              ${r.legacy ? `<span class="classic-pill">✦ Classic Era</span>` : `<span class="verified-pill">✓ Verified</span>`}
              <span class="feed-hours" title="${r.legacy ? `Account-verified classic on ${PLAT_LABELS[r.platform] || r.platform}` : `Verified playtime on ${PLAT_LABELS[r.platform] || r.platform}`}">
                ${r.legacy ? esc(r.legacyEra || 'Classic') : `${r.hours}h`} ${platIcon(r.platform)}
              </span>
            </div>
          </article>`;
        })
        .join('');
    } catch (err) {
      host.innerHTML = `<div class="empty-state"><h3>Could not load reviews</h3><p>${esc(err.message)}</p></div>`;
    }
  }

  // ---- Session-Scoped Client Library Cache (avoids re-syncing on every game card) ----
  const CLIENT_LIB_TTL_MS = 6 * 60 * 60 * 1000;

  function libStorageKey(plat) {
    const accId = state.me?.accounts?.[plat]?.id || state.me?.accounts?.[plat]?.name || '';
    return accId ? `pt_lib_v1_${plat}_${accId}` : '';
  }

  function normTitleKey(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[™®©]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function readSessionLibrary(plat) {
    const inMem = state.librariesByPlat[plat];
    if (inMem && Date.now() - (inMem.syncedAt || 0) < CLIENT_LIB_TTL_MS) return inMem;
    const key = libStorageKey(plat);
    if (!key) return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items) || Date.now() - (parsed.syncedAt || 0) >= CLIENT_LIB_TTL_MS) {
        sessionStorage.removeItem(key);
        return null;
      }
      state.librariesByPlat[plat] = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeSessionLibrary(plat, data) {
    if (!data || !Array.isArray(data.items)) return;
    const payload = { ...data, syncedAt: data.syncedAt || Date.now() };
    state.librariesByPlat[plat] = payload;
    const key = libStorageKey(plat);
    if (key) {
      try {
        sessionStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // Ignore sessionStorage quota overflow; in-memory state.librariesByPlat still holds it for the tab
      }
    }
  }

  function clearSessionLibraryCache(plat = null) {
    const targets = plat ? [plat] : ['pc', 'ps', 'xbox'];
    for (const p of targets) {
      state.librariesByPlat[p] = null;
      delete state.libraryPromises[p];
    }
    state.eligibilityCache = {};
    if (!plat || state.libPlatform === plat) state.library = null;
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (!k || !k.startsWith('pt_lib_v1_')) continue;
        if (!plat || k.startsWith(`pt_lib_v1_${plat}_`)) sessionStorage.removeItem(k);
      }
    } catch {}
  }

  async function ensurePlatformLibrary(plat, { forceRefresh = false } = {}) {
    if (!state.me?.accounts?.[plat]) return null;
    if (!forceRefresh) {
      const cached = readSessionLibrary(plat);
      if (cached) return cached;
      if (state.libraryPromises[plat]) return state.libraryPromises[plat];
    }
    const req = (async () => {
      const url = `/api/library?platform=${encodeURIComponent(plat)}${forceRefresh ? '&refresh=1' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not sync library.');
      writeSessionLibrary(plat, data);
      if (forceRefresh) state.eligibilityCache = {};
      return state.librariesByPlat[plat];
    })().finally(() => {
      if (state.libraryPromises[plat] === req) delete state.libraryPromises[plat];
    });
    state.libraryPromises[plat] = req;
    return req;
  }

  function prewarmConnectedLibraries() {
    const linked = connectedPlatforms();
    for (const p of linked) {
      if (!readSessionLibrary(p)) {
        ensurePlatformLibrary(p).catch(() => {});
      }
    }
  }

  function syncLocalLibraryReviewState(gameId, plat, scoreOrNull) {
    const cached = readSessionLibrary(plat);
    if (!cached || !Array.isArray(cached.items)) return;
    let touched = false;
    for (const item of cached.items) {
      if (String(item.id) === String(gameId) || String(item.externalId) === String(gameId)) {
        item.reviewed = scoreOrNull !== null;
        item.myScore = scoreOrNull;
        touched = true;
      }
    }
    if (touched) writeSessionLibrary(plat, cached);
  }

  function syncLocalLibraryEligibility(gameId, eligData) {
    if (!eligData) return;
    for (const plat of ['pc', 'ps', 'xbox']) {
      const info = eligData[plat];
      if (!info || !info.owned) continue;
      const cached = readSessionLibrary(plat);
      if (!cached || !Array.isArray(cached.items)) continue;
      let touched = false;
      for (const item of cached.items) {
        if (String(item.id) === String(gameId) || String(item.externalId) === String(gameId)) {
          if (typeof info.minHours === 'number' && info.minHours !== item.minHours) {
            item.minHours = info.minHours;
            touched = true;
          }
          if (info.eligible && !item.eligible) {
            item.eligible = true;
            touched = true;
          }
        }
      }
      if (touched) writeSessionLibrary(plat, cached);
    }
  }

  function formatSyncAge(ts) {
    if (!ts) return '';
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (mins < 1) return 'Synced just now';
    if (mins < 60) return `Synced ${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return `Synced ${hrs}h ago`;
  }

  function deriveInstantEligibilityFromCache(game) {
    const gameId = String(game.id);
    if (state.eligibilityCache[gameId]) return state.eligibilityCache[gameId];
    const linked = connectedPlatforms();
    if (!linked.length) return null;
    const gamePlats = (game.platforms && game.platforms.length) ? game.platforms : ['pc'];
    const targetNorm = normTitleKey(game.name);
    const out = {};
    let hasAnyCachedPlat = false;

    for (const p of ['pc', 'ps', 'xbox']) {
      if (!gamePlats.includes(p)) {
        out[p] = { released: false, connected: linked.includes(p), legacy: false, owned: false, eligible: false, hours: 0, minHours: 2 };
        continue;
      }
      if (!linked.includes(p)) {
        out[p] = { released: true, connected: false, legacy: false, owned: false, eligible: false, hours: 0, minHours: 2 };
        continue;
      }
      const lib = readSessionLibrary(p);
      if (!lib) continue;
      hasAnyCachedPlat = true;
      const hit = (lib.items || []).find(
        (it) =>
          String(it.id) === gameId ||
          String(it.externalId) === gameId ||
          (targetNorm && normTitleKey(it.name) === targetNorm)
      );
      if (hit) {
        out[p] = {
          released: true,
          connected: true,
          legacy: false,
          owned: true,
          eligible: Boolean(hit.eligible),
          hours: Number(hit.hours) || 0,
          minHours: typeof hit.minHours === 'number' ? hit.minHours : lib.minHours || 2,
          syncedAt: lib.syncedAt,
        };
      } else {
        out[p] = {
          released: true,
          connected: true,
          legacy: false,
          owned: false,
          eligible: false,
          hours: 0,
          minHours: lib.minHours || 2,
          syncedAt: lib.syncedAt,
        };
      }
    }
    return hasAnyCachedPlat ? out : null;
  }

  // ---- Multi-Platform My Library View ----
  async function loadLibraryView({ forceRefresh = false } = {}) {
    const host = $('#library-container');
    const linked = connectedPlatforms();
    if (!linked.length) {
      host.innerHTML = `<div class="library-auth-card">
        <h3>Connect your gaming accounts</h3>
        <p>
          Link Steam, PlayStation, or Xbox so Playtested can verify which games you own and your real playtime
          (2h+ required per platform). Each platform’s reviews stay strictly isolated to its own score.
        </p>
        <div class="provider-stack">
          <a class="provider-btn-outline" href="/auth/steam">${platIcon('pc')} Connect Steam</a>
          <button type="button" class="provider-btn-outline" data-action="open-psn-connect">${platIcon('ps')} Connect PlayStation Network</button>
          <button type="button" class="provider-btn-outline" data-action="open-xbox-connect">${platIcon('xbox')} Connect Xbox Live</button>
        </div>
        <div class="provider-note">
          <strong>Privacy tip:</strong> Make sure your game library / gaming history privacy is set to <strong>Public / Anyone</strong> on your platform so Playtested can verify ownership and hours played.
        </div>
      </div>`;
      return;
    }

    if (!linked.includes(state.libPlatform)) {
      state.libPlatform = linked[0];
    }

    if (!forceRefresh) {
      const cached = readSessionLibrary(state.libPlatform);
      if (cached) {
        state.library = cached;
        renderLibraryList(linked);
        return;
      }
    }

    host.innerHTML = `<p class="section-description">Syncing your ${PLAT_LABELS[state.libPlatform]} library…</p>`;
    try {
      const data = await ensurePlatformLibrary(state.libPlatform, { forceRefresh });
      state.library = data;
      renderLibraryList(linked);
      if (forceRefresh) showToast(`${PLAT_LABELS[state.libPlatform]} library refreshed!`);
    } catch (err) {
      host.innerHTML = `
        ${renderLibraryPlatformTabs(linked)}
        <div class="empty-state">
          <h3>Could not read your ${PLAT_LABELS[state.libPlatform]} library</h3>
          <p>${esc(err.message || 'Check your platform privacy settings and try again.')}</p>
          <button type="button" class="btn-primary" id="retry-lib-btn">Try again</button>
        </div>`;
    }
  }

  function renderLibraryPlatformTabs(linked) {
    const syncAge = formatSyncAge(state.library?.syncedAt);
    return `<div class="library-plat-tabs" role="tablist" aria-label="Select connected platform library">
      ${['pc', 'ps', 'xbox']
        .map((p) => {
          const isLinked = linked.includes(p);
          if (isLinked) {
            return `<button type="button" class="library-plat-tab ${state.libPlatform === p ? 'is-active' : ''}" data-switch-lib-plat="${p}">
              ${platIcon(p)} ${PLAT_LABELS[p]}
            </button>`;
          }
          return `<button type="button" class="library-plat-tab" data-action="open-auth" style="opacity:0.65;">
            ${platIcon(p)} + Link ${PLAT_LABELS[p]}
          </button>`;
        })
        .join('')}
      <div class="library-sync-meta">
        ${syncAge ? `<span class="library-sync-age">${esc(syncAge)}</span>` : ''}
        <button type="button" class="btn-refresh-lib" id="refresh-lib-btn" title="Re-fetch your latest games and playtime">
          ↻ Refresh library
        </button>
      </div>
    </div>`;
  }

  function renderLibraryList(linked = connectedPlatforms()) {
    const host = $('#library-container');
    const data = state.library;
    if (!data) return;
    const items = data.items || [];
    const totalHours = Math.round(items.reduce((acc, x) => acc + (x.hours || 0), 0));
    const eligibleCount = items.filter((x) => x.eligible).length;
    const reviewedCount = items.filter((x) => x.reviewed).length;
    const platName = PLAT_LABELS[state.libPlatform] || 'Platform';

    const q = state.libQuery.toLowerCase().trim();
    const visible = items.filter((x) => {
      if (q && !x.name.toLowerCase().includes(q)) return false;
      if (state.libFilter === 'eligible') return x.eligible && !x.reviewed;
      if (state.libFilter === 'reviewed') return x.reviewed;
      if (state.libFilter === 'locked') return !x.eligible;
      return true;
    });

    host.innerHTML = `
      ${renderLibraryPlatformTabs(linked)}
      <div class="library-summary">
        <div class="lib-stat-card"><strong>${items.length.toLocaleString()}</strong><span>${platName} games</span></div>
        <div class="lib-stat-card"><strong>${totalHours.toLocaleString()}h</strong><span>Total ${platName} playtime</span></div>
        <div class="lib-stat-card"><strong>${eligibleCount.toLocaleString()}</strong><span>Eligible (${data.minHours}h+)</span></div>
        <div class="lib-stat-card"><strong>${reviewedCount.toLocaleString()}</strong><span>Reviewed on ${platName}</span></div>
      </div>
      <div class="library-controls">
        <input id="lib-search-input" class="library-search" type="search" placeholder="Filter your ${items.length} ${platName} games…" value="${esc(state.libQuery)}" />
        <div class="quick-sorts" style="display:inline-flex">
          ${[
            ['all', 'All'],
            ['eligible', `Ready to rate (${eligibleCount - reviewedCount})`],
            ['reviewed', `Reviewed (${reviewedCount})`],
            ['locked', `Under ${data.minHours}h`],
          ]
            .map(
              ([k, lbl]) =>
                `<button type="button" class="quick-sort ${state.libFilter === k ? 'is-active' : ''}" data-lib-filter="${k}">${lbl}</button>`
            )
            .join('')}
        </div>
      </div>
      <div class="library-grid">
        ${
          visible.length
            ? visible
                .slice(0, 150)
                .map((x) => {
                  const reqHours = typeof x.minHours === 'number' ? x.minHours : data.minHours;
                  const tag = x.reviewed
                    ? `<span class="lib-tag reviewed">Rated · ${x.myScore}</span>`
                    : x.eligible
                      ? `<span class="lib-tag eligible">Rate on ${platName}</span>`
                      : `<span class="lib-tag locked">Need ${Math.max(0.1, reqHours - x.hours).toFixed(1)}h</span>`;
                  return `<button type="button" class="library-row" data-open-lib-game="${esc(x.id)}">
                    ${coverImg(x)}
                    <div class="library-row-info">
                      <div class="library-row-name">${esc(x.name)}</div>
                      <div class="library-row-sub">${x.hours}h played on ${platName}</div>
                    </div>
                    ${tag}
                  </button>`;
                })
                .join('')
            : `<div class="empty-state"><h3>No matching games in your ${platName} library</h3><p>Try clearing your filter or search query.</p></div>`
        }
      </div>
    `;
  }

  function openLogoutConfirmModal() {
    const dlg = $('#confirm-modal');
    if (!dlg) {
      window.location.href = '/auth/logout';
      return;
    }
    const linked = connectedPlatforms().map((p) => PLAT_LABELS[p]);
    const listText = linked.length
      ? `your ${linked.join(', ')} session`
      : 'your Playtested session';

    dlg.innerHTML = `<div class="modal-scroll"><div class="confirm-modal-body">
      <button type="button" class="modal-close-btn" data-close-modal="confirm-modal" aria-label="Close">✕</button>
      <div class="eyebrow" style="margin-bottom:8px;"><span class="eyebrow-dot"></span>ACCOUNT SESSION</div>
      <h2>Sign out of Playtested<span class="accent-dot">?</span></h2>
      <p class="confirm-modal-desc">
        This will end ${esc(listText)} on this device. All your published verified reviews will stay saved.
      </p>
      <div class="confirm-modal-actions">
        <button type="button" class="btn-outline" data-close-modal="confirm-modal" id="confirm-logout-cancel">Cancel</button>
        <a class="btn-danger" href="/auth/logout" id="confirm-logout-proceed">Sign out</a>
      </div>
    </div></div>`;

    if (!dlg.open) dlg.showModal();
    const cancelBtn = $('#confirm-logout-cancel');
    if (cancelBtn) cancelBtn.focus();
  }

  // ---- Multi-Platform Auth & Linking Modal ----
  function openAuthModal(expandTarget = null) {
    if (expandTarget === true || expandTarget === 'ps') state.psnPanelOpen = true;
    if (expandTarget === 'xbox') state.xboxPanelOpen = true;
    const providers = state.stats?.providers || {
      pc: { configured: false, openIdReady: true },
      xbox: { configured: false, bioChallengeReady: false },
      ps: { bioChallengeReady: false, directNpssoReady: true },
    };
    if (!providers.ps.bioChallengeReady) {
      state.psnMode = 'direct';
    }
    renderAuthModal();
    const dlg = $('#auth-modal');
    if (!dlg.open) dlg.showModal();
  }

  function renderAuthModal() {
    const dlg = $('#auth-modal');
    const acc = state.me?.accounts || { pc: null, ps: null, xbox: null };
    const providers = state.stats?.providers || {
      pc: { configured: false },
      xbox: { configured: false },
      ps: { bioChallengeReady: false, directNpssoReady: true },
    };

    const psnSection = acc.ps
      ? `<div class="provider-row">
          <span class="provider-logo">${platIcon('ps')}</span>
          <div class="provider-meta">
            <strong>PlayStation Network</strong>
            <span>${esc(acc.ps.name)}</span>
          </div>
          <div class="provider-actions">
            <span class="provider-connected-btn">✓ Connected</span>
            <button type="button" class="provider-unlink-btn" data-unlink-plat="ps" title="Disconnect PlayStation">Unlink</button>
          </div>
        </div>`
      : `<div class="provider-row">
          <span class="provider-logo">${platIcon('ps')}</span>
          <div class="provider-meta">
            <strong>PlayStation Network</strong>
            <span>Read-only library check · token stays in server RAM only</span>
          </div>
          <button type="button" class="provider-connect-btn" data-toggle-psn>${state.psnPanelOpen ? 'Cancel' : 'Connect'}</button>
        </div>
        ${
          state.psnPanelOpen
            ? `<div class="psn-panel">
                <div class="psn-tabs">
                  ${
                    providers.ps.bioChallengeReady
                      ? `<button type="button" class="psn-tab ${state.psnMode === 'bio' ? 'is-active' : ''}" data-psn-mode="bio">Profile Bio Code</button>`
                      : ''
                  }
                  <button type="button" class="psn-tab ${state.psnMode === 'direct' ? 'is-active' : ''}" data-psn-mode="direct">Official PSN NPSSO</button>
                </div>
                ${
                  state.psnMode === 'bio' && providers.ps.bioChallengeReady
                    ? `
                      <div style="display:flex;gap:8px;">
                        <input id="psn-online-id" type="text" placeholder="Your PSN Online ID" value="${esc(state.psnChallenge?.onlineId || '')}" />
                        <button type="button" class="btn-outline" id="psn-gen-code-btn">Get code</button>
                      </div>
                      ${
                        state.psnChallenge
                          ? `<div class="psn-code-box">
                              Put <code>${esc(state.psnChallenge.code)}</code> in your PlayStation <strong>About Me</strong> bio, save it, then click verify below (you can remove it right after).
                            </div>
                            <button type="button" class="btn-primary provider-btn" id="psn-verify-bio-btn">${platIcon('ps')} Verify PlayStation Account</button>`
                          : ''
                      }
                    `
                    : `
                      <p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;">
                        1. Sign in at <a href="https://www.playstation.com" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">playstation.com</a>.<br>
                        2. Open <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">Sony's SSO cookie page</a> and copy the <code>npsso</code> value.<br>
                        3. Paste it below — used in RAM only to read your game list &amp; playtime, never saved to disk.
                      </p>
                      <input id="psn-npsso-input" type="password" placeholder="Paste 64-character npsso value…" autocomplete="off" />
                      <button type="button" class="btn-primary provider-btn" id="psn-verify-direct-btn">${platIcon('ps')} Verify PlayStation Library</button>
                    `
                }
                <div id="psn-status" class="form-status" role="status"></div>
              </div>`
            : ''
        }`;

    dlg.innerHTML = `<div class="modal-scroll"><div class="auth-modal-body">
      <button type="button" class="modal-close-btn" data-close-modal="auth-modal" aria-label="Close">✕</button>
      <div class="eyebrow" style="margin-bottom:10px;">VERIFIED PLAYER ACCOUNTS</div>
      <h2>Connect your platforms<span class="accent-dot">.</span></h2>
      <p class="auth-modal-desc">
        Link Steam, PlayStation, or Xbox to prove ownership and 2h+ verified playtime.
        Every verified owner counts equally and platform scores are never mixed.
      </p>

      <div class="trust-callout">
        <strong>How your account stays safe (100% read-only):</strong>
        <ul>
          <li><strong>No passwords ever:</strong> Steam signs in directly on <code>steamcommunity.com</code> via official OpenID; Xbox uses a public Gamertag bio code.</li>
          <li><strong>No stored auth tokens:</strong> Temporary PSN/OAuth tokens stay in server RAM only and are never written to disk or database.</li>
          <li><strong>Publicly auditable:</strong> <a href="https://github.com/joaodestro7/playtested/blob/main/lib/platforms.js" target="_blank" rel="noopener noreferrer">Inspect exact auth code (lib/platforms.js) ↗</a></li>
        </ul>
      </div>

      <div class="provider-stack">
        <!-- STEAM -->
        <div class="provider-card ${acc.pc ? 'is-connected' : ''}">
          <div class="provider-row">
            <span class="provider-logo">${platIcon('pc')}</span>
            <div class="provider-meta">
              <strong>Steam (PC)</strong>
              <span>${acc.pc ? esc(acc.pc.name) : 'Official OpenID redirect on steamcommunity.com · no password shared'}</span>
            </div>
            ${
              acc.pc
                ? `<div class="provider-actions">
                    <span class="provider-connected-btn">✓ Connected</span>
                    <button type="button" class="provider-unlink-btn" data-unlink-plat="pc" title="Disconnect Steam">Unlink</button>
                  </div>`
                : `<a class="provider-connect-btn" href="/auth/steam">Connect</a>`
            }
          </div>
        </div>

        <!-- PLAYSTATION -->
        <div class="provider-card ${acc.ps ? 'is-connected' : ''}">
          ${psnSection}
        </div>

        <!-- XBOX -->
        <div class="provider-card ${acc.xbox ? 'is-connected' : ''}">
          <div class="provider-row">
            <span class="provider-logo">${platIcon('xbox')}</span>
            <div class="provider-meta">
              <strong>Xbox Live</strong>
              <span>${acc.xbox ? esc(acc.xbox.name) : 'Public Gamertag bio code · zero login credentials entered here'}</span>
            </div>
            ${
              acc.xbox
                ? `<div class="provider-actions">
                    <span class="provider-connected-btn">✓ Connected</span>
                    <button type="button" class="provider-unlink-btn" data-unlink-plat="xbox" title="Disconnect Xbox">Unlink</button>
                  </div>`
                : providers.xbox.configured
                  ? `<a class="provider-connect-btn" href="/auth/xbox">Connect</a>`
                  : providers.xbox.bioChallengeReady
                    ? `<button type="button" class="provider-connect-btn" data-toggle-xbox>${state.xboxPanelOpen ? 'Cancel' : 'Connect'}</button>`
                    : `<a class="provider-connect-btn" href="/auth/xbox">Connect</a>`
            }
          </div>
          ${
            !acc.xbox && providers.xbox.bioChallengeReady && !providers.xbox.configured && state.xboxPanelOpen
              ? `<div class="psn-panel">
                  <div style="display:flex;gap:8px;">
                    <input id="xbox-gamertag-input" type="text" placeholder="Your Xbox Gamertag" value="${esc(state.xboxChallenge?.gamertag || '')}" />
                    <button type="button" class="btn-outline" id="xbox-gen-code-btn">Get code</button>
                  </div>
                  ${
                    state.xboxChallenge
                      ? `<div class="psn-code-box">
                          Put <code>${esc(state.xboxChallenge.code)}</code> in your Xbox Profile <strong>Bio</strong>, save it, then click verify below (you can remove it right after).
                        </div>
                        <button type="button" class="btn-primary provider-btn" id="xbox-verify-bio-btn">${platIcon('xbox')} Verify Xbox Account</button>`
                      : ''
                  }
                  <div id="xbox-status" class="form-status" role="status"></div>
                </div>`
              : ''
          }
        </div>
      </div>

      <div class="provider-note">
        <strong>Publicly Auditable &amp; Read-Only:</strong> Playtested never asks for your passwords and never writes to
        your gaming accounts. Ensure your library/gaming history privacy is set to <strong>Public</strong> on Steam,
        PlayStation, or Xbox so ownership and playtime can be verified.
      </div>
    </div></div>`;

    bindPsnAuthEvents();
  }

  function bindPsnAuthEvents() {
    const genBtn = $('#psn-gen-code-btn');
    const verifyBioBtn = $('#psn-verify-bio-btn');
    const verifyDirectBtn = $('#psn-verify-direct-btn');
    const status = $('#psn-status');

    if (genBtn) {
      genBtn.onclick = async () => {
        const onlineId = ($('#psn-online-id')?.value || '').trim();
        status.className = 'form-status';
        status.textContent = 'Generating challenge code…';
        try {
          const res = await fetch('/auth/psn/challenge', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ onlineId }),
          });
          const data = await res.json();
          if (!res.ok) {
            status.className = 'form-status err';
            status.textContent = data.error || 'Could not generate code.';
            return;
          }
          state.psnChallenge = data;
          renderAuthModal();
        } catch (err) {
          status.className = 'form-status err';
          status.textContent = err.message;
        }
      };
    }

    if (verifyBioBtn) {
      verifyBioBtn.onclick = async () => {
        verifyBioBtn.disabled = true;
        status.className = 'form-status';
        status.textContent = 'Checking your PlayStation profile bio…';
        try {
          const res = await fetch('/auth/psn/verify', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) {
            status.className = 'form-status err';
            status.textContent = data.error || 'Verification failed.';
            verifyBioBtn.disabled = false;
            return;
          }
          trackMarketingEvent('connect', 'ps');
          await refreshSessionAfterAuth('PlayStation Network connected!');
        } catch (err) {
          status.className = 'form-status err';
          status.textContent = err.message;
          verifyBioBtn.disabled = false;
        }
      };
    }

    if (verifyDirectBtn) {
      verifyDirectBtn.onclick = async () => {
        const npsso = ($('#psn-npsso-input')?.value || '').trim();
        verifyDirectBtn.disabled = true;
        status.className = 'form-status';
        status.textContent = 'Verifying PlayStation account…';
        try {
          const res = await fetch('/auth/psn/direct', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ npsso }),
          });
          const data = await res.json();
          if (!res.ok) {
            status.className = 'form-status err';
            status.textContent = data.error || 'Could not verify NPSSO token.';
            verifyDirectBtn.disabled = false;
            return;
          }
          trackMarketingEvent('connect', 'ps');
          await refreshSessionAfterAuth('PlayStation Network connected!');
        } catch (err) {
          status.className = 'form-status err';
          status.textContent = err.message;
          verifyDirectBtn.disabled = false;
        }
      };
    }

    const xboxGenBtn = $('#xbox-gen-code-btn');
    const xboxVerifyBtn = $('#xbox-verify-bio-btn');
    const xboxStatus = $('#xbox-status');
    if (xboxGenBtn) {
      xboxGenBtn.onclick = async () => {
        const gamertag = ($('#xbox-gamertag-input')?.value || '').trim();
        xboxStatus.className = 'form-status';
        xboxStatus.textContent = 'Generating challenge code…';
        try {
          const res = await fetch('/auth/xbox/challenge', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ gamertag }),
          });
          const data = await res.json();
          if (!res.ok) {
            xboxStatus.className = 'form-status err';
            xboxStatus.textContent = data.error || 'Could not generate code.';
            return;
          }
          state.xboxChallenge = data;
          renderAuthModal();
        } catch (err) {
          xboxStatus.className = 'form-status err';
          xboxStatus.textContent = err.message;
        }
      };
    }
    if (xboxVerifyBtn) {
      xboxVerifyBtn.onclick = async () => {
        xboxVerifyBtn.disabled = true;
        xboxStatus.className = 'form-status';
        xboxStatus.textContent = 'Checking your Xbox profile bio…';
        try {
          const res = await fetch('/auth/xbox/verify', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) {
            xboxStatus.className = 'form-status err';
            xboxStatus.textContent = data.error || 'Verification failed.';
            xboxVerifyBtn.disabled = false;
            return;
          }
          state.xboxChallenge = null;
          state.xboxPanelOpen = false;
          trackMarketingEvent('connect', 'xbox');
          await refreshSessionAfterAuth('Xbox Live connected!');
        } catch (err) {
          xboxStatus.className = 'form-status err';
          xboxStatus.textContent = err.message;
          xboxVerifyBtn.disabled = false;
        }
      };
    }
  }

  async function refreshSessionAfterAuth(toastMsg) {
    try {
      state.me = await (await fetch('/api/me')).json();
    } catch {
      state.me = null;
    }
    state.psnChallenge = null;
    state.psnPanelOpen = false;
    renderUserControls();
    renderAuthModal();
    showToast(toastMsg);
    prewarmConnectedLibraries();
    if (state.view === 'library') {
      loadLibraryView();
    }
    if (state.currentModalGame && $('#game-modal').open) {
      openGameModal(state.currentModalGame.id, state.currentModalGame);
    }
  }

  // ---- Game Detail & Strictly Isolated Per-Platform Review Modal ----
  async function openGameModal(gameId, fallbackObj = null, preferredPlatform = null) {
    const dlg = $('#game-modal');
    const cached =
      state.games.find((g) => String(g.id) === String(gameId)) ||
      (state.stats?.spotlight || []).find((g) => String(g.id) === String(gameId)) ||
      fallbackObj ||
      { id: String(gameId), name: `Game #${gameId}`, date: null, platforms: ['pc'], scores: {} };

    state.currentModalGame = cached;
    state.currentModalPayload = null;
    state.modalReviewSort = 'recent';
    state.modalEligibility = deriveInstantEligibilityFromCache(cached);

    const linked = connectedPlatforms();
    const gamePlats = (cached.platforms && cached.platforms.length) ? cached.platforms : ['pc'];
    state.modalRatePlatform =
      (preferredPlatform && gamePlats.includes(preferredPlatform) ? preferredPlatform : null) ||
      linked.find((p) => gamePlats.includes(p)) ||
      gamePlats[0];

    renderGameModalShell(cached, null);
    if (!dlg.open) dlg.showModal();

    try {
      const targetId = String(gameId);
      const cachedElig = state.eligibilityCache[targetId];
      const reviewsPromise = fetch(`/api/reviews/${encodeURIComponent(targetId)}`).then((r) => r.json());
      const eligPromise =
        linked.length && !cachedElig
          ? fetch(`/api/eligibility/${encodeURIComponent(targetId)}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(cachedElig || null);

      const [data, eligData] = await Promise.all([reviewsPromise, eligPromise]);
      const game = data.game || cached;
      state.currentModalGame = game;
      state.currentModalPayload = data;

      const resolvedPlats = (game.platforms && game.platforms.length) ? game.platforms : ['pc'];
      if (!resolvedPlats.includes(state.modalRatePlatform)) {
        state.modalRatePlatform = linked.find((p) => resolvedPlats.includes(p)) || resolvedPlats[0];
      }

      if (eligData) {
        state.modalEligibility = eligData;
        state.eligibilityCache[String(game.id)] = eligData;
        state.eligibilityCache[targetId] = eligData;
        syncLocalLibraryEligibility(game.id, eligData);
      }

      renderGameModalShell(game, data);
    } catch (err) {
      const revBox = $('#modal-reviews-list');
      if (revBox) revBox.innerHTML = `<p class="section-description">Could not load reviews: ${esc(err.message)}</p>`;
    }
  }

  async function refreshModalEligibility() {
    const game = state.currentModalGame;
    const plat = state.modalRatePlatform;
    if (!game || !plat) return;
    const pill = $('#modal-eligibility');
    const btn = $('#modal-refresh-lib-btn');
    if (pill) {
      pill.className = 'eligibility-pill muted';
      pill.textContent = `Refreshing your ${PLAT_LABELS[plat]} library…`;
    }
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(
        `/api/eligibility/${encodeURIComponent(game.id)}?refresh=1&platform=${encodeURIComponent(plat)}`
      );
      if (res.ok) {
        const fresh = await res.json();
        state.modalEligibility = fresh;
        state.eligibilityCache = { [String(game.id)]: fresh };
        syncLocalLibraryEligibility(game.id, fresh);
        // Also refresh client-side library snapshot in background so My Library reflects latest hours
        ensurePlatformLibrary(plat, { forceRefresh: true }).catch(() => {});
        updateModalEligibilityBadge();
        showToast(`${PLAT_LABELS[plat]} library refreshed!`);
      }
    } catch {
      showToast('Could not refresh library right now.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function updateModalEligibilityBadge() {
    const pill = $('#modal-eligibility');
    const submitBtn = $('#submit-review-btn');
    const statusEl = $('#review-form-status');
    if (!pill || !state.modalEligibility) return;
    const p = state.modalRatePlatform;
    const info = state.modalEligibility[p];
    if (!info) return;

    const refreshHtml = ` <button type="button" class="inline-refresh-link" id="modal-refresh-lib-btn">↻ Refresh ${esc(PLAT_LABELS[p])} library</button>`;

    if (info.released === false) {
      pill.className = 'eligibility-pill err';
      pill.textContent = `Not released on ${PLAT_LABELS[p]}`;
      if (submitBtn) submitBtn.disabled = true;
    } else if (!info.connected) {
      pill.className = 'eligibility-pill muted';
      pill.textContent = `Connect ${PLAT_LABELS[p]} to rate`;
      if (submitBtn) submitBtn.disabled = true;
    } else if (info.legacy) {
      pill.className = 'eligibility-pill classic';
      pill.textContent = `✦ Classic Era (${info.legacyEra || 'Legacy'}) · Account verified`;
      if (submitBtn) submitBtn.disabled = false;
    } else if (info.error) {
      pill.className = 'eligibility-pill warn';
      pill.textContent = 'Library check unavailable';
      if (statusEl) {
        statusEl.className = 'form-status err';
        statusEl.innerHTML = `${esc(info.error)}${refreshHtml}`;
      }
      if (submitBtn) submitBtn.disabled = true;
    } else if (!info.owned) {
      pill.className = 'eligibility-pill err';
      pill.textContent = `Not in your ${PLAT_LABELS[p]} library`;
      if (statusEl) {
        statusEl.className = 'form-status err';
        const msg = `You must own this game on ${PLAT_LABELS[p]} (with ${info.minHours}h+ played) to review it.`;
        statusEl.innerHTML = `${esc(msg)}${refreshHtml}`;
      }
      if (submitBtn) submitBtn.disabled = true;
    } else if (!info.eligible) {
      pill.className = 'eligibility-pill warn';
      pill.textContent = `${info.hours}h played · Need ${info.minHours}h+`;
      if (statusEl) {
        statusEl.className = 'form-status err';
        const msg = `Play at least ${Math.max(0.1, info.minHours - info.hours).toFixed(1)}h more on ${PLAT_LABELS[p]} to unlock reviewing.`;
        statusEl.innerHTML = `${esc(msg)}${refreshHtml}`;
      }
      if (submitBtn) submitBtn.disabled = true;
    } else {
      pill.className = 'eligibility-pill ok';
      pill.textContent = `✓ Verified ${PLAT_LABELS[p]} owner · ${info.hours}h played`;
      if (statusEl && statusEl.classList.contains('err')) {
        statusEl.className = 'form-status';
        statusEl.textContent = '';
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function renderGameModalShell(g, payload = null) {
    const dlg = $('#game-modal');
    const scores = payload?.scores || g.scores || { pc: null, ps: null, xbox: null };
    const stats = payload?.stats || { totalReviews: 0, spike: false };
    const gamePlats = (g.platforms && g.platforms.length) ? g.platforms : ['pc'];
    const activePlat = gamePlats.includes(state.modalRatePlatform) ? state.modalRatePlatform : gamePlats[0];
    state.modalRatePlatform = activePlat;
    const legacyInfo = payload?.legacy?.[activePlat] || { legacy: false, era: '', reason: '' };
    const myReview = payload?.myReviews?.[activePlat] || null;
    const linked = connectedPlatforms();
    const isPlatConnected = linked.includes(activePlat);
    const year = g.date ? g.date.slice(0, 4) : 'Unknown';
    const initialScore = myReview ? myReview.score : 80;
    const initialText = myReview ? myReview.text : '';
    const backdropUrl = g.hdr || g.cover || '';

    dlg.innerHTML = `<div class="modal-scroll">
      <button type="button" class="modal-close-btn" data-close-modal="game-modal" aria-label="Close">✕</button>
      <div class="game-modal-hero">
        ${backdropUrl ? `<div class="game-modal-backdrop-img" style="background-image:url('${esc(backdropUrl)}')"></div>` : ''}
        <div class="game-modal-head">
          ${coverImg(g, 'game-modal-poster')}
          <div class="game-modal-meta">
            <div class="eyebrow" style="margin-bottom:8px;gap:10px;">
              ${gamePlats
                .map((p) => `<span style="display:inline-flex;align-items:center;gap:5px;">${platIcon(p)} ${PLAT_LABELS[p]}</span>`)
                .join('')}
            </div>
            <h2>${esc(g.name)}</h2>
            <div class="meta-list">
              ${g.developer ? `<span>Developer: <strong>${esc(g.developer)}</strong></span>` : ''}
              ${g.publisher ? `<span>Publisher: <strong>${esc(g.publisher)}</strong></span>` : ''}
              ${g.generations && g.generations.length ? `<span>Systems: <strong>${esc(g.generations.join(' · '))}</strong></span>` : ''}
              <span>Released: <strong>${esc(year)}</strong>${g.trend >= 1000 ? ` · <strong>${formatCompact(g.trend)}</strong> peak players this week` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="game-modal-body">
        <div class="modal-scores-grid">
          ${['pc', 'ps', 'xbox']
            .map((p) => {
              const releasedHere = gamePlats.includes(p);
              const s = scores[p];
              const subText = !releasedHere
                ? `Not released on ${PLAT_LABELS[p]}`
                : s
                  ? s.legacyOnly
                    ? `${s.n} ${s.n === 1 ? 'review' : 'reviews'} · Classic era`
                    : `${s.n} ${s.n === 1 ? 'review' : 'reviews'}${s.avgHours ? ` · avg ${s.avgHours}h` : ''}`
                  : 'No verified reviews';
              return `<div class="modal-score-card ${scoreClass(s && s.score)} ${releasedHere ? '' : 'is-unreleased'}">
                <div class="modal-score-top">
                  <span>${PLAT_LABELS[p]}</span>
                  ${platIcon(p)}
                </div>
                <div class="modal-score-val">${s ? s.score : '–'}</div>
                <div class="modal-score-sub">${subText}</div>
              </div>`;
            })
            .join('')}
        </div>

        ${(() => {
          const activeSc = scores[activePlat];
          if (!activeSc || !activeSc.n) return '';
          const d = activeSc.dist || { hi: 0, mid: 0, lo: 0 };
          const hiPct = Math.round((d.hi / activeSc.n) * 100);
          const midPct = Math.round((d.mid / activeSc.n) * 100);
          const loPct = Math.max(0, 100 - hiPct - midPct);
          const hoursMeta = activeSc.legacyOnly
            ? 'Classic Era · account verified'
            : `Median ${activeSc.medianHours || activeSc.avgHours || 0}h · Avg ${activeSc.avgHours || 0}h played`;
          return `<div class="score-breakdown-box">
            <div class="score-breakdown-head">
              <strong>${PLAT_LABELS[activePlat]} Equal-Weight Breakdown (${activeSc.n} ${activeSc.n === 1 ? 'review' : 'reviews'})</strong>
              <span>1 verified owner = 1 equal vote · ${hoursMeta}</span>
            </div>
            <div class="score-dist-bar" aria-label="Score distribution for ${PLAT_LABELS[activePlat]}">
              ${d.hi ? `<span class="score-dist-seg hi" style="width:${hiPct}%"></span>` : ''}
              ${d.mid ? `<span class="score-dist-seg mid" style="width:${midPct}%"></span>` : ''}
              ${d.lo ? `<span class="score-dist-seg lo" style="width:${loPct}%"></span>` : ''}
            </div>
            <div class="score-breakdown-legend">
              <span><i class="legend-swatch hi"></i>Positive (75–100): ${d.hi}</span>
              <span><i class="legend-swatch mid"></i>Mixed (50–74): ${d.mid}</span>
              <span><i class="legend-swatch lo"></i>Negative (0–49): ${d.lo}</span>
            </div>
          </div>`;
        })()}

        ${
          stats.spike
            ? `<div class="spike-notice"><strong>High recent activity:</strong> Verified owners are actively reviewing this game right now. All platform scores remain strictly equal-weight and isolated per platform.</div>`
            : ''
        }

        <div class="rate-section" id="modal-rate-section">
          ${
            gamePlats.length > 1
              ? `<div class="rate-platform-bar" role="group" aria-label="Choose platform to review">
                  ${gamePlats
                    .map(
                      (p) => `<button type="button" class="rate-plat-btn ${activePlat === p ? 'is-active' : ''}" data-rate-plat="${p}">
                        ${platIcon(p)} ${PLAT_LABELS[p]}
                      </button>`
                    )
                    .join('')}
                </div>`
              : ''
          }
          ${
            isPlatConnected
              ? `
            <div class="rate-section-head">
              <h3>${myReview ? `Edit your ${PLAT_LABELS[activePlat]} review` : `Rate on ${PLAT_LABELS[activePlat]}`}</h3>
              <span id="modal-eligibility" class="eligibility-pill ${legacyInfo.legacy ? 'classic' : 'muted'}">${
                legacyInfo.legacy
                  ? `✦ Classic Era (${esc(legacyInfo.era || 'Legacy')}) · Account verified`
                  : `Checking your ${PLAT_LABELS[activePlat]} library…`
              }</span>
            </div>
            ${
              legacyInfo.legacy
                ? `<div class="legacy-banner"><strong>Classic Era Review:</strong> ${esc(legacyInfo.reason)}. Ownership &amp; playtime checks are waived for this classic, while your verified ${PLAT_LABELS[activePlat]} login is still required (one review per account).</div>`
                : `<p class="rate-isolation-note">Allocates strictly to the <strong>${PLAT_LABELS[activePlat]}</strong> score — never mixed with other platforms.</p>`
            }
            <form id="review-form" class="review-form">
              <div class="score-slider-row">
                <label for="score-range" style="font-size:13px;font-weight:600;color:var(--muted);">Score</label>
                <input id="score-range" type="range" min="0" max="100" value="${initialScore}" />
                <input id="score-number" class="score-number-input" type="number" min="0" max="100" value="${initialScore}" aria-label="Score 0 to 100" />
                <span id="score-verdict" class="verdict-chip ${scoreClass(initialScore)}">${verdictFor(initialScore)}</span>
              </div>
              <textarea id="review-text" class="review-textarea" maxlength="2000" placeholder="Share your honest experience playing on ${PLAT_LABELS[activePlat]} (optional)…">${esc(initialText)}</textarea>
              <div class="review-form-actions">
                <span class="char-count"><span id="review-chars">${initialText.length}</span> / 2000</span>
                <div style="display:flex;gap:10px;align-items:center;">
                  ${myReview ? '<button type="button" class="btn-danger" id="delete-review-btn">Delete review</button>' : ''}
                  <button type="submit" class="btn-primary" id="submit-review-btn">${myReview ? `Update ${PLAT_LABELS[activePlat]} review` : `Publish ${PLAT_LABELS[activePlat]} review`}</button>
                </div>
              </div>
              <div id="review-form-status" class="form-status" role="status"></div>
            </form>
          `
              : `
            <div class="rate-signin-box">
              <div>
                <h3 style="margin-bottom:6px;">${
                  linked.length
                    ? `${esc(g.name)} requires a ${PLAT_LABELS[activePlat]} account`
                    : `Have you played ${esc(g.name)}?`
                }</h3>
                <p>${
                  linked.length
                    ? `You can only review games on platforms where they were released. Connect your ${PLAT_LABELS[activePlat]} account to rate this ${legacyInfo.legacy ? `${legacyInfo.era} classic (library check waived)` : `${PLAT_LABELS[activePlat]} title`}.`
                    : legacyInfo.legacy
                      ? `Sign in with ${PLAT_LABELS[activePlat]} to rate this ${legacyInfo.era} classic. Ownership & playtime checks are waived for pre-API classics, while platform login is still required.`
                      : `Connect ${gamePlats.map((p) => PLAT_LABELS[p]).join(' or ')} to verify ownership and 2h+ playtime. Each platform score is calculated separately.`
                }</p>
              </div>
              <button type="button" class="btn-primary" data-action="${activePlat === 'ps' ? 'open-psn-connect' : activePlat === 'xbox' ? 'open-xbox-connect' : 'open-auth'}">
                ${platIcon(activePlat)} Connect ${PLAT_LABELS[activePlat]}
              </button>
            </div>
          `
          }
        </div>

        <div class="modal-reviews-head">
          <h3>Verified player reviews (${payload ? payload.reviews.length : '…'})</h3>
          <select id="modal-review-sort" class="size-select" style="height:34px;font-size:12.5px;" aria-label="Sort game reviews">
            <option value="recent">Newest first</option>
            <option value="hours">Most playtime</option>
            <option value="high">Highest score</option>
            <option value="low">Lowest score</option>
          </select>
        </div>

        <div id="modal-reviews-list">
          ${payload ? renderModalReviewsHtml(payload.reviews) : '<p class="section-description">Loading reviews…</p>'}
        </div>
      </div>
    </div>`;

    bindModalInteractions(g);
    updateModalEligibilityBadge();
  }

  function renderModalReviewsHtml(reviews) {
    if (!reviews.length) {
      return '<p class="section-description">No verified reviews yet. Be the first owner with 2h+ played to score it.</p>';
    }
    const sorted = [...reviews];
    if (state.modalReviewSort === 'hours') {
      sorted.sort((a, b) => (b.hours || 0) - (a.hours || 0));
    } else if (state.modalReviewSort === 'high') {
      sorted.sort((a, b) => b.score - a.score || (b.hours || 0) - (a.hours || 0));
    } else if (state.modalReviewSort === 'low') {
      sorted.sort((a, b) => a.score - b.score || (b.hours || 0) - (a.hours || 0));
    } else {
      sorted.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    return sorted
      .map(
        (r) => `<article class="review-item">
          <div class="review-item-head">
            ${r.avatar ? `<img src="${esc(r.avatar)}" referrerpolicy="no-referrer" alt="" />` : ''}
            <span class="review-author-name">${esc(r.name)}</span>
            ${r.isMine ? '<span class="verified-pill">You</span>' : r.legacy ? '<span class="classic-pill">✦ Classic Era</span>' : '<span class="verified-pill">✓ Verified</span>'}
            <span class="review-playtime">${
              r.legacy
                ? `${esc(r.legacyEra || 'Classic')} account-verified on ${platIcon(r.platform)} ${PLAT_LABELS[r.platform] || r.platform}`
                : `${r.hours}h played on ${platIcon(r.platform)} ${PLAT_LABELS[r.platform] || r.platform}`
            }</span>
            <span class="review-score-pill ${scoreClass(r.score)}">${r.score}</span>
          </div>
          ${r.text ? `<p class="review-item-body">${esc(r.text)}</p>` : ''}
          <div class="review-item-date">${formatDate(r.ts)}${r.edited ? ' · edited' : ''}</div>
        </article>`
      )
      .join('');
  }

  function bindModalInteractions(game) {
    const range = $('#score-range');
    const num = $('#score-number');
    const verdict = $('#score-verdict');
    const textarea = $('#review-text');
    const chars = $('#review-chars');
    const form = $('#review-form');
    const delBtn = $('#delete-review-btn');
    const sortSel = $('#modal-review-sort');

    const syncScore = (val) => {
      const clamped = Math.min(100, Math.max(0, Math.round(Number(val) || 0)));
      if (range) range.value = String(clamped);
      if (num) num.value = String(clamped);
      if (verdict) {
        verdict.textContent = verdictFor(clamped);
        verdict.className = `verdict-chip ${scoreClass(clamped)}`;
      }
    };

    if (range) range.oninput = () => syncScore(range.value);
    if (num) num.oninput = () => syncScore(num.value);
    if (textarea && chars) {
      textarea.oninput = () => {
        chars.textContent = String(textarea.value.length);
      };
    }

    if (sortSel) {
      sortSel.value = state.modalReviewSort;
      sortSel.onchange = () => {
        state.modalReviewSort = sortSel.value;
        $('#modal-reviews-list').innerHTML = renderModalReviewsHtml(state.currentModalPayload?.reviews || []);
      };
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const status = $('#review-form-status');
        const submitBtn = $('#submit-review-btn');
        const plat = state.modalRatePlatform;
        status.className = 'form-status';
        status.textContent = `Verifying your ${PLAT_LABELS[plat]} library & playtime…`;
        submitBtn.disabled = true;

        try {
          const res = await fetch('/api/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              gameId: game.id,
              platform: plat,
              score: Number(num.value),
              text: textarea.value,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            status.className = 'form-status err';
            status.textContent = data.error || 'Could not save review.';
            submitBtn.disabled = false;
            return;
          }
          if (!data.edited) {
            trackMarketingEvent('review', plat);
          }
          showToast(
            data.edited
              ? `${PLAT_LABELS[plat]} verified review updated!`
              : `${PLAT_LABELS[plat]} verified review published!`
          );
          syncLocalLibraryReviewState(data.gameId || game.id, plat, Number(num.value));
          await openGameModal(data.gameId || game.id, game, plat);
          loadCatalog();
          loadStats();
          if (state.view === 'reviews') loadReviewsFeed();
          if (state.view === 'library') {
            loadLibraryView();
          }
        } catch (err) {
          status.className = 'form-status err';
          status.textContent = err.message || 'Network error.';
          submitBtn.disabled = false;
        }
      };
    }

    if (delBtn) {
      delBtn.onclick = async () => {
        const plat = state.modalRatePlatform;
        delBtn.disabled = true;
        try {
          const res = await fetch(`/api/review/${encodeURIComponent(game.id)}?platform=${encodeURIComponent(plat)}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            showToast(`Your ${PLAT_LABELS[plat]} review was deleted.`);
            syncLocalLibraryReviewState(game.id, plat, null);
            await openGameModal(game.id, game, plat);
            loadCatalog();
            loadStats();
            if (state.view === 'reviews') loadReviewsFeed();
            if (state.view === 'library') {
              loadLibraryView();
            }
          }
        } finally {
          delBtn.disabled = false;
        }
      };
    }
  }

  // ---- Mobile Filter Drawer ----
  function setSidebarOpen(open) {
    $('#filters-sidebar').classList.toggle('is-open', open);
    $('#sidebar-backdrop').hidden = !open;
    $('#open-filters-btn').setAttribute('aria-expanded', String(open));
  }

  function debounce(fn, ms = 320) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  // ---- Global Event Wiring ----
  function initEvents() {
    // Inject official platform logos into static filter chips
    $$('.chip[data-platform]:not([data-platform="all"])').forEach((btn) => {
      btn.innerHTML = platIcon(btn.dataset.platform);
    });
    $$('.rev-plat-chip:not([data-rev-plat="all"])').forEach((btn) => {
      btn.innerHTML = platIcon(btn.dataset.revPlat);
    });

    $('#brand-home').addEventListener('click', (e) => {
      e.preventDefault();
      if ($('#search-input').value) {
        $('#search-input').value = '';
        state.page = 1;
        loadCatalog();
      }
      switchView('discover');
    });

    $$('.nav-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    $('#hero-browse-btn').addEventListener('click', () => {
      $('#catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#hero-auth-btn').addEventListener('click', () => {
      if (state.me) switchView('library');
      else openAuthModal();
    });
    $('#banner-cta-btn').addEventListener('click', () => {
      if (state.me) openAuthModal();
      else openAuthModal();
    });
    $('#spotlight-all-reviews').addEventListener('click', () => switchView('reviews'));

    const triggerSearch = debounce(() => {
      if (state.view !== 'discover') switchView('discover');
      state.page = 1;
      loadCatalog();
    }, 300);

    $('#search-input').addEventListener('input', triggerSearch);
    $('#search-clear').addEventListener('click', () => {
      $('#search-input').value = '';
      state.page = 1;
      loadCatalog();
      $('#search-input').focus();
    });

    const triggerFilter = debounce(() => {
      state.page = 1;
      loadCatalog();
    }, 320);
    ['#f-from', '#f-to', '#f-dev', '#f-pub', '#f-min'].forEach((sel) => {
      $(sel).addEventListener('input', triggerFilter);
    });
    $('#f-reviewed').addEventListener('change', () => {
      state.page = 1;
      loadCatalog();
    });
    $('#f-sort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      state.page = 1;
      syncQuickSorts();
      loadCatalog();
    });
    $('#f-reset').addEventListener('click', resetAllFilters);

    $$('.platform-chips .chip[data-platform]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.platform = btn.dataset.platform;
        state.page = 1;
        syncPlatformChips();
        loadCatalog();
      });
    });

    $$('.quick-sort[data-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.sort = btn.dataset.sort;
        state.page = 1;
        syncQuickSorts();
        loadCatalog();
      });
    });

    $('#page-size').addEventListener('change', (e) => {
      state.size = Number(e.target.value) || 30;
      state.page = 1;
      loadCatalog();
    });

    $$('.rev-plat-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.revFeedPlat = btn.dataset.revPlat;
        $$('.rev-plat-chip').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        loadReviewsFeed();
      });
    });
    $('#reviews-feed-sort').addEventListener('change', (e) => {
      state.revFeedSort = e.target.value;
      loadReviewsFeed();
    });

    $('#open-filters-btn').addEventListener('click', () => setSidebarOpen(true));
    $('#close-filters-btn').addEventListener('click', () => setSidebarOpen(false));
    $('#sidebar-backdrop').addEventListener('click', () => setSidebarOpen(false));

    document.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action="toggle-theme"]')) {
        toggleTheme();
        return;
      }
      if (e.target.closest('[data-action="confirm-logout"]')) {
        // Guard against accidental mobile tap-through right after closing a modal with ✕
        if (Date.now() - state.lastModalCloseTs < 320) return;
        openLogoutConfirmModal();
        return;
      }
      if (e.target.closest('[data-action="open-auth"]')) {
        openAuthModal(false);
        return;
      }
      if (e.target.closest('[data-action="open-psn-connect"]')) {
        openAuthModal('ps');
        return;
      }
      if (e.target.closest('[data-action="open-xbox-connect"]')) {
        if (state.stats?.providers?.xbox?.configured) {
          window.location.href = '/auth/xbox';
        } else {
          openAuthModal('xbox');
        }
        return;
      }
      if (e.target.closest('[data-toggle-psn]')) {
        state.psnPanelOpen = !state.psnPanelOpen;
        renderAuthModal();
        return;
      }
      if (e.target.closest('[data-toggle-xbox]')) {
        state.xboxPanelOpen = !state.xboxPanelOpen;
        renderAuthModal();
        return;
      }
      const coffeeLink = e.target.closest('#coffee-donate-btn');
      if (coffeeLink && coffeeLink.dataset.configured !== '1') {
        e.preventDefault();
        showToast('PayPal donation link is not configured yet.');
        return;
      }
      const psnModeBtn = e.target.closest('[data-psn-mode]');
      if (psnModeBtn) {
        state.psnMode = psnModeBtn.dataset.psnMode;
        renderAuthModal();
        return;
      }
      const unlinkBtn = e.target.closest('[data-unlink-plat]');
      if (unlinkBtn) {
        const p = unlinkBtn.dataset.unlinkPlat;
        await fetch(`/auth/unlink/${encodeURIComponent(p)}`, { method: 'POST' });
        clearSessionLibraryCache(p);
        await refreshSessionAfterAuth(`${PLAT_LABELS[p]} account unlinked.`);
        return;
      }
      if (e.target.closest('#confirm-logout-proceed')) {
        clearSessionLibraryCache();
        return;
      }
      if (e.target.closest('#modal-refresh-lib-btn')) {
        refreshModalEligibility();
        return;
      }
      const ratePlatBtn = e.target.closest('[data-rate-plat]');
      if (ratePlatBtn && state.currentModalGame) {
        state.modalRatePlatform = ratePlatBtn.dataset.ratePlat;
        renderGameModalShell(state.currentModalGame, state.currentModalPayload);
        return;
      }
      const closeModalBtn = e.target.closest('[data-close-modal]');
      if (closeModalBtn) {
        e.preventDefault();
        e.stopPropagation();
        state.lastModalCloseTs = Date.now();
        const target = $('#' + closeModalBtn.dataset.closeModal);
        if (target && target.open) target.close();
        return;
      }
      const openGameBtn = e.target.closest('[data-open-game]');
      if (openGameBtn) {
        openGameModal(openGameBtn.dataset.openGame);
        return;
      }
      const openLibGameBtn = e.target.closest('[data-open-lib-game]');
      if (openLibGameBtn) {
        const id = openLibGameBtn.dataset.openLibGame;
        const item = (state.library?.items || []).find((x) => String(x.id) === String(id));
        openGameModal(id, item, state.libPlatform);
        return;
      }
      const switchLibPlatBtn = e.target.closest('[data-switch-lib-plat]');
      if (switchLibPlatBtn) {
        state.libPlatform = switchLibPlatBtn.dataset.switchLibPlat;
        state.libQuery = '';
        state.libFilter = 'all';
        loadLibraryView();
        return;
      }
      const pageDeltaBtn = e.target.closest('[data-page-delta]');
      if (pageDeltaBtn && !pageDeltaBtn.disabled) {
        state.page = Math.min(state.pages, Math.max(1, state.page + Number(pageDeltaBtn.dataset.pageDelta)));
        loadCatalog();
        $('#catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const clearFilterBtn = e.target.closest('[data-clear-filter]');
      if (clearFilterBtn) {
        const k = clearFilterBtn.dataset.clearFilter;
        if (k === 'q') $('#search-input').value = '';
        if (k === 'platform') {
          state.platform = 'all';
          syncPlatformChips();
        }
        if (k === 'year') {
          $('#f-from').value = '';
          $('#f-to').value = '';
        }
        if (k === 'dev') $('#f-dev').value = '';
        if (k === 'pub') $('#f-pub').value = '';
        if (k === 'min') $('#f-min').value = '';
        if (k === 'reviewed') $('#f-reviewed').checked = false;
        state.page = 1;
        loadCatalog();
        return;
      }
      if (e.target.id === 'empty-reset-btn') {
        resetAllFilters();
        return;
      }
      if (e.target.id === 'retry-catalog-btn') {
        loadCatalog();
        return;
      }
      if (e.target.id === 'retry-lib-btn' || e.target.id === 'refresh-lib-btn') {
        loadLibraryView({ forceRefresh: true });
        return;
      }
      const libFilterBtn = e.target.closest('[data-lib-filter]');
      if (libFilterBtn) {
        state.libFilter = libFilterBtn.dataset.libFilter;
        renderLibraryList();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'page-jump-input') {
        state.page = Math.min(state.pages, Math.max(1, Number(e.target.value) || 1));
        loadCatalog();
        $('#catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    document.addEventListener('input', (e) => {
      if (e.target.id === 'lib-search-input') {
        state.libQuery = e.target.value;
        const pos = e.target.selectionStart;
        renderLibraryList();
        const refocused = $('#lib-search-input');
        if (refocused) {
          refocused.focus();
          refocused.setSelectionRange(pos, pos);
        }
      }
    });

    ['#game-modal', '#auth-modal', '#confirm-modal'].forEach((sel) => {
      const dlg = $(sel);
      if (!dlg) return;
      dlg.addEventListener('close', () => {
        state.lastModalCloseTs = Date.now();
      });
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) {
          state.lastModalCloseTs = Date.now();
          dlg.close();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
        e.preventDefault();
        $('#search-input').focus();
      }
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    });

    window.addEventListener('offline', () => {
      showToast('You appear to be offline. Reconnect to load updates or post reviews.');
    });
    window.addEventListener('online', () => {
      showToast('Back online!');
    });
  }

  async function boot() {
    initEvents();
    initHeroShowcase();

    const params = new URLSearchParams(window.location.search);
    initUtmAttribution(params);
    const errCode = params.get('e');
    const connected = params.get('connected');
    const hasUtm = params.has('utm_source') || params.has('utm_campaign') || params.has('utm_medium');
    if (errCode === 'login') showToast('Steam sign-in failed. Please try again.');
    if (errCode === 'xbox_login') showToast('Xbox sign-in failed. Please try again.');
    if (errCode === 'xbox_config') {
      showToast('Xbox Live connection is currently unavailable on this server. Please try again later.');
    }
    if (connected && PLAT_LABELS[connected]) {
      trackMarketingEvent('connect', connected);
      showToast(`${PLAT_LABELS[connected]} connected! You can now publish verified reviews.`);
    }
    if (errCode || connected || hasUtm) {
      history.replaceState(null, '', '/');
    }

    try {
      state.me = await (await fetch('/api/me')).json();
    } catch {
      state.me = null;
    }

    renderUserControls();
    if (state.me) {
      if (connected && PLAT_LABELS[connected]) {
        clearSessionLibraryCache(connected);
      }
      prewarmConnectedLibraries();
    } else {
      clearSessionLibraryCache();
    }
    await Promise.all([loadStats(), loadCatalog()]);
  }

  boot();
})();
