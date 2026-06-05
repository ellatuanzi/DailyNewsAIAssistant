const YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const FINANCE_REQUEST_TIMEOUT_MS = 10000;
const ETF_SYMBOLS = ["SMH", "VGT"];

function buildQuoteUrl(symbols) {
  const url = new URL(YAHOO_QUOTE_URL);
  url.searchParams.set("symbols", symbols.join(","));
  return url;
}

function formatQuote(result) {
  const marketTime =
    typeof result.regularMarketTime === "number"
      ? new Date(result.regularMarketTime * 1000).toISOString()
      : null;

  return {
    symbol: result.symbol,
    shortName: result.shortName || result.longName || result.symbol,
    currency: result.currency || "USD",
    exchange: result.fullExchangeName || result.exchange || null,
    marketState: result.marketState || null,
    price: result.regularMarketPrice ?? null,
    change: result.regularMarketChange ?? null,
    changePercent: result.regularMarketChangePercent ?? null,
    previousClose: result.regularMarketPreviousClose ?? result.previousClose ?? null,
    marketTime,
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(result.symbol)}`
  };
}

export async function fetchEtfQuotes() {
  const quoteUrl = buildQuoteUrl(ETF_SYMBOLS);
  const response = await fetch(quoteUrl, {
    signal: AbortSignal.timeout(FINANCE_REQUEST_TIMEOUT_MS)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.quoteResponse?.error || "ETF quote request failed.");
  }

  const results = Array.isArray(data?.quoteResponse?.result)
    ? data.quoteResponse.result
    : [];

  const quotesBySymbol = Object.fromEntries(
    results
      .filter((result) => result?.symbol)
      .map((result) => [result.symbol, formatQuote(result)])
  );

  const missingSymbols = ETF_SYMBOLS.filter((symbol) => !quotesBySymbol[symbol]);

  return {
    unavailable: results.length === 0,
    partial: missingSymbols.length > 0,
    checkedAt: new Date().toISOString(),
    source: "Yahoo Finance quote API",
    requestUrl: quoteUrl.toString(),
    quotes: ETF_SYMBOLS.map((symbol) => quotesBySymbol[symbol] || { symbol, missing: true }),
    missingSymbols
  };
}
