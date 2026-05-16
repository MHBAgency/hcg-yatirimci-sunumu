/* ============================================================
   SLIDE 04 — Reaksiyon Sahneleri step controller
   ----------------------------------------------------------------
   5 adımlık cross-fade akışı (data-step="0..4"):
     0 → Açılış cümlesi (centered)
     1 → Kavurma sahnesi    (sol foto · sağ büyük SVG + formül)
     2 → CIL Liçi sahnesi   (sol foto · sağ büyük SVG + formül)
     3 → Doré çıktısı       (sol foto · sağ büyük SVG + formül)
     4 → Klimaks: 3 mini etiket + büyük %95 donut + final cümle
   Adım 4'te sağ-ok navigation'a teslim → slayt 5'e (yöntem) geçer.
   Sol-ok adımları geri alır; adım 0'da slayt 3'e döner.
   slide3-reveal.js ile aynı pattern.
   ============================================================ */
(function () {
  const section = document.querySelector('.r4-stage');
  if (!section) return;

  const SLIDE_INDEX = 3; // data-slide="4" → 0-indexed = 3
  const TOTAL_STEPS = 4;
  const STEP_LOCK_MS = 420; // cross-fade süresince kilit

  let step = 0;
  let busy = false;
  let prevSlideIndex = 0;
  let lockTimer = null;

  const setStep = (n) => {
    step = Math.max(0, Math.min(TOTAL_STEPS, n));
    section.dataset.step = String(step);
  };

  const lock = (ms) => new Promise((res) => {
    busy = true;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
      busy = false;
      lockTimer = null;
      res();
    }, ms);
  });

  function advance() {
    if (busy) return;
    if (step >= TOTAL_STEPS) return;
    setStep(step + 1);
    // Klimaks adımı biraz daha uzun — donut + ring animasyonu otursun
    lock(step === TOTAL_STEPS ? 560 : STEP_LOCK_MS);
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
      // step === TOTAL_STEPS → navigation slayt 5'e geçer
    } else if (REGRESS_KEYS.has(e.key)) {
      if (step > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        regress();
      }
      // step === 0 → navigation slayt 3'e geri döner
    }
  }, true);

  // -------- Sync with navigation slidechange -----------------------------
  window.addEventListener('slidechange', (e) => {
    const newIdx = e.detail && typeof e.detail.index === 'number'
      ? e.detail.index
      : null;
    if (newIdx === null) return;

    if (newIdx === SLIDE_INDEX) {
      // Slayt 4'e giriş
      if (prevSlideIndex < SLIDE_INDEX) {
        // İleri (slayt 3'ten) → baştan başla (intro cümlesi)
        resetTo(0);
      } else {
        // Geri (slayt 5'ten) → son adımda land et (klimaks)
        resetTo(TOTAL_STEPS);
      }
    } else if (prevSlideIndex === SLIDE_INDEX) {
      // Slayt 4'ten çıkış — pending state'i temizle
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
      busy = false;
    }
    prevSlideIndex = newIdx;
  });

  // -------- İlk yükleme: slayt 4 aktif olabilir (nadir), default 0 -------
  if (section.classList.contains('active')) {
    resetTo(0);
  } else {
    setStep(0);
  }
})();
