/* NTE Pars Metal — PWA Install + Fresh-Download Controller
 * Slayt 16'daki "Sunumu İndir" butonunu yönetir.
 * Akış (her tarayıcıda aynı): tıklama -> SW'a tüm cache'i taze indir dedirt
 *   -> ardından Chromium'da native install prompt, diğerlerinde "yer imine ekle" yönergesi.
 * Böylece kullanıcı her tıklamada güncel sürümü almış olur.
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
  let refreshing = false;

  function setMode(next) {
    mode = next;
    block.hidden = false;
    block.setAttribute('data-pwa-state', mode);
    btn.disabled = false;

    if (mode === 'installable') {
      labelEl.textContent = 'Sunumu İndir';
      subEl.textContent = 'Tek tıkla · En güncel sürüm · Çevrimdışı açılır';
      statusEl.textContent = 'Sunum çevrimdışı kullanıma hazır';
    } else if (mode === 'installed') {
      labelEl.textContent = 'Yüklendi';
      subEl.textContent = 'Sunum masaüstünden çevrimdışı açılır';
      statusEl.textContent = '✓ Kurulum tamamlandı';
      btn.disabled = true;
    } else if (mode === 'ready-cache') {
      labelEl.textContent = 'Sunumu İndir';
      subEl.textContent = 'En güncel sürümü indir · Yer imine ekle, çevrimdışı açılır';
      statusEl.textContent = 'Ctrl+D (Win) · ⌘+D (Mac) → Yer imine ekle';
    } else if (mode === 'ios') {
      labelEl.textContent = 'Sunumu İndir';
      subEl.textContent = 'Paylaş ⤴ → "Ana Ekrana Ekle" ile çevrimdışı açılır';
      statusEl.textContent = 'iOS Safari · Çevrimdışı kullanıma hazır';
    } else {
      labelEl.textContent = 'Sunumu İndir';
      subEl.textContent = 'Yer imine ekle · Çevrimdışı açılır';
      statusEl.textContent = 'Ctrl+D (Win) · ⌘+D (Mac) → Yer imine ekle';
    }
  }

  // SW'a "tüm cache'i sıfırla, en güncel asset'leri yeniden indir" dedirten yardımcı.
  // Promise resolve olduğunda kullanıcı %100 güncel sürümü almış olur.
  function refreshAllAssets(onProgress) {
    return new Promise((resolve) => {
      if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
        resolve({ ok: false, reason: 'no-sw' });
        return;
      }
      const channel = new MessageChannel();
      let settled = false;
      const done = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };
      channel.port1.onmessage = (event) => {
        const data = event.data || {};
        if (data.type === 'refresh-progress' && typeof onProgress === 'function') {
          onProgress(data.done, data.total);
        } else if (data.type === 'refresh-done') {
          done({ ok: true, total: data.total });
        } else if (data.type === 'refresh-error') {
          done({ ok: false, reason: data.error });
        }
      };
      // Güvenlik: 30 sn'de bitmezse devam ettir
      setTimeout(() => done({ ok: false, reason: 'timeout' }), 30000);
      try {
        navigator.serviceWorker.controller.postMessage(
          { type: 'force-refresh-all' },
          [channel.port2]
        );
      } catch (err) {
        done({ ok: false, reason: String(err) });
      }
    });
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
    if (refreshing) return;
    refreshing = true;
    btn.disabled = true;

    const originalLabel = labelEl.textContent;
    const originalSub = subEl.textContent;

    labelEl.textContent = 'Güncelleniyor...';
    subEl.textContent = 'En güncel sürüm indiriliyor';
    statusEl.textContent = '⏳ 0%';

    // 1) SW güncelle (yeni sw.js varsa onu da yakala)
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'skip-waiting' });
        }
      }
    } catch (e) { /* ignore */ }

    // 2) Tüm asset'leri taze indir
    const result = await refreshAllAssets((done, total) => {
      const pct = total ? Math.round((done / total) * 100) : 0;
      statusEl.textContent = '⏳ ' + pct + '%';
    });

    if (result.ok) {
      statusEl.textContent = '✓ En güncel sürüm indirildi';
    } else {
      statusEl.textContent = 'Çevrimiçi sürüm güncel · indirme atlandı';
    }

    // 3) deferredPrompt henüz gelmediyse 1.5 sn'lik bir pencere aç — race condition'ı yakala
    if (!deferredPrompt) {
      await new Promise((res) => {
        const timer = setTimeout(res, 1500);
        const once = (e) => {
          e.preventDefault();
          deferredPrompt = e;
          clearTimeout(timer);
          window.removeEventListener('beforeinstallprompt', once);
          res();
        };
        window.addEventListener('beforeinstallprompt', once);
      });
    }

    // 4) Asıl indirme aksiyonu: Chromium'da native install, diğerlerinde yönerge
    if (deferredPrompt) {
      labelEl.textContent = 'Bilgisayara Kur';
      subEl.textContent = 'En güncel sürüm hazır · Kuruluma devam edin';
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          // appinstalled event tetiklenecek; setMode('installed') oradan çağrılır
        } else {
          labelEl.textContent = originalLabel;
          subEl.textContent = originalSub;
          btn.disabled = false;
        }
        deferredPrompt = null;
      } catch (err) {
        console.warn('[PWA] Kurulum istemi başarısız', err);
        labelEl.textContent = originalLabel;
        subEl.textContent = originalSub;
        btn.disabled = false;
      }
    } else if (isIOS) {
      labelEl.textContent = 'Ana Ekrana Ekle';
      subEl.textContent = 'Paylaş ⤴ → "Ana Ekrana Ekle"';
      statusEl.textContent = '✓ Güncel sürüm hazır · iOS Safari yönergeyi takip edin';
      btn.disabled = false;
    } else {
      labelEl.textContent = 'Yer İmine Ekle';
      subEl.textContent = 'Ctrl+D (Win) · ⌘+D (Mac)';
      statusEl.textContent = '✓ Güncel sürüm önbelleğe alındı · çevrimdışı açılır';
      btn.disabled = false;
    }
    refreshing = false;
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
