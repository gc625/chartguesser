// Universe registry. Dow 30 is hardcoded (guaranteed). S&P 500 and Nasdaq 100
// are fetched from Wikipedia at first access and cached in memory.

const DOW_30 = [
  "AXP", "AMGN", "AMZN", "AAPL", "BA", "CAT", "CVX", "CSCO", "KO", "DIS",
  "DOW", "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "MCD", "MMM",
  "MRK", "MSFT", "NKE", "PG", "CRM", "TRV", "UNH", "VZ", "V", "WMT",
];

const cache: Record<string, string[]> = { "Dow 30": DOW_30 };

async function fetchTickers(url: string, pattern: RegExp): Promise<string[]> {
  const res = await fetch(url, { headers: { "User-Agent": "chartguesser/1.0" } });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const html = await res.text();
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) out.add(m[1]);
  return [...out];
}

export async function getUniverse(name: string): Promise<string[]> {
  if (cache[name]) return cache[name];
  try {
    if (name === "S&P 500") {
      const t = await fetchTickers(
        "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
        /<td[^>]*>\s*<a[^>]*>([A-Z.]{1,6})<\/a>\s*<\/td>/g
      );
      cache[name] = t.length > 50 ? t : DOW_30;
    } else if (name === "Nasdaq 100") {
      const t = await fetchTickers(
        "https://en.wikipedia.org/wiki/Nasdaq-100",
        />([A-Z]{1,5}(\.[A-Z]{1,2})?)</g
      );
      const filtered = t.filter((x) => x.length >= 1 && x.length <= 5 && !["I", "A"].includes(x));
      cache[name] = filtered.length > 50 ? [...new Set(filtered)] : DOW_30;
    }
  } catch {
    cache[name] = DOW_30;
  }
  return cache[name] || DOW_30;
}

export const UNIVERSE_NAMES = ["S&P 500", "Nasdaq 100", "Dow 30"];
