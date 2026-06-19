import { useEffect, useState } from "react";

const getTodayDate = () => new Date().toISOString().split("T")[0];
const LIVE_REFRESH_MS = 30000;

const assetConfigs = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", unitLabel: "BTC", tracksPrice: true },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", unitLabel: "ETH", tracksPrice: true },
  { id: "solana", name: "Solana", symbol: "SOL", unitLabel: "SOL", tracksPrice: true },
  { id: "sp500", name: "S&P 500", symbol: "SPX", unitLabel: "units", tracksPrice: false },
];

const createEmptyPurchases = () => ({
  bitcoin: [],
  ethereum: [],
  solana: [],
  sp500: [],
});

const createInitialFormState = () => {
  const today = getTodayDate();

  return {
    bitcoin: { date: today, price: "", amount: "150" },
    ethereum: { date: today, price: "", amount: "60" },
    solana: { date: today, price: "", amount: "40" },
    sp500: { date: today, price: "", amount: "250" },
  };
};

const createInitialExpandedState = () => ({
  bitcoin: false,
  ethereum: false,
  solana: false,
  sp500: false,
});

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);

function App() {
  const [purchases, setPurchases] = useState(createEmptyPurchases);
  const [formState, setFormState] = useState(createInitialFormState);
  const [expandedCards, setExpandedCards] = useState(createInitialExpandedState);
  const [marketPrices, setMarketPrices] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPurchases = async () => {
      try {
        const response = await fetch("/api/purchases");

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Failed to load purchases");
        }

        const data = await response.json();
        setPurchases({
          bitcoin: data.bitcoin ?? [],
          ethereum: data.ethereum ?? [],
          solana: data.solana ?? [],
          sp500: data.sp500 ?? [],
        });
      } catch (loadError) {
        setError(
          "Не вдалося завантажити дані із сервера. Переконайся, що запущений API-сервер командою npm run server або npm run dev:full."
        );
        console.error(loadError);
      } finally {
        setIsLoading(false);
      }
    };

    loadPurchases();
  }, []);

  const loadMarketPrices = async () => {
    setIsLoadingMarket(true);
    setError("");

    try {
      const response = await fetch("/api/market-prices?live=1");

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to load market prices");
      }

      const data = await response.json();
      setMarketPrices(data);
    } catch (marketError) {
      setError(
        "Не вдалося підтягнути свіжі ринкові ціни. Для крипти це має бути live, а для S&P 500 може знадобитися інший провайдер або API key."
      );
      console.error(marketError);
    } finally {
      setIsLoadingMarket(false);
    }
  };

  useEffect(() => {
    loadMarketPrices();

    const intervalId = window.setInterval(() => {
      loadMarketPrices();
    }, LIVE_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleChange = (assetId, field, value) => {
    setFormState((prev) => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        [field]: value,
      },
    }));
  };

  const toggleExpanded = (assetId) => {
    setExpandedCards((prev) => ({
      ...prev,
      [assetId]: !prev[assetId],
    }));
  };

  const handleAddPurchase = async (assetId) => {
    const asset = assetConfigs.find((item) => item.id === assetId);
    const entry = formState[assetId];
    const price = Number(entry.price);
    const amount = Number(entry.amount);

    const isValid =
      asset?.tracksPrice
        ? entry.date && price > 0 && amount > 0
        : entry.date && amount > 0;

    if (!isValid) {
      setError("Заповни дату, ціну та суму покупки коректно.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coinId: assetId,
          purchase: {
            date: entry.date,
            ...(asset?.tracksPrice ? { price } : {}),
            amount,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to save purchase");
      }

      const data = await response.json();
      setPurchases({
        bitcoin: data.bitcoin ?? [],
        ethereum: data.ethereum ?? [],
        solana: data.solana ?? [],
        sp500: data.sp500 ?? [],
      });

      setExpandedCards((prev) => ({
        ...prev,
        [assetId]: true,
      }));

      setFormState((prev) => ({
        ...prev,
        [assetId]: {
          date: getTodayDate(),
          price: "",
          amount:
            assetId === "bitcoin"
              ? "150"
              : assetId === "ethereum"
                ? "60"
                : assetId === "solana"
                  ? "40"
                  : assetId === "sp500"
                    ? "250"
                    : "",
        },
      }));
    } catch (saveError) {
      setError(
        "Не вдалося зберегти покупку на сервері. Перевір, що API-сервер запущений і файл data/purchases.json доступний для запису."
      );
      console.error(saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePurchase = async (assetId, purchaseId) => {
    setDeletingKey(`${assetId}-${purchaseId}`);
    setError("");

    try {
      let response = await fetch(`/api/purchases/${assetId}/${purchaseId}`, {
        method: "DELETE",
      });

      if (response.status === 404) {
        response = await fetch("/api/purchases/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assetId, purchaseId }),
        });
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to delete purchase");
      }

      const data = await response.json();
      setPurchases({
        bitcoin: data.bitcoin ?? [],
        ethereum: data.ethereum ?? [],
        solana: data.solana ?? [],
        sp500: data.sp500 ?? [],
      });
    } catch (deleteError) {
      setError(
        "Не вдалося видалити позицію. Якщо щойно оновлював код сервера, перезапусти npm run server або npm run dev:full."
      );
      console.error(deleteError);
    } finally {
      setDeletingKey("");
    }
  };

  const portfolioTotals = assetConfigs.reduce(
    (acc, asset) => {
      const entries = purchases[asset.id] ?? [];
      const totalInvested = entries.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0
      );
      const totalQuantity = entries.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      );
      const livePrice = Number(marketPrices?.[asset.id]);
      const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;

      acc.invested += totalInvested;
      if (asset.tracksPrice) {
        acc.cryptoInvested += totalInvested;
      } else {
        acc.indexInvested += totalInvested;
      }

      if (asset.tracksPrice && hasLivePrice) {
        acc.currentValue += totalQuantity * livePrice;
      }

      return acc;
    },
    { invested: 0, cryptoInvested: 0, indexInvested: 0, currentValue: 0 }
  );

  const pnl = portfolioTotals.currentValue - portfolioTotals.cryptoInvested;
  const pnlClassName = pnl >= 0 ? "summary-card positive" : "summary-card negative";
  const trackedAssets = assetConfigs.filter((asset) => asset.tracksPrice);
  const hasMarketPrices = trackedAssets.every((asset) => {
    const livePrice = Number(marketPrices?.[asset.id]);
    return Number.isFinite(livePrice) && livePrice > 0;
  });

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Portfolio Average Price Tracker</p>
        <div className="hero-topline">
          <h1>Portfolio overview</h1>
          <button
            type="button"
            className="toggle-button"
            onClick={loadMarketPrices}
          >
            Refresh prices
          </button>
        </div>
        <div className="summary-grid">
          <article className="summary-card highlight">
            <span>Total value now</span>
            <strong>
              {isLoadingMarket
                ? "Loading..."
                : hasMarketPrices
                  ? formatCompactCurrency(portfolioTotals.currentValue)
                  : "Unavailable"}
            </strong>
            <p>Based on current BTC, ETH and SOL prices.</p>
          </article>

          <article className="summary-card">
            <span>Crypto invested</span>
            <strong>{formatCompactCurrency(portfolioTotals.cryptoInvested)}</strong>
            <p>All money you have put into crypto positions so far.</p>
          </article>

          <article className={pnlClassName}>
            <span>Profit / Loss</span>
            <strong>
              {isLoadingMarket
                ? "Loading..."
                : hasMarketPrices
                  ? formatCompactCurrency(pnl)
                  : "Unavailable"}
            </strong>
            <p>
              {marketPrices?.updatedAt
                ? `${marketPrices?.stale ? "Last known" : "Updated"} ${new Date(
                    marketPrices.updatedAt
                  ).toLocaleTimeString()}`
                : "Waiting for market data"}
            </p>
          </article>

          <article className="summary-card">
            <span>Indexes invested</span>
            <strong>{formatCompactCurrency(portfolioTotals.indexInvested)}</strong>
            <p>All money you have put into index positions so far.</p>
          </article>
        </div>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}
      {isLoading ? (
        <div className="status-banner">Завантажую покупки із сервера...</div>
      ) : null}
      {isSaving ? (
        <div className="status-banner">Зберігаю нову покупку...</div>
      ) : null}

      <section className="coins-grid">
        {assetConfigs.map((asset) => {
          const entries = purchases[asset.id] ?? [];
          const isExpanded = expandedCards[asset.id];
          const livePrice = Number(marketPrices?.[asset.id]);
          const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;
          const totals = entries.reduce(
            (acc, item) => {
              acc.totalSpent += item.amount;
              acc.totalQuantity += Number(item.quantity) || 0;
              return acc;
            },
            { totalSpent: 0, totalQuantity: 0 }
          );

          const averagePrice =
            totals.totalQuantity > 0 ? totals.totalSpent / totals.totalQuantity : 0;
          const totalValueNow =
            hasLivePrice && totals.totalQuantity > 0
              ? totals.totalQuantity * livePrice
              : null;

          return (
            <article key={asset.id} className="coin-card">
              <div className="coin-card__header">
                <div>
                  <p className="coin-symbol">{asset.symbol}</p>
                  <h2>{asset.name}</h2>
                </div>
                <div className="coin-badge">
                  {entries.length} {entries.length === 1 ? "purchase" : "purchases"}
                </div>
              </div>

              <div className="stats">
                {asset.tracksPrice ? (
                  <div className="stat">
                    <span>Average buy price</span>
                    <strong>
                      {totals.totalQuantity > 0
                        ? formatCurrency(averagePrice)
                        : "No data yet"}
                    </strong>
                    <small className="stat-note">
                      Current price:{" "}
                      {hasLivePrice ? formatCurrency(livePrice) : "Unavailable"}
                    </small>
                  </div>
                ) : (
                  <div className="stat">
                    <span>Tracking mode</span>
                    <strong>Invested amount only</strong>
                    <small className="stat-note">
                      For S&amp;P 500 I only track date and invested amount.
                    </small>
                  </div>
                )}
                <div className="stat">
                  <span>Total invested</span>
                  <strong>{formatCurrency(totals.totalSpent)}</strong>
                </div>
                {asset.tracksPrice ? (
                  <div className="stat">
                    <span>Total value now</span>
                    <strong>
                      {totalValueNow !== null
                        ? formatCurrency(totalValueNow)
                        : "Unavailable"}
                    </strong>
                  </div>
                ) : null}
              </div>

              <div className="form-grid">
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    value={formState[asset.id].date}
                    onChange={(event) =>
                      handleChange(asset.id, "date", event.target.value)
                    }
                  />
                </label>

                {asset.tracksPrice ? (
                  <label>
                    <span>Buy price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 68000"
                      value={formState[asset.id].price}
                      onChange={(event) =>
                        handleChange(asset.id, "price", event.target.value)
                      }
                    />
                  </label>
                ) : null}

                <label>
                  <span>Invested USD</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={formState[asset.id].amount}
                    onChange={(event) =>
                      handleChange(asset.id, "amount", event.target.value)
                    }
                  />
                </label>
              </div>

              <button
                type="button"
                className="add-button"
                disabled={isLoading || isSaving}
                onClick={() => handleAddPurchase(asset.id)}
              >
                Add purchase
              </button>

              <div className="positions-toolbar">
                <p className="positions-title">
                  Saved positions <span>{entries.length}</span>
                </p>
                <button
                  type="button"
                  className="toggle-button"
                  onClick={() => toggleExpanded(asset.id)}
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
              </div>

              {isExpanded ? (
                <div className="purchase-list">
                  {entries.length === 0 ? (
                    <p className="empty-state">Ще немає покупок для цього активу.</p>
                  ) : (
                    entries
                      .slice()
                      .reverse()
                      .map((item) => (
                        <div key={item.id} className="purchase-item">
                          <div className="purchase-item__main">
                            <p className="purchase-item__date">{item.date}</p>
                            <span className="purchase-item__price">
                              {asset.tracksPrice && Number.isFinite(Number(item.price))
                                ? `${formatCurrency(item.price)} per unit`
                                : "Invested without buy price tracking"}
                            </span>
                          </div>

                          <div className="purchase-item__meta">
                            <strong className="purchase-item__amount">
                              {formatCurrency(item.amount)}
                            </strong>
                            {asset.tracksPrice &&
                            Number.isFinite(Number(item.quantity)) ? (
                              <span className="purchase-item__quantity">
                                {Number(item.quantity).toFixed(6)} {asset.unitLabel}
                              </span>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            className="delete-button"
                            disabled={
                              deletingKey === `${asset.id}-${item.id}` || isSaving
                            }
                            onClick={() => handleDeletePurchase(asset.id, item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ))
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default App;
