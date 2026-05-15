(function () {
  const slides = document.querySelectorAll('.slide');
  const indicator = document.getElementById('nav-indicator');
  const total = slides.length;
  let current = 0;
  let transitioning = false;

  // Build dot indicator
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'nav-dot' + (i === 0 ? ' active' : '');
    dot.dataset.index = i;
    dot.addEventListener('click', () => goTo(i));
    indicator.appendChild(dot);
  }

  function goTo(index) {
    if (transitioning) return;
    if (index < 0 || index >= total || index === current) return;
    transitioning = true;

    const prev = slides[current];
    const next = slides[index];

    if (index > current) {
      prev.classList.add('exit-left');
      prev.classList.remove('active');
    } else {
      prev.classList.remove('active');
      prev.classList.remove('exit-left');
    }

    setTimeout(() => {
      prev.classList.remove('exit-left');
    }, 450);

    next.classList.remove('exit-left');
    next.classList.add('active');

    document.querySelectorAll('.nav-dot').forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });

    current = index;

    // Dispatch event for slide-specific behaviors
    window.dispatchEvent(new CustomEvent('slidechange', {
      detail: { index, slide: next }
    }));

    setTimeout(() => { transitioning = false; }, 480);
  }

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
      case ' ':
      case 'PageDown':
        e.preventDefault();
        goTo(current + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        goTo(current - 1);
        break;
      case 'Home':
        goTo(0); break;
      case 'End':
        goTo(total - 1); break;
      case 'f':
      case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
        break;
    }
  });

  // Expose for debugging
  window.__nav = { goTo, get current() { return current; } };
})();
