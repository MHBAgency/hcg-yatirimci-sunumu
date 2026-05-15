# Hikmet Çetin Gold — Yatırımcı Sunumu

Sülfürlü altın cevheri işleyen tesis için yatırımcı sunumu — interaktif web demosu.

**Konum:** Safadaşt, İran
**Tesis tipi:** Refrakter sülfürlü altın işleme (Kavurma + CIL + Electrowinning)

---

## Slaytlar

1. **Kapak** — Hikmet Çetin Gold tanıtım
2. **Dünya Haritası** — Sülfürlü altın madenleri + saha konumu
3. **CIL Liç Tankı (İnteraktif 3D)** — Fareyle döndürülen Three.js modeli
4. **CIL Liç Tankı (Görsel)** — Konsept render + animasyonlu açıklamalar
5. **Proses Akış Şeması** — 5 aşamalı tesis akışı + KPI

## Klavye

- `→` / `SPACE` — Sonraki slayt
- `←` — Önceki slayt
- `Home` / `End` — İlk / son slayt
- `F` — Tam ekran

## Teknik

Tamamen statik — backend yok. Three.js + Leaflet (CDN'den), saf JS/CSS.

## Yerel çalıştırma

```bash
# Python 3 ile
python -m http.server 8765
# Sonra tarayıcıda: http://localhost:8765
```

## Deploy

Vercel veya Netlify'a bu repo'yu bağla → otomatik static deploy.

---

© 2026 — Hikmet Çetin Gold için hazırlanmıştır.
