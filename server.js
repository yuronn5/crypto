import { createServer } from "node:http";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "purchases.json");
const marketPricesFile = path.join(dataDir, "market-prices.json");
const distDir = path.join(__dirname, "dist");

const initialPurchases = {
  bitcoin: [],
  ethereum: [],
  solana: [],
  sp500: [],
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
};

const sendFile = async (response, filePath, contentType) => {
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentType });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
};

const ensureDataFile = async () => {
  await mkdir(dataDir, { recursive: true });

  try {
    await access(dataFile);
  } catch {
    await writeFile(dataFile, JSON.stringify(initialPurchases, null, 2));
  }
};

const ensureMarketPricesFile = async () => {
  await mkdir(dataDir, { recursive: true });

  try {
    await access(marketPricesFile);
  } catch {
    await writeFile(
      marketPricesFile,
      JSON.stringify(
        {
          bitcoin: null,
          ethereum: null,
          solana: null,
          sp500: null,
          updatedAt: null,
          stale: true,
          source: "empty-cache",
        },
        null,
        2
      )
    );
  }
};

const readPurchases = async () => {
  await ensureDataFile();
  const rawData = await readFile(dataFile, "utf-8");
  const parsed = JSON.parse(rawData);

  return {
    bitcoin: parsed.bitcoin ?? [],
    ethereum: parsed.ethereum ?? [],
    solana: parsed.solana ?? [],
    sp500: parsed.sp500 ?? [],
  };
};

const writePurchases = async (data) => {
  await ensureDataFile();
  await writeFile(dataFile, JSON.stringify(data, null, 2));
};

const readCachedMarketPrices = async () => {
  await ensureMarketPricesFile();
  const rawData = await readFile(marketPricesFile, "utf-8");
  const parsed = JSON.parse(rawData);

  return {
    bitcoin: parsed.bitcoin ?? null,
    ethereum: parsed.ethereum ?? null,
    solana: parsed.solana ?? null,
    sp500: parsed.sp500 ?? null,
    updatedAt: parsed.updatedAt ?? null,
    stale: parsed.stale ?? true,
    source: parsed.source ?? "cache",
  };
};

const writeCachedMarketPrices = async (data) => {
  await ensureMarketPricesFile();
  await writeFile(marketPricesFile, JSON.stringify(data, null, 2));
};

const fetchSp500Price = async () => {
  const sources = [
    async () => {
      const response = await fetch("https://stooq.com/q/l/?s=%5Espx&i=d");

      if (!response.ok) {
        throw new Error("Stooq request failed");
      }

      const csv = await response.text();
      const [, row = ""] = csv.trim().split("\n");
      const columns = row.split(",");
      const closePrice = Number(columns[6]);

      if (!Number.isFinite(closePrice) || closePrice <= 0) {
        throw new Error("Invalid Stooq payload");
      }

      return closePrice;
    },
    async () => {
      const response = await fetch(
        "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=demo"
      );

      if (!response.ok) {
        throw new Error("Alpha Vantage request failed");
      }

      const data = await response.json();
      const spyPrice = Number(data?.["Global Quote"]?.["05. price"]);

      if (!Number.isFinite(spyPrice) || spyPrice <= 0) {
        throw new Error("Invalid Alpha Vantage payload");
      }

      return spyPrice;
    },
  ];

  for (const loadPrice of sources) {
    try {
      return await loadPrice();
    } catch (error) {
      console.error(error);
    }
  }

  throw new Error("Failed to fetch S&P 500 price from all sources");
};

const fetchMarketPrices = async ({ liveOnly = false } = {}) => {
  const cachedPrices = await readCachedMarketPrices();
  const [cryptoResult, sp500Result] = await Promise.allSettled([
    fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd"
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch crypto prices");
      }

      const data = await response.json();
      return {
        bitcoin: Number(data?.bitcoin?.usd) || null,
        ethereum: Number(data?.ethereum?.usd) || null,
        solana: Number(data?.solana?.usd) || null,
      };
    }),
    fetchSp500Price(),
  ]);

  const marketPrices = {
    bitcoin:
      cryptoResult.status === "fulfilled"
        ? cryptoResult.value.bitcoin
        : cachedPrices.bitcoin,
    ethereum:
      cryptoResult.status === "fulfilled"
        ? cryptoResult.value.ethereum
        : cachedPrices.ethereum,
    solana:
      cryptoResult.status === "fulfilled"
        ? cryptoResult.value.solana
        : cachedPrices.solana,
    sp500: sp500Result.status === "fulfilled" ? sp500Result.value : cachedPrices.sp500,
    updatedAt:
      cryptoResult.status === "fulfilled" || sp500Result.status === "fulfilled"
        ? new Date().toISOString()
        : cachedPrices.updatedAt,
    stale:
      cryptoResult.status !== "fulfilled" || sp500Result.status !== "fulfilled",
    source:
      cryptoResult.status === "fulfilled" || sp500Result.status === "fulfilled"
        ? "live"
        : cachedPrices.source || "cache",
  };

  const hasAnyPrice = Object.entries(marketPrices).some(([key, value]) => {
    if (key === "updatedAt" || key === "stale" || key === "source") {
      return false;
    }

    return Number.isFinite(Number(value));
  });

  if (!hasAnyPrice) {
    if (liveOnly) {
      throw new Error("No live market prices available");
    }

    return {
      ...marketPrices,
      errors: ["Market data providers are currently unavailable"],
    };
  }

  await writeCachedMarketPrices(marketPrices);
  return marketPrices;
};

const readRequestBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });

const deletePurchase = async (assetId, purchaseId) => {
  if (!initialPurchases[assetId]) {
    return { statusCode: 400, payload: { message: "Unknown assetId" } };
  }

  const purchases = await readPurchases();
  const previousLength = purchases[assetId].length;

  purchases[assetId] = purchases[assetId].filter((item) => item.id !== purchaseId);

  if (purchases[assetId].length === previousLength) {
    return { statusCode: 404, payload: { message: "Purchase not found" } };
  }

  await writePurchases(purchases);
  return { statusCode: 200, payload: purchases };
};

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, "http://localhost:4000");

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (requestUrl.pathname === "/api/purchases" && request.method === "GET") {
    try {
      const purchases = await readPurchases();
      sendJson(response, 200, purchases);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { message: "Failed to read purchases" });
    }
    return;
  }

  if (requestUrl.pathname === "/api/market-prices" && request.method === "GET") {
    try {
      const liveOnly = requestUrl.searchParams.get("live") === "1";
      const prices = await fetchMarketPrices({ liveOnly });
      sendJson(response, 200, prices);
    } catch (error) {
      console.error(error);
      const liveOnly = requestUrl.searchParams.get("live") === "1";
      const cachedPrices = await readCachedMarketPrices().catch(() => null);

      if (cachedPrices && !liveOnly) {
        sendJson(response, 200, {
          ...cachedPrices,
          stale: true,
          errors: ["Failed to fetch live market prices"],
        });
        return;
      }

      sendJson(response, 502, {
        message: "Failed to fetch fresh market prices",
      });
    }
    return;
  }

  if (requestUrl.pathname === "/api/purchases" && request.method === "POST") {
    try {
      const { coinId, purchase } = await readRequestBody(request);

      if (!initialPurchases[coinId]) {
        sendJson(response, 400, { message: "Unknown coinId" });
        return;
      }

      const amount = Number(purchase?.amount);
      const date = purchase?.date;
      const tracksPrice = coinId !== "sp500";
      const price = tracksPrice ? Number(purchase?.price) : null;

      if (!date || amount <= 0 || (tracksPrice && price <= 0)) {
        sendJson(response, 400, { message: "Invalid purchase payload" });
        return;
      }

      const purchases = await readPurchases();
      purchases[coinId].push({
        id: randomUUID(),
        date,
        amount,
        ...(tracksPrice ? { price, quantity: amount / price } : {}),
      });

      await writePurchases(purchases);
      sendJson(response, 200, purchases);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { message: "Failed to save purchase" });
    }
    return;
  }

  if (
    requestUrl.pathname.startsWith("/api/purchases/") &&
    request.method === "DELETE"
  ) {
    try {
      const [, apiSegment, purchasesSegment, assetId, purchaseId] =
        requestUrl.pathname.split("/");

      if (apiSegment !== "api" || purchasesSegment !== "purchases" || !purchaseId) {
        sendJson(response, 400, { message: "Invalid delete path" });
        return;
      }

      const result = await deletePurchase(assetId, purchaseId);
      sendJson(response, result.statusCode, result.payload);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { message: "Failed to delete purchase" });
    }
    return;
  }

  if (requestUrl.pathname === "/api/purchases/delete" && request.method === "POST") {
    try {
      const { assetId, purchaseId } = await readRequestBody(request);

      if (!assetId || !purchaseId) {
        sendJson(response, 400, { message: "Missing assetId or purchaseId" });
        return;
      }

      const result = await deletePurchase(assetId, purchaseId);
      sendJson(response, result.statusCode, result.payload);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { message: "Failed to delete purchase" });
    }
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    const assetPath = path.join(distDir, requestUrl.pathname);
    const contentType = requestUrl.pathname.endsWith(".css")
      ? "text/css"
      : "application/javascript";

    await sendFile(response, assetPath, contentType);
    return;
  }

  if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
    await sendFile(response, path.join(distDir, "index.html"), "text/html");
    return;
  }

  response.writeHead(404);
  response.end("Not found");
});

server.listen(4000, () => {
  console.log("Server is running on http://localhost:4000");
});
