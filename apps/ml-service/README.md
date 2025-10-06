# ML Python Service

Production-ready Machine Learning service for cryptocurrency price prediction using PyTorch.

## Features

- **LSTM/GRU Models**: Proper implementation with Backpropagation Through Time (BPTT)
- **Feature Engineering**: 40+ technical indicators, price features, sentiment integration
- **Backtesting**: Walk-forward validation, cross-validation, robust metrics
- **Hyperparameter Optimization**: Optuna-based AutoML
- **Model Persistence**: Save/load trained models with metadata
- **API**: FastAPI with async endpoints
- **Monitoring**: Prometheus metrics, structured logging

## Architecture

```
apps/ml-python/
├── src/
│   ├── api/              # FastAPI routes
│   ├── models/           # PyTorch model implementations
│   ├── services/         # Business logic
│   ├── features/         # Feature engineering
│   ├── data/             # Data loading & preprocessing
│   ├── training/         # Training loops & optimization
│   ├── evaluation/       # Metrics & backtesting
│   └── utils/            # Helpers
├── tests/
├── models/               # Saved model checkpoints
└── logs/
```

## Installation

```bash
cd apps/ml-python
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

```bash
# Development
uvicorn src.main:app --reload --port 8000

# Production
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

- `POST /api/ml/train` - Train a new model
- `POST /api/ml/predict` - Make price predictions
- `POST /api/ml/backtest` - Run backtesting
- `POST /api/ml/optimize` - Hyperparameter optimization
- `GET /api/ml/models` - List available models
- `GET /api/ml/health` - Health check

## Model Training

```python
import requests

response = requests.post("http://localhost:8000/api/ml/train", json={
    "symbol": "BTCUSDT",
    "model_type": "LSTM",
    "hidden_size": 128,
    "sequence_length": 60,
    "epochs": 100
})
```

## Configuration

See `.env.example` for all configuration options.

## Development

```bash
# Format code
black src/

# Lint
ruff check src/

# Run tests
pytest
```

## Performance

Expected performance on BTCUSDT:

- Directional Accuracy: 60-70%
- MAPE: <5%
- Training time: 2-5 minutes (CPU)
