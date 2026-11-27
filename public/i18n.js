(() => {
  'use strict';

  const STORAGE_KEY = 'playtested_lang';
  const SUPPORTED = ['en', 'pt-BR', 'es'];

  const LANGUAGES = [
    { code: 'en', label: 'English', short: 'EN', locale: 'en-US' },
    { code: 'pt-BR', label: 'Português (BR)', short: 'PT', locale: 'pt-BR' },
    { code: 'es', label: 'Español', short: 'ES', locale: 'es-ES' },
  ];

  // Crisp inline SVGs (Windows browsers render flag emojis as plain "US"/"BR"/"ES" text)
  const FLAGS = {
    en:
      '<svg class="lang-flag-svg" viewBox="0 0 24 16" aria-hidden="true">' +
      '<rect width="24" height="16" fill="#FFFFFF"/>' +
      '<g fill="#B22234">' +
      '<rect y="0" width="24" height="1.23"/>' +
      '<rect y="2.46" width="24" height="1.23"/>' +
      '<rect y="4.92" width="24" height="1.23"/>' +
      '<rect y="7.38" width="24" height="1.23"/>' +
      '<rect y="9.85" width="24" height="1.23"/>' +
      '<rect y="12.31" width="24" height="1.23"/>' +
      '<rect y="14.77" width="24" height="1.23"/>' +
      '</g>' +
      '<rect width="10.4" height="8.62" fill="#3C3B6E"/>' +
      '<g fill="#FFFFFF">' +
      '<circle cx="1.8" cy="1.7" r="0.55"/><circle cx="4.0" cy="1.7" r="0.55"/><circle cx="6.2" cy="1.7" r="0.55"/><circle cx="8.4" cy="1.7" r="0.55"/>' +
      '<circle cx="2.9" cy="3.1" r="0.55"/><circle cx="5.1" cy="3.1" r="0.55"/><circle cx="7.3" cy="3.1" r="0.55"/>' +
      '<circle cx="1.8" cy="4.5" r="0.55"/><circle cx="4.0" cy="4.5" r="0.55"/><circle cx="6.2" cy="4.5" r="0.55"/><circle cx="8.4" cy="4.5" r="0.55"/>' +
      '<circle cx="2.9" cy="5.9" r="0.55"/><circle cx="5.1" cy="5.9" r="0.55"/><circle cx="7.3" cy="5.9" r="0.55"/>' +
      '<circle cx="1.8" cy="7.2" r="0.55"/><circle cx="4.0" cy="7.2" r="0.55"/><circle cx="6.2" cy="7.2" r="0.55"/><circle cx="8.4" cy="7.2" r="0.55"/>' +
      '</g>' +
      '</svg>',
    'pt-BR':
      '<svg class="lang-flag-svg" viewBox="0 0 24 16" aria-hidden="true">' +
      '<rect width="24" height="16" fill="#009C3B"/>' +
      '<polygon points="12,1.8 22,8 12,14.2 2,8" fill="#FFDF00"/>' +
      '<circle cx="12" cy="8" r="3.6" fill="#002776"/>' +
      '<path d="M8.55 7.45c2.2-0.75 4.8-0.35 6.85 1.15" fill="none" stroke="#FFFFFF" stroke-width="0.72" stroke-linecap="round"/>' +
      '</svg>',
    es:
      '<svg class="lang-flag-svg" viewBox="0 0 24 16" aria-hidden="true">' +
      '<rect width="24" height="16" fill="#AA151B"/>' +
      '<rect y="4" width="24" height="8" fill="#F1BF00"/>' +
      '<g transform="translate(5.2, 5.4)">' +
      '<rect x="0.8" y="0.9" width="2.8" height="3.2" rx="0.9" fill="#AA151B"/>' +
      '<rect x="2.2" y="0.9" width="1.4" height="1.6" fill="#F1BF00"/>' +
      '<rect x="0.8" y="2.5" width="1.4" height="1.6" fill="#F1BF00"/>' +
      '<rect x="0" y="1.1" width="0.55" height="2.8" fill="#B8860B"/>' +
      '<rect x="3.85" y="1.1" width="0.55" height="2.8" fill="#B8860B"/>' +
      '<path d="M1.1 0.85h2.2l-0.35-0.65h-1.5z" fill="#AA151B"/>' +
      '</g>' +
      '</svg>',
  };

  const DICT = {
    en: {
      // Meta
      'meta.title': 'Playtested — True Reviews by True Gamers',
      'meta.description':
        'Independent 0–100 game scores for Steam, PlayStation, and Xbox — equal weight per verified owner, strictly isolated per platform, with zero critic ratings ever.',

      // Header & Navigation
      'skip.content': 'Skip to content',
      'nav.aria': 'Main navigation',
      'nav.homeAria': 'Playtested home',
      'nav.discover': 'Discover',
      'nav.reviews': 'Reviews',
      'nav.library': 'My library',
      'search.aria': 'Search games',
      'search.placeholder': 'Search games...',
      'search.clear': 'Clear search',
      'theme.aria': 'Toggle dark mode',
      'theme.title': 'Switch light or dark theme',
      'lang.aria': 'Select language',
      'lang.title': 'Change language',
      'auth.signIn': 'Sign in',
      'auth.signOut': 'Sign out',
      'auth.manageTitle': 'Manage connected Steam, PlayStation, and Xbox accounts',
      'auth.connectedPlatsAria': 'Connected platforms',

      // Hero
      'hero.eyebrow': 'VERIFIED OWNERS ONLY · ZERO CRITICS',
      'hero.h1Html': 'True Reviews<br /><em>by True Gamers</em>',
      'hero.sub':
        'Independent 0–100 scores for Steam, PlayStation, and Xbox — every verified owner counts equally, never mixed across platforms. Connect your gaming accounts to review games you actually own and played.',
      'hero.browse': 'Browse catalog',
      'hero.signInCta': 'Sign in to rate games',
      'hero.openLibrariesCta': 'Open my libraries',
      'hero.statsAria': 'Platform statistics',
      'hero.statGames': 'Games indexed',
      'hero.statReviews': 'Verified reviews',
      'hero.statHours': 'Playtime logged',
      'hero.statCritics': 'Critic scores',
      'hero.release2026': '2026 RELEASE',
      'hero.openFeaturedAria': 'Open featured game {name}',
      'hero.showSlideAria': 'Show {name}',
      'hero.artworkControlsAria': 'Featured hero artwork controls',

      // Trust Strip
      'trust.aria': 'Playtested principles',
      'trust.lead': 'VERIFIED OWNERSHIP. ALWAYS.',
      'trust.item1': 'Library-verified owners only',
      'trust.item2': '2h+ verified playtime',
      'trust.item3': 'Equal-weight 0–100 scores',
      'trust.item4': 'No critic ratings. Ever.',

      // Spotlight
      'spotlight.eyebrow': 'FRESH FROM VERIFIED LIBRARIES',
      'spotlight.titleHtml': 'Recently playtested<span class="accent-dot">.</span>',
      'spotlight.allReviews': 'Read all verified reviews',
      'spotlight.isolatedTip': '{platform} isolated score',
      'spotlight.verifiedReviewOne': '{n} verified player review',
      'spotlight.verifiedReviewMany': '{n} verified player reviews',
      'spotlight.hoursPlayed': '{hours}h played',

      // Catalog & Filters
      'catalog.eyebrow': 'THE VERIFIED CATALOG',
      'catalog.loading': 'Loading catalog…',
      'catalog.filters': 'Filters',
      'catalog.filtersAria': 'Catalog filters',
      'catalog.closeFilters': 'Close filters',
      'catalog.sortBy': 'Sort by',
      'catalog.sort.trend': 'Trending',
      'catalog.sort.new': 'Newest',
      'catalog.sort.top': 'Top rated',
      'catalog.sort.most': 'Most reviewed',
      'catalog.sort.old': 'Oldest',
      'catalog.sort.az': 'Name A to Z',
      'catalog.sort.za': 'Name Z to A',
      'catalog.title.trend': 'Trending now',
      'catalog.title.new': 'Newest releases',
      'catalog.title.old': 'Oldest releases',
      'catalog.title.top': 'Top rated',
      'catalog.title.most': 'Most reviewed',
      'catalog.title.az': 'Games A to Z',
      'catalog.title.za': 'Games Z to A',
      'catalog.title.default': 'Catalog',
      'catalog.title.search': 'Results for “{q}”',
      'catalog.releaseYear': 'Release year',
      'catalog.from': 'From',
      'catalog.to': 'To',
      'catalog.fromAria': 'Release year from',
      'catalog.toAria': 'Release year to',
      'catalog.developer': 'Developer',
      'catalog.devPlaceholder': 'e.g. FromSoftware',
      'catalog.publisher': 'Publisher',
      'catalog.pubPlaceholder': 'e.g. Valve',
      'catalog.minScore': 'Minimum score (0–100)',
      'catalog.minScorePlaceholder': 'e.g. 75',
      'catalog.avgPlaytime': 'Average Game Playtime',
      'catalog.playtime.all': 'All',
      'catalog.playtime.low': 'Low (≤ 80h)',
      'catalog.playtime.medium': 'Medium (80.1h – 200h)',
      'catalog.playtime.high': 'High (200.1h – 1,500h)',
      'catalog.playtime.second_job': 'Second Job (1,500h+)',
      'catalog.onlyReviewed': 'Only games with verified reviews',
      'catalog.resetFilters': 'Reset filters',
      'catalog.resetAllFilters': 'Reset all filters',
      'catalog.filterPlatAria': 'Filter by platform',
      'catalog.all': 'All',
      'catalog.quickSortAria': 'Quick sort',
      'catalog.perPageAria': 'Games per page',
      'catalog.perPage': '{n} per page',
      'catalog.paginationAria': 'Catalog pagination',
      'catalog.countLine':
        '{total} unique {gameWord} matching · {indexed}{knownPart} cross-platform titles indexed & deduplicated.',
      'catalog.knownPart': ' of {known}',
      'catalog.gameOne': 'game',
      'catalog.gameMany': 'games',
      'catalog.emptyTitle': 'No games match these filters.',
      'catalog.emptyBody': 'Try widening your year range, clearing developer filters, or searching another title.',
      'catalog.indexingTitle': 'Indexing catalog…',
      'catalog.indexingBody': 'Playtested is validating covers and deduplicating metadata in the background.',
      'catalog.loadErrorTitle': 'Could not load catalog',
      'catalog.loadErrorFallback': 'Check that the Playtested server is running and try again.',
      'catalog.retry': 'Retry',
      'catalog.peakTitle': 'Peak concurrent players this week',
      'catalog.hoverCta': 'Inspect & rate →',
      'catalog.reviewOne': 'review',
      'catalog.reviewMany': 'reviews',
      'catalog.prev': '← Previous',
      'catalog.next': 'Next →',
      'catalog.page': 'Page',
      'catalog.ofPages': 'of {pages}',
      'catalog.jumpPageAria': 'Jump to page number',

      // Active Filter Pills
      'pill.search': 'Search: “{q}”',
      'pill.platform': 'Platform: {platform}',
      'pill.year': 'Year: {from} – {to}',
      'pill.any': 'Any',
      'pill.dev': 'Dev: {dev}',
      'pill.pub': 'Pub: {pub}',
      'pill.min': 'Score ≥ {min}',
      'pill.playtime': 'Playtime: {label}',
      'pill.reviewed': 'Reviewed only',
      'pill.removeAria': 'Remove filter',

      // Score Trio Tooltips
      'score.tip': '{platform} score: {score}/100 from {n} verified {reviewWord}{avgPart}',
      'score.tipAvg': ' (avg {hours}h played)',
      'score.tipNone': '{platform}: no verified reviews yet',
      'cover.alt': '{name} cover',

      // Editorial Banner
      'banner.eyebrow': 'YOUR TIME IS PRECIOUS. YOUR PLAYTIME PROVES IT.',
      'banner.h3Html': 'Honest scores from people who <em>actually played.</em>',
      'banner.p':
        'Connect your Steam, PlayStation, or Xbox account to add your voice — one verified review per platform, editable anytime.',
      'banner.ctaGuest': 'Connect gaming accounts',
      'banner.ctaUser': 'Manage accounts & rate',

      // Reviews Feed
      'reviews.eyebrow': 'NO CRITICS. NO PAID HYPE.',
      'reviews.titleHtml': 'Verified player reviews<span class="accent-dot">.</span>',
      'reviews.loading': 'Loading verified reviews…',
      'reviews.loadingPlayer': 'Loading verified player reviews…',
      'reviews.filterPlatAria': 'Filter reviews by platform',
      'reviews.sortAria': 'Sort reviews',
      'reviews.sort.recent': 'Most recent',
      'reviews.sort.hours': 'Most playtime',
      'reviews.sort.high': 'Highest score',
      'reviews.sort.low': 'Lowest score',
      'reviews.countLine':
        '{total} verified owner {reviewWord}{scope}. Every score is strictly isolated to its platform.',
      'reviews.scopePlatform': ' on {platform}',
      'reviews.scopeAll': ' across Steam, PlayStation, and Xbox',
      'reviews.emptyTitle': 'No verified reviews for this platform yet.',
      'reviews.emptyBody':
        'Connect your Steam, PlayStation, or Xbox account to publish the first verified owner score here.',
      'reviews.verifiedTitle': 'Verified title',
      'reviews.verifiedScoreTitle': '{platform} verified score',
      'reviews.scoreOnly': 'Score-only verified rating.',
      'reviews.classicPill': '✦ Classic Era',
      'reviews.verifiedPill': '✓ Verified',
      'reviews.youPill': 'You',
      'reviews.legacyTitle': 'Account-verified classic on {platform}',
      'reviews.playtimeTitle': 'Verified playtime on {platform}',
      'reviews.classicFallback': 'Classic',
      'reviews.loadErrorTitle': 'Could not load reviews',

      // My Library
      'library.eyebrow': 'YOUR VERIFIED GAMES',
      'library.titleHtml': 'My connected libraries<span class="accent-dot">.</span>',
      'library.desc':
        'Connect Steam, PlayStation, or Xbox to browse your owned games and publish platform-specific scores (2h+ required).',
      'library.manageBtn': 'Manage connected accounts',
      'library.connectTitle': 'Connect your gaming accounts',
      'library.connectBody':
        'Link Steam, PlayStation, or Xbox so Playtested can verify which games you own and your real playtime (2h+ required per platform). Each platform’s reviews stay strictly isolated to its own score.',
      'library.connectSteam': 'Connect Steam',
      'library.connectPsn': 'Connect PlayStation Network',
      'library.connectXbox': 'Connect Xbox Live',
      'library.privacyTipHtml':
        '<strong>Privacy tip:</strong> Make sure your game library / gaming history privacy is set to <strong>Public / Anyone</strong> on your platform so Playtested can verify ownership and hours played.',
      'library.syncing': 'Syncing your {platform} library…',
      'library.refreshedToast': '{platform} library refreshed!',
      'library.errorTitle': 'Could not read your {platform} library',
      'library.errorFallback': 'Check your platform privacy settings and try again.',
      'library.tryAgain': 'Try again',
      'library.tabsAria': 'Select connected platform library',
      'library.linkPlatform': '+ Link {platform}',
      'library.syncJustNow': 'Synced just now',
      'library.syncMinsAgo': 'Synced {n}m ago',
      'library.syncHoursAgo': 'Synced {n}h ago',
      'library.refreshTitle': 'Re-fetch your latest games and playtime',
      'library.refreshBtn': '↻ Refresh library',
      'library.statGames': '{platform} games',
      'library.statPlaytime': 'Total {platform} playtime',
      'library.statEligible': 'Eligible ({hours}h+)',
      'library.statReviewed': 'Reviewed on {platform}',
      'library.filterPlaceholder': 'Filter your {n} {platform} games…',
      'library.filterAll': 'All',
      'library.filterReady': 'Ready to rate ({n})',
      'library.filterReviewed': 'Reviewed ({n})',
      'library.filterLocked': 'Under {hours}h',
      'library.tagRated': 'Rated · {score}',
      'library.tagRateOn': 'Rate on {platform}',
      'library.tagNeedHours': 'Need {hours}h',
      'library.rowHours': '{hours}h played on {platform}',
      'library.emptyTitle': 'No matching games in your {platform} library',
      'library.emptyBody': 'Try clearing your filter or search query.',

      // Footer
      'footer.promise':
        'Every score on Playtested comes from a verified owner. Critic ratings are not allowed, ever.',
      'footer.audit': 'Audit source code',
      'footer.coffeeAria': 'Buy me a coffee via PayPal',
      'footer.coffee': 'Buy me a coffee',
      'footer.coffeeUnconfigured': 'PayPal donation link is not configured yet.',

      // Dialog Aria
      'modal.gameAria': 'Game details and verified reviews',
      'modal.authAria': 'Sign in to Playtested',
      'modal.confirmAria': 'Confirm sign out',
      'modal.close': 'Close',

      // Logout Confirm Modal
      'logout.eyebrow': 'ACCOUNT SESSION',
      'logout.titleHtml': 'Sign out of Playtested<span class="accent-dot">?</span>',
      'logout.desc':
        'This will end {sessionText} on this device. All your published verified reviews will stay saved.',
      'logout.sessionLinked': 'your {platforms} session',
      'logout.sessionDefault': 'your Playtested session',
      'logout.cancel': 'Cancel',

      // Auth Modal
      'auth.eyebrow': 'VERIFIED PLAYER ACCOUNTS',
      'auth.titleHtml': 'Connect your platforms<span class="accent-dot">.</span>',
      'auth.desc':
        'Link Steam, PlayStation, or Xbox to prove ownership and 2h+ verified playtime. Every verified owner counts equally and platform scores are never mixed.',
      'auth.safeTitle': 'How your account stays safe (100% read-only):',
      'auth.safeItem1Html':
        '<strong>No passwords ever:</strong> Steam signs in directly on <code>steamcommunity.com</code> via official OpenID; Xbox uses a public Gamertag bio code.',
      'auth.safeItem2Html':
        '<strong>No stored auth tokens:</strong> Temporary PSN/OAuth tokens stay in server RAM only and are never written to disk or database.',
      'auth.safeItem3Html':
        '<strong>Publicly auditable:</strong> <a href="https://github.com/joaodestro7/playtested/blob/main/lib/platforms.js" target="_blank" rel="noopener noreferrer">Inspect exact auth code (lib/platforms.js) ↗</a>',
      'auth.steamSub': 'Official OpenID redirect on steamcommunity.com · no password shared',
      'auth.psnSub': 'Read-only library check · token stays in server RAM only',
      'auth.xboxSub': 'Public Gamertag bio code · zero login credentials entered here',
      'auth.connected': '✓ Connected',
      'auth.unlink': 'Unlink',
      'auth.disconnectTitle': 'Disconnect {platform}',
      'auth.connect': 'Connect',
      'auth.cancel': 'Cancel',
      'auth.psnTabBio': 'Profile Bio Code',
      'auth.psnTabDirect': 'Official PSN NPSSO',
      'auth.psnOnlineIdPlaceholder': 'Your PSN Online ID',
      'auth.getCode': 'Get code',
      'auth.psnBioCodeHtml':
        'Put <code>{code}</code> in your PlayStation <strong>About Me</strong> bio, save it, then click verify below (you can remove it right after).',
      'auth.psnVerifyAccount': 'Verify PlayStation Account',
      'auth.psnDirectStepsHtml':
        '1. Sign in at <a href="https://www.playstation.com" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">playstation.com</a>.<br>' +
        '2. Open <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">Sony’s SSO cookie page</a> and copy the <code>npsso</code> value.<br>' +
        '3. Paste it below — used in RAM only to read your game list &amp; playtime, never saved to disk.',
      'auth.psnNpssoPlaceholder': 'Paste 64-character npsso value…',
      'auth.psnVerifyLibrary': 'Verify PlayStation Library',
      'auth.xboxGamertagPlaceholder': 'Your Xbox Gamertag',
      'auth.xboxBioCodeHtml':
        'Put <code>{code}</code> in your Xbox Profile <strong>Bio</strong>, save it, then click verify below (you can remove it right after).',
      'auth.xboxVerifyAccount': 'Verify Xbox Account',
      'auth.notePrivacyHtml':
        '<strong>Publicly Auditable &amp; Read-Only:</strong> Playtested never asks for your passwords and never writes to your gaming accounts. Ensure your library/gaming history privacy is set to <strong>Public</strong> on Steam, PlayStation, or Xbox so ownership and playtime can be verified.',
      'auth.noteUnavailableHtml':
        '<strong>Epic Games Store &amp; Nintendo currently unavailable:</strong> Neither Epic Games nor Nintendo offers a public API to verify owned libraries and playtime like Steam’s. We won’t ask users for full-account access codes, so support for both is on hold until safe public APIs are available.',
      'auth.statusGenerating': 'Generating challenge code…',
      'auth.statusGenError': 'Could not generate code.',
      'auth.statusPsnCheckingBio': 'Checking your PlayStation profile bio…',
      'auth.statusVerifyFail': 'Verification failed.',
      'auth.statusPsnConnected': 'PlayStation Network connected!',
      'auth.statusPsnVerifying': 'Verifying PlayStation account…',
      'auth.statusPsnNpssoError': 'Could not verify NPSSO token.',
      'auth.statusXboxCheckingBio': 'Checking your Xbox profile bio…',
      'auth.statusXboxConnected': 'Xbox Live connected!',
      'auth.unlinkedToast': '{platform} account unlinked.',

      // Game Modal
      'game.fallbackName': 'Game #{id}',
      'game.unknownYear': 'Unknown',
      'game.developer': 'Developer:',
      'game.publisher': 'Publisher:',
      'game.systems': 'Systems:',
      'game.released': 'Released:',
      'game.peakPlayers': 'peak players this week',
      'game.notReleasedOn': 'Not released on {platform}',
      'game.noVerifiedReviews': 'No verified reviews',
      'game.classicEraShort': 'Classic era',
      'game.avgHoursShort': 'avg {hours}h',
      'game.scoreBreakdown': '{platform} Score Breakdown',
      'game.totalAvg': 'Total avg:',
      'game.classicVerified': 'Classic Era · account verified',
      'game.medianAvgHours': 'Median {median}h · Avg {avg}h played',
      'game.noRatingsYet': 'No verified ratings yet',
      'game.criteriaGridAria': 'Average scores across all 4 metrics for {platform}',
      'game.distAria': 'Score distribution for {platform}',
      'game.distPositive': 'Positive (75–100): {n}',
      'game.distMixed': 'Mixed (50–74): {n}',
      'game.distNegative': 'Negative (0–49): {n}',
      'game.spikeHtml':
        '<strong>High recent activity:</strong> Verified owners are actively reviewing this game right now. All platform scores remain strictly equal-weight and isolated per platform.',
      'game.choosePlatAria': 'Choose platform to review',
      'game.editReviewTitle': 'Edit your {platform} review',
      'game.rateOnTitle': 'Rate on {platform}',
      'game.classicPillFull': '✦ Classic Era ({era}) · Account verified',
      'game.checkingLib': 'Checking your {platform} library…',
      'game.refreshingLib': 'Refreshing your {platform} library…',
      'game.refreshLibBtn': '↻ Refresh {platform} library',
      'game.refreshLibError': 'Could not refresh library right now.',
      'game.eligConnect': 'Connect {platform} to rate',
      'game.eligUnavailable': 'Library check unavailable',
      'game.eligNotOwned': 'Not in your {platform} library',
      'game.eligNotOwnedMsg': 'You must own this game on {platform} (with {hours}h+ played) to review it.',
      'game.eligNeedMore': '{played}h played · Need {min}h+',
      'game.eligNeedMoreMsg': 'Play at least {more}h more on {platform} to unlock reviewing.',
      'game.eligVerified': '✓ Verified {platform} owner · {hours}h played',
      'game.legacyBannerHtml':
        '<strong>Classic Era Review:</strong> {reason}. Ownership &amp; playtime checks are waived for this classic, while your verified {platform} login is still required (one review per account).',
      'game.isolationNoteHtml':
        'Allocates strictly to the <strong>{platform}</strong> score — never mixed with other platforms.',
      'game.legacyMigrateHtml':
        'Your existing review has a score of <strong>{score}</strong>. Answer all 4 mandatory questions below to update it.',
      'game.qPrefix': 'Q{num}',
      'game.qTipAria': 'Tooltip for {label}',
      'game.qScaleAria': '{label} (0 to 10)',
      'game.finalScore': 'Final Score',
      'game.calculatedSub': 'Calculated from your 4 answers',
      'game.incompleteSub': 'Answer all 4 mandatory questions ({n}/4 answered)',
      'game.incomplete': 'Incomplete',
      'game.textareaPlaceholder': 'Share your honest experience playing on {platform} (optional)…',
      'game.deleteReview': 'Delete review',
      'game.updateReview': 'Update {platform} review',
      'game.publishReview': 'Publish {platform} review',
      'game.requiresAccount': '{name} requires a {platform} account',
      'game.haveYouPlayed': 'Have you played {name}?',
      'game.connectLinkedPrompt':
        'You can only review games on platforms where they were released. Connect your {platform} account to rate this {target}.',
      'game.targetClassic': '{era} classic (library check waived)',
      'game.targetTitle': '{platform} title',
      'game.connectGuestClassic':
        'Sign in with {platform} to rate this {era} classic. Ownership & playtime checks are waived for pre-API classics, while platform login is still required.',
      'game.connectGuestNormal':
        'Connect {platforms} to verify ownership and 2h+ playtime. Each platform score is calculated separately.',
      'game.orWord': 'or',
      'game.connectPlatformBtn': 'Connect {platform}',
      'game.modalReviewsTitle': 'Verified player reviews ({count})',
      'game.sortGameReviewsAria': 'Sort game reviews',
      'game.sortNewestFirst': 'Newest first',
      'game.loadingReviews': 'Loading reviews…',
      'game.noReviewsInModal': 'No verified reviews yet. Be the first owner with 2h+ played to score it.',
      'game.loadReviewsError': 'Could not load reviews: {msg}',
      'game.reviewLegacyMeta': '{era} account-verified on {icon} {platform}',
      'game.reviewPlayedMeta': '{hours}h played on {icon} {platform}',
      'game.editedSuffix': ' · edited',
      'game.answerAllErr': 'Please answer all 4 mandatory questions (0–10) before publishing.',
      'game.verifyingSubmit': 'Verifying your {platform} library & playtime…',
      'game.saveError': 'Could not save review.',
      'game.networkError': 'Network error.',
      'game.updatedToast': '{platform} verified review updated! ({score}/100)',
      'game.publishedToast': '{platform} verified review published! ({score}/100)',
      'game.deletedToast': 'Your {platform} review was deleted.',
      'game.breakdownAria': 'Score breakdown',

      // 4 Review Questions (weights never displayed)
      'q.fun.label': 'Is the game fun?',
      'q.fun.short': 'Fun',
      'q.fun.tip':
        'Games are made primarily so we can have fun, so tell here how much you enjoyed your time in this game.',
      'q.performance.label': 'Is the game performance good?',
      'q.performance.short': 'Performance',
      'q.performance.tip': 'Consider minimum and recommended specs.',
      'q.gameplay.label': 'Is the gameplay loop good?',
      'q.gameplay.short': 'Gameplay loop',
      'q.gameplay.tip': 'Consider the main premises and mechanics here and how engaging they are.',
      'q.visuals.label': 'Does the game look good?',
      'q.visuals.short': 'Visuals',
      'q.visuals.tip':
        'Keep in mind that the art direction can be pixel art and a game can still look good in that design.',

      // Verdicts
      'verdict.essential': 'Essential',
      'verdict.great': 'Great',
      'verdict.good': 'Good',
      'verdict.mixed': 'Mixed',
      'verdict.rough': 'Rough',
      'verdict.poor': 'Poor',

      // System / Boot Toasts
      'toast.offline': 'You appear to be offline. Reconnect to load updates or post reviews.',
      'toast.online': 'Back online!',
      'toast.steamLoginFail': 'Steam sign-in failed. Please try again.',
      'toast.xboxLoginFail': 'Xbox sign-in failed. Please try again.',
      'toast.xboxConfigUnavailable':
        'Xbox Live connection is currently unavailable on this server. Please try again later.',
      'toast.connected': '{platform} connected! You can now publish verified reviews.',
    },

    'pt-BR': {
      // Meta
      'meta.title': 'Playtested — Avaliações Reais por Gamers Reais',
      'meta.description':
        'Notas independentes de 0 a 100 para Steam, PlayStation e Xbox — peso igual por jogador verificado, isoladas por plataforma e zero notas de críticos.',

      // Header & Navigation
      'skip.content': 'Pular para o conteúdo',
      'nav.aria': 'Navegação principal',
      'nav.homeAria': 'Início do Playtested',
      'nav.discover': 'Descobrir',
      'nav.reviews': 'Avaliações',
      'nav.library': 'Biblioteca',
      'search.aria': 'Buscar jogos',
      'search.placeholder': 'Buscar jogos...',
      'search.clear': 'Limpar busca',
      'theme.aria': 'Alternar modo escuro',
      'theme.title': 'Alternar tema claro ou escuro',
      'lang.aria': 'Selecionar idioma',
      'lang.title': 'Alterar idioma',
      'auth.signIn': 'Entrar',
      'auth.signOut': 'Sair',
      'auth.manageTitle': 'Gerenciar contas conectadas do Steam, PlayStation e Xbox',
      'auth.connectedPlatsAria': 'Plataformas conectadas',

      // Hero
      'hero.eyebrow': 'APENAS DONOS VERIFICADOS · ZERO CRÍTICOS',
      'hero.h1Html': 'Avaliações Reais<br /><em>por Gamers Reais</em>',
      'hero.sub':
        'Notas independentes de 0 a 100 para Steam, PlayStation e Xbox — cada dono verificado tem o mesmo peso, sem misturar plataformas. Conecte suas contas para avaliar jogos que você realmente possui e jogou.',
      'hero.browse': 'Ver catálogo',
      'hero.signInCta': 'Entrar para avaliar',
      'hero.openLibrariesCta': 'Abrir bibliotecas',
      'hero.statsAria': 'Estatísticas da plataforma',
      'hero.statGames': 'Jogos indexados',
      'hero.statReviews': 'Avaliações verificadas',
      'hero.statHours': 'Horas registradas',
      'hero.statCritics': 'Notas de críticos',
      'hero.release2026': 'LANÇAMENTO 2026',
      'hero.openFeaturedAria': 'Abrir jogo em destaque {name}',
      'hero.showSlideAria': 'Mostrar {name}',
      'hero.artworkControlsAria': 'Controles dos destaques',

      // Trust Strip
      'trust.aria': 'Princípios do Playtested',
      'trust.lead': 'POSSE VERIFICADA. SEMPRE.',
      'trust.item1': 'Apenas donos verificados',
      'trust.item2': '2h+ de jogo verificadas',
      'trust.item3': 'Notas 0–100 de peso igual',
      'trust.item4': 'Sem notas de críticos. Nunca.',

      // Spotlight
      'spotlight.eyebrow': 'DIRETO DAS BIBLIOTECAS VERIFICADAS',
      'spotlight.titleHtml': 'Avaliados recentemente<span class="accent-dot">.</span>',
      'spotlight.allReviews': 'Ver todas as avaliações',
      'spotlight.isolatedTip': 'Nota isolada no {platform}',
      'spotlight.verifiedReviewOne': '{n} avaliação verificada',
      'spotlight.verifiedReviewMany': '{n} avaliações verificadas',
      'spotlight.hoursPlayed': '{hours}h jogadas',

      // Catalog & Filters
      'catalog.eyebrow': 'O CATÁLOGO VERIFICADO',
      'catalog.loading': 'Carregando catálogo…',
      'catalog.filters': 'Filtros',
      'catalog.filtersAria': 'Filtros do catálogo',
      'catalog.closeFilters': 'Fechar filtros',
      'catalog.sortBy': 'Ordenar por',
      'catalog.sort.trend': 'Em alta',
      'catalog.sort.new': 'Mais recentes',
      'catalog.sort.top': 'Melhores notas',
      'catalog.sort.most': 'Mais avaliados',
      'catalog.sort.old': 'Mais antigos',
      'catalog.sort.az': 'Nome A a Z',
      'catalog.sort.za': 'Nome Z a A',
      'catalog.title.trend': 'Em alta agora',
      'catalog.title.new': 'Lançamentos recentes',
      'catalog.title.old': 'Lançamentos mais antigos',
      'catalog.title.top': 'Melhores notas',
      'catalog.title.most': 'Mais avaliados',
      'catalog.title.az': 'Jogos de A a Z',
      'catalog.title.za': 'Jogos de Z a A',
      'catalog.title.default': 'Catálogo',
      'catalog.title.search': 'Resultados para “{q}”',
      'catalog.releaseYear': 'Ano de lançamento',
      'catalog.from': 'De',
      'catalog.to': 'Até',
      'catalog.fromAria': 'Ano de lançamento inicial',
      'catalog.toAria': 'Ano de lançamento final',
      'catalog.developer': 'Desenvolvedora',
      'catalog.devPlaceholder': 'ex: FromSoftware',
      'catalog.publisher': 'Publicadora',
      'catalog.pubPlaceholder': 'ex: Valve',
      'catalog.minScore': 'Nota mínima (0–100)',
      'catalog.minScorePlaceholder': 'ex: 75',
      'catalog.avgPlaytime': 'Tempo médio de jogo',
      'catalog.playtime.all': 'Todos',
      'catalog.playtime.low': 'Curto (≤ 80h)',
      'catalog.playtime.medium': 'Médio (80.1h – 200h)',
      'catalog.playtime.high': 'Alto (200.1h – 1.500h)',
      'catalog.playtime.second_job': 'Segundo Emprego (1.500h+)',
      'catalog.onlyReviewed': 'Apenas jogos com avaliações verificadas',
      'catalog.resetFilters': 'Limpar filtros',
      'catalog.resetAllFilters': 'Limpar todos os filtros',
      'catalog.filterPlatAria': 'Filtrar por plataforma',
      'catalog.all': 'Todos',
      'catalog.quickSortAria': 'Ordenação rápida',
      'catalog.perPageAria': 'Jogos por página',
      'catalog.perPage': '{n} por página',
      'catalog.paginationAria': 'Paginação do catálogo',
      'catalog.countLine':
        '{total} {gameWord} encontrados · {indexed}{knownPart} títulos multiplataforma indexados e unificados.',
      'catalog.knownPart': ' de {known}',
      'catalog.gameOne': 'jogo único',
      'catalog.gameMany': 'jogos únicos',
      'catalog.emptyTitle': 'Nenhum jogo encontrado com esses filtros.',
      'catalog.emptyBody':
        'Tente ampliar o intervalo de anos, limpar filtros de desenvolvedora ou buscar outro título.',
      'catalog.indexingTitle': 'Indexando catálogo…',
      'catalog.indexingBody':
        'O Playtested está validando capas e organizando os metadados em segundo plano.',
      'catalog.loadErrorTitle': 'Não foi possível carregar o catálogo',
      'catalog.loadErrorFallback': 'Verifique sua conexão e tente novamente.',
      'catalog.retry': 'Tentar novamente',
      'catalog.peakTitle': 'Pico de jogadores simultâneos esta semana',
      'catalog.hoverCta': 'Ver e avaliar →',
      'catalog.reviewOne': 'avaliação',
      'catalog.reviewMany': 'avaliações',
      'catalog.prev': '← Anterior',
      'catalog.next': 'Próxima →',
      'catalog.page': 'Página',
      'catalog.ofPages': 'de {pages}',
      'catalog.jumpPageAria': 'Ir para a página',

      // Active Filter Pills
      'pill.search': 'Busca: “{q}”',
      'pill.platform': 'Plataforma: {platform}',
      'pill.year': 'Ano: {from} – {to}',
      'pill.any': 'Qualquer',
      'pill.dev': 'Dev: {dev}',
      'pill.pub': 'Pub: {pub}',
      'pill.min': 'Nota ≥ {min}',
      'pill.playtime': 'Tempo: {label}',
      'pill.reviewed': 'Apenas avaliados',
      'pill.removeAria': 'Remover filtro',

      // Score Trio Tooltips
      'score.tip': 'Nota no {platform}: {score}/100 de {n} {reviewWord}{avgPart}',
      'score.tipAvg': ' (média de {hours}h jogadas)',
      'score.tipNone': '{platform}: nenhuma avaliação verificada ainda',
      'cover.alt': 'Capa de {name}',

      // Editorial Banner
      'banner.eyebrow': 'SEU TEMPO É VALIOSO. SUAS HORAS PROVAM ISSO.',
      'banner.h3Html': 'Notas honestas de quem <em>realmente jogou.</em>',
      'banner.p':
        'Conecte sua conta Steam, PlayStation ou Xbox para participar — uma avaliação verificada por plataforma, editável quando quiser.',
      'banner.ctaGuest': 'Conectar contas',
      'banner.ctaUser': 'Gerenciar contas e avaliar',

      // Reviews Feed
      'reviews.eyebrow': 'SEM CRÍTICOS. SEM HYPE PAGO.',
      'reviews.titleHtml': 'Avaliações verificadas<span class="accent-dot">.</span>',
      'reviews.loading': 'Carregando avaliações verificadas…',
      'reviews.loadingPlayer': 'Carregando avaliações de jogadores verificados…',
      'reviews.filterPlatAria': 'Filtrar avaliações por plataforma',
      'reviews.sortAria': 'Ordenar avaliações',
      'reviews.sort.recent': 'Mais recentes',
      'reviews.sort.hours': 'Mais horas jogadas',
      'reviews.sort.high': 'Maior nota',
      'reviews.sort.low': 'Menor nota',
      'reviews.countLine':
        '{total} {reviewWord} de donos verificados{scope}. Cada nota fica estritamente isolada na sua plataforma.',
      'reviews.scopePlatform': ' no {platform}',
      'reviews.scopeAll': ' entre Steam, PlayStation e Xbox',
      'reviews.emptyTitle': 'Ainda não há avaliações verificadas nesta plataforma.',
      'reviews.emptyBody':
        'Conecte sua conta Steam, PlayStation ou Xbox para publicar a primeira nota verificada aqui.',
      'reviews.verifiedTitle': 'Título verificado',
      'reviews.verifiedScoreTitle': 'Nota verificada no {platform}',
      'reviews.scoreOnly': 'Avaliação verificada apenas com nota.',
      'reviews.classicPill': '✦ Era Clássica',
      'reviews.verifiedPill': '✓ Verificado',
      'reviews.youPill': 'Você',
      'reviews.legacyTitle': 'Clássico verificado por conta no {platform}',
      'reviews.playtimeTitle': 'Tempo de jogo verificado no {platform}',
      'reviews.classicFallback': 'Clássico',
      'reviews.loadErrorTitle': 'Não foi possível carregar as avaliações',

      // My Library
      'library.eyebrow': 'SEUS JOGOS VERIFICADOS',
      'library.titleHtml': 'Minhas bibliotecas conectadas<span class="accent-dot">.</span>',
      'library.desc':
        'Conecte Steam, PlayStation ou Xbox para ver seus jogos e publicar notas por plataforma (mínimo de 2h).',
      'library.manageBtn': 'Gerenciar contas conectadas',
      'library.connectTitle': 'Conecte suas contas de jogos',
      'library.connectBody':
        'Vincule Steam, PlayStation ou Xbox para que o Playtested verifique os jogos que você possui e seu tempo real de jogo (2h+ por plataforma). As notas de cada plataforma permanecem isoladas.',
      'library.connectSteam': 'Conectar Steam',
      'library.connectPsn': 'Conectar PlayStation Network',
      'library.connectXbox': 'Conectar Xbox Live',
      'library.privacyTipHtml':
        '<strong>Dica de privacidade:</strong> Deixe a privacidade da sua biblioteca / histórico de jogos como <strong>Público / Todos</strong> na plataforma para que o Playtested consiga verificar posse e horas jogadas.',
      'library.syncing': 'Sincronizando sua biblioteca {platform}…',
      'library.refreshedToast': 'Biblioteca {platform} atualizada!',
      'library.errorTitle': 'Não foi possível ler sua biblioteca {platform}',
      'library.errorFallback': 'Verifique as configurações de privacidade da plataforma e tente novamente.',
      'library.tryAgain': 'Tentar novamente',
      'library.tabsAria': 'Selecionar biblioteca da plataforma conectada',
      'library.linkPlatform': '+ Vincular {platform}',
      'library.syncJustNow': 'Sincronizado agora',
      'library.syncMinsAgo': 'Sincronizado há {n} min',
      'library.syncHoursAgo': 'Sincronizado há {n}h',
      'library.refreshTitle': 'Atualizar seus jogos e horas mais recentes',
      'library.refreshBtn': '↻ Atualizar biblioteca',
      'library.statGames': 'Jogos no {platform}',
      'library.statPlaytime': 'Total jogado no {platform}',
      'library.statEligible': 'Elegíveis ({hours}h+)',
      'library.statReviewed': 'Avaliados no {platform}',
      'library.filterPlaceholder': 'Filtrar seus {n} jogos do {platform}…',
      'library.filterAll': 'Todos',
      'library.filterReady': 'Prontos ({n})',
      'library.filterReviewed': 'Avaliados ({n})',
      'library.filterLocked': 'Menos de {hours}h',
      'library.tagRated': 'Nota · {score}',
      'library.tagRateOn': 'Avaliar no {platform}',
      'library.tagNeedHours': 'Faltam {hours}h',
      'library.rowHours': '{hours}h jogadas no {platform}',
      'library.emptyTitle': 'Nenhum jogo encontrado na sua biblioteca {platform}',
      'library.emptyBody': 'Tente limpar o filtro ou o termo de busca.',

      // Footer
      'footer.promise':
        'Toda nota no Playtested vem de um dono verificado. Notas de críticos não são permitidas, nunca.',
      'footer.audit': 'Auditar código-fonte',
      'footer.coffeeAria': 'Me pague um café pelo PayPal',
      'footer.coffee': 'Me pague um café',
      'footer.coffeeUnconfigured': 'O link de doação do PayPal ainda não está configurado.',

      // Dialog Aria
      'modal.gameAria': 'Detalhes do jogo e avaliações verificadas',
      'modal.authAria': 'Entrar no Playtested',
      'modal.confirmAria': 'Confirmar saída',
      'modal.close': 'Fechar',

      // Logout Confirm Modal
      'logout.eyebrow': 'SESSÃO DA CONTA',
      'logout.titleHtml': 'Sair do Playtested<span class="accent-dot">?</span>',
      'logout.desc':
        'Isso encerrará {sessionText} neste dispositivo. Todas as suas avaliações verificadas continuarão salvas.',
      'logout.sessionLinked': 'sua sessão de {platforms}',
      'logout.sessionDefault': 'sua sessão no Playtested',
      'logout.cancel': 'Cancelar',

      // Auth Modal
      'auth.eyebrow': 'CONTAS VERIFICADAS',
      'auth.titleHtml': 'Conecte suas plataformas<span class="accent-dot">.</span>',
      'auth.desc':
        'Vincule Steam, PlayStation ou Xbox para comprovar a posse do jogo e 2h+ jogadas. Cada jogador verificado tem o mesmo peso e as notas de cada plataforma nunca se misturam.',
      'auth.safeTitle': 'Como sua conta fica segura (100% somente leitura):',
      'auth.safeItem1Html':
        '<strong>Nunca pedimos senhas:</strong> o Steam faz login direto em <code>steamcommunity.com</code> via OpenID oficial; o Xbox usa um código público na bio da Gamertag.',
      'auth.safeItem2Html':
        '<strong>Sem tokens salvos:</strong> tokens temporários da PSN/OAuth ficam apenas na memória RAM do servidor e nunca são gravados em disco ou banco de dados.',
      'auth.safeItem3Html':
        '<strong>Código auditável:</strong> <a href="https://github.com/joaodestro7/playtested/blob/main/lib/platforms.js" target="_blank" rel="noopener noreferrer">Inspecionar código de autenticação (lib/platforms.js) ↗</a>',
      'auth.steamSub': 'Redirecionamento OpenID oficial em steamcommunity.com · sem compartilhar senha',
      'auth.psnSub': 'Consulta somente leitura da biblioteca · token apenas na RAM do servidor',
      'auth.xboxSub': 'Código público na bio da Gamertag · nenhuma credencial de login digitada aqui',
      'auth.connected': '✓ Conectado',
      'auth.unlink': 'Desvincular',
      'auth.disconnectTitle': 'Desconectar {platform}',
      'auth.connect': 'Conectar',
      'auth.cancel': 'Cancelar',
      'auth.psnTabBio': 'Código na Bio',
      'auth.psnTabDirect': 'NPSSO Oficial da PSN',
      'auth.psnOnlineIdPlaceholder': 'Seu ID Online da PSN',
      'auth.getCode': 'Gerar código',
      'auth.psnBioCodeHtml':
        'Coloque <code>{code}</code> na bio <strong>Sobre mim</strong> da PlayStation, salve e clique em verificar abaixo (você pode remover logo depois).',
      'auth.psnVerifyAccount': 'Verificar conta PlayStation',
      'auth.psnDirectStepsHtml':
        '1. Faça login em <a href="https://www.playstation.com" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">playstation.com</a>.<br>' +
        '2. Abra a <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">página de cookie SSO da Sony</a> e copie o valor de <code>npsso</code>.<br>' +
        '3. Cole abaixo — usado apenas em memória RAM para ler seus jogos e horas, nunca salvo em disco.',
      'auth.psnNpssoPlaceholder': 'Cole o valor npsso de 64 caracteres…',
      'auth.psnVerifyLibrary': 'Verificar biblioteca PlayStation',
      'auth.xboxGamertagPlaceholder': 'Sua Gamertag do Xbox',
      'auth.xboxBioCodeHtml':
        'Coloque <code>{code}</code> na <strong>Bio</strong> do seu perfil Xbox, salve e clique em verificar abaixo (você pode remover logo depois).',
      'auth.xboxVerifyAccount': 'Verificar conta Xbox',
      'auth.notePrivacyHtml':
        '<strong>Código Auditável e Somente Leitura:</strong> O Playtested nunca pede suas senhas e nunca altera suas contas. Certifique-se de que a privacidade da biblioteca/histórico de jogos está como <strong>Público</strong> no Steam, PlayStation ou Xbox para verificar posse e tempo de jogo.',
      'auth.noteUnavailableHtml':
        '<strong>Epic Games Store e Nintendo indisponíveis no momento:</strong> Nem a Epic Games nem a Nintendo oferecem uma API pública como a do Steam para verificar bibliotecas e horas jogadas. Não pediremos códigos que deem acesso total à sua conta, então o suporte fica em espera até existirem APIs públicas seguras.',
      'auth.statusGenerating': 'Gerando código de verificação…',
      'auth.statusGenError': 'Não foi possível gerar o código.',
      'auth.statusPsnCheckingBio': 'Verificando a bio do seu perfil PlayStation…',
      'auth.statusVerifyFail': 'Falha na verificação.',
      'auth.statusPsnConnected': 'PlayStation Network conectada!',
      'auth.statusPsnVerifying': 'Verificando conta PlayStation…',
      'auth.statusPsnNpssoError': 'Não foi possível verificar o token NPSSO.',
      'auth.statusXboxCheckingBio': 'Verificando a bio do seu perfil Xbox…',
      'auth.statusXboxConnected': 'Xbox Live conectada!',
      'auth.unlinkedToast': 'Conta {platform} desvinculada.',

      // Game Modal
      'game.fallbackName': 'Jogo #{id}',
      'game.unknownYear': 'Desconhecido',
      'game.developer': 'Desenvolvedora:',
      'game.publisher': 'Publicadora:',
      'game.systems': 'Sistemas:',
      'game.released': 'Lançamento:',
      'game.peakPlayers': 'pico de jogadores esta semana',
      'game.notReleasedOn': 'Não lançado no {platform}',
      'game.noVerifiedReviews': 'Sem avaliações verificadas',
      'game.classicEraShort': 'Era clássica',
      'game.avgHoursShort': 'média {hours}h',
      'game.scoreBreakdown': 'Detalhes da nota ({platform})',
      'game.totalAvg': 'Média geral:',
      'game.classicVerified': 'Era Clássica · conta verificada',
      'game.medianAvgHours': 'Mediana {median}h · Média {avg}h jogadas',
      'game.noRatingsYet': 'Nenhuma avaliação verificada ainda',
      'game.criteriaGridAria': 'Médias nos 4 critérios para {platform}',
      'game.distAria': 'Distribuição das notas no {platform}',
      'game.distPositive': 'Positivas (75–100): {n}',
      'game.distMixed': 'Mistas (50–74): {n}',
      'game.distNegative': 'Negativas (0–49): {n}',
      'game.spikeHtml':
        '<strong>Alta atividade recente:</strong> Donos verificados estão avaliando este jogo agora. Todas as notas continuam com peso igual e isoladas por plataforma.',
      'game.choosePlatAria': 'Escolher plataforma para avaliar',
      'game.editReviewTitle': 'Editar avaliação no {platform}',
      'game.rateOnTitle': 'Avaliar no {platform}',
      'game.classicPillFull': '✦ Era Clássica ({era}) · Conta verificada',
      'game.checkingLib': 'Verificando biblioteca {platform}…',
      'game.refreshingLib': 'Atualizando biblioteca {platform}…',
      'game.refreshLibBtn': '↻ Atualizar biblioteca {platform}',
      'game.refreshLibError': 'Não foi possível atualizar a biblioteca agora.',
      'game.eligConnect': 'Conecte {platform} para avaliar',
      'game.eligUnavailable': 'Verificação indisponível',
      'game.eligNotOwned': 'Não encontrado na sua biblioteca {platform}',
      'game.eligNotOwnedMsg':
        'Você precisa possuir este jogo no {platform} (com {hours}h+ jogadas) para avaliá-lo.',
      'game.eligNeedMore': '{played}h jogadas · Precisa de {min}h+',
      'game.eligNeedMoreMsg': 'Jogue pelo menos mais {more}h no {platform} para liberar a avaliação.',
      'game.eligVerified': '✓ Dono verificado no {platform} · {hours}h jogadas',
      'game.legacyBannerHtml':
        '<strong>Avaliação da Era Clássica:</strong> {reason}. A verificação de biblioteca e horas é dispensada para este clássico, mantendo obrigatório o login verificado no {platform} (uma avaliação por conta).',
      'game.isolationNoteHtml':
        'Conta exclusivamente para a nota do <strong>{platform}</strong> — nunca misturada com outras plataformas.',
      'game.legacyMigrateHtml':
        'Sua avaliação anterior tem nota <strong>{score}</strong>. Responda às 4 perguntas obrigatórias abaixo para atualizá-la.',
      'game.qPrefix': 'P{num}',
      'game.qTipAria': 'Ajuda para {label}',
      'game.qScaleAria': '{label} (0 a 10)',
      'game.finalScore': 'Nota Final',
      'game.calculatedSub': 'Calculada a partir das suas 4 respostas',
      'game.incompleteSub': 'Responda às 4 perguntas obrigatórias ({n}/4 respondidas)',
      'game.incomplete': 'Incompleto',
      'game.textareaPlaceholder': 'Compartilhe sua experiência sincera jogando no {platform} (opcional)…',
      'game.deleteReview': 'Excluir avaliação',
      'game.updateReview': 'Atualizar avaliação ({platform})',
      'game.publishReview': 'Publicar avaliação ({platform})',
      'game.requiresAccount': '{name} requer uma conta {platform}',
      'game.haveYouPlayed': 'Você já jogou {name}?',
      'game.connectLinkedPrompt':
        'Você só pode avaliar jogos nas plataformas em que eles foram lançados. Conecte sua conta {platform} para avaliar este {target}.',
      'game.targetClassic': 'clássico de {era} (verificação de biblioteca dispensada)',
      'game.targetTitle': 'título do {platform}',
      'game.connectGuestClassic':
        'Entre com {platform} para avaliar este clássico de {era}. A verificação de biblioteca e horas é dispensada para clássicos pré-API, mas o login na plataforma continua obrigatório.',
      'game.connectGuestNormal':
        'Conecte {platforms} para verificar a posse e 2h+ jogadas. A nota de cada plataforma é calculada separadamente.',
      'game.orWord': 'ou',
      'game.connectPlatformBtn': 'Conectar {platform}',
      'game.modalReviewsTitle': 'Avaliações de jogadores verificados ({count})',
      'game.sortGameReviewsAria': 'Ordenar avaliações do jogo',
      'game.sortNewestFirst': 'Mais recentes primeiro',
      'game.loadingReviews': 'Carregando avaliações…',
      'game.noReviewsInModal':
        'Nenhuma avaliação verificada ainda. Seja o primeiro dono com 2h+ jogadas a avaliar.',
      'game.loadReviewsError': 'Não foi possível carregar as avaliações: {msg}',
      'game.reviewLegacyMeta': '{era} verificado por conta no {icon} {platform}',
      'game.reviewPlayedMeta': '{hours}h jogadas no {icon} {platform}',
      'game.editedSuffix': ' · editada',
      'game.answerAllErr': 'Responda às 4 perguntas obrigatórias (0–10) antes de publicar.',
      'game.verifyingSubmit': 'Verificando sua biblioteca e tempo de jogo no {platform}…',
      'game.saveError': 'Não foi possível salvar a avaliação.',
      'game.networkError': 'Erro de rede.',
      'game.updatedToast': 'Avaliação verificada no {platform} atualizada! ({score}/100)',
      'game.publishedToast': 'Avaliação verificada no {platform} publicada! ({score}/100)',
      'game.deletedToast': 'Sua avaliação no {platform} foi excluída.',
      'game.breakdownAria': 'Detalhamento da nota',

      // 4 Review Questions (weights never displayed)
      'q.fun.label': 'O jogo é divertido?',
      'q.fun.short': 'Diversão',
      'q.fun.tip':
        'Jogos existem principalmente para nos divertirmos, então diga aqui o quanto você aproveitou seu tempo neste jogo.',
      'q.performance.label': 'O desempenho do jogo é bom?',
      'q.performance.short': 'Desempenho',
      'q.performance.tip': 'Considere os requisitos mínimos e recomendados.',
      'q.gameplay.label': 'O loop de gameplay é bom?',
      'q.gameplay.short': 'Gameplay',
      'q.gameplay.tip': 'Considere as premissas e mecânicas principais e o quanto elas são envolventes.',
      'q.visuals.label': 'O jogo tem um visual bonito?',
      'q.visuals.short': 'Visual',
      'q.visuals.tip':
        'Lembre-se de que a direção de arte pode ser pixel art e o jogo ainda assim ter um ótimo visual dentro dessa proposta.',

      // Verdicts
      'verdict.essential': 'Essencial',
      'verdict.great': 'Ótimo',
      'verdict.good': 'Bom',
      'verdict.mixed': 'Misto',
      'verdict.rough': 'Fraco',
      'verdict.poor': 'Ruim',

      // System / Boot Toasts
      'toast.offline': 'Você parece estar offline. Reconecte para carregar atualizações ou publicar avaliações.',
      'toast.online': 'Conexão restabelecida!',
      'toast.steamLoginFail': 'Falha ao entrar com o Steam. Tente novamente.',
      'toast.xboxLoginFail': 'Falha ao entrar com o Xbox. Tente novamente.',
      'toast.xboxConfigUnavailable':
        'A conexão com o Xbox Live está indisponível neste servidor no momento. Tente novamente mais tarde.',
      'toast.connected': '{platform} conectado! Agora você pode publicar avaliações verificadas.',
    },

    es: {
      // Meta
      'meta.title': 'Playtested — Reseñas Reales de Gamers Reales',
      'meta.description':
        'Puntuaciones independientes de 0 a 100 para Steam, PlayStation y Xbox — mismo peso por propietario verificado, estrictamente separadas por plataforma y cero notas de críticos.',

      // Header & Navigation
      'skip.content': 'Ir al contenido',
      'nav.aria': 'Navegación principal',
      'nav.homeAria': 'Inicio de Playtested',
      'nav.discover': 'Explorar',
      'nav.reviews': 'Reseñas',
      'nav.library': 'Biblioteca',
      'search.aria': 'Buscar juegos',
      'search.placeholder': 'Buscar juegos...',
      'search.clear': 'Limpiar búsqueda',
      'theme.aria': 'Cambiar modo oscuro',
      'theme.title': 'Cambiar entre tema claro y oscuro',
      'lang.aria': 'Seleccionar idioma',
      'lang.title': 'Cambiar idioma',
      'auth.signIn': 'Entrar',
      'auth.signOut': 'Salir',
      'auth.manageTitle': 'Gestionar cuentas conectadas de Steam, PlayStation y Xbox',
      'auth.connectedPlatsAria': 'Plataformas conectadas',

      // Hero
      'hero.eyebrow': 'SOLO PROPIETARIOS VERIFICADOS · CERO CRÍTICOS',
      'hero.h1Html': 'Reseñas Reales<br /><em>de Gamers Reales</em>',
      'hero.sub':
        'Puntuaciones independientes de 0 a 100 para Steam, PlayStation y Xbox — cada propietario verificado cuenta por igual, sin mezclar plataformas. Conecta tus cuentas para puntuar juegos que realmente tienes y jugaste.',
      'hero.browse': 'Ver catálogo',
      'hero.signInCta': 'Entrar para puntuar',
      'hero.openLibrariesCta': 'Abrir bibliotecas',
      'hero.statsAria': 'Estadísticas de la plataforma',
      'hero.statGames': 'Juegos indexados',
      'hero.statReviews': 'Reseñas verificadas',
      'hero.statHours': 'Horas registradas',
      'hero.statCritics': 'Notas de críticos',
      'hero.release2026': 'ESTRENO 2026',
      'hero.openFeaturedAria': 'Abrir juego destacado {name}',
      'hero.showSlideAria': 'Mostrar {name}',
      'hero.artworkControlsAria': 'Controles de destacados',

      // Trust Strip
      'trust.aria': 'Principios de Playtested',
      'trust.lead': 'PROPIEDAD VERIFICADA. SIEMPRE.',
      'trust.item1': 'Solo dueños verificados',
      'trust.item2': '2h+ de juego verificadas',
      'trust.item3': 'Notas 0–100 de peso igual',
      'trust.item4': 'Sin notas de críticos. Nunca.',

      // Spotlight
      'spotlight.eyebrow': 'RECIÉN SALIDO DE BIBLIOTECAS VERIFICADAS',
      'spotlight.titleHtml': 'Reseñados recientemente<span class="accent-dot">.</span>',
      'spotlight.allReviews': 'Ver todas las reseñas',
      'spotlight.isolatedTip': 'Nota aislada en {platform}',
      'spotlight.verifiedReviewOne': '{n} reseña verificada',
      'spotlight.verifiedReviewMany': '{n} reseñas verificadas',
      'spotlight.hoursPlayed': '{hours}h jugadas',

      // Catalog & Filters
      'catalog.eyebrow': 'EL CATÁLOGO VERIFICADO',
      'catalog.loading': 'Cargando catálogo…',
      'catalog.filters': 'Filtros',
      'catalog.filtersAria': 'Filtros del catálogo',
      'catalog.closeFilters': 'Cerrar filtros',
      'catalog.sortBy': 'Ordenar por',
      'catalog.sort.trend': 'Tendencia',
      'catalog.sort.new': 'Más recientes',
      'catalog.sort.top': 'Mejor valorados',
      'catalog.sort.most': 'Más reseñados',
      'catalog.sort.old': 'Más antiguos',
      'catalog.sort.az': 'Nombre A a Z',
      'catalog.sort.za': 'Nombre Z a A',
      'catalog.title.trend': 'En tendencia ahora',
      'catalog.title.new': 'Estrenos recientes',
      'catalog.title.old': 'Lanzamientos antiguos',
      'catalog.title.top': 'Mejor valorados',
      'catalog.title.most': 'Más reseñados',
      'catalog.title.az': 'Juegos de A a Z',
      'catalog.title.za': 'Juegos de Z a A',
      'catalog.title.default': 'Catálogo',
      'catalog.title.search': 'Resultados para “{q}”',
      'catalog.releaseYear': 'Año de lanzamiento',
      'catalog.from': 'Desde',
      'catalog.to': 'Hasta',
      'catalog.fromAria': 'Año de lanzamiento inicial',
      'catalog.toAria': 'Año de lanzamiento final',
      'catalog.developer': 'Desarrolladora',
      'catalog.devPlaceholder': 'ej. FromSoftware',
      'catalog.publisher': 'Editora',
      'catalog.pubPlaceholder': 'ej. Valve',
      'catalog.minScore': 'Nota mínima (0–100)',
      'catalog.minScorePlaceholder': 'ej. 75',
      'catalog.avgPlaytime': 'Tiempo medio de juego',
      'catalog.playtime.all': 'Todos',
      'catalog.playtime.low': 'Corto (≤ 80h)',
      'catalog.playtime.medium': 'Medio (80.1h – 200h)',
      'catalog.playtime.high': 'Alto (200.1h – 1.500h)',
      'catalog.playtime.second_job': 'Segundo Trabajo (1.500h+)',
      'catalog.onlyReviewed': 'Solo juegos con reseñas verificadas',
      'catalog.resetFilters': 'Limpiar filtros',
      'catalog.resetAllFilters': 'Limpiar todos los filtros',
      'catalog.filterPlatAria': 'Filtrar por plataforma',
      'catalog.all': 'Todos',
      'catalog.quickSortAria': 'Orden rápido',
      'catalog.perPageAria': 'Juegos por página',
      'catalog.perPage': '{n} por página',
      'catalog.paginationAria': 'Paginación del catálogo',
      'catalog.countLine':
        '{total} {gameWord} encontrados · {indexed}{knownPart} títulos multiplataforma indexados y unificados.',
      'catalog.knownPart': ' de {known}',
      'catalog.gameOne': 'juego único',
      'catalog.gameMany': 'juegos únicos',
      'catalog.emptyTitle': 'Ningún juego coincide con estos filtros.',
      'catalog.emptyBody':
        'Prueba ampliando el rango de años, limpiando filtros de desarrolladora o buscando otro título.',
      'catalog.indexingTitle': 'Indexando catálogo…',
      'catalog.indexingBody':
        'Playtested está validando portadas y organizando los metadatos en segundo plano.',
      'catalog.loadErrorTitle': 'No se pudo cargar el catálogo',
      'catalog.loadErrorFallback': 'Comprueba tu conexión e inténtalo de nuevo.',
      'catalog.retry': 'Reintentar',
      'catalog.peakTitle': 'Pico de jugadores simultáneos esta semana',
      'catalog.hoverCta': 'Ver y puntuar →',
      'catalog.reviewOne': 'reseña',
      'catalog.reviewMany': 'reseñas',
      'catalog.prev': '← Anterior',
      'catalog.next': 'Siguiente →',
      'catalog.page': 'Página',
      'catalog.ofPages': 'de {pages}',
      'catalog.jumpPageAria': 'Ir a la página',

      // Active Filter Pills
      'pill.search': 'Búsqueda: “{q}”',
      'pill.platform': 'Plataforma: {platform}',
      'pill.year': 'Año: {from} – {to}',
      'pill.any': 'Cualquiera',
      'pill.dev': 'Dev: {dev}',
      'pill.pub': 'Pub: {pub}',
      'pill.min': 'Nota ≥ {min}',
      'pill.playtime': 'Tiempo: {label}',
      'pill.reviewed': 'Solo reseñados',
      'pill.removeAria': 'Quitar filtro',

      // Score Trio Tooltips
      'score.tip': 'Nota en {platform}: {score}/100 de {n} {reviewWord}{avgPart}',
      'score.tipAvg': ' (media de {hours}h jugadas)',
      'score.tipNone': '{platform}: sin reseñas verificadas aún',
      'cover.alt': 'Portada de {name}',

      // Editorial Banner
      'banner.eyebrow': 'TU TIEMPO ES VALIOSO. TUS HORAS LO DEMUESTRAN.',
      'banner.h3Html': 'Notas honestas de quienes <em>realmente jugaron.</em>',
      'banner.p':
        'Conecta tu cuenta de Steam, PlayStation o Xbox para sumar tu voz — una reseña verificada por plataforma, editable cuando quieras.',
      'banner.ctaGuest': 'Conectar cuentas',
      'banner.ctaUser': 'Gestionar cuentas y puntuar',

      // Reviews Feed
      'reviews.eyebrow': 'SIN CRÍTICOS. SIN HYPE PAGADO.',
      'reviews.titleHtml': 'Reseñas verificadas<span class="accent-dot">.</span>',
      'reviews.loading': 'Cargando reseñas verificadas…',
      'reviews.loadingPlayer': 'Cargando reseñas de jugadores verificados…',
      'reviews.filterPlatAria': 'Filtrar reseñas por plataforma',
      'reviews.sortAria': 'Ordenar reseñas',
      'reviews.sort.recent': 'Más recientes',
      'reviews.sort.hours': 'Más horas jugadas',
      'reviews.sort.high': 'Mayor nota',
      'reviews.sort.low': 'Menor nota',
      'reviews.countLine':
        '{total} {reviewWord} de propietarios verificados{scope}. Cada nota se mantiene aislada en su plataforma.',
      'reviews.scopePlatform': ' en {platform}',
      'reviews.scopeAll': ' entre Steam, PlayStation y Xbox',
      'reviews.emptyTitle': 'Aún no hay reseñas verificadas en esta plataforma.',
      'reviews.emptyBody':
        'Conecta tu cuenta de Steam, PlayStation o Xbox para publicar la primera puntuación verificada aquí.',
      'reviews.verifiedTitle': 'Título verificado',
      'reviews.verifiedScoreTitle': 'Nota verificada en {platform}',
      'reviews.scoreOnly': 'Puntuación verificada sin texto.',
      'reviews.classicPill': '✦ Era Clásica',
      'reviews.verifiedPill': '✓ Verificado',
      'reviews.youPill': 'Tú',
      'reviews.legacyTitle': 'Clásico verificado por cuenta en {platform}',
      'reviews.playtimeTitle': 'Tiempo de juego verificado en {platform}',
      'reviews.classicFallback': 'Clásico',
      'reviews.loadErrorTitle': 'No se pudieron cargar las reseñas',

      // My Library
      'library.eyebrow': 'TUS JUEGOS VERIFICADOS',
      'library.titleHtml': 'Mis bibliotecas conectadas<span class="accent-dot">.</span>',
      'library.desc':
        'Conecta Steam, PlayStation o Xbox para explorar tus juegos y publicar notas por plataforma (mínimo 2h).',
      'library.manageBtn': 'Gestionar cuentas conectadas',
      'library.connectTitle': 'Conecta tus cuentas de juegos',
      'library.connectBody':
        'Vincula Steam, PlayStation o Xbox para que Playtested verifique qué juegos posees y tu tiempo real de juego (2h+ por plataforma). Las notas de cada plataforma permanecen aisladas.',
      'library.connectSteam': 'Conectar Steam',
      'library.connectPsn': 'Conectar PlayStation Network',
      'library.connectXbox': 'Conectar Xbox Live',
      'library.privacyTipHtml':
        '<strong>Consejo de privacidad:</strong> Asegúrate de tener la privacidad de tu biblioteca / historial de juegos en <strong>Público / Todos</strong> en tu plataforma para que Playtested pueda verificar propiedad y horas jugadas.',
      'library.syncing': 'Sincronizando tu biblioteca de {platform}…',
      'library.refreshedToast': '¡Biblioteca de {platform} actualizada!',
      'library.errorTitle': 'No se pudo leer tu biblioteca de {platform}',
      'library.errorFallback': 'Revisa la configuración de privacidad de tu plataforma e inténtalo de nuevo.',
      'library.tryAgain': 'Intentar de nuevo',
      'library.tabsAria': 'Seleccionar biblioteca de plataforma conectada',
      'library.linkPlatform': '+ Vincular {platform}',
      'library.syncJustNow': 'Sincronizado ahora',
      'library.syncMinsAgo': 'Sincronizado hace {n} min',
      'library.syncHoursAgo': 'Sincronizado hace {n}h',
      'library.refreshTitle': 'Volver a cargar tus juegos y horas más recientes',
      'library.refreshBtn': '↻ Actualizar biblioteca',
      'library.statGames': 'Juegos en {platform}',
      'library.statPlaytime': 'Total jugado en {platform}',
      'library.statEligible': 'Elegibles ({hours}h+)',
      'library.statReviewed': 'Reseñados en {platform}',
      'library.filterPlaceholder': 'Filtrar tus {n} juegos de {platform}…',
      'library.filterAll': 'Todos',
      'library.filterReady': 'Listos ({n})',
      'library.filterReviewed': 'Reseñados ({n})',
      'library.filterLocked': 'Menos de {hours}h',
      'library.tagRated': 'Nota · {score}',
      'library.tagRateOn': 'Puntuar en {platform}',
      'library.tagNeedHours': 'Faltan {hours}h',
      'library.rowHours': '{hours}h jugadas en {platform}',
      'library.emptyTitle': 'No hay juegos coincidentes en tu biblioteca de {platform}',
      'library.emptyBody': 'Prueba limpiando el filtro o la búsqueda.',

      // Footer
      'footer.promise':
        'Cada nota en Playtested proviene de un propietario verificado. No se permiten notas de críticos, nunca.',
      'footer.audit': 'Auditar código fuente',
      'footer.coffeeAria': 'Invítame a un café por PayPal',
      'footer.coffee': 'Invítame a un café',
      'footer.coffeeUnconfigured': 'El enlace de donación de PayPal aún no está configurado.',

      // Dialog Aria
      'modal.gameAria': 'Detalles del juego y reseñas verificadas',
      'modal.authAria': 'Iniciar sesión en Playtested',
      'modal.confirmAria': 'Confirmar cierre de sesión',
      'modal.close': 'Cerrar',

      // Logout Confirm Modal
      'logout.eyebrow': 'SESIÓN DE LA CUENTA',
      'logout.titleHtml': '¿Salir de Playtested<span class="accent-dot">?</span>',
      'logout.desc':
        'Esto cerrará {sessionText} en este dispositivo. Todas tus reseñas verificadas seguirán guardadas.',
      'logout.sessionLinked': 'tu sesión de {platforms}',
      'logout.sessionDefault': 'tu sesión de Playtested',
      'logout.cancel': 'Cancelar',

      // Auth Modal
      'auth.eyebrow': 'CUENTAS VERIFICADAS',
      'auth.titleHtml': 'Conecta tus plataformas<span class="accent-dot">.</span>',
      'auth.desc':
        'Vincula Steam, PlayStation o Xbox para demostrar la propiedad y 2h+ de juego verificadas. Cada jugador verificado cuenta por igual y las notas por plataforma nunca se mezclan.',
      'auth.safeTitle': 'Cómo protegemos tu cuenta (100% solo lectura):',
      'auth.safeItem1Html':
        '<strong>Sin contraseñas nunca:</strong> Steam inicia sesión directamente en <code>steamcommunity.com</code> mediante OpenID oficial; Xbox usa un código público en la bio de tu Gamertag.',
      'auth.safeItem2Html':
        '<strong>Sin tokens almacenados:</strong> los tokens temporales de PSN/OAuth permanecen solo en la RAM del servidor y nunca se guardan en disco ni en base de datos.',
      'auth.safeItem3Html':
        '<strong>Públicamente auditable:</strong> <a href="https://github.com/joaodestro7/playtested/blob/main/lib/platforms.js" target="_blank" rel="noopener noreferrer">Inspeccionar código de autenticación (lib/platforms.js) ↗</a>',
      'auth.steamSub': 'Redirección OpenID oficial en steamcommunity.com · sin compartir contraseña',
      'auth.psnSub': 'Consulta de biblioteca de solo lectura · token solo en la RAM del servidor',
      'auth.xboxSub': 'Código público en la bio de Gamertag · cero credenciales introducidas aquí',
      'auth.connected': '✓ Conectado',
      'auth.unlink': 'Desvincular',
      'auth.disconnectTitle': 'Desconectar {platform}',
      'auth.connect': 'Conectar',
      'auth.cancel': 'Cancelar',
      'auth.psnTabBio': 'Código en Bio',
      'auth.psnTabDirect': 'NPSSO Oficial de PSN',
      'auth.psnOnlineIdPlaceholder': 'Tu ID Online de PSN',
      'auth.getCode': 'Obtener código',
      'auth.psnBioCodeHtml':
        'Coloca <code>{code}</code> en la bio <strong>Acerca de mí</strong> de PlayStation, guárdalo y pulsa verificar abajo (puedes quitarlo justo después).',
      'auth.psnVerifyAccount': 'Verificar cuenta PlayStation',
      'auth.psnDirectStepsHtml':
        '1. Inicia sesión en <a href="https://www.playstation.com" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">playstation.com</a>.<br>' +
        '2. Abre la <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">página de cookie SSO de Sony</a> y copia el valor <code>npsso</code>.<br>' +
        '3. Pégalo abajo — usado solo en RAM para leer tu lista de juegos y horas, nunca guardado en disco.',
      'auth.psnNpssoPlaceholder': 'Pega el valor npsso de 64 caracteres…',
      'auth.psnVerifyLibrary': 'Verificar biblioteca PlayStation',
      'auth.xboxGamertagPlaceholder': 'Tu Gamertag de Xbox',
      'auth.xboxBioCodeHtml':
        'Coloca <code>{code}</code> en la <strong>Bio</strong> de tu perfil Xbox, guárdalo y pulsa verificar abajo (puedes quitarlo justo después).',
      'auth.xboxVerifyAccount': 'Verificar cuenta Xbox',
      'auth.notePrivacyHtml':
        '<strong>Auditable y Solo Lectura:</strong> Playtested nunca pide tus contraseñas ni modifica tus cuentas. Asegúrate de tener la privacidad de tu biblioteca/historial en <strong>Público</strong> en Steam, PlayStation o Xbox para verificar propiedad y horas jugadas.',
      'auth.noteUnavailableHtml':
        '<strong>Epic Games Store y Nintendo no disponibles por ahora:</strong> Ni Epic Games ni Nintendo ofrecen una API pública como la de Steam para verificar bibliotecas y tiempo de juego. No pediremos códigos con acceso completo a tu cuenta, así que el soporte queda en espera hasta que existan APIs públicas seguras.',
      'auth.statusGenerating': 'Generando código de verificación…',
      'auth.statusGenError': 'No se pudo generar el código.',
      'auth.statusPsnCheckingBio': 'Comprobando la bio de tu perfil PlayStation…',
      'auth.statusVerifyFail': 'Error en la verificación.',
      'auth.statusPsnConnected': '¡PlayStation Network conectada!',
      'auth.statusPsnVerifying': 'Verificando cuenta PlayStation…',
      'auth.statusPsnNpssoError': 'No se pudo verificar el token NPSSO.',
      'auth.statusXboxCheckingBio': 'Comprobando la bio de tu perfil Xbox…',
      'auth.statusXboxConnected': '¡Xbox Live conectado!',
      'auth.unlinkedToast': 'Cuenta de {platform} desvinculada.',

      // Game Modal
      'game.fallbackName': 'Juego #{id}',
      'game.unknownYear': 'Desconocido',
      'game.developer': 'Desarrolladora:',
      'game.publisher': 'Editora:',
      'game.systems': 'Sistemas:',
      'game.released': 'Lanzamiento:',
      'game.peakPlayers': 'pico de jugadores esta semana',
      'game.notReleasedOn': 'No lanzado en {platform}',
      'game.noVerifiedReviews': 'Sin reseñas verificadas',
      'game.classicEraShort': 'Era clásica',
      'game.avgHoursShort': 'media {hours}h',
      'game.scoreBreakdown': 'Desglose de nota ({platform})',
      'game.totalAvg': 'Media total:',
      'game.classicVerified': 'Era Clásica · cuenta verificada',
      'game.medianAvgHours': 'Mediana {median}h · Media {avg}h jugadas',
      'game.noRatingsYet': 'Aún sin puntuaciones verificadas',
      'game.criteriaGridAria': 'Promedios en los 4 criterios para {platform}',
      'game.distAria': 'Distribución de notas en {platform}',
      'game.distPositive': 'Positivas (75–100): {n}',
      'game.distMixed': 'Mixtas (50–74): {n}',
      'game.distNegative': 'Negativas (0–49): {n}',
      'game.spikeHtml':
        '<strong>Alta actividad reciente:</strong> Hay propietarios verificados reseñando este juego ahora mismo. Todas las notas mantienen el mismo peso y siguen aisladas por plataforma.',
      'game.choosePlatAria': 'Elegir plataforma para reseñar',
      'game.editReviewTitle': 'Editar reseña en {platform}',
      'game.rateOnTitle': 'Puntuar en {platform}',
      'game.classicPillFull': '✦ Era Clásica ({era}) · Cuenta verificada',
      'game.checkingLib': 'Comprobando biblioteca de {platform}…',
      'game.refreshingLib': 'Actualizando biblioteca de {platform}…',
      'game.refreshLibBtn': '↻ Actualizar biblioteca {platform}',
      'game.refreshLibError': 'No se pudo actualizar la biblioteca ahora mismo.',
      'game.eligConnect': 'Conecta {platform} para puntuar',
      'game.eligUnavailable': 'Verificación no disponible',
      'game.eligNotOwned': 'No está en tu biblioteca de {platform}',
      'game.eligNotOwnedMsg':
        'Debes tener este juego en {platform} (con {hours}h+ jugadas) para poder reseñarlo.',
      'game.eligNeedMore': '{played}h jugadas · Necesitas {min}h+',
      'game.eligNeedMoreMsg': 'Juega al menos {more}h más en {platform} para desbloquear la reseña.',
      'game.eligVerified': '✓ Dueño verificado en {platform} · {hours}h jugadas',
      'game.legacyBannerHtml':
        '<strong>Reseña de Era Clásica:</strong> {reason}. Se omite la comprobación de biblioteca y horas para este clásico, pero sigue siendo obligatorio iniciar sesión en {platform} (una reseña por cuenta).',
      'game.isolationNoteHtml':
        'Se suma exclusivamente a la nota de <strong>{platform}</strong> — nunca mezclada con otras plataformas.',
      'game.legacyMigrateHtml':
        'Tu reseña anterior tiene una nota de <strong>{score}</strong>. Responde a las 4 preguntas obligatorias abajo para actualizarla.',
      'game.qPrefix': 'P{num}',
      'game.qTipAria': 'Ayuda para {label}',
      'game.qScaleAria': '{label} (de 0 a 10)',
      'game.finalScore': 'Nota Final',
      'game.calculatedSub': 'Calculada a partir de tus 4 respuestas',
      'game.incompleteSub': 'Responde a las 4 preguntas obligatorias ({n}/4 respondidas)',
      'game.incomplete': 'Incompleto',
      'game.textareaPlaceholder': 'Comparte tu experiencia honesta jugando en {platform} (opcional)…',
      'game.deleteReview': 'Eliminar reseña',
      'game.updateReview': 'Actualizar reseña ({platform})',
      'game.publishReview': 'Publicar reseña ({platform})',
      'game.requiresAccount': '{name} requiere una cuenta de {platform}',
      'game.haveYouPlayed': '¿Has jugado a {name}?',
      'game.connectLinkedPrompt':
        'Solo puedes reseñar juegos en las plataformas donde se lanzaron. Conecta tu cuenta de {platform} para puntuar este {target}.',
      'game.targetClassic': 'clásico de {era} (sin comprobación de biblioteca)',
      'game.targetTitle': 'título de {platform}',
      'game.connectGuestClassic':
        'Inicia sesión con {platform} para puntuar este clásico de {era}. Se omiten las comprobaciones de biblioteca y horas en clásicos pre-API, pero el acceso con cuenta sigue siendo obligatorio.',
      'game.connectGuestNormal':
        'Conecta {platforms} para verificar la propiedad y 2h+ de juego. La nota de cada plataforma se calcula por separado.',
      'game.orWord': 'o',
      'game.connectPlatformBtn': 'Conectar {platform}',
      'game.modalReviewsTitle': 'Reseñas de jugadores verificados ({count})',
      'game.sortGameReviewsAria': 'Ordenar reseñas del juego',
      'game.sortNewestFirst': 'Más recientes primero',
      'game.loadingReviews': 'Cargando reseñas…',
      'game.noReviewsInModal':
        'Aún no hay reseñas verificadas. Sé el primer propietario con 2h+ jugadas en puntuarlo.',
      'game.loadReviewsError': 'No se pudieron cargar las reseñas: {msg}',
      'game.reviewLegacyMeta': '{era} verificado por cuenta en {icon} {platform}',
      'game.reviewPlayedMeta': '{hours}h jugadas en {icon} {platform}',
      'game.editedSuffix': ' · editada',
      'game.answerAllErr': 'Responde a las 4 preguntas obligatorias (0–10) antes de publicar.',
      'game.verifyingSubmit': 'Verificando tu biblioteca y horas de juego en {platform}…',
      'game.saveError': 'No se pudo guardar la reseña.',
      'game.networkError': 'Error de red.',
      'game.updatedToast': '¡Reseña verificada en {platform} actualizada! ({score}/100)',
      'game.publishedToast': '¡Reseña verificada en {platform} publicada! ({score}/100)',
      'game.deletedToast': 'Tu reseña en {platform} fue eliminada.',
      'game.breakdownAria': 'Desglose de puntuación',

      // 4 Review Questions (weights never displayed)
      'q.fun.label': '¿Es divertido el juego?',
      'q.fun.short': 'Diversión',
      'q.fun.tip':
        'Los juegos existen sobre todo para divertirnos, así que indica cuánto disfrutaste tu tiempo en este juego.',
      'q.performance.label': '¿El rendimiento del juego es bueno?',
      'q.performance.short': 'Rendimiento',
      'q.performance.tip': 'Ten en cuenta los requisitos mínimos y recomendados.',
      'q.gameplay.label': '¿El gameplay loop es bueno?',
      'q.gameplay.short': 'Gameplay',
      'q.gameplay.tip': 'Valora las premisas y mecánicas principales y lo adictivas que resultan.',
      'q.visuals.label': '¿El juego se ve bien?',
      'q.visuals.short': 'Gráficos',
      'q.visuals.tip':
        'Recuerda que la dirección de arte puede ser pixel art y aun así verse increíble dentro de ese estilo.',

      // Verdicts
      'verdict.essential': 'Imprescindible',
      'verdict.great': 'Excelente',
      'verdict.good': 'Bueno',
      'verdict.mixed': 'Mixto',
      'verdict.rough': 'Flojo',
      'verdict.poor': 'Malo',

      // System / Boot Toasts
      'toast.offline': 'Parece que estás sin conexión. Reconéctate para cargar novedades o publicar reseñas.',
      'toast.online': '¡De nuevo en línea!',
      'toast.steamLoginFail': 'Error al iniciar sesión con Steam. Inténtalo de nuevo.',
      'toast.xboxLoginFail': 'Error al iniciar sesión con Xbox. Inténtalo de nuevo.',
      'toast.xboxConfigUnavailable':
        'La conexión con Xbox Live no está disponible en este servidor ahora mismo. Inténtalo más tarde.',
      'toast.connected': '¡{platform} conectado! Ya puedes publicar reseñas verificadas.',
    },
  };

  function normalizeLang(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (SUPPORTED.includes(trimmed)) return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower === 'pt' || lower.startsWith('pt-')) return 'pt-BR';
    if (lower === 'es' || lower.startsWith('es-')) return 'es';
    if (lower === 'en' || lower.startsWith('en-')) return 'en';
    return null;
  }

  function detectInitialLang() {
    try {
      const saved = normalizeLang(localStorage.getItem(STORAGE_KEY));
      if (saved) return saved;
    } catch {}
    const candidates = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || 'en'];
    for (const c of candidates) {
      const match = normalizeLang(c);
      if (match) return match;
    }
    return 'en';
  }

  let currentLang = detectInitialLang();

  function getLang() {
    return currentLang;
  }

  function getLangMeta(code = currentLang) {
    return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
  }

  function locale() {
    return getLangMeta(currentLang).locale;
  }

  function t(key, vars = null) {
    const table = DICT[currentLang] || DICT.en;
    let out = Object.prototype.hasOwnProperty.call(table, key)
      ? table[key]
      : Object.prototype.hasOwnProperty.call(DICT.en, key)
        ? DICT.en[key]
        : key;
    if (vars && typeof vars === 'object') {
      out = out.replace(/\{(\w+)\}/g, (_, k) =>
        Object.prototype.hasOwnProperty.call(vars, k) && vars[k] !== undefined && vars[k] !== null
          ? String(vars[k])
          : `{${k}}`
      );
    }
    return out;
  }

  function flagSvg(code = currentLang) {
    return FLAGS[code] || FLAGS.en;
  }

  function applyDomTranslations(root = document) {
    document.documentElement.lang = currentLang;
    document.title = t('meta.title');
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', t('meta.description'));

    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const numVar = el.getAttribute('data-i18n-n');
      el.textContent = numVar !== null ? t(key, { n: numVar }) : t(key);
    });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      el.innerHTML = t(key);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });
  }

  const listeners = new Set();

  function setLang(next) {
    const norm = normalizeLang(next);
    if (!norm) return currentLang;
    const changed = norm !== currentLang;
    currentLang = norm;
    try {
      localStorage.setItem(STORAGE_KEY, currentLang);
    } catch {}
    applyDomTranslations(document);
    if (changed) {
      listeners.forEach((fn) => {
        try {
          fn(currentLang);
        } catch (err) {
          console.warn('i18n listener error:', err);
        }
      });
    }
    return currentLang;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  window.PlaytestedI18n = {
    LANGUAGES,
    getLang,
    getLangMeta,
    setLang,
    locale,
    t,
    flagSvg,
    applyDomTranslations,
    onChange,
  };
})();
