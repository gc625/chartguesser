export type EtfConstituents = {
  symbol: string;
  name: string;
  issuer: string;
  sourceUrl: string;
  asOf?: string;
  tickers: string[];
  stale?: boolean;
};

export class UnsupportedEtfError extends Error {
  constructor(symbol: string) {
    super(`${symbol} is not available from a supported free issuer feed yet.`);
    this.name = "UnsupportedEtfError";
  }
}
