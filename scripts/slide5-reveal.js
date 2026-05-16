/* ============================================================
   SLIDE 05 — Yöntem Seçimi · Eleme Turnuvası step controller
   ----------------------------------------------------------------
   6 adımlık akış (data-step="0..5"):
     0 → açılış sorusu (4 yöntem üstte nötr, ortada soru)
     1 → ULTRA İNCE ÖĞÜTME değerlendiriliyor → elenir
     2 → BIOX değerlendiriliyor → elenir
     3 → POX değerlendiriliyor → elenir
     4 → KAVURMA + CIL kazanır (★ ribbon)
     5 → 4 yöntem yan yana karşılaştırma tablosu
   Adım 5'te sağ-ok navigation'a teslim → slayt 6'ya geçer.
   Sol-ok adımları geri alır; adım 0'da slayt 4'e döner.
   slide3-reveal.js ile aynı pattern.
   ============================================================ */
(function () {
  const section = document.querySelector('.ms-slide');
  if (!section) return;

  const SLIDE_INDEX = 4; // data-slide="5" → 0-indexed = 4
  const TOTAL_STEPS = 5;
  const STEP_LOCK_MS = 420;
  const WIN_LOCK_MS = 620;     // 4. adım (kazanan) — ribbon pop-in için biraz daha uzun

  // Adım → o adımda incelenen yöntem (null = aktif yok)
  // Adım → o adıma kadar elenen yöntemler kümesi
  const METHOD_AT_STEP = [null, 'ultra', 'biox', 'pox', 'kavurma', null];
  const ELIMINATED_AT_STEP = [
    [],                                    // step 0
    [],                                    // step 1 (Ultra inceleniyor, henüz elenmedi)
    ['ultra'],                             // step 2 (Ultra elendi, BIOX inceleniyor)
    ['ultra', 'biox'],                     // step 3
    ['ultra', 'biox', 'pox'],              // step 4 (Kavurma kazandı; diğer 3 elendi)
    ['ultra', 'biox', 'pox'],              // step 5 (karşılaştırma — aynı durum, Kavurma kazanan)
  ];

  const tabs = Array.from(section.querySelectorAll('.ms-tab'));
  const tabByMethod = Object.fromEntries(
    tabs.map((t) => [t.dataset.method, t])
  );

  let step = 0;
  let busy = false;
  let prevSlideIndex = 0;
  let lockTimer = null;

  function applyTabStates(n) {
    const active = METHOD_AT_STEP[n];
    const eliminated = new Set(ELIMINATED_AT_STEP[n]);
    const winner = n >= 4 ? 'kavurma' : null;

    tabs.forEach((tab) => {
      const m = tab.dataset.method;
      tab.classList.remove('is-active', 'is-eliminated', 'is-winner');
      if (winner === m) {
        tab.classList.add('is-winner');
      } else if (eliminated.has(m)) {
        tab.classList.add('is-eliminated');
      } else if (active === m) {
        tab.classList.add('is-active');
      }
    });
  }

  function setStep(n) {
    step = Math.max(0, Math.min(TOTAL_STEPS, n));
    section.dataset.step = String(step);
    applyTabStates(step);
  }

  function lock(ms) {
    busy = true;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
      busy = false;
      lockTimer = null;
    }, ms);
  }

  function advance() {
    if (busy) return;
    if (step >= TOTAL_STEPS) return;
    const next = step + 1;
    setStep(next);
    lock(next === 4 ? WIN_LOCK_MS : STEP_LOCK_MS);
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
      // step === TOTAL_STEPS → navigation slayt 6'ya geçer
    } else if (REGRESS_KEYS.has(e.key)) {
      if (step > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        regress();
      }
      // step === 0 → navigation slayt 4'e geri döner
    }
  }, true);

  // -------- Sync with navigation slidechange -----------------------------
  window.addEventListener('slidechange', (e) => {
    const newIdx = e.detail && typeof e.detail.index === 'number'
      ? e.detail.index
      : null;
    if (newIdx === null) return;

    if (newIdx === SLIDE_INDEX) {
      // Slayt 5'e giriş
      if (prevSlideIndex < SLIDE_INDEX) {
        // İleri (slayt 4'ten) → baştan başla
        resetTo(0);
      } else {
        // Geri (slayt 6'dan) → son adımda land et
        resetTo(TOTAL_STEPS);
      }
    } else if (prevSlideIndex === SLIDE_INDEX) {
      // Slayt 5'ten çıkış — pending state'i temizle
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
      busy = false;
    }
    prevSlideIndex = newIdx;
  });

  // -------- İlk yükleme: slayt 5 aktif olabilir (nadir), default 0 -------
  if (section.classList.contains('active')) {
    resetTo(0);
  } else {
    setStep(0);
  }
})();
