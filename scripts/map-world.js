/* World mine map — initialized when slide 2 becomes active */
(function () {
  let map = null;
  let initialized = false;
  let dramaTimer = null;

  // Sulfide gold mines around the world (from project notes)
  const mines = [
    // Africa
    { name: 'Witwatersrand',     coords: [-26.4, 27.9],  country: 'G. Afrika',  company: 'Sibanye-Stillwater',  mineral: 'Pirit' },
    { name: 'Obuasi (Ashanti)',  coords: [6.2, -1.7],    country: 'Gana',       company: 'AngloGold Ashanti',   mineral: 'Refrakter sülfür' },

    // Russia / Asia
    { name: 'Olimpiada',         coords: [59.6, 92.9],   country: 'Rusya',      company: 'Polyus',              mineral: 'Arsenopirit, pirit' },
    { name: 'Muruntau',          coords: [41.5, 64.6],   country: 'Özbekistan', company: 'Navoi MMC',           mineral: 'Sülfürlü/oksit' },
    { name: 'Jinfeng',           coords: [25.7, 105.6],  country: 'Çin',        company: 'Zijin Mining',        mineral: 'Arsenopirit' },

    // North America
    { name: 'Carlin Trend',      coords: [40.9, -116.1], country: 'ABD',        company: 'Nevada Gold Mines',   mineral: 'Arsenopirit' },
    { name: 'Goldstrike',        coords: [40.95, -116.35],country: 'ABD',       company: 'Barrick Gold',        mineral: 'Refrakter sülfür' },
    { name: 'Hemlo',             coords: [48.7, -85.9],  country: 'Kanada',     company: 'Barrick Gold',        mineral: 'Sülfürlü' },

    // South America
    { name: 'Paracatu',          coords: [-17.2, -46.9], country: 'Brezilya',   company: 'Kinross Gold',        mineral: 'Sülfürlü' },

    // Australia
    { name: 'Kalgoorlie Super Pit', coords: [-30.78, 121.5], country: 'Avustralya', company: 'Northern Star',  mineral: 'Sülfürlü' },
    { name: 'Boddington',        coords: [-32.75, 116.36],country: 'Avustralya', company: 'Newmont',           mineral: 'Sülfürlü' },

    // Türkiye
    { name: 'Çöpler',            coords: [39.3, 38.4],   country: 'Türkiye',    company: 'SSR Mining',          mineral: 'Sülfürlü (POX)' },

    // İran
    { name: 'Zarshuran',         coords: [36.7, 47.1],   country: 'İran',       company: 'IMPASCO',             mineral: 'Sülfürlü' },
  ];

  // Hikmet Çetin Gold — Safadaşt, İran (approximate, refine later if exact coords given)
  const ourSite = {
    name: 'Hikmet Çetin Gold',
    coords: [35.72, 50.83],   // Safadaşt (Tehran Province) — adjust when exact location provided
    country: 'Safadaşt, İran',
    detail: 'Sülfürlü Altın İşleme Tesisi',
  };

  function initMap() {
    if (initialized) return;
    initialized = true;

    map = L.map('map', {
      center: [25, 30],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
      preferCanvas: true,
    });

    // Dark, premium tile layer (CartoDB Dark Matter — beautiful for presentations)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Labels layer on top
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19,
      pane: 'shadowPane',
      opacity: 0.7,
    }).addTo(map);

    // Add mine pins with staggered animation
    mines.forEach((mine, i) => {
      setTimeout(() => {
        const icon = L.divIcon({
          className: 'mine-pin-wrapper',
          html: '<div class="mine-pin"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker(mine.coords, { icon }).addTo(map);
        marker.bindPopup(
          `<div class="pin-popup">
             <strong>${mine.name}</strong>
             <div>${mine.country}</div>
             <div class="pop-meta">${mine.company}<br/>${mine.mineral}</div>
           </div>`,
          { closeButton: true, offset: [0, -4] }
        );
      }, 200 + i * 100);
    });

    // Hikmet Çetin Gold site — primary pin (delayed for dramatic reveal)
    setTimeout(() => {
      const primaryIcon = L.divIcon({
        className: 'mine-pin-wrapper',
        html: '<div class="mine-pin primary"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker(ourSite.coords, { icon: primaryIcon, zIndexOffset: 1000 }).addTo(map);
      marker.bindPopup(
        `<div class="pin-popup" style="border-color: var(--gold);">
           <strong style="color: var(--gold-bright); font-size: 16px;">★ ${ourSite.name}</strong>
           <div style="color: var(--gold); font-weight: 600;">${ourSite.country}</div>
           <div class="pop-meta">${ourSite.detail}</div>
         </div>`,
        { closeButton: true, offset: [0, -8] }
      ).openPopup();

      // Drama: smoothly fly to Iran with our site centered
      dramaTimer = setTimeout(() => {
        map.flyTo(ourSite.coords, 4.5, {
          duration: 3.2,
          easeLinearity: 0.25,
        });
      }, 1500);
    }, mines.length * 100 + 600);
  }

  window.addEventListener('slidechange', (e) => {
    if (e.detail.index === 1) {
      initMap();
      if (map) setTimeout(() => map.invalidateSize(), 100);
    }
  });

  // If user lands directly on slide 2 (unlikely but safe)
  if (document.querySelector('.slide[data-slide="2"]').classList.contains('active')) {
    setTimeout(initMap, 200);
  }
})();
