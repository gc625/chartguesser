import { normalizeTickers, SYMBOL_PATTERN } from "@/lib/universes";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\"") {
      if (quoted && line[i + 1] === "\"") {
        value += "\"";
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

export function parseIsharesCsv(csv: string): { tickers: string[]; asOf?: string } {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const asOf = lines.join(" ").match(/as of\s+([A-Za-z0-9, /-]+)/i)?.[1]?.trim();
  const headerIndex = lines.findIndex((line) => {
    const headers = parseCsvLine(line).map((item) => item.toLowerCase());
    return headers.includes("ticker") && headers.some((item) => item.includes("asset class"));
  });
  if (headerIndex < 0) throw new Error("The iShares holdings file had an unknown format.");
  const headers = parseCsvLine(lines[headerIndex]).map((item) => item.toLowerCase());
  const tickerIndex = headers.indexOf("ticker");
  const assetClassIndex = headers.findIndex((item) => item.includes("asset class"));
  const tickers = lines.slice(headerIndex + 1).flatMap((line) => {
    const cells = parseCsvLine(line);
    const assetClass = cells[assetClassIndex]?.toLowerCase() || "";
    const ticker = cells[tickerIndex]?.toUpperCase();
    return assetClass.includes("equity") && ticker && SYMBOL_PATTERN.test(ticker) ? [ticker] : [];
  });
  return { tickers: normalizeTickers(tickers), asOf };
}

export function parseVanEckHtml(html: string): { tickers: string[]; asOf?: string } {
  const asOf = html.match(/Daily Holdings[^<]{0,40}as of\s+([0-9/]+)/i)?.[1];
  const tableSection = html.match(/Daily Holdings[\s\S]{0,250000}?(?:All Fund Holdings|Holdings are subject to change)/i)?.[0] || html;
  const candidates = [...tableSection.matchAll(/>\s*([A-Z][A-Z0-9.-]{0,14})\s*<\/(?:td|span)>/g)]
    .map((match) => match[1])
    .filter((ticker) => !["USD", "CASH", "OTHER", "TICKER"].includes(ticker));
  const tickers = normalizeTickers(candidates);
  if (tickers.length < 2) throw new Error("The VanEck holdings page had an unknown format.");
  return { tickers, asOf };
}

export function parseInvescoJson(value: unknown, fundSymbol: string): string[] {
  const candidates: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    for (const key of ["ticker", "symbol", "holdingTicker", "securityTicker"]) {
      const candidate = record[key];
      if (typeof candidate === "string") candidates.push(candidate.toUpperCase());
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return normalizeTickers(candidates).filter((ticker) =>
    ticker !== fundSymbol && !["USD", "CASH", "OTHER"].includes(ticker)
  );
}
