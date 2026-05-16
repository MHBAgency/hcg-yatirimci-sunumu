/* ============================================================
   SLIDE 06 — Sinematik Harita step controller
   ----------------------------------------------------------------
   5 adımlık akış (data-step="0..4"):
     0 → DÜNYA  (4 ana kuşak + dünya madenleri)
     1 → TETHYAN (rakipler listesi — Öksüt, Çöpler, Reko Diq, Zarshuran)
     2 → CAPEX  (yatay bar grafik, $7B → $10M dramatik klimaks)
     3 → SAFADAŞT (saha detayları)
     4 → KAPANIŞ QUOTE (NTE Pars vurgulu)
   Adım 4'te sağ-ok navigation'a teslim → slayt 7'ye geçer.
   Sol-ok adımları geri alır; adım 0'da slayt 5'e döner.
   slide5-reveal.js ile aynı pattern.

   map-world.js entegrasyonu:
   - window.__cmap.flyToLevel('world'|'tethyan'|'safadast') ile harita
     uçar. Step 1/2 aynı seviyede (tethyan), step 3/4 aynı seviyede
     (safadast) — tekrar fly etmiyoruz.
   - flyToLevel kendi info-panel sync'ini yapar; biz sonra step'in
     gerçek panel hedefini (capex/quote dahil) override ederiz.
   - İlk yüklemede map-world.js'in 400ms gecikmeli flyTo('world')'ü
     bizim ilk adımımızı (özellikle slayt 7'den geri girişte step 4'ü)
     ezmesin diye suppressInitialFly() çağırıyoruz.
   ============================================================ */
(function () {
  const section = document.querySelector('.cinematic-map-slide');
  if (!section) return;

  const SLIDE_INDEX = 5; // data-slide="6" → 0-indexed = 5
  const TOTAL_STEPS = 4;
  const STEP_LOCK_MS = 480;
  const CAPEX_LOCK_MS = 900; // step 2 — bar animasyonu otursun
  const QUOTE_LOCK_MS = 600;

  // Step → harita zoom seviyesi (step 1/2 aynı tethyan, step 3/4 aynı safadast)
  const STEP_TO_LEVEL = ['world', 'tethyan', 'tethyan', 'safadast', 'safadast'];
  // Step → sağ panel section (mip-section data-zoom-info değeri)
  const STEP_TO_PANEL = ['world', 'tethyan', 'capex',  'safadast', 'quote'];

  let step = 0;
  let busy = false;
  let prevSlideIndex = 0;
  let lockTimer = null;

  function applyPanel(n) {
    const target = STEP_TO_PANEL[n];
    section.querySelectorAll('.mip-section').forEach((s) => {
      s.classList.toggle('active', s.dataset.zoomInfo === target);
    });
  }

  function flyWhenReady(targetStep) {
    if (step !== targetStep) return; // stale — kullanıcı zaten ilerledi
    const cmap = window.__cmap;
    if (!cmap) return;
    if (cmap.isReady) {
      const target = STEP_TO_LEVEL[targetStep];
      if (cmap.current !== target) {
        cmap.flyToLevel(target);
      }
      // flyToLevel kendi panel sync'ini yapar — biz step'e göre override
      applyPanel(targetStep);
    } else {
      // Map henüz init olmadı — kısa bir poll
      setTimeout(() => flyWhenReady(targetStep), 60);
    }
  }

  function setStep(n) {
    step = Math.max(0, Math.min(TOTAL_STEPS, n));
    section.dataset.step = String(step);
    // Önce panel'i göster (anlık), sonra harita uçuşunu kuyruğa al
    applyPanel(step);
    flyWhenReady(step);
  }

  function lock(ms) {
    busy = true;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
      busy = false;
      lockTimer = null;
    }, ms);
  }

  function lockMsForStep(n) {
    if (n === 2) return CAPEX_LOCK_MS;
    if (n === 4) return QUOTE_LOCK_MS;
    return STEP_LOCK_MS;
  }

  function advance() {
    if (busy) return;
    if (step >= TOTAL_STEPS) return;
    const next = step + 1;
    setStep(next);
    lock(lockMsForStep(next));
  }

  function regress() {
    if (busy) return;
    if (step <= 0) return;
    const next = step - 1;
    setStep(next);
    lock(STEP_LOCK_MS);
  }

  function resetTo(n) {
    if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
    busy = false;
    setStep(n);
  }

  // -------- Key interception (capture-phase, navigation.js'ten önce) -----
  const ADVANCE_KEYS = new Set(['ArrowRight', ' ', 'PageDown']);
  const REGRESS_KEYS = new Set(['ArrowLeft', 'PageUp']);

  document.addEventListener('keydown', (e) => {
    if (!section.classList.contains('active')) return;

    if (busy) {
      if (ADVANCE_KEYS.has(e.key) || REGRESS_KEYS.has(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }

    if (ADVANCE_KEYS.has(e.key)) {
      if (step < TOTAL_STEPS) {
        e.preventDefault();
        e.stopImmediatePropagation();
        advance();
      }
      // step === TOTAL_STEPS → navigation slayt 7'ye geçer
    } else if (REGRESS_KEYS.has(e.key)) {
      if (step > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        regress();
      }
      // step === 0 → navigation slayt 5'e geri döner
    }
  }, true);

  // -------- Sync with navigation slidechange -----------------------------
  window.addEventListener('slidechange', (e) => {
    const newIdx = e.detail && typeof e.detail.index === 'number'
      ? e.detail.index
      : null;
    if (newIdx === null) return;

    if (newIdx === SLIDE_INDEX) {
      // map-world.js'in 400ms gecikmeli init flyTo('world')'ünü iptal et
      // (step 4'te girersek bizim safadast fly'ımızı ezmesin).
      if (window.__cmap && window.__cmap.suppressInitialFly) {
        window.__cmap.suppressInitialFly();
      }
      // Slayt 6'ya giriş
      if (prevSlideIndex < SLIDE_INDEX) {
        // İleri (slayt 5'ten) → baştan başla
        resetTo(0);
      } else {
        // Geri (slayt 7'den) → son adımda land et
        resetTo(TOTAL_STEPS);
      }
    } else if (prevSlideIndex === SLIDE_INDEX) {
      // Slayt 6'dan çıkış — pending state'i temizle
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
      busy = false;
    }
    prevSlideIndex = newIdx;
  });

  // -------- İlk yükleme: slayt 6 aktif olabilir (nadir), default 0 -------
  if (section.classList.contains('active')) {
    if (window.__cmap && window.__cmap.suppressInitialFly) {
      window.__cmap.suppressInitialFly();
    }
    resetTo(0);
  } else {
    section.dataset.step = '0';
    applyPanel(0);
  }
})();
