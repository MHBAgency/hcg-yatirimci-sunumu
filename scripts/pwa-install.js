/* NTE Pars Metal — "Sunumu İndir" butonu
 *
 * Hedef: Hangi tarayıcıda olursa olsun butona basınca GERÇEK bir dosya insin.
 * Akış:
 *   1) sunum.zip dosyasını anchor + click ile indir (her tarayıcı destekler)
 *   2) Paralel: Service Worker'a tüm asset'leri taze çek dedirt (online iken offline cache hazırlanır)
 *   3) Chrome/Edge'de `beforeinstallprompt` event'i geldiyse, ZIP indikten sonra opsiyonel olarak "uygulama olarak da kur" prompt'u göster
 * Böylece kullanıcı her durumda fiziksel bir kopya alır + isteyen uygulama olarak da kurabilir.
 */
(function () {
  const block = document.querySelector('[data-pwa-block]');
  if (!block) return;

  const btn = block.querySelector('[data-pwa-trigger]');
  const labelEl = block.querySelector('[data-pwa-label]');
  const subEl = block.querySelector('[data-pwa-sub]');
  const statusEl = block.querySelector('[data-pwa-status]');
  if (!btn || !labelEl || !subEl || !statusEl) return;

  const ZIP_URL = './sunum.zip';
  const ZIP_FILENAME = 'hikmet-cetin-gold-sunum.zip';

  const isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  let deferredPrompt = null;
  let working = false;

  // Başlangıç durumu — uygulama olarak zaten kuruluysa farklı mesaj
  function setIdleState() {
    block.hidden = false;
    if (isStandalone) {
      labelEl.textContent = 'Sunumu İndir';
      subEl.textContent = 'ZIP olarak masaüstünüze iner · Çevrimdışı açılır';
      statusEl.textContent = '✓ Uygulama olarak yüklü';
    } else {
      labelEl.textContent = 'Sunumu İndir';
      subEl.textContent = 'ZIP olarak masaüstünüze iner · Çevrimdışı açılır';
      statusEl.textContent = '';
    }
    btn.disabled = false;
  }

  setIdleState();

  // Chrome/Edge'de install prompt'unu yakala — kullanmak için saklayalım
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    statusEl.textContent = '✓ Uygulama olarak kuruldu';
  });

  // Service Worker'a "tüm asset'leri taze çek" dedirt — offline cache hazırlığı
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

  // ZIP'i Blob üzerinden indir — Save dialog'u tetiklenmesi en garanti yol
  async function downloadZipAsBlob(onProgress) {
    const response = await fetch(ZIP_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('ZIP indirilemedi: ' + response.status);

    const contentLength = +response.headers.get('Content-Length') || 0;
    if (response.body && contentLength > 0 && typeof ReadableStream !== 'undefined') {
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (onProgress) onProgress(received, contentLength);
      }
      const blob = new Blob(chunks, { type: 'application/zip' });
      triggerDownload(blob);
    } else {
      const blob = await response.blob();
      triggerDownload(blob);
    }
  }

  function triggerDownload(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ZIP_FILENAME;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // Anchor tabanlı saf fallback — fetch yoksa veya başarısızsa
  function directAnchorDownload() {
    const a = document.createElement('a');
    a.href = ZIP_URL;
    a.download = ZIP_FILENAME;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 1000);
  }

  async function maybeOfferInstall() {
    if (!deferredPrompt) return;
    try {
      const choice = await deferredPrompt.prompt().then(() => deferredPrompt.userChoice);
      if (choice && choice.outcome === 'accepted') {
        statusEl.textContent = '✓ Uygulama olarak da kuruldu';
      }
      deferredPrompt = null;
    } catch (err) {
      // sessizce geç — ZIP zaten indi
    }
  }

  btn.addEventListener('click', async () => {
    if (working) return;
    working = true;
    btn.disabled = true;

    labelEl.textContent = 'İndiriliyor...';
    subEl.textContent = 'sunum.zip dosyanız hazırlanıyor';
    statusEl.textContent = '⏳ 0%';

    // 1) ZIP indir — asıl iş
    let downloaded = false;
    try {
      await downloadZipAsBlob((done, total) => {
        const pct = total ? Math.round((done / total) * 100) : 0;
        statusEl.textContent = '⏳ ' + pct + '%  (' + (done / 1048576).toFixed(1) + ' / ' + (total / 1048576).toFixed(1) + ' MB)';
      });
      downloaded = true;
    } catch (err) {
      console.warn('[İndir] Blob indirme başarısız, anchor fallback', err);
      try {
        directAnchorDownload();
        downloaded = true;
      } catch (err2) {
        console.error('[İndir] Anchor indirme de başarısız', err2);
      }
    }

    if (downloaded) {
      labelEl.textContent = 'İndirildi ✓';
      subEl.textContent = 'Downloads klasörünüzü kontrol edin';
      statusEl.textContent = '✓ sunum.zip indi · Çıkartıp NASIL-ACILIR.txt dosyasını okuyun';
    } else {
      labelEl.textContent = 'İndirme başarısız';
      subEl.textContent = 'İnternet bağlantınızı kontrol edip tekrar deneyin';
      statusEl.textContent = '⚠ Tekrar deneyin veya yöneticinize ulaşın';
    }

    // 2) Paralel: SW asset refresh (best-effort, başarısız olursa önemsiz)
    refreshAllAssets().catch(() => {});

    // 3) Chrome/Edge'de PWA install prompt'u varsa kullanıcıya sun
    setTimeout(() => maybeOfferInstall(), 600);

    setTimeout(() => {
      btn.disabled = false;
      working = false;
    }, 1500);
  });
})();
