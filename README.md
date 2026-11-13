# Koltuk Belası: Şehir Senin

Mobil siyasi strateji ve şehir yönetimi oyunu. Türkiye'nin illerinden birinin belediye başkanı olur, 18 aylık dönem boyunca mahalle isteklerini karşılar, yapıları haritaya yerleştirir, hizmet bütçesini dağıtır, meclisten uygulama geçirir ve seçimde %51 barajını aşmaya çalışırsın.

Şu an oynanabilir il: İstanbul (39 ilçe, 964 mahalle, gerçek uydu görüntüsü).

## Çalıştırma

```bash
python -m http.server 5190 --directory app
```

Sonra tarayıcıda `http://localhost:5190` adresini aç.

## Klasörler

- `app/` — oyunun kendisi (düz HTML, CSS, JavaScript; derleme adımı yok)
  - `index.html` il seçimi, `sehir.html` şehir ekranı
  - `oyun.js` oyun kuralları (arayüzden bağımsız), `app.js` harita ve arayüz
  - `tiles/` İstanbul uydu karoları, `data/` il, ilçe ve mahalle verisi
- `tools/` — veriyi üreten betikler (uydu mozaiği, karo piramidi, sınırlar, mahalle tipleri) ve denge simülasyonu (`node tools/sim.js`)
- `scripts/`, `.github/workflows/` — iOS derlemesi (Capacitor). `main` dalına her gönderimde imzasız IPA üretilir.

## Kaynaklar ve lisanslar

- Uydu görüntüsü: Contains modified Copernicus Sentinel data 2025
- İlçe, mahalle ve il sınırları: © OpenStreetMap katkıcıları (ODbL); il sınırları geoBoundaries üzerinden
- Yükseklik verisi: Mapzen Terrain Tiles
- İl nüfusları: Wikidata (CC0)
- Ses efektleri: Kenney "Interface Sounds" (CC0)
- İkonlar: Lucide (ISC) · Harita kütüphanesi: Leaflet (BSD-2-Clause) · Yazı tipleri: Bebas Neue ve Inter (SIL OFL)

Karakterler ve olaylar kurgusaldır. Mutluluk, bütçe ve risk değerleri oyun dengesi için üretilmiştir; gerçek veriyi yansıtmaz.
