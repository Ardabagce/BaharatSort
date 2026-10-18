/** Statik sayfalar: tanıtım, gizlilik politikası (TR + EN) ve destek. Harici varlık yok. */

const ISSUES = 'https://github.com/Ardabagce/BaharatSort/issues';

const css = `
:root{--ink:#2a170d;--soft:#5b4232;--accent:#b5541f;--card:#fff6e8}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
color:var(--ink);background:radial-gradient(ellipse at 50% 0%,#8a3a17,#4a1d0c 45%,#1d120b);min-height:100vh}
main{max-width:720px;margin:0 auto;padding:32px 20px 48px}
.card{background:var(--card);border-radius:18px;padding:22px 26px;margin-bottom:18px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
h1{font-family:Georgia,serif;font-size:44px;margin:20px 0 6px;color:#fff1d6;text-shadow:0 3px 8px rgba(0,0,0,.5)}
h2{margin:6px 0 10px;font-family:Georgia,serif}a{color:var(--accent)}p,li{line-height:1.6;color:var(--soft)}
small{color:#8a6a55}nav{display:flex;flex-wrap:wrap;gap:16px;margin:6px 0 22px}nav a{color:#ffd9a0;font-weight:700;text-decoration:none}
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${css}</style></head><body><main><h1>Baharat Sort</h1>
<nav><a href="/">Ana sayfa / Home</a><a href="/privacy">Gizlilik / Privacy</a><a href="/support">Destek / Support</a></nav>
${body}</main></body></html>`;
}

function contact(email: string | undefined, lang: 'tr' | 'en'): string {
  const gh = `<a href="${ISSUES}">${lang === 'tr' ? 'GitHub üzerinden bize yaz' : 'write to us on GitHub'}</a>`;
  return email
    ? `<a href="mailto:${email}">${email}</a> ${lang === 'tr' ? 'ya da' : 'or'} ${gh}`
    : gh;
}

export function landingPage(): string {
  return page(
    'Baharat Sort',
    `<div class="card"><p><strong>Mısır Çarşısı'nda bir baharat tezgâhındasın.</strong> Kavanozdan kavanoza
baharat dök, her kavanozu tek bir baharatla doldur, kazandığın altınla dükkânını süsle. 1000 seviye, internetsiz oynanır.</p>
<p lang="en"><strong>You run a spice stall in Istanbul's Spice Bazaar.</strong> Pour spices from jar to jar, fill every
jar with a single spice and decorate your stall with the gold you earn. 1000 levels, plays offline.</p></div>`,
  );
}

