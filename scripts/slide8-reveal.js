/* ============================================================
   SLIDE 08 — Tesis Atlası + Sıralı 3D Önizleme · step controller
   ----------------------------------------------------------------
   8 adımlık akış (data-step="0..7"):
     0 → Atlas + 6 pin sönük, hiçbir ünite aktif, hint görünür
     1 → Ünite 01 KAVURMA aktif (mini 3D: three-roaster)
     2 → Ünite 02 OKSİJEN aktif (mini 3D: three-oxygen)
     3 → Ünite 03 CIL aktif (mini 3D: three-cil-tank)
     4 → Ünite 04 ADSORPSİYON aktif (mini 3D: three-carbon-adsorption)
     5 → Ünite 05 REJENERASYON aktif (mini 3D: three-carbon-regen)
     6 → Ünite 06 ELECTROWINNING aktif (mini 3D: three-electrowinning)
     7 → Tüm pinler altın, KPI strip + köprü cümlesi
   Adım 7'de sağ-ok navigation'a teslim → slayt 9'a geçer.
   Sol-ok adımları geri alır; adım 0'da slayt 7'ye döner.
   slide7-reveal.js ile aynı pattern.

   3D entegrasyonu: her three-XXX.js modülünde refactor edilmiş
   window.threeXXX.mount(canvasEl) / unmount() API'sı var.
   Aktif adımda sadece bir canvas mount'lu; diğer adıma geçişte
   önce eski modül unmount edilir, sonra yenisi mount edilir —
   tek anda bir WebGL context, performans güvenli.
   ============================================================ */
(function () {
  const section = document.querySelector('.s8-slide');
  if (!section) return;

  const SLIDE_INDEX = 7; // data-slide="8" → 0-indexed = 7
  const TOTAL_STEPS = 7;
  const STEP_LOCK_MS = 520;
  const FINAL_LOCK_MS = 700;

  // step → { moduleKey, canvasId } veya null (step 0 / 7)
  const UNIT_CONFIG = [
    null,                                                          // step 0
    { key: 'threeRoaster',       canvasId: 's8-canvas-roaster' },  // step 1
    { key: 'threeOxygen',        canvasId: 's8-canvas-oxygen'  },  // step 2
    { key: 'threeCilTank',       canvasId: 's8-canvas-cil'     },  // step 3
    { key: 'threeCarbonAds',     canvasId: 's8-canvas-ads'     },  // step 4
    { key: 'threeCarbonRegen',   canvasId: 's8-canvas-regen'   },  // step 5
    { key: 'threeElectrowinning',canvasId: 's8-canvas-ew'      },  // step 6
    null,                                                          // step 7
  ];

  let step = 0;
  let busy = false;
  let prevSlideIndex = 0;
  let lockTimer = null;
  let activeMount = null; // { key, canvasId } currently mounted

  // ---- 3D helpers --------------------------------------------------------
  function mountForStep(n) {
    const cfg = UNIT_CONFIG[n];
    if (!cfg) return;
    // Aynı modül zaten mount'lu mu?
    if (activeMount && activeMount.key === cfg.key) return;
    // Önce eskisini söndür
    unmountActive();

    const mod = window[cfg.key];
    if (!mod || typeof mod.mount !== 'function') return; // modül henüz yüklenmemiş olabilir — sessiz geç
    const canvasEl = document.getElementById(cfg.canvasId);
    if (!canvasEl) return;
    try {
      mod.mount(canvasEl);
      activeMount = cfg;
    } catch (err) {
      console.warn('[slide8] mount failed for', cfg.key, err);
      activeMount = null;
    }
  }

  function unmountActive() {
    if (!activeMount) return;
    const mod = window[activeMount.key];
    if (mod && typeof mod.unmount === 'function') {
      try { mod.unmount(); } catch (err) {
        console.warn('[slide8] unmount failed for', activeMount.key, err);
      }
    }
    activeMount = null;
  }

  // ---- DOM state ---------------------------------------------------------
  function applyState(n) {
    // Pinler
    section.querySelectorAll('.s8-pin').forEach((pin) => {
      const u = Number(pin.dataset.unit);
      pin.classList.toggle('is-active', n >= 1 && n <= 6 && u === n);
      pin.classList.toggle('is-past',   n >= 1 && n <= 6 && u < n);
    });
    // Liste
    section.querySelectorAll('.s8-list__item').forEach((li) => {
      const u = Number(li.dataset.unit);
      li.classList.toggle('is-active', n >= 1 && n <= 6 && u === n);
      li.classList.toggle('is-past',   n >= 1 && n <= 6 && u < n);
    });
    // Mini kart
    section.querySelectorAll('.s8-mini__card').forEach((card) => {
      const u = Number(card.dataset.unit);
      card.classList.toggle('is-active', n >= 1 && n <= 6 && u === n);
    });
  }

  function setStep(n) {
    step = Math.max(0, Math.min(TOTAL_STEPS, n));
    section.dataset.step = String(step);
    applyState(step);

    // 3D mount/unmount
    if (step >= 1 && step <= 6) {
      // Slayt aktif değilse 3D başlatma — slidechange handler içinde başlatılır
      if (section.classList.contains('active')) {
        // Yeni canvas'ın layout'a oturması için bir tick bekle
        requestAnimationFrame(() => requestAnimationFrame(() => mountForStep(step)));
      }
    } else {
      // step 0 veya 7 → aktif olanı kapat
      unmountActive();
    }
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
    if (n === 7) return FINAL_LOCK_MS;
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
    setStep(step - 1);
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
      // step === TOTAL_STEPS → navigation slayt 9'a geçer
    } else if (REGRESS_KEYS.has(e.key)) {
      if (step > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        regress();
      }
      // step === 0 → navigation slayt 7'ye geri döner
    }
  }, true);

  // -------- Sync with navigation slidechange -----------------------------
  window.addEventListener('slidechange', (e) => {
    const newIdx = e.detail && typeof e.detail.index === 'number'
      ? e.detail.index
      : null;
    if (newIdx === null) return;

    if (newIdx === SLIDE_INDEX) {
      // Slayt 8'e giriş
      if (prevSlideIndex < SLIDE_INDEX) {
        resetTo(0);
      } else {
        // Geri (slayt 9'dan) → son adımda land et
        resetTo(TOTAL_STEPS);
      }
    } else if (prevSlideIndex === SLIDE_INDEX) {
      // Slayt 8'den çıkış — pending state + aktif 3D'yi kapat (performans)
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
      busy = false;
      unmountActive();
    }
    prevSlideIndex = newIdx;
  });

  // -------- İlk yükleme: slayt 8 aktif olabilir, default 0 ---------------
  if (section.classList.contains('active')) {
    resetTo(0);
  } else {
    section.dataset.step = '0';
    applyState(0);
  }
})();
