"""ClickHouse data loader."""

import logging
from datetime import datetime, timedelta

import clickhouse_connect
import pandas as pd

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ClickHouseLoader:
    """Load cryptocurrency data from ClickHouse."""

    def __init__(self):
        """Initialize ClickHouse client."""
        self.client = clickhouse_connect.get_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
            database=settings.clickhouse_database,
        )
        logger.info("Connected to ClickHouse")

    def load_candles(
        self,
        symbol: str,
        timeframe: str = "1m",
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int | None = None,
    ) -> pd.DataFrame:
        """
        Load candle data from ClickHouse.

        Args:
            symbol: Trading pair symbol (e.g., "BTCUSDT")
            timeframe: Timeframe (e.g., "1m", "5m", "1h")
            start_time: Start datetime
            end_time: End datetime
            limit: Maximum number of candles to return

        Returns:
            DataFrame with OHLCV data
        """
        # Build query
        query = """
            SELECT
                timestamp,
                open,
                high,
                low,
                close,
                volume
            FROM candles
            WHERE symbol = {symbol:String}
              AND timeframe = {timeframe:String}
        """

        params = {"symbol": symbol, "timeframe": timeframe}

        if start_time:
            query += " AND timestamp >= {start_time:DateTime}"
            params["start_time"] = start_time

        if end_time:
            query += " AND timestamp <= {end_time:DateTime}"
            params["end_time"] = end_time

        query += " ORDER BY timestamp ASC"

        if limit:
            query += f" LIMIT {limit}"

        # Execute query
        result = self.client.query(query, parameters=params)

        # Convert to DataFrame
        df = pd.DataFrame(
            result.result_rows,
            columns=["timestamp", "open", "high", "low", "close", "volume"],
        )

        # Convert timestamp to datetime
        df["timestamp"] = pd.to_datetime(df["timestamp"])

        logger.info(
            f"Loaded {len(df)} candles for {symbol} ({timeframe}) "
            f"from {df['timestamp'].min()} to {df['timestamp'].max()}"
        )

        return df

    def load_recent_candles(
        self,
        symbol: str,
        timeframe: str = "1m",
        lookback_days: int = 30,
    ) -> pd.DataFrame:
        """
        Load recent candles.

        Args:
            symbol: Trading pair symbol
            timeframe: Timeframe
            lookback_days: Number of days to look back

        Returns:
            DataFrame with OHLCV data
        """
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=lookback_days)

        return self.load_candles(
            symbol=symbol,
            timeframe=timeframe,
            start_time=start_time,
            end_time=end_time,
        )

    def get_available_symbols(self) -> list[str]:
        """
        Get list of available trading symbols.

        Returns:
            List of symbols
        """
        query = """
            SELECT DISTINCT symbol
            FROM candles
            ORDER BY symbol
        """

        result = self.client.query(query)
        symbols = [row[0] for row in result.result_rows]

        logger.info(f"Found {len(symbols)} available symbols")

        return symbols

    def get_data_range(self, symbol: str, timeframe: str = "1m") -> dict:
        """
        Get data range for a symbol.

        Args:
            symbol: Trading pair symbol
            timeframe: Timeframe

        Returns:
            Dict with start and end timestamps
        """
        query = """
            SELECT
                min(timestamp) as start,
                max(timestamp) as end,
                count(*) as count
            FROM candles
            WHERE symbol = {symbol:String}
              AND timeframe = {timeframe:String}
        """

        result = self.client.query(query, parameters={"symbol": symbol, "timeframe": timeframe})
        row = result.result_rows[0]

        return {"start": row[0], "end": row[1], "count": row[2]}

    def close(self):
        """Close ClickHouse connection."""
        self.client.close()
        logger.info("Closed ClickHouse connection")

