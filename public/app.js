(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const I18N = window.PlaytestedI18n;
  const t = (key, vars) => (I18N ? I18N.t(key, vars) : key);
  const currentLocale = () => (I18N ? I18N.locale() : 'en-US');
  const fmtNum = (n) => {
    const num = Number(n || 0);
    try {
      return num.toLocaleString(currentLocale());
    } catch {
      return num.toLocaleString();
    }
  };

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

  function sortTitleFor(sortKey) {
    const valid = ['trend', 'new', 'old', 'top', 'most', 'az', 'za'];
    return t(valid.includes(sortKey) ? `catalog.title.${sortKey}` : 'catalog.title.default');
  }

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
      if (captionSub) captionSub.textContent = t('hero.release2026');
      if (captionBtn) captionBtn.setAttribute('aria-label', t('hero.openFeaturedAria', { name: item.name }));
      if (indexNum) indexNum.textContent = `${pad2(idx + 1)} / ${pad2(slides.length)}`;
      if (dotsWrap) {
        $$('.hero-dot-btn', dotsWrap).forEach((btn, i) => {
          btn.classList.toggle('is-active', i === idx);
          btn.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
          if (slides[i]) btn.setAttribute('aria-label', t('hero.showSlideAria', { name: slides[i].name }));
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
            `<button type="button" class="hero-dot-btn${i === 0 ? ' is-active' : ''}" data-idx="${i}" aria-label="${esc(t('hero.showSlideAria', { name: s.name }))}" aria-pressed="${i === 0 ? 'true' : 'false'}"></button>`
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
    state.refreshHeroMeta = () => renderMeta(current);
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
    lastCatalogData: null,
    lastReviewsFeedData: null,
    refreshHeroMeta: null,
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

  const REVIEW_QUESTIONS = [
    { key: 'fun', num: 1, weight: 5 },
    { key: 'performance', num: 2, weight: 1.5 },
    { key: 'gameplay', num: 3, weight: 2 },
    { key: 'visuals', num: 4, weight: 1.5 },
  ];

  const qLabel = (q) => t(`q.${q.key}.label`);
  const qShort = (q) => t(`q.${q.key}.short`);
  const qTip = (q) => t(`q.${q.key}.tip`);

  function calcWeightedBreakdown(answers) {
    if (!answers || typeof answers !== 'object') return null;
    let raw = 0;
    for (const q of REVIEW_QUESTIONS) {
      const v = answers[q.key];
      if (!Number.isInteger(v) || v < 0 || v > 10) return null;
      raw += v * q.weight;
    }
    return Math.min(100, Math.max(0, Math.round(raw)));
  }

  function renderReviewBreakdownPills(breakdown) {
    if (!breakdown || typeof breakdown !== 'object') return '';
    const valid = REVIEW_QUESTIONS.every((q) => Number.isInteger(breakdown[q.key]));
    if (!valid) return '';
    return `<div class="review-criteria-pills" aria-label="${esc(t('game.breakdownAria'))}">${REVIEW_QUESTIONS.map(
      (q) =>
        `<span class="review-criteria-pill" title="${esc(qLabel(q))}"><span>${esc(qShort(q))}</span><strong>${breakdown[q.key]}/10</strong></span>`
    ).join('')}</div>`;
  }

  function verdictFor(score) {
    if (score >= 95) return t('verdict.essential');
    if (score >= 85) return t('verdict.great');
    if (score >= 70) return t('verdict.good');
    if (score >= 50) return t('verdict.mixed');
    if (score >= 30) return t('verdict.rough');
    return t('verdict.poor');
  }

  function formatCompact(n) {
    if (!n) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${Math.round(n / 1000)}k`;
    if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
    return fmtNum(n);
  }

  function formatDate(ts) {
    if (!ts) return '';
    try {
      return new Intl.DateTimeFormat(currentLocale(), { month: 'short', day: 'numeric', year: 'numeric' }).format(
        new Date(ts)
      );
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
    return `<img class="${className}" loading="lazy" referrerpolicy="no-referrer" alt="${esc(t('cover.alt', { name: game.name }))}" src="${esc(src)}" data-id="${esc(game.id)}" data-name="${esc(game.name)}" data-hdr="${esc(game.hdr || '')}" onerror="handleCoverError(this)" />`;
  }

  function scoreTrioHtml(scores) {
    return `<div class="score-trio">${['pc', 'ps', 'xbox']
      .map((p) => {
        const entry = scores && scores[p];
        const tip = entry
          ? t('score.tip', {
              platform: PLAT_LABELS[p],
              score: entry.score,
              n: entry.n,
              reviewWord: entry.n === 1 ? t('catalog.reviewOne') : t('catalog.reviewMany'),
              avgPart: entry.avgHours ? t('score.tipAvg', { hours: entry.avgHours }) : '',
            })
          : t('score.tipNone', { platform: PLAT_LABELS[p] });
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

  // ---- Language Switch (Compact Flag Dropdown) ----
  function langSwitchHtml() {
    if (!I18N) return '';
    const cur = I18N.getLang();
    return `<div class="lang-switch" data-lang-switch>
      <button type="button" class="lang-trigger" data-action="toggle-lang-menu" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('lang.aria'))}" title="${esc(t('lang.title'))}">
        ${I18N.flagSvg(cur)}
        <svg class="lang-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5"/>
        </svg>
      </button>
      <div class="lang-menu" role="menu" aria-label="${esc(t('lang.aria'))}" hidden>
        ${I18N.LANGUAGES.map((l) => {
          const active = l.code === cur;
          return `<button type="button" class="lang-option ${active ? 'is-active' : ''}" role="menuitemradio" aria-checked="${active ? 'true' : 'false'}" data-set-lang="${esc(l.code)}">
            ${I18N.flagSvg(l.code)}
            <span class="lang-option-label">${esc(l.label)}</span>
            <span class="lang-option-check" aria-hidden="true">✓</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }

  function closeLangMenus() {
    $$('[data-lang-switch].is-open').forEach((wrap) => {
      wrap.classList.remove('is-open');
      const btn = wrap.querySelector('.lang-trigger');
      const menu = wrap.querySelector('.lang-menu');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (menu) menu.hidden = true;
    });
  }

  // ---- Theme Switch ----
  function themeSwitchHtml() {
    const isDark = document.documentElement.dataset.theme !== 'light';
    return `<button type="button" class="theme-toggle" role="switch" aria-checked="${isDark}" aria-label="${esc(t('theme.aria'))}" title="${esc(t('theme.title'))}" data-action="toggle-theme">
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
        <button type="button" class="user-chip" data-action="open-auth" title="${esc(t('auth.manageTitle'))}">
          ${avatarHtml}
          <span class="user-name">${esc(state.me.name)}</span>
          <span class="user-plat-dots" aria-label="${esc(t('auth.connectedPlatsAria'))}">${linked.map((p) => platIcon(p)).join('')}</span>
        </button>
        ${langSwitchHtml()}
        ${themeSwitchHtml()}
        <button type="button" class="btn-outline" data-action="confirm-logout">${esc(t('auth.signOut'))}</button>
      `;
      $('#hero-auth-btn').innerHTML = `${esc(t('hero.openLibrariesCta'))} <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
      $('#banner-cta-btn').innerHTML = `${esc(t('banner.ctaUser'))} <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
    } else {
      host.innerHTML = `
        ${langSwitchHtml()}
        ${themeSwitchHtml()}
        <button type="button" class="btn-primary" data-action="open-auth">${esc(t('auth.signIn'))}</button>
      `;
      $('#hero-auth-btn').innerHTML = `${esc(t('hero.signInCta'))} <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
      $('#banner-cta-btn').innerHTML = `${esc(t('banner.ctaGuest'))} <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
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
  function renderStatsNumbers() {
    if (!state.stats) return;
    $('#stat-games').textContent = fmtNum(state.stats.indexed);
    $('#stat-reviews').textContent = fmtNum(state.stats.totalReviews);
    $('#stat-hours').textContent = `${formatCompact(state.stats.totalVerifiedHours)}h`;
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      state.stats = data;
      renderStatsNumbers();
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
                ? `<span class="spotlight-score-float ${scoreClass(score)}" title="${esc(t('spotlight.isolatedTip', { platform: PLAT_LABELS[plat] }))}">${platIcon(plat)} ${score} <small>/ 100</small></span>`
                : ''
            }
          </div>
          <div class="spotlight-body">
            <div class="spotlight-title">${esc(g.name)}</div>
            ${
              hl
                ? `<p class="spotlight-quote">“${esc(hl.text)}”</p>`
                : `<p class="spotlight-quote">${esc(
                    t(g.reviews === 1 ? 'spotlight.verifiedReviewOne' : 'spotlight.verifiedReviewMany', { n: g.reviews })
                  )}</p>`
            }
            <div class="spotlight-author">
              ${hl?.avatar ? `<img src="${esc(hl.avatar)}" referrerpolicy="no-referrer" alt="" />` : ''}
              <span><strong>${esc(hl ? hl.name : g.developer)}</strong></span>
              ${hl ? `<span class="spotlight-hours">${esc(t('spotlight.hoursPlayed', { hours: hl.hours }))}</span>` : `<span>${esc(g.date.slice(0, 4))}</span>`}
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
    const playtime = $('#f-playtime')?.value || '';
    const rev = $('#f-reviewed').checked;

    if (q) pills.push({ key: 'q', label: t('pill.search', { q }) });
    if (state.platform !== 'all') pills.push({ key: 'platform', label: t('pill.platform', { platform: PLAT_LABELS[state.platform] }) });
    if (from || to) pills.push({ key: 'year', label: t('pill.year', { from: from || t('pill.any'), to: to || t('pill.any') }) });
    if (dev) pills.push({ key: 'dev', label: t('pill.dev', { dev }) });
    if (pub) pills.push({ key: 'pub', label: t('pill.pub', { pub }) });
    if (min) pills.push({ key: 'min', label: t('pill.min', { min }) });
    if (playtime) {
      const ptKeys = {
        low: 'catalog.playtime.low',
        medium: 'catalog.playtime.medium',
        high: 'catalog.playtime.high',
        second_job: 'catalog.playtime.second_job',
      };
      pills.push({ key: 'playtime', label: t('pill.playtime', { label: ptKeys[playtime] ? t(ptKeys[playtime]) : playtime }) });
    }
    if (rev) pills.push({ key: 'reviewed', label: t('pill.reviewed') });

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
        (p) => `<span class="filter-pill">${esc(p.label)} <button type="button" data-clear-filter="${p.key}" aria-label="${esc(t('pill.removeAria'))}">✕</button></span>`
      )
      .join('');
  }

  function renderCatalogData(data) {
    if (!data) return;
    const q = $('#search-input').value.trim();
    state.games = data.items || [];
    state.page = data.page;
    state.pages = data.pages;
    if (typeof data.indexed === 'number') {
      $('#stat-games').textContent = fmtNum(data.indexed);
    }

    const titleText = q ? t('catalog.title.search', { q }) : sortTitleFor(state.sort);
    $('#catalog-title').innerHTML = `${esc(titleText)}<span class="accent-dot">.</span>`;
    $('#catalog-count').textContent = t('catalog.countLine', {
      total: fmtNum(data.total),
      gameWord: data.total === 1 ? t('catalog.gameOne') : t('catalog.gameMany'),
      indexed: fmtNum(data.indexed),
      knownPart: data.known ? t('catalog.knownPart', { known: fmtNum(data.known) }) : '',
    });

    if (!state.games.length) {
      $('#game-grid').innerHTML = `<div class="empty-state">
        <h3>${esc(data.indexed ? t('catalog.emptyTitle') : t('catalog.indexingTitle'))}</h3>
        <p>${esc(data.indexed ? t('catalog.emptyBody') : t('catalog.indexingBody'))}</p>
        ${data.indexed ? `<button type="button" class="btn-outline" id="empty-reset-btn">${esc(t('catalog.resetAllFilters'))}</button>` : ''}
      </div>`;
    } else {
      $('#game-grid').innerHTML = state.games
        .map((g) => {
          const year = g.date ? g.date.slice(0, 4) : '—';
          const peakBadge =
            g.trend && g.trend >= 15000
              ? `<span class="card-badge-peak" title="${esc(t('catalog.peakTitle'))}"><span class="peak-dot"></span>${formatCompact(g.trend)}</span>`
              : '';
          return `<button type="button" class="game-card" data-open-game="${esc(g.id)}">
            <div class="card-cover">
              ${coverImg(g)}
              ${peakBadge}
              <span class="card-hover-cta">${esc(t('catalog.hoverCta'))}</span>
            </div>
            <div class="card-body">
              <h3 class="card-title">${esc(g.name)}</h3>
              <div class="card-meta">
                <span>${esc(year)}</span>
                <span>${g.reviews} ${esc(g.reviews === 1 ? t('catalog.reviewOne') : t('catalog.reviewMany'))}</span>
              </div>
              ${scoreTrioHtml(g.scores)}
            </div>
          </button>`;
        })
        .join('');
    }

    renderPager();
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
      ['playtime', '#f-playtime'],
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

      state.lastCatalogData = data;
      renderCatalogData(data);
      if (!data.items?.length && !data.indexed) {
        setTimeout(loadCatalog, 5000);
      }
    } catch (err) {
      if (id !== state.reqId) return;
      $('#game-grid').innerHTML = `<div class="empty-state">
        <h3>${esc(t('catalog.loadErrorTitle'))}</h3>
        <p>${esc(err.message || t('catalog.loadErrorFallback'))}</p>
        <button type="button" class="btn-primary" id="retry-catalog-btn">${esc(t('catalog.retry'))}</button>
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
        ${esc(t('catalog.prev'))}
      </button>
      <label class="pager-jump">
        ${esc(t('catalog.page'))}
        <input id="page-jump-input" type="number" min="1" max="${state.pages}" value="${state.page}" aria-label="${esc(t('catalog.jumpPageAria'))}" />
        ${esc(t('catalog.ofPages', { pages: fmtNum(state.pages) }))}
      </label>
      <button type="button" class="btn-outline" data-page-delta="1" ${state.page >= state.pages ? 'disabled' : ''}>
        ${esc(t('catalog.next'))}
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
    if ($('#f-playtime')) $('#f-playtime').value = '';
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
  function renderReviewsFeedData(data) {
    const host = $('#reviews-feed-list');
    if (!data) return;
    $('#reviews-feed-count').textContent = t('reviews.countLine', {
      total: fmtNum(data.total),
      reviewWord: data.total === 1 ? t('catalog.reviewOne') : t('catalog.reviewMany'),
      scope:
        state.revFeedPlat !== 'all'
          ? t('reviews.scopePlatform', { platform: PLAT_LABELS[state.revFeedPlat] })
          : t('reviews.scopeAll'),
    });

    if (!data.items.length) {
      host.innerHTML = `<div class="empty-state">
        <h3>${esc(t('reviews.emptyTitle'))}</h3>
        <p>${esc(t('reviews.emptyBody'))}</p>
        <button type="button" class="btn-primary" data-action="open-auth">${esc(t('banner.ctaGuest'))}</button>
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
        const platLabel = PLAT_LABELS[r.platform] || r.platform;
        return `<article class="feed-card">
          <button type="button" class="feed-game-row" data-open-game="${esc(r.gameId)}">
            ${coverImg(fakeGame)}
            <div class="feed-game-info">
              <h3 class="feed-game-title">${esc(r.gameName)}</h3>
              <div class="feed-game-meta">
                ${esc(r.gameDeveloper || t('reviews.verifiedTitle'))}${r.gameYear ? ' · ' + esc(r.gameYear) : ''}
              </div>
            </div>
            <span class="feed-score-badge ${scoreClass(r.score)}" title="${esc(t('reviews.verifiedScoreTitle', { platform: platLabel }))}">${r.score}</span>
          </button>
          ${renderReviewBreakdownPills(r.breakdown)}
          ${
            r.text
              ? `<p class="feed-review-text">${esc(r.text)}</p>`
              : `<p class="feed-review-text" style="color:var(--muted);font-style:italic;">${esc(t('reviews.scoreOnly'))}</p>`
          }
          <div class="feed-review-footer">
            ${r.avatar ? `<img src="${esc(r.avatar)}" referrerpolicy="no-referrer" alt="" />` : ''}
            <strong>${esc(r.name)}</strong>
            ${r.legacy ? `<span class="classic-pill">${esc(t('reviews.classicPill'))}</span>` : `<span class="verified-pill">${esc(t('reviews.verifiedPill'))}</span>`}
            <span class="feed-hours" title="${esc(t(r.legacy ? 'reviews.legacyTitle' : 'reviews.playtimeTitle', { platform: platLabel }))}">
              ${r.legacy ? esc(r.legacyEra || t('reviews.classicFallback')) : `${r.hours}h`} ${platIcon(r.platform)}
            </span>
          </div>
        </article>`;
      })
      .join('');
  }

  async function loadReviewsFeed() {
    const host = $('#reviews-feed-list');
    host.innerHTML = `<p class="section-description">${esc(t('reviews.loadingPlayer'))}</p>`;
    try {
      const params = new URLSearchParams({ sort: state.revFeedSort, platform: state.revFeedPlat });
      const res = await fetch('/api/reviews?' + params.toString());
      const data = await res.json();
      state.lastReviewsFeedData = data;
      renderReviewsFeedData(data);
    } catch (err) {
      host.innerHTML = `<div class="empty-state"><h3>${esc(t('reviews.loadErrorTitle'))}</h3><p>${esc(err.message)}</p></div>`;
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
    if (mins < 1) return t('library.syncJustNow');
    if (mins < 60) return t('library.syncMinsAgo', { n: mins });
    const hrs = Math.round(mins / 60);
    return t('library.syncHoursAgo', { n: hrs });
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
        <h3>${esc(t('library.connectTitle'))}</h3>
        <p>${esc(t('library.connectBody'))}</p>
        <div class="provider-stack">
          <a class="provider-btn-outline" href="/auth/steam">${platIcon('pc')} ${esc(t('library.connectSteam'))}</a>
          <button type="button" class="provider-btn-outline" data-action="open-psn-connect">${platIcon('ps')} ${esc(t('library.connectPsn'))}</button>
          <button type="button" class="provider-btn-outline" data-action="open-xbox-connect">${platIcon('xbox')} ${esc(t('library.connectXbox'))}</button>
        </div>
        <div class="provider-note">${t('library.privacyTipHtml')}</div>
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

    host.innerHTML = `<p class="section-description">${esc(t('library.syncing', { platform: PLAT_LABELS[state.libPlatform] }))}</p>`;
    try {
      const data = await ensurePlatformLibrary(state.libPlatform, { forceRefresh });
      state.library = data;
      renderLibraryList(linked);
      if (forceRefresh) showToast(t('library.refreshedToast', { platform: PLAT_LABELS[state.libPlatform] }));
    } catch (err) {
      host.innerHTML = `
        ${renderLibraryPlatformTabs(linked)}
        <div class="empty-state">
          <h3>${esc(t('library.errorTitle', { platform: PLAT_LABELS[state.libPlatform] }))}</h3>
          <p>${esc(err.message || t('library.errorFallback'))}</p>
          <button type="button" class="btn-primary" id="retry-lib-btn">${esc(t('library.tryAgain'))}</button>
        </div>`;
    }
  }

  function renderLibraryPlatformTabs(linked) {
    const syncAge = formatSyncAge(state.library?.syncedAt);
    return `<div class="library-plat-tabs" role="tablist" aria-label="${esc(t('library.tabsAria'))}">
      ${['pc', 'ps', 'xbox']
        .map((p) => {
          const isLinked = linked.includes(p);
          if (isLinked) {
            return `<button type="button" class="library-plat-tab ${state.libPlatform === p ? 'is-active' : ''}" data-switch-lib-plat="${p}">
              ${platIcon(p)} ${PLAT_LABELS[p]}
            </button>`;
          }
          return `<button type="button" class="library-plat-tab" data-action="open-auth" style="opacity:0.65;">
            ${platIcon(p)} ${esc(t('library.linkPlatform', { platform: PLAT_LABELS[p] }))}
          </button>`;
        })
        .join('')}
      <div class="library-sync-meta">
        ${syncAge ? `<span class="library-sync-age">${esc(syncAge)}</span>` : ''}
        <button type="button" class="btn-refresh-lib" id="refresh-lib-btn" title="${esc(t('library.refreshTitle'))}">
          ${esc(t('library.refreshBtn'))}
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
        <div class="lib-stat-card"><strong>${fmtNum(items.length)}</strong><span>${esc(t('library.statGames', { platform: platName }))}</span></div>
        <div class="lib-stat-card"><strong>${fmtNum(totalHours)}h</strong><span>${esc(t('library.statPlaytime', { platform: platName }))}</span></div>
        <div class="lib-stat-card"><strong>${fmtNum(eligibleCount)}</strong><span>${esc(t('library.statEligible', { hours: data.minHours }))}</span></div>
        <div class="lib-stat-card"><strong>${fmtNum(reviewedCount)}</strong><span>${esc(t('library.statReviewed', { platform: platName }))}</span></div>
      </div>
      <div class="library-controls">
        <input id="lib-search-input" class="library-search" type="search" placeholder="${esc(t('library.filterPlaceholder', { n: items.length, platform: platName }))}" value="${esc(state.libQuery)}" />
        <div class="quick-sorts" style="display:inline-flex">
          ${[
            ['all', t('library.filterAll')],
            ['eligible', t('library.filterReady', { n: eligibleCount - reviewedCount })],
            ['reviewed', t('library.filterReviewed', { n: reviewedCount })],
            ['locked', t('library.filterLocked', { hours: data.minHours })],
          ]
            .map(
              ([k, lbl]) =>
                `<button type="button" class="quick-sort ${state.libFilter === k ? 'is-active' : ''}" data-lib-filter="${k}">${esc(lbl)}</button>`
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
                    ? `<span class="lib-tag reviewed">${esc(t('library.tagRated', { score: x.myScore }))}</span>`
                    : x.eligible
                      ? `<span class="lib-tag eligible">${esc(t('library.tagRateOn', { platform: platName }))}</span>`
                      : `<span class="lib-tag locked">${esc(t('library.tagNeedHours', { hours: Math.max(0.1, reqHours - x.hours).toFixed(1) }))}</span>`;
                  return `<button type="button" class="library-row" data-open-lib-game="${esc(x.id)}">
                    ${coverImg(x)}
                    <div class="library-row-info">
                      <div class="library-row-name">${esc(x.name)}</div>
                      <div class="library-row-sub">${esc(t('library.rowHours', { hours: x.hours, platform: platName }))}</div>
                    </div>
                    ${tag}
                  </button>`;
                })
                .join('')
            : `<div class="empty-state"><h3>${esc(t('library.emptyTitle', { platform: platName }))}</h3><p>${esc(t('library.emptyBody'))}</p></div>`
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
      ? t('logout.sessionLinked', { platforms: linked.join(', ') })
      : t('logout.sessionDefault');

    dlg.innerHTML = `<div class="modal-scroll"><div class="confirm-modal-body">
      <button type="button" class="modal-close-btn" data-close-modal="confirm-modal" aria-label="${esc(t('modal.close'))}">✕</button>
      <div class="eyebrow" style="margin-bottom:8px;"><span class="eyebrow-dot"></span>${esc(t('logout.eyebrow'))}</div>
      <h2>${t('logout.titleHtml')}</h2>
      <p class="confirm-modal-desc">${esc(t('logout.desc', { sessionText: listText }))}</p>
      <div class="confirm-modal-actions">
        <button type="button" class="btn-outline" data-close-modal="confirm-modal" id="confirm-logout-cancel">${esc(t('logout.cancel'))}</button>
        <a class="btn-danger" href="/auth/logout" id="confirm-logout-proceed">${esc(t('auth.signOut'))}</a>
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
            <span class="provider-connected-btn">${esc(t('auth.connected'))}</span>
            <button type="button" class="provider-unlink-btn" data-unlink-plat="ps" title="${esc(t('auth.disconnectTitle', { platform: 'PlayStation' }))}">${esc(t('auth.unlink'))}</button>
          </div>
        </div>`
      : `<div class="provider-row">
          <span class="provider-logo">${platIcon('ps')}</span>
          <div class="provider-meta">
            <strong>PlayStation Network</strong>
            <span>${esc(t('auth.psnSub'))}</span>
          </div>
          <button type="button" class="provider-connect-btn" data-toggle-psn>${esc(state.psnPanelOpen ? t('auth.cancel') : t('auth.connect'))}</button>
        </div>
        ${
          state.psnPanelOpen
            ? `<div class="psn-panel">
                <div class="psn-tabs">
                  ${
                    providers.ps.bioChallengeReady
                      ? `<button type="button" class="psn-tab ${state.psnMode === 'bio' ? 'is-active' : ''}" data-psn-mode="bio">${esc(t('auth.psnTabBio'))}</button>`
                      : ''
                  }
                  <button type="button" class="psn-tab ${state.psnMode === 'direct' ? 'is-active' : ''}" data-psn-mode="direct">${esc(t('auth.psnTabDirect'))}</button>
                </div>
                ${
                  state.psnMode === 'bio' && providers.ps.bioChallengeReady
                    ? `
                      <div style="display:flex;gap:8px;">
                        <input id="psn-online-id" type="text" placeholder="${esc(t('auth.psnOnlineIdPlaceholder'))}" value="${esc(state.psnChallenge?.onlineId || '')}" />
                        <button type="button" class="btn-outline" id="psn-gen-code-btn">${esc(t('auth.getCode'))}</button>
                      </div>
                      ${
                        state.psnChallenge
                          ? `<div class="psn-code-box">${t('auth.psnBioCodeHtml', { code: esc(state.psnChallenge.code) })}</div>
                            <button type="button" class="btn-primary provider-btn" id="psn-verify-bio-btn">${platIcon('ps')} ${esc(t('auth.psnVerifyAccount'))}</button>`
                          : ''
                      }
                    `
                    : `
                      <p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;">
                        ${t('auth.psnDirectStepsHtml')}
                      </p>
                      <input id="psn-npsso-input" type="password" placeholder="${esc(t('auth.psnNpssoPlaceholder'))}" autocomplete="off" />
                      <button type="button" class="btn-primary provider-btn" id="psn-verify-direct-btn">${platIcon('ps')} ${esc(t('auth.psnVerifyLibrary'))}</button>
                    `
                }
                <div id="psn-status" class="form-status" role="status"></div>
              </div>`
            : ''
        }`;

    dlg.innerHTML = `<div class="modal-scroll"><div class="auth-modal-body">
      <button type="button" class="modal-close-btn" data-close-modal="auth-modal" aria-label="${esc(t('modal.close'))}">✕</button>
      <div class="eyebrow" style="margin-bottom:10px;">${esc(t('auth.eyebrow'))}</div>
      <h2>${t('auth.titleHtml')}</h2>
      <p class="auth-modal-desc">${esc(t('auth.desc'))}</p>

      <div class="trust-callout">
        <strong>${esc(t('auth.safeTitle'))}</strong>
        <ul>
          <li>${t('auth.safeItem1Html')}</li>
          <li>${t('auth.safeItem2Html')}</li>
          <li>${t('auth.safeItem3Html')}</li>
        </ul>
      </div>

      <div class="provider-stack">
        <!-- STEAM -->
        <div class="provider-card ${acc.pc ? 'is-connected' : ''}">
          <div class="provider-row">
            <span class="provider-logo">${platIcon('pc')}</span>
            <div class="provider-meta">
              <strong>Steam (PC)</strong>
              <span>${acc.pc ? esc(acc.pc.name) : esc(t('auth.steamSub'))}</span>
            </div>
            ${
              acc.pc
                ? `<div class="provider-actions">
                    <span class="provider-connected-btn">${esc(t('auth.connected'))}</span>
                    <button type="button" class="provider-unlink-btn" data-unlink-plat="pc" title="${esc(t('auth.disconnectTitle', { platform: 'Steam' }))}">${esc(t('auth.unlink'))}</button>
                  </div>`
                : `<a class="provider-connect-btn" href="/auth/steam">${esc(t('auth.connect'))}</a>`
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
              <span>${acc.xbox ? esc(acc.xbox.name) : esc(t('auth.xboxSub'))}</span>
            </div>
            ${
              acc.xbox
                ? `<div class="provider-actions">
                    <span class="provider-connected-btn">${esc(t('auth.connected'))}</span>
                    <button type="button" class="provider-unlink-btn" data-unlink-plat="xbox" title="${esc(t('auth.disconnectTitle', { platform: 'Xbox' }))}">${esc(t('auth.unlink'))}</button>
                  </div>`
                : providers.xbox.configured
                  ? `<a class="provider-connect-btn" href="/auth/xbox">${esc(t('auth.connect'))}</a>`
                  : providers.xbox.bioChallengeReady
                    ? `<button type="button" class="provider-connect-btn" data-toggle-xbox>${esc(state.xboxPanelOpen ? t('auth.cancel') : t('auth.connect'))}</button>`
                    : `<a class="provider-connect-btn" href="/auth/xbox">${esc(t('auth.connect'))}</a>`
            }
          </div>
          ${
            !acc.xbox && providers.xbox.bioChallengeReady && !providers.xbox.configured && state.xboxPanelOpen
              ? `<div class="psn-panel">
                  <div style="display:flex;gap:8px;">
                    <input id="xbox-gamertag-input" type="text" placeholder="${esc(t('auth.xboxGamertagPlaceholder'))}" value="${esc(state.xboxChallenge?.gamertag || '')}" />
                    <button type="button" class="btn-outline" id="xbox-gen-code-btn">${esc(t('auth.getCode'))}</button>
                  </div>
                  ${
                    state.xboxChallenge
                      ? `<div class="psn-code-box">${t('auth.xboxBioCodeHtml', { code: esc(state.xboxChallenge.code) })}</div>
                        <button type="button" class="btn-primary provider-btn" id="xbox-verify-bio-btn">${platIcon('xbox')} ${esc(t('auth.xboxVerifyAccount'))}</button>`
                      : ''
                  }
                  <div id="xbox-status" class="form-status" role="status"></div>
                </div>`
              : ''
          }
        </div>
      </div>

      <div class="provider-note">${t('auth.notePrivacyHtml')}</div>
      <div class="provider-note" style="margin-top:10px;">${t('auth.noteUnavailableHtml')}</div>
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
        status.textContent = t('auth.statusGenerating');
        try {
          const res = await fetch('/auth/psn/challenge', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ onlineId }),
          });
          const data = await res.json();
          if (!res.ok) {
            status.className = 'form-status err';
            status.textContent = data.error || t('auth.statusGenError');
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
        status.textContent = t('auth.statusPsnCheckingBio');
        try {
          const res = await fetch('/auth/psn/verify', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) {
            status.className = 'form-status err';
            status.textContent = data.error || t('auth.statusVerifyFail');
            verifyBioBtn.disabled = false;
            return;
          }
          trackMarketingEvent('connect', 'ps');
          await refreshSessionAfterAuth(t('auth.statusPsnConnected'));
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
        status.textContent = t('auth.statusPsnVerifying');
        try {
          const res = await fetch('/auth/psn/direct', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ npsso }),
          });
          const data = await res.json();
          if (!res.ok) {
            status.className = 'form-status err';
            status.textContent = data.error || t('auth.statusPsnNpssoError');
            verifyDirectBtn.disabled = false;
            return;
          }
          trackMarketingEvent('connect', 'ps');
          await refreshSessionAfterAuth(t('auth.statusPsnConnected'));
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
        xboxStatus.textContent = t('auth.statusGenerating');
        try {
          const res = await fetch('/auth/xbox/challenge', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ gamertag }),
          });
          const data = await res.json();
          if (!res.ok) {
            xboxStatus.className = 'form-status err';
            xboxStatus.textContent = data.error || t('auth.statusGenError');
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
        xboxStatus.textContent = t('auth.statusXboxCheckingBio');
        try {
          const res = await fetch('/auth/xbox/verify', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) {
            xboxStatus.className = 'form-status err';
            xboxStatus.textContent = data.error || t('auth.statusVerifyFail');
            xboxVerifyBtn.disabled = false;
            return;
          }
          state.xboxChallenge = null;
          state.xboxPanelOpen = false;
          trackMarketingEvent('connect', 'xbox');
          await refreshSessionAfterAuth(t('auth.statusXboxConnected'));
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
      { id: String(gameId), name: t('game.fallbackName', { id: gameId }), date: null, platforms: ['pc'], scores: {} };

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
      if (revBox) revBox.innerHTML = `<p class="section-description">${esc(t('game.loadReviewsError', { msg: err.message }))}</p>`;
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
      pill.textContent = t('game.refreshingLib', { platform: PLAT_LABELS[plat] });
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
        showToast(t('library.refreshedToast', { platform: PLAT_LABELS[plat] }));
      }
    } catch {
      showToast(t('game.refreshLibError'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function syncReviewSubmitState() {
    const submitBtn = $('#submit-review-btn');
    if (!submitBtn) return;
    const total = calcWeightedBreakdown(state.modalDraftBreakdown);
    const eligible = Boolean(state.modalEligibilityAllowed);
    submitBtn.disabled = !eligible || total === null;
  }

  function updateModalEligibilityBadge() {
    const pill = $('#modal-eligibility');
    const statusEl = $('#review-form-status');
    if (!pill || !state.modalEligibility) {
      syncReviewSubmitState();
      return;
    }
    const p = state.modalRatePlatform;
    const info = state.modalEligibility[p];
    if (!info) {
      syncReviewSubmitState();
      return;
    }

    const platName = PLAT_LABELS[p];
    const refreshHtml = ` <button type="button" class="inline-refresh-link" id="modal-refresh-lib-btn">${esc(t('game.refreshLibBtn', { platform: platName }))}</button>`;

    if (info.released === false) {
      pill.className = 'eligibility-pill err';
      pill.textContent = t('game.notReleasedOn', { platform: platName });
      state.modalEligibilityAllowed = false;
    } else if (!info.connected) {
      pill.className = 'eligibility-pill muted';
      pill.textContent = t('game.eligConnect', { platform: platName });
      state.modalEligibilityAllowed = false;
    } else if (info.legacy) {
      pill.className = 'eligibility-pill classic';
      pill.textContent = t('game.classicPillFull', { era: info.legacyEra || t('reviews.classicFallback') });
      state.modalEligibilityAllowed = true;
    } else if (info.error) {
      pill.className = 'eligibility-pill warn';
      pill.textContent = t('game.eligUnavailable');
      if (statusEl) {
        statusEl.className = 'form-status err';
        statusEl.innerHTML = `${esc(info.error)}${refreshHtml}`;
      }
      state.modalEligibilityAllowed = false;
    } else if (!info.owned) {
      pill.className = 'eligibility-pill err';
      pill.textContent = t('game.eligNotOwned', { platform: platName });
      if (statusEl) {
        statusEl.className = 'form-status err';
        const msg = t('game.eligNotOwnedMsg', { platform: platName, hours: info.minHours });
        statusEl.innerHTML = `${esc(msg)}${refreshHtml}`;
      }
      state.modalEligibilityAllowed = false;
    } else if (!info.eligible) {
      pill.className = 'eligibility-pill warn';
      pill.textContent = t('game.eligNeedMore', { played: info.hours, min: info.minHours });
      if (statusEl) {
        statusEl.className = 'form-status err';
        const msg = t('game.eligNeedMoreMsg', {
          more: Math.max(0.1, info.minHours - info.hours).toFixed(1),
          platform: platName,
        });
        statusEl.innerHTML = `${esc(msg)}${refreshHtml}`;
      }
      state.modalEligibilityAllowed = false;
    } else {
      pill.className = 'eligibility-pill ok';
      pill.textContent = t('game.eligVerified', { platform: platName, hours: info.hours });
      if (statusEl && statusEl.classList.contains('err')) {
        statusEl.className = 'form-status';
        statusEl.textContent = '';
      }
      state.modalEligibilityAllowed = true;
    }
    syncReviewSubmitState();
  }

  function renderGameModalShell(g, payload = null, preserveDraft = false) {
    const dlg = $('#game-modal');
    const prevDraftText = preserveDraft ? $('#review-text')?.value : null;
    const scores = payload?.scores || g.scores || { pc: null, ps: null, xbox: null };
    const stats = payload?.stats || { totalReviews: 0, spike: false };
    const gamePlats = (g.platforms && g.platforms.length) ? g.platforms : ['pc'];
    const activePlat = gamePlats.includes(state.modalRatePlatform) ? state.modalRatePlatform : gamePlats[0];
    state.modalRatePlatform = activePlat;
    const legacyInfo = payload?.legacy?.[activePlat] || { legacy: false, era: '', reason: '' };
    const myReview = payload?.myReviews?.[activePlat] || null;
    const linked = connectedPlatforms();
    const isPlatConnected = linked.includes(activePlat);
    const year = g.date ? g.date.slice(0, 4) : t('game.unknownYear');
    const existingBreakdown = myReview && myReview.breakdown ? myReview.breakdown : null;
    if (!preserveDraft || !state.modalDraftBreakdown) {
      state.modalDraftBreakdown = {
        fun: Number.isInteger(existingBreakdown?.fun) ? existingBreakdown.fun : null,
        performance: Number.isInteger(existingBreakdown?.performance) ? existingBreakdown.performance : null,
        gameplay: Number.isInteger(existingBreakdown?.gameplay) ? existingBreakdown.gameplay : null,
        visuals: Number.isInteger(existingBreakdown?.visuals) ? existingBreakdown.visuals : null,
      };
    }
    state.modalEligibilityAllowed = Boolean(legacyInfo.legacy);
    const initialCalculated = calcWeightedBreakdown(state.modalDraftBreakdown);
    const initialAnsweredCount = REVIEW_QUESTIONS.filter((q) => Number.isInteger(state.modalDraftBreakdown[q.key])).length;
    const initialText = prevDraftText !== null && prevDraftText !== undefined ? prevDraftText : myReview ? myReview.text : '';
    const backdropUrl = g.hdr || g.cover || '';
    const activePlatName = PLAT_LABELS[activePlat];

    dlg.innerHTML = `<div class="modal-scroll">
      <button type="button" class="modal-close-btn" data-close-modal="game-modal" aria-label="${esc(t('modal.close'))}">✕</button>
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
              ${g.developer ? `<span>${esc(t('game.developer'))} <strong>${esc(g.developer)}</strong></span>` : ''}
              ${g.publisher ? `<span>${esc(t('game.publisher'))} <strong>${esc(g.publisher)}</strong></span>` : ''}
              ${g.generations && g.generations.length ? `<span>${esc(t('game.systems'))} <strong>${esc(g.generations.join(' · '))}</strong></span>` : ''}
              <span>${esc(t('game.released'))} <strong>${esc(year)}</strong>${g.trend >= 1000 ? ` · <strong>${formatCompact(g.trend)}</strong> ${esc(t('game.peakPlayers'))}` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="game-modal-body">
        <div class="modal-scores-grid">
          ${['pc', 'ps', 'xbox']
            .map((p) => {
              const releasedHere = gamePlats.includes(p);
              const isActiveCard = releasedHere && activePlat === p;
              const s = scores[p];
              const revWord = s && s.n === 1 ? t('catalog.reviewOne') : t('catalog.reviewMany');
              const subText = !releasedHere
                ? t('game.notReleasedOn', { platform: PLAT_LABELS[p] })
                : s
                  ? s.legacyOnly
                    ? `${s.n} ${revWord} · ${t('game.classicEraShort')}`
                    : `${s.n} ${revWord}${s.avgHours ? ` · ${t('game.avgHoursShort', { hours: s.avgHours })}` : ''}`
                  : t('game.noVerifiedReviews');
              return `<div class="modal-score-card ${scoreClass(s && s.score)} ${releasedHere ? 'is-selectable' : 'is-unreleased'} ${isActiveCard ? 'is-active-plat' : ''}" ${releasedHere ? `data-rate-plat="${p}" role="button" tabindex="0" aria-pressed="${isActiveCard ? 'true' : 'false'}"` : ''}>
                <div class="modal-score-top">
                  <span>${PLAT_LABELS[p]}</span>
                  ${platIcon(p)}
                </div>
                <div class="modal-score-val">${s ? s.score : '–'}</div>
                <div class="modal-score-sub">${esc(subText)}</div>
              </div>`;
            })
            .join('')}
        </div>

        ${(() => {
          const activeSc = scores[activePlat];
          const hasReviews = Boolean(activeSc && activeSc.n);
          const criteriaAvg = activeSc?.criteriaAvg || null;
          const d = activeSc?.dist || { hi: 0, mid: 0, lo: 0 };
          const hiPct = hasReviews ? Math.round((d.hi / activeSc.n) * 100) : 0;
          const midPct = hasReviews ? Math.round((d.mid / activeSc.n) * 100) : 0;
          const loPct = hasReviews ? Math.max(0, 100 - hiPct - midPct) : 0;
          const hoursMeta = hasReviews
            ? activeSc.legacyOnly
              ? t('game.classicVerified')
              : t('game.medianAvgHours', {
                  median: activeSc.medianHours || activeSc.avgHours || 0,
                  avg: activeSc.avgHours || 0,
                })
            : t('game.noRatingsYet');
          const revWord = activeSc && activeSc.n === 1 ? t('catalog.reviewOne') : t('catalog.reviewMany');
          return `<div class="score-breakdown-box">
            <div class="score-breakdown-head">
              <strong>${esc(t('game.scoreBreakdown', { platform: activePlatName }))}${hasReviews ? ` (${activeSc.n} ${esc(revWord)})` : ''}</strong>
              <span>${esc(t('game.totalAvg'))} <b class="breakdown-total-inline ${scoreClass(activeSc && activeSc.score)}">${hasReviews ? `${activeSc.score}/100` : '–'}</b> · ${esc(hoursMeta)}</span>
            </div>
            <div class="criteria-avg-grid" aria-label="${esc(t('game.criteriaGridAria', { platform: activePlatName }))}">
              ${REVIEW_QUESTIONS.map((q) => {
                const rawVal = criteriaAvg ? criteriaAvg[q.key] : null;
                const hasVal = rawVal !== null && rawVal !== undefined && Number.isFinite(Number(rawVal));
                const avg = hasVal ? Number(rawVal) : 0;
                const pct = hasVal ? Math.min(100, Math.max(0, Math.round((avg / 10) * 100))) : 0;
                const tier = !hasVal ? 'na' : avg >= 7.5 ? 'hi' : avg >= 5 ? 'mid' : 'lo';
                return `<div class="criteria-avg-item">
                  <div class="criteria-avg-top">
                    <span>${esc(qShort(q))}</span>
                    <strong class="${tier}">${hasVal ? avg.toFixed(1) : '–'}<small>/10</small></strong>
                  </div>
                  <div class="criteria-avg-bar"><span class="${tier}" style="width:${pct}%"></span></div>
                </div>`;
              }).join('')}
            </div>
            ${
              hasReviews
                ? `<div class="score-dist-bar" aria-label="${esc(t('game.distAria', { platform: activePlatName }))}">
                    ${d.hi ? `<span class="score-dist-seg hi" style="width:${hiPct}%"></span>` : ''}
                    ${d.mid ? `<span class="score-dist-seg mid" style="width:${midPct}%"></span>` : ''}
                    ${d.lo ? `<span class="score-dist-seg lo" style="width:${loPct}%"></span>` : ''}
                  </div>
                  <div class="score-breakdown-legend">
                    <span><i class="legend-swatch hi"></i>${esc(t('game.distPositive', { n: d.hi }))}</span>
                    <span><i class="legend-swatch mid"></i>${esc(t('game.distMixed', { n: d.mid }))}</span>
                    <span><i class="legend-swatch lo"></i>${esc(t('game.distNegative', { n: d.lo }))}</span>
                  </div>`
                : ''
            }
          </div>`;
        })()}

        ${stats.spike ? `<div class="spike-notice">${t('game.spikeHtml')}</div>` : ''}

        <div class="rate-section" id="modal-rate-section">
          ${
            gamePlats.length > 1
              ? `<div class="rate-platform-bar" role="group" aria-label="${esc(t('game.choosePlatAria'))}">
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
              <h3>${esc(myReview ? t('game.editReviewTitle', { platform: activePlatName }) : t('game.rateOnTitle', { platform: activePlatName }))}</h3>
              <span id="modal-eligibility" class="eligibility-pill ${legacyInfo.legacy ? 'classic' : 'muted'}">${esc(
                legacyInfo.legacy
                  ? t('game.classicPillFull', { era: legacyInfo.era || t('reviews.classicFallback') })
                  : t('game.checkingLib', { platform: activePlatName })
              )}</span>
            </div>
            ${
              legacyInfo.legacy
                ? `<div class="legacy-banner">${t('game.legacyBannerHtml', { reason: esc(legacyInfo.reason), platform: esc(activePlatName) })}</div>`
                : `<p class="rate-isolation-note">${t('game.isolationNoteHtml', { platform: esc(activePlatName) })}</p>`
            }
            <form id="review-form" class="review-form" novalidate>
              ${
                myReview && !existingBreakdown
                  ? `<p class="legacy-score-migrate-note">${t('game.legacyMigrateHtml', { score: myReview.score })}</p>`
                  : ''
              }
              <div class="score-questions-list" id="score-questions-list">
                ${REVIEW_QUESTIONS.map((q) => {
                  const cur = state.modalDraftBreakdown[q.key];
                  const hasVal = Number.isInteger(cur);
                  const valText = hasVal ? `${cur} / 10` : '0–10';
                  const lbl = qLabel(q);
                  return `<fieldset class="score-question-card ${hasVal ? 'is-answered' : ''}" data-q-key="${q.key}">
                    <div class="score-question-head">
                      <div class="score-question-title-wrap">
                        <span class="score-question-num">${esc(t('game.qPrefix', { num: q.num }))}</span>
                        <legend class="score-question-label">${esc(lbl)} <span class="score-question-req" aria-hidden="true">*</span></legend>
                        <span class="q-tip-wrap">
                          <button type="button" class="q-tip-btn" aria-label="${esc(t('game.qTipAria', { label: lbl }))}" aria-expanded="false">?</button>
                          <span class="q-tip-pop" role="tooltip">${esc(qTip(q))}</span>
                        </span>
                      </div>
                      <span class="score-question-pts" data-q-pts="${q.key}">${valText}</span>
                    </div>
                    <div class="score-scale-row" role="radiogroup" aria-label="${esc(t('game.qScaleAria', { label: lbl }))}">
                      ${Array.from({ length: 11 }, (_, n) => {
                        const selected = cur === n;
                        return `<button type="button" class="score-scale-btn ${selected ? 'is-selected' : ''}" role="radio" aria-checked="${selected ? 'true' : 'false'}" data-q-key="${q.key}" data-q-val="${n}">${n}</button>`;
                      }).join('')}
                    </div>
                  </fieldset>`;
                }).join('')}
              </div>

              <div class="weighted-total-bar" id="weighted-total-bar">
                <div class="weighted-total-meta">
                  <span class="weighted-total-label">${esc(t('game.finalScore'))}</span>
                  <span class="weighted-total-sub" id="weighted-total-sub">${esc(
                    initialCalculated !== null
                      ? t('game.calculatedSub')
                      : t('game.incompleteSub', { n: initialAnsweredCount })
                  )}</span>
                </div>
                <div class="weighted-total-readout">
                  <span id="score-total-num" class="weighted-total-num ${scoreClass(initialCalculated)}">${
                    initialCalculated !== null ? initialCalculated : '—'
                  }</span>
                  <span class="weighted-total-denom">/ 100</span>
                  <span id="score-verdict" class="verdict-chip ${initialCalculated !== null ? scoreClass(initialCalculated) : 'pending'}">${esc(
                    initialCalculated !== null ? verdictFor(initialCalculated) : t('game.incomplete')
                  )}</span>
                </div>
              </div>

              <textarea id="review-text" class="review-textarea" maxlength="2000" placeholder="${esc(t('game.textareaPlaceholder', { platform: activePlatName }))}">${esc(initialText)}</textarea>
              <div class="review-form-actions">
                <span class="char-count"><span id="review-chars">${initialText.length}</span> / 2000</span>
                <div style="display:flex;gap:10px;align-items:center;">
                  ${myReview ? `<button type="button" class="btn-danger" id="delete-review-btn">${esc(t('game.deleteReview'))}</button>` : ''}
                  <button type="submit" class="btn-primary" id="submit-review-btn" ${initialCalculated === null || !state.modalEligibilityAllowed ? 'disabled' : ''}>${esc(myReview ? t('game.updateReview', { platform: activePlatName }) : t('game.publishReview', { platform: activePlatName }))}</button>
                </div>
              </div>
              <div id="review-form-status" class="form-status" role="status"></div>
            </form>
          `
              : `
            <div class="rate-signin-box">
              <div>
                <h3 style="margin-bottom:6px;">${esc(
                  linked.length
                    ? t('game.requiresAccount', { name: g.name, platform: activePlatName })
                    : t('game.haveYouPlayed', { name: g.name })
                )}</h3>
                <p>${esc(
                  linked.length
                    ? t('game.connectLinkedPrompt', {
                        platform: activePlatName,
                        target: legacyInfo.legacy
                          ? t('game.targetClassic', { era: legacyInfo.era })
                          : t('game.targetTitle', { platform: activePlatName }),
                      })
                    : legacyInfo.legacy
                      ? t('game.connectGuestClassic', { platform: activePlatName, era: legacyInfo.era })
                      : t('game.connectGuestNormal', {
                          platforms: gamePlats.map((p) => PLAT_LABELS[p]).join(` ${t('game.orWord')} `),
                        })
                )}</p>
              </div>
              <button type="button" class="btn-primary" data-action="${activePlat === 'ps' ? 'open-psn-connect' : activePlat === 'xbox' ? 'open-xbox-connect' : 'open-auth'}">
                ${platIcon(activePlat)} ${esc(t('game.connectPlatformBtn', { platform: activePlatName }))}
              </button>
            </div>
          `
          }
        </div>

        <div class="modal-reviews-head">
          <h3>${esc(t('game.modalReviewsTitle', { count: payload ? payload.reviews.length : '…' }))}</h3>
          <select id="modal-review-sort" class="size-select" style="height:34px;font-size:12.5px;" aria-label="${esc(t('game.sortGameReviewsAria'))}">
            <option value="recent">${esc(t('game.sortNewestFirst'))}</option>
            <option value="hours">${esc(t('reviews.sort.hours'))}</option>
            <option value="high">${esc(t('reviews.sort.high'))}</option>
            <option value="low">${esc(t('reviews.sort.low'))}</option>
          </select>
        </div>

        <div id="modal-reviews-list">
          ${payload ? renderModalReviewsHtml(payload.reviews) : `<p class="section-description">${esc(t('game.loadingReviews'))}</p>`}
        </div>
      </div>
    </div>`;

    bindModalInteractions(g);
    updateModalEligibilityBadge();
  }

  function renderModalReviewsHtml(reviews) {
    if (!reviews.length) {
      return `<p class="section-description">${esc(t('game.noReviewsInModal'))}</p>`;
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
      .map((r) => {
        const platLabel = PLAT_LABELS[r.platform] || r.platform;
        return `<article class="review-item">
          <div class="review-item-head">
            ${r.avatar ? `<img src="${esc(r.avatar)}" referrerpolicy="no-referrer" alt="" />` : ''}
            <span class="review-author-name">${esc(r.name)}</span>
            ${
              r.isMine
                ? `<span class="verified-pill">${esc(t('reviews.youPill'))}</span>`
                : r.legacy
                  ? `<span class="classic-pill">${esc(t('reviews.classicPill'))}</span>`
                  : `<span class="verified-pill">${esc(t('reviews.verifiedPill'))}</span>`
            }
            <span class="review-playtime">${
              r.legacy
                ? t('game.reviewLegacyMeta', {
                    era: esc(r.legacyEra || t('reviews.classicFallback')),
                    icon: platIcon(r.platform),
                    platform: esc(platLabel),
                  })
                : t('game.reviewPlayedMeta', {
                    hours: r.hours,
                    icon: platIcon(r.platform),
                    platform: esc(platLabel),
                  })
            }</span>
            <span class="review-score-pill ${scoreClass(r.score)}">${r.score}</span>
          </div>
          ${renderReviewBreakdownPills(r.breakdown)}
          ${r.text ? `<p class="review-item-body">${esc(r.text)}</p>` : ''}
          <div class="review-item-date">${esc(formatDate(r.ts))}${r.edited ? esc(t('game.editedSuffix')) : ''}</div>
        </article>`;
      })
      .join('');
  }

  function bindModalInteractions(game) {
    const questionsHost = $('#score-questions-list');
    const totalNum = $('#score-total-num');
    const totalSub = $('#weighted-total-sub');
    const verdict = $('#score-verdict');
    const textarea = $('#review-text');
    const chars = $('#review-chars');
    const form = $('#review-form');
    const delBtn = $('#delete-review-btn');
    const sortSel = $('#modal-review-sort');

    const closeAllTooltips = (exceptWrap = null) => {
      if (!questionsHost) return;
      questionsHost.querySelectorAll('.q-tip-wrap.is-open').forEach((wrap) => {
        if (wrap === exceptWrap) return;
        wrap.classList.remove('is-open');
        const btn = wrap.querySelector('.q-tip-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    };

    const syncWeightedPreview = () => {
      const answers = state.modalDraftBreakdown || {};
      const answeredCount = REVIEW_QUESTIONS.filter((q) => Number.isInteger(answers[q.key])).length;
      const total = calcWeightedBreakdown(answers);

      for (const q of REVIEW_QUESTIONS) {
        const val = answers[q.key];
        const card = questionsHost?.querySelector(`.score-question-card[data-q-key="${q.key}"]`);
        const ptsEl = questionsHost?.querySelector(`[data-q-pts="${q.key}"]`);
        const hasVal = Number.isInteger(val);
        if (card) {
          card.classList.toggle('is-answered', hasVal);
          if (hasVal) card.classList.remove('is-missing');
        }
        if (ptsEl) {
          ptsEl.textContent = hasVal ? `${val} / 10` : '0–10';
        }
      }

      if (totalNum) {
        totalNum.textContent = total !== null ? String(total) : '—';
        totalNum.className = `weighted-total-num ${scoreClass(total)}`;
      }
      if (totalSub) {
        totalSub.textContent =
          total !== null
            ? t('game.calculatedSub')
            : t('game.incompleteSub', { n: answeredCount });
      }
      if (verdict) {
        if (total !== null) {
          verdict.textContent = verdictFor(total);
          verdict.className = `verdict-chip ${scoreClass(total)}`;
        } else {
          verdict.textContent = t('game.incomplete');
          verdict.className = 'verdict-chip pending';
        }
      }
      syncReviewSubmitState();
    };

    if (questionsHost) {
      questionsHost.addEventListener('click', (e) => {
        const tipBtn = e.target.closest('.q-tip-btn');
        if (tipBtn) {
          e.preventDefault();
          const wrap = tipBtn.closest('.q-tip-wrap');
          const willOpen = !wrap.classList.contains('is-open');
          closeAllTooltips(willOpen ? wrap : null);
          wrap.classList.toggle('is-open', willOpen);
          tipBtn.setAttribute('aria-expanded', String(willOpen));
          return;
        }
        const scaleBtn = e.target.closest('.score-scale-btn');
        if (scaleBtn) {
          closeAllTooltips();
          const key = scaleBtn.dataset.qKey;
          const val = Number(scaleBtn.dataset.qVal);
          if (!key || !Number.isInteger(val) || val < 0 || val > 10) return;
          state.modalDraftBreakdown[key] = val;
          const group = scaleBtn.closest('.score-scale-row');
          if (group) {
            group.querySelectorAll('.score-scale-btn').forEach((btn) => {
              const active = btn === scaleBtn;
              btn.classList.toggle('is-selected', active);
              btn.setAttribute('aria-checked', String(active));
            });
          }
          syncWeightedPreview();
          return;
        }
        closeAllTooltips();
      });
    }

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
        const calculated = calcWeightedBreakdown(state.modalDraftBreakdown);
        if (calculated === null) {
          for (const q of REVIEW_QUESTIONS) {
            if (!Number.isInteger(state.modalDraftBreakdown?.[q.key])) {
              const card = questionsHost?.querySelector(`.score-question-card[data-q-key="${q.key}"]`);
              if (card) card.classList.add('is-missing');
            }
          }
          status.className = 'form-status err';
          status.textContent = t('game.answerAllErr');
          return;
        }

        status.className = 'form-status';
        status.textContent = t('game.verifyingSubmit', { platform: PLAT_LABELS[plat] });
        submitBtn.disabled = true;

        try {
          const res = await fetch('/api/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              gameId: game.id,
              platform: plat,
              breakdown: state.modalDraftBreakdown,
              text: textarea.value,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            status.className = 'form-status err';
            status.textContent = data.error || t('game.saveError');
            syncReviewSubmitState();
            return;
          }
          if (!data.edited) {
            trackMarketingEvent('review', plat);
          }
          const finalScore = Number.isFinite(Number(data.score)) ? Number(data.score) : calculated;
          showToast(
            t(data.edited ? 'game.updatedToast' : 'game.publishedToast', {
              platform: PLAT_LABELS[plat],
              score: finalScore,
            })
          );
          syncLocalLibraryReviewState(data.gameId || game.id, plat, finalScore);
          await openGameModal(data.gameId || game.id, game, plat);
          loadCatalog();
          loadStats();
          if (state.view === 'reviews') loadReviewsFeed();
          if (state.view === 'library') {
            loadLibraryView();
          }
        } catch (err) {
          status.className = 'form-status err';
          status.textContent = err.message || t('game.networkError');
          syncReviewSubmitState();
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
            showToast(t('game.deletedToast', { platform: PLAT_LABELS[plat] }));
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
    if ($('#f-playtime')) {
      $('#f-playtime').addEventListener('change', () => {
        state.page = 1;
        loadCatalog();
      });
    }
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
      const langTrigger = e.target.closest('[data-action="toggle-lang-menu"]');
      if (langTrigger) {
        const wrap = langTrigger.closest('[data-lang-switch]');
        const menu = wrap?.querySelector('.lang-menu');
        const willOpen = !wrap?.classList.contains('is-open');
        closeLangMenus();
        if (wrap && menu && willOpen) {
          wrap.classList.add('is-open');
          langTrigger.setAttribute('aria-expanded', 'true');
          menu.hidden = false;
        }
        return;
      }
      const langOption = e.target.closest('[data-set-lang]');
      if (langOption) {
        const code = langOption.dataset.setLang;
        closeLangMenus();
        if (I18N && code) I18N.setLang(code);
        return;
      }
      if (!e.target.closest('[data-lang-switch]')) {
        closeLangMenus();
      }
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
        showToast(t('footer.coffeeUnconfigured'));
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
        await refreshSessionAfterAuth(t('auth.unlinkedToast', { platform: PLAT_LABELS[p] }));
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
        if (k === 'playtime' && $('#f-playtime')) $('#f-playtime').value = '';
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
        closeLangMenus();
      }
    });

    window.addEventListener('offline', () => {
      showToast(t('toast.offline'));
    });
    window.addEventListener('online', () => {
      showToast(t('toast.online'));
    });
  }

  function handleLanguageChange() {
    renderUserControls();
    if (typeof state.refreshHeroMeta === 'function') state.refreshHeroMeta();
    renderStatsNumbers();
    if (state.stats) renderSpotlight(state.stats.spotlight || []);
    updateActiveFilterPills();
    if (state.lastCatalogData) renderCatalogData(state.lastCatalogData);
    if (state.view === 'reviews' && state.lastReviewsFeedData) {
      renderReviewsFeedData(state.lastReviewsFeedData);
    }
    if (state.view === 'library') {
      if (connectedPlatforms().length && state.library) {
        renderLibraryList();
      } else {
        loadLibraryView();
      }
    }
    if ($('#game-modal')?.open && state.currentModalGame) {
      renderGameModalShell(state.currentModalGame, state.currentModalPayload, true);
    }
    if ($('#auth-modal')?.open) {
      renderAuthModal();
    }
    if ($('#confirm-modal')?.open) {
      openLogoutConfirmModal();
    }
  }

  async function boot() {
    if (I18N) {
      I18N.applyDomTranslations(document);
      I18N.onChange(handleLanguageChange);
    }
    initEvents();
    initHeroShowcase();

    const params = new URLSearchParams(window.location.search);
    initUtmAttribution(params);
    const errCode = params.get('e');
    const connected = params.get('connected');
    const hasUtm = params.has('utm_source') || params.has('utm_campaign') || params.has('utm_medium');
    if (errCode === 'login') showToast(t('toast.steamLoginFail'));
    if (errCode === 'xbox_login') showToast(t('toast.xboxLoginFail'));
    if (errCode === 'xbox_config') {
      showToast(t('toast.xboxConfigUnavailable'));
    }
    if (connected && PLAT_LABELS[connected]) {
      trackMarketingEvent('connect', connected);
      showToast(t('toast.connected', { platform: PLAT_LABELS[connected] }));
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
