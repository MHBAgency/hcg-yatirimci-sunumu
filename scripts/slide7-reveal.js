/* ============================================================
   SLIDE 07 — Hammadde Farkımız: Atık · step controller
   ----------------------------------------------------------------
   5 adımlık akış (data-step="0..4"):
     0 → açılış sorusu (tam ekran atık görseli)
     1 → klasik vs NTE karşılaştırması (görsel ölçek farkı)
     2 → + gümüş bonusu (sağ sütuna pop-in)
     3 → gelir akışı (10 g/t Au + 100 g/t Ag → $25M → $22M)
     4 → ESG sahnesi (3 ikon)
   Adım 4'te sağ-ok navigation'a teslim → slayt 8'e geçer.
   Sol-ok adımları geri alır; adım 0'da slayt 6'ya döner.
   slide5-reveal.js / slide6-reveal.js ile aynı pattern.
   ============================================================ */
(function () {
  const section = document.querySelector('.s7-slide');
  if (!section) return;

  const SLIDE_INDEX = 6; // data-slide="7" → 0-indexed = 6
  const TOTAL_STEPS = 4;
  const STEP_LOCK_MS = 480;
  const REV_LOCK_MS = 1200;  // step 3 — dev sayı + caption cascade otursun

  let step = 0;
  let busy = false;
  let prevSlideIndex = 0;
  let lockTimer = null;

  function setStep(n) {
    step = Math.max(0, Math.min(TOTAL_STEPS, n));
    section.dataset.step = String(step);
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
    if (n === 3) return REV_LOCK_MS;
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
      // step === TOTAL_STEPS → navigation slayt 8'e geçer
    } else if (REGRESS_KEYS.has(e.key)) {
      if (step > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        regress();
      }
      // step === 0 → navigation slayt 6'ya geri döner
    }
  }, true);

  // -------- Sync with navigation slidechange -----------------------------
  window.addEventListener('slidechange', (e) => {
    const newIdx = e.detail && typeof e.detail.index === 'number'
      ? e.detail.index
      : null;
    if (newIdx === null) return;

    if (newIdx === SLIDE_INDEX) {
      // Slayt 7'ye giriş
      if (prevSlideIndex < SLIDE_INDEX) {
        // İleri (slayt 6'dan) → baştan başla
        resetTo(0);
      } else {
        // Geri (slayt 8'den) → son adımda land et
        resetTo(TOTAL_STEPS);
      }
    } else if (prevSlideIndex === SLIDE_INDEX) {
      // Slayt 7'den çıkış — pending state'i temizle
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
      busy = false;
    }
    prevSlideIndex = newIdx;
  });

  // -------- İlk yükleme: slayt 7 aktif olabilir (nadir), default 0 -------
  if (section.classList.contains('active')) {
    resetTo(0);
  } else {
    setStep(0);
  }
})();
