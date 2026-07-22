import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseInvescoJson, parseIsharesCsv, parseVanEckHtml } from "../src/lib/etf/parsers";

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));

test("parseIsharesCsv keeps only equity tickers", async () => {
  const csv = await readFile(`${fixtures}ishares-holdings.csv`, "utf8");
  assert.deepEqual(parseIsharesCsv(csv).tickers, ["NVDA", "AVGO"]);
});

test("parseVanEckHtml extracts the holdings table", async () => {
  const html = await readFile(`${fixtures}vaneck-holdings.html`, "utf8");
  assert.deepEqual(parseVanEckHtml(html).tickers, ["NVDA", "TSM"]);
});

test("parseInvescoJson recursively extracts holdings", () => {
  const payload = { holdings: [{ ticker: "NVDA" }, { securityTicker: "AMD" }, { ticker: "QQQ" }] };
  assert.deepEqual(parseInvescoJson(payload, "QQQ"), ["NVDA", "AMD"]);
});
