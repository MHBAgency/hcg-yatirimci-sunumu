/* Sinematik harita — Dünya → Tethyan → Safadaşt 3 zoom seviyesi
   Slayt 4 aktif olduğunda init olur, buton tıklamalarıyla flyTo */
(function () {
  let map = null;
  let initialized = false;
  let dramaTimer = null;
  let initialFlyTimer = null;

  // Pin referansları — zoom seviyesine göre opacity ayarı için
  const pinRefs = {
    global: [],     // dünya madenleri (Tethyan dışı)
    tethyan: [],    // Tethyan kuşağı rakipleri
    primary: null,  // Hikmet Çetin Gold
  };

  // Sülfürlü altın madenleri — Tethyan dışı (global)
  const globalMines = [
    { name: 'Witwatersrand',     coords: [-26.4, 27.9],  country: 'G. Afrika',  company: 'Sibanye-Stillwater', mineral: 'Pirit' },
    { name: 'Obuasi (Ashanti)',  coords: [6.2, -1.7],    country: 'Gana',       company: 'AngloGold Ashanti',  mineral: 'Refrakter sülfür' },
    { name: 'Olimpiada',         coords: [59.6, 92.9],   country: 'Rusya',      company: 'Polyus',             mineral: 'Arsenopirit, pirit' },
    { name: 'Muruntau',          coords: [41.5, 64.6],   country: 'Özbekistan', company: 'Navoi MMC',          mineral: 'Sülfürlü/oksit' },
    { name: 'Jinfeng',           coords: [25.7, 105.6],  country: 'Çin',        company: 'Zijin Mining',       mineral: 'Arsenopirit' },
    { name: 'Carlin Trend',      coords: [40.9, -116.1], country: 'ABD',        company: 'Nevada Gold Mines',  mineral: 'Arsenopirit' },
    { name: 'Goldstrike',        coords: [40.95, -116.35], country: 'ABD',      company: 'Barrick Gold',       mineral: 'Refrakter sülfür' },
    { name: 'Hemlo',             coords: [48.7, -85.9],  country: 'Kanada',     company: 'Barrick Gold',       mineral: 'Sülfürlü' },
    { name: 'Paracatu',          coords: [-17.2, -46.9], country: 'Brezilya',   company: 'Kinross Gold',       mineral: 'Sülfürlü' },
    { name: 'Kalgoorlie Super Pit', coords: [-30.78, 121.5], country: 'Avustralya', company: 'Northern Star', mineral: 'Sülfürlü' },
    { name: 'Boddington',        coords: [-32.75, 116.36], country: 'Avustralya', company: 'Newmont',         mineral: 'Sülfürlü' },
  ];

  // Tethyan kuşağı rakipleri — özellikle vurgulanıyor
  const tethyanMines = [
    { name: 'Öksüt',     coords: [38.42, 35.7],  country: 'Türkiye',  company: 'SSR Mining',    mineral: 'Sülfürlü' },
    { name: 'Çöpler',    coords: [39.3, 38.4],   country: 'Türkiye',  company: 'SSR Mining',    mineral: 'Sülfürlü (POX)' },
    { name: 'Zarshuran', coords: [36.7, 47.1],   country: 'İran',     company: 'IMPASCO',       mineral: 'Sülfürlü' },
    { name: 'Reko Diq',  coords: [29.0, 62.3],   country: 'Pakistan', company: 'Barrick Gold',  mineral: 'Sülfürlü/Bakır' },
  ];

  // Hikmet Çetin Gold — Safadaşt, İran
  const ourSite = {
    name: 'Hikmet Çetin Gold',
    coords: [35.72, 50.83],
    country: 'Safadaşt, İran',
    detail: 'Sülfürlü Altın İşleme Tesisi · $10M CAPEX',
  };

  // 3 zoom seviyesinin Leaflet parametreleri — sunum ritmi için
  // süreler hafif kısaltıldı (sinematik his bozulmadan).
  const ZOOM_LEVELS = {
    world:    { center: [25, 30],            zoom: 2,    duration: 1.8 },
    tethyan:  { center: [37, 50],            zoom: 4.2,  duration: 1.6 },
    safadast: { center: ourSite.coords,      zoom: 7.5,  duration: 1.8 },
  };

  let currentZoomLevel = 'world';
  // Slide6-reveal init'in başında bunu true yapar — kendi 400ms gecikmeli
  // 'world' fly'ımız step controller'ın resetTo(4)'ünü ezmesin.
  let suppressInitialFly = false;

  function makePin(coords, opts = {}) {
    const { primary = false, label = '', subtitle = '' } = opts;
    const icon = L.divIcon({
      className: 'mine-pin-wrapper',
      html: primary ? '<div class="mine-pin primary"></div>' : '<div class="mine-pin"></div>',
      iconSize: primary ? [22, 22] : [14, 14],
      iconAnchor: primary ? [11, 11] : [7, 7],
    });
    const marker = L.marker(coords, {
      icon,
      zIndexOffset: primary ? 1000 : 0,
    });
    if (label) {
      const popup = primary
        ? `<div class="pin-popup" style="border-color: var(--gold);">
             <strong style="color: var(--gold-bright); font-size: 16px;">★ ${label}</strong>
             <div style="color: var(--gold); font-weight: 600;">${subtitle}</div>
           </div>`
        : `<div class="pin-popup">
             <strong>${label}</strong>
             <div>${subtitle}</div>
           </div>`;
      marker.bindPopup(popup, { closeButton: true, offset: [0, primary ? -8 : -4] });
    }
    return marker;
  }

  function initMap() {
    if (initialized) return;
    initialized = true;

    map = L.map('map', {
      center: ZOOM_LEVELS.world.center,
      zoom: ZOOM_LEVELS.world.zoom,
      minZoom: 2,
      maxZoom: 9,
      // Sinematik step-controlled — kullanıcı haritayla etkileşmesin,
      // sıra slide6-reveal.js'in kontrolünde
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
      preferCanvas: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
      boxZoom: false,
      tap: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19,
      pane: 'shadowPane',
      opacity: 0.7,
    }).addTo(map);

    // Container fullscreen olduğu için ilk frame'de Leaflet boyutu yanlış
    // hesaplayabilir → pinleri off-screen koyar (görünmüyor bug). RAF
    // ile bir sonraki frame'de invalidateSize çağırıp pin staggered'ları
    // doğru boyutla başlatıyoruz.
    requestAnimationFrame(() => {
      if (map) map.invalidateSize();
    });

    // Dünya madenleri (Tethyan dışı) — staggered animation
    globalMines.forEach((mine, i) => {
      setTimeout(() => {
        const m = makePin(mine.coords, {
          label: mine.name,
          subtitle: `${mine.country} · ${mine.company} · ${mine.mineral}`,
        }).addTo(map);
        pinRefs.global.push(m);
      }, 200 + i * 90);
    });

    // Tethyan rakipleri — biraz daha geç, vurgu için
    tethyanMines.forEach((mine, i) => {
      setTimeout(() => {
        const m = makePin(mine.coords, {
          label: mine.name,
          subtitle: `${mine.country} · ${mine.company} · ${mine.mineral}`,
        }).addTo(map);
        pinRefs.tethyan.push(m);
      }, 200 + (globalMines.length + i) * 90);
    });

    // Hikmet Çetin Gold — primary pin (dramatik açılış)
    setTimeout(() => {
      pinRefs.primary = makePin(ourSite.coords, {
        primary: true,
        label: ourSite.name,
        subtitle: `${ourSite.country} · ${ourSite.detail}`,
      }).addTo(map);
      pinRefs.primary.openPopup();
    }, 200 + (globalMines.length + tethyanMines.length) * 90 + 300);

    // İlk zoom drama: dünyaya açıl. Step-controller (slide6-reveal)
    // init sırasında suppressInitialFly'ı set ediyorsa atla — controller
    // başlangıç adımına göre kendi flyTo'sunu yapar.
    initialFlyTimer = setTimeout(() => {
      if (suppressInitialFly) return;
      flyToLevel('world');
    }, 400);
  }

  function flyToLevel(level) {
    if (!map || !ZOOM_LEVELS[level]) return;
    const cfg = ZOOM_LEVELS[level];
    map.flyTo(cfg.center, cfg.zoom, {
      duration: cfg.duration,
      easeLinearity: 0.25,
    });
    currentZoomLevel = level;
    updatePinVisibility(level);
    updateInfoPanel(level);
    updateButtonState(level);
  }

  function updatePinVisibility(level) {
    // Tüm seviyelerde primary + Tethyan görünür kalır
    // World seviyesinde global pinler de görünür
    // Yakın zoom'da global pinleri soluklaştır (canvas pinleri pseudo-state'le yönetiyoruz)
    const dimGlobal = level !== 'world';
    pinRefs.global.forEach(m => {
      const el = m.getElement && m.getElement();
      if (el) el.style.opacity = dimGlobal ? '0.25' : '1';
    });
  }

  function updateInfoPanel(level) {
    document.querySelectorAll('.mip-section').forEach(s => {
      s.classList.toggle('active', s.dataset.zoomInfo === level);
    });
  }

  function updateButtonState(level) {
    document.querySelectorAll('.mz-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.zoomLevel === level);
    });
  }

  function bindZoomButtons() {
    document.querySelectorAll('.mz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const level = btn.dataset.zoomLevel;
        if (level && level !== currentZoomLevel) {
          flyToLevel(level);
        }
      });
    });
  }

  // Slayt 6 (sinematik harita)
  window.addEventListener('slidechange', (e) => {
    const slide = e.detail.slide;
    if (slide && slide.classList.contains('cinematic-map-slide')) {
      initMap();
      bindZoomButtons();
      // active class ile layout flush olduktan sonra invalidateSize —
      // RAF + 1 frame fallback (transition tamamlanmasa bile container
      // yeni boyutuna ulaşmış olur)
      if (map) {
        requestAnimationFrame(() => {
          if (map) map.invalidateSize();
          requestAnimationFrame(() => { if (map) map.invalidateSize(); });
        });
      }
    }
  });

  // Eğer sayfa yüklenirken cinematic-map-slide aktifse
  document.addEventListener('DOMContentLoaded', () => {
    const directSlide = document.querySelector('.slide.cinematic-map-slide.active');
    if (directSlide) {
      setTimeout(() => {
        initMap();
        bindZoomButtons();
      }, 200);
    }
  });

  // Public API (slide6-reveal step controller + DEBUG)
  window.__cmap = {
    flyToLevel,
    get current() { return currentZoomLevel; },
    get isReady() { return !!map; },
    pinRefs,
    // Step controller başlangıç adımı 'world' değilse, init'in 400ms
    // gecikmeli flyTo('world')'ünün adım state'ini ezmesini engeller.
    suppressInitialFly() {
      suppressInitialFly = true;
      if (initialFlyTimer) { clearTimeout(initialFlyTimer); initialFlyTimer = null; }
    },
  };
})();
