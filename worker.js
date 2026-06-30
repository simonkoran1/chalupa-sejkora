const MONTH_MAP = {
  'Leden': 1, 'Únor': 2, 'Březen': 3, 'Duben': 4, 'Květen': 5, 'Červen': 6,
  'Červenec': 7, 'Srpen': 8, 'Září': 9, 'Říjen': 10, 'Listopad': 11, 'Prosinec': 12,
};

function pad(n) { return String(n).padStart(2, '0'); }

function parseBookedDates(html) {
  const booked = [];
  let currentYear = null;
  let currentMonth = null;

  // Tokenize month headers and day cells
  const tokenRe = /class='month-name'>([^<]+)<|<TD class='([^']+)'[^>]*>(\d+)</g;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1]) {
      // Month header like "Červen 2026"
      const parts = m[1].trim().split(/\s+/);
      currentMonth = MONTH_MAP[parts[0]] || null;
      currentYear = parseInt(parts[1], 10) || null;
    } else if (m[2] && currentYear && currentMonth) {
      const cls = m[2];
      const day = parseInt(m[3], 10);
      // day-shdw = other month, skip
      if (cls.includes('day-shdw')) continue;
      // day-full k = checkout day, free for new arrivals, skip
      if (cls.includes('day-full') && cls.includes('k')) continue;
      // day-full (including z = arrival) = booked
      if (cls.includes('day-full')) {
        booked.push(`${currentYear}-${pad(currentMonth)}-${pad(day)}`);
      }
    }
  }
  return booked;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/availability') {
      try {
        const resp = await fetch(
          'https://obsazenost.e-chalupy.cz/kalendar.php?id=10684&pocetMesicu=14&jazyk=cz',
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const html = await resp.text();
        const booked = parseBookedDates(html);
        return Response.json({ booked }, {
          headers: {
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (err) {
        return Response.json({ booked: [], error: err.message }, { status: 200 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
