/* Market news — wired up to show headlines once a news source is connected.
   Point NEWS_URL at an endpoint returning JSON: { items: [{ title, url, source, time }] }.
   (e.g. add a /news route to the Cloudflare helper that calls your news API with your key.)
   Until a source answers, a friendly "coming soon" note shows. */
const NEWS_URL = 'https://wickline-oanda.muhammadmuzammal266.workers.dev/news';
(async function () {
  const list = document.getElementById('newsList');
  if (!list) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(NEWS_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw 0;
    const j = await r.json();
    const items = (j && j.items) || [];
    if (!items.length) throw 0;
    list.innerHTML = '';
    for (const it of items.slice(0, 12)) {
      const a = document.createElement('a');
      a.className = 'news-item'; a.href = it.url || '#'; a.target = '_blank'; a.rel = 'noopener nofollow';
      const h = document.createElement('div'); h.className = 'h'; h.textContent = it.title || '';
      const m = document.createElement('div'); m.className = 'm'; m.textContent = [it.source, it.time].filter(Boolean).join(' · ');
      a.append(h, m); list.append(a);
    }
  } catch (e) {
    list.innerHTML = '<div class="news-empty">Live market headlines are coming soon. In the meantime, explore the guides above or <a href="/">open the charts</a>.</div>';
  }
})();
