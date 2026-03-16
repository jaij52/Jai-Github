from flask import Flask, jsonify, request, render_template
import yfinance as yf
from datetime import datetime, timedelta
import numpy as np
from scipy.stats import norm

app = Flask(__name__)


def black_scholes(S, K, T, r, sigma, option_type="call"):
    """Black-Scholes option pricing."""
    if T <= 0:
        return max(float(S - K), 0) if option_type == "call" else max(float(K - S), 0)
    sigma = max(sigma, 0.0001)
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    if option_type == "call":
        price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:
        price = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    return max(float(price), 0)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stock/<ticker>")
def get_stock(ticker):
    try:
        stock = yf.Ticker(ticker.upper())
        hist = stock.history(period="3mo")
        if hist.empty:
            return jsonify({"error": f"No data found for {ticker}"}), 404
        info = stock.info
        current_price = float(
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or hist["Close"].iloc[-1]
        )
        historical = [
            {"date": d.strftime("%Y-%m-%d"), "close": round(float(c), 2)}
            for d, c in zip(hist.index, hist["Close"])
        ]
        return jsonify({
            "ticker": ticker.upper(),
            "current_price": round(current_price, 2),
            "company_name": info.get("longName", ticker.upper()),
            "historical": historical,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        data = request.json
        ticker = data.get("ticker", "AAPL").upper()
        positions = data.get("positions", [])
        include_stock = data.get("include_stock", True)

        stock = yf.Ticker(ticker)
        hist = stock.history(period="3mo")
        if hist.empty:
            return jsonify({"error": f"No data found for {ticker}"}), 404

        info = stock.info
        current_price = float(
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or hist["Close"].iloc[-1]
        )

        log_returns = np.log(hist["Close"] / hist["Close"].shift(1)).dropna()
        volatility = float(log_returns.std() * np.sqrt(252))
        if volatility <= 0:
            volatility = 0.30

        r = 0.05
        result_positions = []
        option_historical = {}

        stock_historical = [
            {"date": d.strftime("%Y-%m-%d"), "price": round(float(c), 2)}
            for d, c in zip(hist.index, hist["Close"])
        ]

        if include_stock:
            entry = float(hist["Close"].iloc[0])
            pl = (current_price - entry) * 100
            result_positions.append({
                "index": 0,
                "position": f"Stock ({ticker})",
                "entry_price": round(entry, 2),
                "exit_price": round(current_price, 2),
                "pl": round(pl, 2),
                "max_profit": "Unlimited",
                "max_loss": round(-entry * 100, 2),
            })

        for i, pos in enumerate(positions):
            expiry_str = pos.get("expiry", "")
            strike = float(pos.get("strike", 100))
            option_type = pos.get("type", "call").lower()
            order_type = pos.get("order", "buy").lower()

            try:
                fmt = "%Y/%m/%d" if "/" in expiry_str else "%Y-%m-%d"
                expiry_date = datetime.strptime(expiry_str, fmt)
            except Exception:
                expiry_date = datetime.now() + timedelta(days=30)

            entry_stock = float(hist["Close"].iloc[0])
            entry_date = hist.index[0].to_pydatetime().replace(tzinfo=None)
            T_entry = max((expiry_date - entry_date).days / 365, 0.001)
            T_now = max((expiry_date - datetime.now()).days / 365, 0.001)

            entry_price = black_scholes(entry_stock, strike, T_entry, r, volatility, option_type)
            exit_price = black_scholes(current_price, strike, T_now, r, volatility, option_type)

            mult = 100
            if order_type == "sell":
                pl = (entry_price - exit_price) * mult
                max_profit = round(entry_price * mult, 2)
                max_loss = "Unlimited" if option_type == "call" else round(-(strike - entry_price) * mult, 2)
            else:
                pl = (exit_price - entry_price) * mult
                max_loss = round(-entry_price * mult, 2)
                max_profit = "Unlimited" if option_type == "call" else round((strike - entry_price) * mult, 2)

            label = f"{option_type.capitalize()} {strike:.1f} {order_type.capitalize()} ({expiry_str.replace('/', '-')})"

            opt_hist = []
            for d, row in hist.iterrows():
                T = max((expiry_date - d.to_pydatetime().replace(tzinfo=None)).days / 365, 0.001)
                p = black_scholes(float(row["Close"]), strike, T, r, volatility, option_type)
                opt_hist.append({"date": d.strftime("%Y-%m-%d"), "price": round(p, 2)})

            option_historical[label] = opt_hist
            result_positions.append({
                "index": len(result_positions),
                "position": label,
                "entry_price": round(entry_price, 2),
                "exit_price": round(exit_price, 2),
                "pl": round(pl, 2),
                "max_profit": max_profit,
                "max_loss": max_loss,
            })

        return jsonify({
            "positions": result_positions,
            "stock_historical": stock_historical,
            "option_historical": option_historical,
            "current_price": round(current_price, 2),
            "ticker": ticker,
            "volatility": round(volatility * 100, 2),
        })
    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "detail": traceback.format_exc()}), 400


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8502)
