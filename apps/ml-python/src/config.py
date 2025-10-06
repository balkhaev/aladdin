"""Configuration management."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Server
    port: int = Field(default=8000, description="Server port")
    host: str = Field(default="0.0.0.0", description="Server host")
    log_level: str = Field(default="info", description="Log level")
    workers: int = Field(default=1, description="Number of workers")

    # ClickHouse
    clickhouse_host: str = Field(default="localhost", description="ClickHouse host")
    clickhouse_port: int = Field(default=8123, description="ClickHouse port")
    clickhouse_user: str = Field(default="default", description="ClickHouse user")
    clickhouse_password: str = Field(default="", description="ClickHouse password")
    clickhouse_database: str = Field(default="crypto", description="ClickHouse database")

    # Redis
    redis_host: str = Field(default="localhost", description="Redis host")
    redis_port: int = Field(default=6379, description="Redis port")
    redis_db: int = Field(default=0, description="Redis database")

    # Model settings
    model_cache_dir: Path = Field(default=Path("./models"), description="Model cache directory")
    model_expiry_hours: int = Field(default=24, description="Model expiry time in hours")
    max_models_in_memory: int = Field(default=10, description="Max models in memory")

    # Training defaults
    default_hidden_size: int = Field(default=128, description="Default LSTM hidden size")
    default_sequence_length: int = Field(default=60, description="Default sequence length")
    default_learning_rate: float = Field(default=0.001, description="Default learning rate")
    default_batch_size: int = Field(default=32, description="Default batch size")
    default_epochs: int = Field(default=100, description="Default epochs")
    early_stopping_patience: int = Field(default=10, description="Early stopping patience")

    # Device
    device: str = Field(default="cpu", description="Device to use (cpu/cuda/mps)")

    # MLflow (optional)
    mlflow_tracking_uri: str | None = Field(default=None, description="MLflow tracking URI")
    mlflow_experiment_name: str = Field(
        default="crypto-ml", description="MLflow experiment name"
    )

    # External services
    analytics_service_url: str = Field(
        default="http://localhost:3016", description="Analytics service URL"
    )

    def __init__(self, **kwargs):
        """Initialize settings."""
        super().__init__(**kwargs)
        # Create model cache directory if it doesn't exist
        self.model_cache_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

