"""ClickHouse data loader."""

import logging
from datetime import datetime, timedelta

import clickhouse_connect
import pandas as pd

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Singleton client для переиспользования соединения
_clickhouse_client = None


def get_clickhouse_client():
    """Get or create ClickHouse client with proper settings."""
    global _clickhouse_client
    
    if _clickhouse_client is None:
        logger.info("Creating new ClickHouse client")
        _clickhouse_client = clickhouse_connect.get_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
            database=settings.clickhouse_database,
            # Настройки для работы с большими запросами и таймаутов
            connect_timeout=30,  # 30 секунд на подключение
            send_receive_timeout=300,  # 5 минут на выполнение запроса
            # Настройки для стабильности соединения
            pool_mgr_kwargs={
                'maxsize': 10,  # Максимум 10 соединений в пуле
                'block': True,   # Блокировать при исчерпании пула
            },
            # Настройки ClickHouse для больших запросов
            settings={
                'max_execution_time': 300,  # 5 минут
                'max_block_size': 100000,   # Размер блока для чтения
                'max_insert_block_size': 100000,
            },
        )
        logger.info("ClickHouse client created successfully")
    
    return _clickhouse_client


class ClickHouseLoader:
    """Load cryptocurrency data from ClickHouse."""

    def __init__(self):
        """Initialize ClickHouse client."""
        self.client = get_clickhouse_client()
        logger.info("Using shared ClickHouse client")

    def load_candles(
        self,
        symbol: str,
        timeframe: str = "1m",
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int | None = None,
        max_retries: int = 3,
    ) -> pd.DataFrame:
        """
        Load candle data from ClickHouse.

        Args:
            symbol: Trading pair symbol (e.g., "BTCUSDT")
            timeframe: Timeframe (e.g., "1m", "5m", "1h")
            start_time: Start datetime
            end_time: End datetime
            limit: Maximum number of candles to return
            max_retries: Maximum number of retry attempts

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

        # Execute query with retry logic
        last_error = None
        for attempt in range(max_retries):
            try:
                logger.info(
                    f"Executing query for {symbol} ({timeframe}), attempt {attempt + 1}/{max_retries}"
                )
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
                
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Query attempt {attempt + 1}/{max_retries} failed: {e}",
                    exc_info=True
                )
                
                # Если это не последняя попытка, ждём перед повтором
                if attempt < max_retries - 1:
                    import time
                    wait_time = 2 ** attempt  # Exponential backoff: 1, 2, 4 seconds
                    logger.info(f"Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
        
        # Если все попытки провалились, выбрасываем последнюю ошибку
        logger.error(f"All {max_retries} attempts failed for {symbol}")
        raise last_error

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
        # Не закрываем shared client
        logger.info("ClickHouse connection is managed globally, not closing")

