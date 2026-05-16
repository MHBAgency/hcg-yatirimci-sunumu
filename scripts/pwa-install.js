/* NTE Pars Metal — PWA Install Controller
 * Slayt 16'daki "Bilgisayara Kur" butonunu yönetir.
 * Tarayıcıya göre uygun aksiyon gösterir:
 *   - Chromium (Chrome/Edge/Brave/Opera): beforeinstallprompt -> native installer
 *   - iOS Safari: "Paylaş -> Ana Ekrana Ekle" yönergesi
 *   - Firefox / desktop Safari: cache hazır göstergesi + yer imi öner
 *   - Halihazırda kurulu (standalone): bloğu gizle
 */
(function () {
  const block = document.querySelector('[data-pwa-block]');
  if (!block) return;

  const btn = block.querySelector('[data-pwa-trigger]');
  const labelEl = block.querySelector('[data-pwa-label]');
  const subEl = block.querySelector('[data-pwa-sub]');
  const statusEl = block.querySelector('[data-pwa-status]');
  if (!btn || !labelEl || !subEl || !statusEl) return;

  const isStandalone =
    window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    block.hidden = true;
    return;
  }

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  let deferredPrompt = null;
  let mode = 'pending';

  function setMode(next) {
    mode = next;
    block.hidden = false;
    block.setAttribute('data-pwa-state', mode);
    btn.disabled = false;

    if (mode === 'installable') {
      labelEl.textContent = 'Bilgisayara Kur';
      subEl.textContent = 'Tek tıkla · İnternet olmadan da açılır';
      statusEl.textContent = 'Sunum çevrimdışı kullanıma hazır';
    } else if (mode === 'installed') {
      labelEl.textContent = 'Yüklendi';
      subEl.textContent = 'Sunum masaüstünden çevrimdışı açılır';
      statusEl.textContent = '✓ Kurulum tamamlandı';
      btn.disabled = true;
    } else if (mode === 'ready-cache') {
      labelEl.textContent = 'Çevrimdışı Hazır';
      subEl.textContent = 'Bu sekmeyi yer imine ekleyin · Sunum vaktinde açılır';
      statusEl.textContent = 'Ctrl+D (Win) · ⌘+D (Mac) → Yer imine ekle';
    } else if (mode === 'ios') {
      labelEl.textContent = 'Ana Ekrana Ekle';
      subEl.textContent = 'Paylaş ⤴ → "Ana Ekrana Ekle" ile çevrimdışı açılır';
      statusEl.textContent = 'iOS Safari · Çevrimdışı kullanıma hazır';
      btn.disabled = true;
    } else {
      labelEl.textContent = 'Sunumu İndir';
      subEl.textContent = 'Yer imine ekle · Çevrimdışı açılır';
      statusEl.textContent = 'Ctrl+D (Win) · ⌘+D (Mac) → Yer imine ekle';
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setMode('installable');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setMode('installed');
  });

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      btn.disabled = true;
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          // appinstalled event tetiklenecek; ekstra render gerekmez
        } else {
          btn.disabled = false;
        }
        deferredPrompt = null;
      } catch (err) {
        console.warn('[PWA] Kurulum istemi başarısız', err);
        btn.disabled = false;
      }
      return;
    }
    if (mode === 'ready-cache') {
      statusEl.textContent = 'Ctrl+D (Win) · ⌘+D (Mac) → Yer imine ekle';
    }
  });

  if (isIOS) {
    setMode('ios');
    return;
  }

  if (!('serviceWorker' in navigator)) {
    setMode('ready-cache');
    return;
  }

  navigator.serviceWorker.ready.then(() => {
    // Chrome beforeinstallprompt'u biraz geç fırlatabilir — kısa bekleme tanı.
    setTimeout(() => {
      if (mode === 'pending') {
        setMode('ready-cache');
      }
    }, 2500);
  }).catch(() => {
    setMode('ready-cache');
  });
})();
