/* ============================================================
   SLIDE 03 — Mikroskop Yolculuğu step controller
   ----------------------------------------------------------------
   6 adımlık zoom akışı (data-step="0..5"):
     0 → ore-samples (çıplak göz)              "Çıplak gözle..."
     1 → ore-microphoto (mikroskop)            "Mikroskop altında..."
     2 → pyrite-crystals + kübik kafes overlay "Pirit..."
     3 → arseno spotlight + monoklin kafes     "Arsenopirit..."
     4 → quartz spotlight + damar overlay      "Kuvars matrisi..."
     5 → klimaks: büyük %85 SÜLFÜRDE KİLİTLİ ringi + final cümle
   Adım 5'te sağ-ok navigation'a teslim → slayt 4'e (kavurma) geçer.
   Sol-ok adımları geri alır; adım 0'da slayt 2'ye döner.
   slide2-reveal.js ile aynı pattern.
   ============================================================ */
(function () {
  const section = document.querySelector('.micro-slide');
  if (!section) return;

  const SLIDE_INDEX = 2; // data-slide="3" → 0-indexed = 2
  const TOTAL_STEPS = 5;
  const STEP_LOCK_MS = 380; // her step için kısa kilit (cross-fade'i koru)

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
    // klimaks adımı biraz daha uzun bir lock — donut animasyonu otursun
    lock(step === TOTAL_STEPS ? 520 : STEP_LOCK_MS);
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
      // step === TOTAL_STEPS → navigation slayt 4'e geçer
    } else if (REGRESS_KEYS.has(e.key)) {
      if (step > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        regress();
      }
      // step === 0 → navigation slayt 2'ye geri döner
    }
  }, true);

  // -------- Sync with navigation slidechange -----------------------------
  window.addEventListener('slidechange', (e) => {
    const newIdx = e.detail && typeof e.detail.index === 'number'
      ? e.detail.index
      : null;
    if (newIdx === null) return;

    if (newIdx === SLIDE_INDEX) {
      // Slayt 3'e giriş
      if (prevSlideIndex < SLIDE_INDEX) {
        // İleri (slayt 2'den) → baştan başla
        resetTo(0);
      } else {
        // Geri (slayt 4'ten) → son adımda land et
        resetTo(TOTAL_STEPS);
      }
    } else if (prevSlideIndex === SLIDE_INDEX) {
      // Slayt 3'ten çıkış — pending state'i temizle
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
      busy = false;
    }
    prevSlideIndex = newIdx;
  });

  // -------- İlk yükleme: slayt 3 aktif olabilir (nadir), default 0 -------
  if (section.classList.contains('active')) {
    resetTo(0);
  } else {
    setStep(0);
  }
})();
