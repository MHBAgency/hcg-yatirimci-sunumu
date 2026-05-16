/* ============================================================
   SLIDE 02 — Story Sentence step controller
   ----------------------------------------------------------------
   Slayt 2'de sağ/sol ok navigation.js'e bırakılmadan, 5 adımlık
   sinematik "boşlukları dolan cümle" akışı yürütülür.
     0 → cümle yarım haliyle görünür (3 boşluk)
     1 → "$10M" merkezde belirir → ufalarak slot 1'e iner
     2 → "342 kg" merkezde belirir → slot 2'ye iner
     3 → "6 AY" daha dramatik (uzun bekleme) → slot 3'e iner
     4 → altta destek şeridi (TETHYAN · 3.4 t Ag · ~$22M)
   Adım 4 tamamlandıktan sonra sağ-ok navigation'a teslim
   edilir (slayt 3'e geçer).
   ============================================================ */
(function () {
  const section = document.querySelector('.story2-slide');
  if (!section) return;

  const SLIDE_INDEX = 1; // data-slide="2" → 0-indexed nav = 1
  const HOLD_MS = [0, 1300, 1300, 1750];   // big "stays at center" duration per step
  const FLY_MS  = 720;                      // big shrinks toward slot
  const STEP_LOCK_MS = 200;                 // tiny debounce between steps
  const TOTAL_STEPS = 4;

  let step = 0;
  let busy = false;
  let prevSlideIndex = 0; // initial active slide
  let pendingTimers = [];

  const setStep = (n) => {
    step = Math.max(0, Math.min(TOTAL_STEPS, n));
    section.dataset.step = String(step);
  };

  const wait = (ms) => new Promise((res) => {
    const t = setTimeout(() => {
      pendingTimers = pendingTimers.filter((x) => x !== t);
      res();
    }, ms);
    pendingTimers.push(t);
  });

  const clearTimers = () => {
    pendingTimers.forEach(clearTimeout);
    pendingTimers = [];
  };

  // -------- FLIP-like staging → flight choreography --------
  async function stageAndFly(stepNum) {
    const big = section.querySelector(`.story2__big[data-big="${stepNum}"]`);
    const slot = section.querySelector(`.story2__slot[data-slot="${stepNum}"]`);
    if (!big || !slot) return;
    const bigNumEl = big.querySelector('.story2__big-num');
    const filled = slot.querySelector('.story2__filled');
    const stage = big.parentElement; // .story2__stage

    // 1) Cleanup leftover state, present big centered
    big.classList.remove('is-flying');
    big.style.removeProperty('--fly-x');
    big.style.removeProperty('--fly-y');
    big.style.removeProperty('--fly-s');
    // force reflow so the transition starts cleanly
    // eslint-disable-next-line no-unused-expressions
    big.offsetWidth;
    big.classList.add('is-staging');

    // 2) Hold the giant number for the configured duration
    await wait(HOLD_MS[stepNum]);

    // 3) Compute FLIP transform: shrink to slot, translate from stage anchor
    const stageRect = stage.getBoundingClientRect();
    const anchorX = stageRect.left + stageRect.width / 2;
    const anchorY = stageRect.top + stageRect.height / 2;

    const bigRect = bigNumEl.getBoundingClientRect();
    const slotRect = filled.getBoundingClientRect();
    const bigCx = bigRect.left + bigRect.width / 2;
    const bigCy = bigRect.top + bigRect.height / 2;
    const slotCx = slotRect.left + slotRect.width / 2;
    const slotCy = slotRect.top + slotRect.height / 2;

    const safeBigW = Math.max(bigRect.width, 1);
    const scale = Math.max(slotRect.width / safeBigW, 0.05);

    const flyX = slotCx - anchorX - scale * (bigCx - anchorX);
    const flyY = slotCy - anchorY - scale * (bigCy - anchorY);

    big.style.setProperty('--fly-x', flyX.toFixed(2) + 'px');
    big.style.setProperty('--fly-y', flyY.toFixed(2) + 'px');
    big.style.setProperty('--fly-s', scale.toFixed(4));

    big.classList.remove('is-staging');
    big.classList.add('is-flying');

    // 4) Reveal slot's filled value as big disappears
    await wait(180);
    slot.classList.add('is-filled');
    setStep(stepNum); // commit step

    // 5) Wait for flight to finish, then reset transform state
    await wait(FLY_MS - 180);
    big.classList.remove('is-flying');
    big.style.removeProperty('--fly-x');
    big.style.removeProperty('--fly-y');
    big.style.removeProperty('--fly-s');
  }

  async function advance() {
    if (busy) return;
    if (step >= TOTAL_STEPS) return;
    busy = true;
    try {
      const next = step + 1;
      if (next <= 3) {
        await stageAndFly(next);
      } else {
        // step 4 — just reveal support strip (pure CSS)
        setStep(4);
        await wait(900);
      }
      await wait(STEP_LOCK_MS);
    } finally {
      busy = false;
    }
  }

  function regress() {
    if (busy) return;
    if (step <= 0) return;
    // Backward navigation: skip the cinematic re-stage. Just toggle states.
    const prevStep = step - 1;
    // Hide any stale big elements
    section.querySelectorAll('.story2__big').forEach((el) => {
      el.classList.remove('is-staging', 'is-flying');
      el.style.removeProperty('--fly-x');
      el.style.removeProperty('--fly-y');
      el.style.removeProperty('--fly-s');
    });
    // Un-fill slots above prevStep
    section.querySelectorAll('.story2__slot').forEach((slot) => {
      const idx = Number(slot.dataset.slot);
      slot.classList.toggle('is-filled', idx <= prevStep);
    });
    setStep(prevStep);
  }

  function resetTo(n) {
    clearTimers();
    busy = false;
    section.querySelectorAll('.story2__big').forEach((el) => {
      el.classList.remove('is-staging', 'is-flying');
      el.style.removeProperty('--fly-x');
      el.style.removeProperty('--fly-y');
      el.style.removeProperty('--fly-s');
    });
    section.querySelectorAll('.story2__slot').forEach((slot) => {
      const idx = Number(slot.dataset.slot);
      slot.classList.toggle('is-filled', idx <= Math.min(n, 3));
    });
    setStep(n);
  }

  // -------- Key interception (capture-phase, before navigation.js) --------
  const ADVANCE_KEYS = new Set(['ArrowRight', ' ', 'PageDown']);
  const REGRESS_KEYS = new Set(['ArrowLeft', 'PageUp']);

  document.addEventListener('keydown', (e) => {
    if (!section.classList.contains('active')) return;

    // During a step animation, swallow nav keys so timing isn't broken
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
      // step === TOTAL_STEPS → let navigation advance to slide 3
    } else if (REGRESS_KEYS.has(e.key)) {
      if (step > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        regress();
      }
      // step === 0 → let navigation go back to slide 1
    }
  }, true);

  // -------- Sync with navigation slidechange --------
  window.addEventListener('slidechange', (e) => {
    const newIdx = e.detail && typeof e.detail.index === 'number'
      ? e.detail.index
      : null;
    if (newIdx === null) return;

    if (newIdx === SLIDE_INDEX) {
      // Entering slide 2
      if (prevSlideIndex < SLIDE_INDEX) {
        // From slide 1 (forward) → fresh start
        resetTo(0);
      } else {
        // From slide 3+ (backward) → land at the completed end
        resetTo(TOTAL_STEPS);
      }
    } else if (prevSlideIndex === SLIDE_INDEX) {
      // Leaving slide 2 — abort any pending animations
      clearTimers();
      busy = false;
    }
    prevSlideIndex = newIdx;
  });

  // -------- Initial state: slide 2 might be active on load (rare), default 0 --------
  if (section.classList.contains('active')) {
    resetTo(0);
  } else {
    setStep(0);
  }
})();
