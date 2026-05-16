/* Service Worker registration + initial precache progress display */
(function () {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker desteklenmiyor');
    finishLoading(true);
    return;
  }

  // file:// için SW çalışmaz, sadece http(s)://
  if (location.protocol === 'file:') {
    console.warn('[SW] file:// protokolü altında SW çalışmaz');
    finishLoading(true);
    return;
  }

  const totalAssets = 25; // sw.js PRECACHE_URLS yaklaşık sayısı
  let cachedCount = 0;
  let installCompleted = false;

  function updateProgress(pct) {
    const fill = document.getElementById('loader-fill');
    const pctText = document.getElementById('loader-pct');
    if (fill) fill.style.width = pct + '%';
    if (pctText) pctText.textContent = Math.round(pct) + '%';
  }

  function finishLoading(skipAnimation) {
    const overlay = document.getElementById('app-loader');
    if (!overlay) return;
    if (skipAnimation) {
      overlay.style.display = 'none';
    } else {
      updateProgress(100);
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => { overlay.style.display = 'none'; }, 600);
      }, 250);
    }
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'precache-progress') {
      cachedCount++;
      const pct = Math.min(95, (cachedCount / totalAssets) * 100);
      updateProgress(pct);
    }
  });

  // Yeni SW aktive olduğunda sayfayı bir kez yenile — eski CSS/JS önbelleğini hızla devre dışı bırak
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((reg) => {
        console.log('[SW] Kayıt başarılı', reg.scope);

        // Periyodik güncelleme tetikleyici
        reg.update().catch(() => {});

        if (reg.installing) {
          // İlk açılış — install olayını bekle
          reg.installing.addEventListener('statechange', () => {
            if (reg.installing && reg.installing.state === 'installed') {
              installCompleted = true;
              setTimeout(finishLoading, 400);
            }
          });
        } else if (reg.active) {
          // Daha önce kurulmuş — direkt geç
          installCompleted = true;
          finishLoading();
        }

        // Güvenlik: 8 saniye sonra her durumda kapat
        setTimeout(() => {
          if (!installCompleted) {
            console.warn('[SW] Install timeout — devam ediliyor');
            finishLoading();
          }
        }, 8000);
      })
      .catch((err) => {
        console.error('[SW] Kayıt başarısız', err);
        finishLoading(true);
      });
  });

  // Window load zaten geçtiyse hemen tetikle
  if (document.readyState === 'complete') {
    window.dispatchEvent(new Event('load'));
  }
})();
