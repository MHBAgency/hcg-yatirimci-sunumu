/* Loading screen — DOM hazır olduğunda hemen fake progress başlat
 * SW pre-cache mesajları gerçek progressi günceller. */
(function () {
  let fakeProgress = 0;
  let interval = null;

  function start() {
    const overlay = document.getElementById('app-loader');
    if (!overlay) return;

    interval = setInterval(() => {
      // Fake progress en fazla %90'a kadar
      if (fakeProgress < 90) {
        fakeProgress += Math.random() * 4 + 1;
        const fill = document.getElementById('loader-fill');
        const pct = document.getElementById('loader-pct');
        if (fill) {
          const current = parseFloat(fill.style.width) || 0;
          const next = Math.min(90, Math.max(current, fakeProgress));
          fill.style.width = next + '%';
          if (pct) pct.textContent = Math.round(next) + '%';
        }
      } else {
        clearInterval(interval);
      }
    }, 180);
  }

  // Loader fade out sonrası temizle
  window.addEventListener('hcg-loader-done', () => {
    if (interval) clearInterval(interval);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