export function privacyPage(email?: string): string {
  return page(
    'Baharat Sort – Gizlilik Politikası / Privacy Policy',
    `<div class="card">
<h2>Gizlilik Politikası</h2>
<p><small>Son güncelleme: 18 Ekim 2026</small></p>
<ul>
<li><strong>Hesap yok, kişisel veri yok.</strong> Baharat Sort ad, e-posta, telefon numarası ya da kesin konum istemez. Giriş yapılmaz.</li>
<li><strong>Oyun ilerlemen</strong> (açılan seviyeler, altın, dükkân süslemeleri, ayarlar) yalnızca cihazında tutulur.</li>
<li><strong>Anonim oyuncu kimliği:</strong> Uygulama cihazında rastgele bir kimlik (UUID) üretebilir. Yalnızca oyun istatistikleri (örneğin hangi seviyede takılındığı) ve günün bulmacası için kullanılır; seninle ilişkilendirilemez.</li>
<li><strong>Reklamlar (Google AdMob):</strong> Uygulama ücretsizdir ve reklam gösterebilir. AdMob reklam sunmak, sıklığı sınırlamak ve dolandırıcılığı önlemek için cihaz tanımlayıcıları, yaklaşık konum (IP adresinden) ve reklam etkileşimleri gibi verileri işleyebilir. Ayrıntılar: <a href="https://policies.google.com/technologies/ads">Google reklam politikası</a>.</li>
<li><strong>App Tracking Transparency (ATT):</strong> Reklam kimliğine (IDFA) erişmeden önce iOS sana sorar. İzin vermezsen reklamlar kişiselleştirilmez; oyun aynen çalışır.</li>
<li><strong>Onay (Google UMP):</strong> AB/AEA, Birleşik Krallık ve İsviçre'de reklam verisi için onay formu gösterilir. Seçimini uygulamanın Ayarlar ekranından değiştirebilirsin.</li>
<li><strong>Reklam içeriği:</strong> Tüm reklam istekleri her yaşa uygun ("G") içerikle sınırlandırılır.</li>
<li><strong>Uygulama içi satın alma yok.</strong> Altın yalnızca oynayarak kazanılır.</li>
<li><strong>Çocuklar:</strong> Uygulama çocuklara özel olarak tasarlanmamıştır ve bilerek çocuklardan kişisel veri toplamaz.</li>
<li><strong>Silme:</strong> Uygulamayı silmek cihazdaki tüm verileri siler.</li>
<li><strong>İletişim:</strong> ${contact(email, 'tr')}.</li>
</ul></div>
<div class="card" lang="en">
<h2>Privacy Policy</h2>
<p><small>Last updated: 18 October 2026</small></p>
<ul>
<li><strong>No account, no personal data.</strong> Baharat Sort never asks for your name, email, phone number or precise location. There is no login.</li>
<li><strong>Your game progress</strong> (unlocked levels, gold, shop decorations, settings) stays on your device.</li>
<li><strong>Anonymous player ID:</strong> The app may create a random identifier (UUID) on your device. It is used only for game statistics (for example, which level players get stuck on) and the daily puzzle; it cannot be linked to you.</li>
<li><strong>Ads (Google AdMob):</strong> The app is free and may show ads. AdMob may process device identifiers, approximate location (from the IP address) and ad interactions to serve ads, cap frequency and prevent fraud. See <a href="https://policies.google.com/technologies/ads">Google's advertising policy</a>.</li>
<li><strong>App Tracking Transparency (ATT):</strong> iOS asks for your permission before the advertising identifier (IDFA) is used. If you decline, ads are not personalised and the game works the same.</li>
<li><strong>Consent (Google UMP):</strong> In the EU/EEA, the UK and Switzerland a consent form is shown for ad data. You can change your choice in the app's Settings.</li>
<li><strong>Ad content:</strong> All ad requests are limited to content suitable for all ages ("G").</li>
<li><strong>No in-app purchases.</strong> Gold is earned only by playing.</li>
<li><strong>Children:</strong> The app is not directed at children and does not knowingly collect personal data from children.</li>
<li><strong>Deletion:</strong> Deleting the app removes all data on your device.</li>
<li><strong>Contact:</strong> ${contact(email, 'en')}.</li>
</ul></div>`,
  );
}

export function supportPage(email?: string): string {
  return page(
    'Baharat Sort – Destek / Support',
    `<div class="card">
<h2>Destek</h2>
<p><strong>Nasıl oynanır?</strong> Bir kavanoza, sonra hedef kavanoza dokun; en üstteki baharat dökülür. Yalnızca aynı baharatın üstüne ya da boş kavanoza dökebilirsin. Her kavanoz tek baharatla dolu ya da boş olunca seviye biter.</p>
<p><strong>Takıldım.</strong> Geri al, ipucu, boş kavanoz ve karıştır yardımcılarını kullanabilir ya da seviyeyi yeniden başlatabilirsin. Süre ve can sınırı yok.</p>
<p><strong>İlerlemem kayboldu.</strong> İlerleme yalnızca cihazında tutulur; uygulamayı silmek onu da siler.</p>
<p><strong>Sorun bildirmek ya da öneri için:</strong> ${contact(email, 'tr')}. Cihaz modelini, iOS sürümünü ve seviye numarasını eklersen hızlı yardımcı oluruz.</p>
</div>
<div class="card" lang="en">
<h2>Support</h2>
<p><strong>How do I play?</strong> Tap a jar, then a target jar; the top spice pours over. You can only pour onto the same spice or into an empty jar. A level is done when every jar is full of one spice or empty.</p>
<p><strong>I'm stuck.</strong> Use undo, hint, extra jar or shuffle, or restart the level. There are no timers or lives.</p>
<p><strong>I lost my progress.</strong> Progress is stored only on your device; deleting the app deletes it too.</p>
<p><strong>Report a problem or send feedback:</strong> ${contact(email, 'en')}. Please include your device model, iOS version and the level number.</p>
</div>`,
  );
}
