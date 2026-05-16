/* ============================================================
   SLIDE 15 — Yatırım & Geri Dönüş · 8 adımlı finansal hikaye
   ----------------------------------------------------------------
   8 adımlık akış (data-step="0..7"):
     0 → Açılış sorusu: "$10M koyarsan, ne kazanırsın?"
     1 → CAPEX devasa: $10M
     2 → CAPEX dağılımı pasta (4 segment)
     3 → Yıllık gelir (Au + Ag → $25.3M)
     4 → OPEX düşülür → ~$22M yıllık net kâr
     5 → Kümülatif nakit akışı · 6 ay break-even (sektör 3–5 yıl)
     6 → 12 yıl lifecycle · ~$264M · 26× geri dönüş (KLİMAKS)
     7 → Dashboard özet + Au fiyat duyarlılığı (leave-behind)
   Adım 7'de sağ-ok navigation'a teslim → slayt 16'ya geçer.
   Sol-ok adımları geri alır; adım 0'da slayt 14'e döner.
   slide7-reveal.js / slide8-reveal.js ile aynı pattern.
   ============================================================ */
(function () {
  const section = document.querySelector('.s15-slide');
  if (!section) return;

  const SLIDE_INDEX = 14; // data-slide="15" → 0-indexed = 14
  const TOTAL_STEPS = 7;
  const STEP_LOCK_MS = 520;
  const PIE_LOCK_MS = 1200;   // step 2 — 4 segment sırayla
  const REV_LOCK_MS = 820;    // step 3-4 — bar dolumları
  const CF_LOCK_MS = 1400;    // step 5-6 — kümülatif alan reveal
  const DASH_LOCK_MS = 900;   // step 7 — dashboard cascade

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
    if (n === 2) return PIE_LOCK_MS;
    if (n === 3 || n === 4) return REV_LOCK_MS;
    if (n === 5 || n === 6) return CF_LOCK_MS;
    if (n === 7) return DASH_LOCK_MS;
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
      // step === TOTAL_STEPS → navigation slayt 16'ya geçer
    } else if (REGRESS_KEYS.has(e.key)) {
      if (step > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        regress();
      }
      // step === 0 → navigation slayt 14'e geri döner
    }
  }, true);

  // -------- Sync with navigation slidechange -----------------------------
  window.addEventListener('slidechange', (e) => {
    const newIdx = e.detail && typeof e.detail.index === 'number'
      ? e.detail.index
      : null;
    if (newIdx === null) return;

    if (newIdx === SLIDE_INDEX) {
      if (prevSlideIndex < SLIDE_INDEX) {
        // İleri (slayt 14'ten) → baştan başla
        resetTo(0);
      } else {
        // Geri (slayt 16'dan) → son adımda land et
        resetTo(TOTAL_STEPS);
      }
    } else if (prevSlideIndex === SLIDE_INDEX) {
      // Slayt 15'ten çıkış — pending state'i temizle
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
      busy = false;
    }
    prevSlideIndex = newIdx;
  });

  // -------- İlk yükleme: slayt 15 aktif olabilir (nadir), default 0 ------
  if (section.classList.contains('active')) {
    resetTo(0);
  } else {
    setStep(0);
  }
})();
