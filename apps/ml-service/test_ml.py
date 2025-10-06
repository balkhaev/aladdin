"""Simple test script to verify ML service."""

import asyncio

import requests


def test_health():
    """Test health endpoint."""
    response = requests.get("http://localhost:8000/api/ml/health")
    print("Health check:", response.json())
    assert response.status_code == 200


def test_train():
    """Test training endpoint."""
    payload = {
        "symbol": "BTCUSDT",
        "model_type": "LSTM",
        "hidden_size": 64,  # Smaller for faster testing
        "num_layers": 2,
        "sequence_length": 30,
        "lookback_days": 7,  # Less data for faster testing
        "batch_size": 32,
        "epochs": 50,  # Fewer epochs for testing
        "dropout": 0.2,
    }

    print("Starting training...")
    response = requests.post("http://localhost:8000/api/ml/train", json=payload, timeout=600)
    result = response.json()
    
    print("Training result:")
    print(f"  Success: {result['success']}")
    if result["success"]:
        data = result["data"]
        print(f"  Symbol: {data['symbol']}")
        print(f"  Model type: {data['model_type']}")
        print(f"  Training time: {data['training_time']:.2f}s")
        print(f"  Epochs: {data['epochs_trained']}")
        print(f"  Test MAE: {data['metrics']['mae']:.6f}")
        print(f"  Test RMSE: {data['metrics']['rmse']:.6f}")
        print(f"  Directional Accuracy: {data['metrics']['directional_accuracy']:.2f}%")
        print(f"  R² Score: {data['metrics']['r2_score']:.4f}")
    
    assert response.status_code == 200
    assert result["success"]


def test_predict():
    """Test prediction endpoint."""
    payload = {"symbol": "BTCUSDT", "horizon": "1h", "confidence": 0.95}

    print("\nMaking prediction...")
    response = requests.post("http://localhost:8000/api/ml/predict", json=payload)
    result = response.json()
    
    print("Prediction result:")
    print(f"  Success: {result['success']}")
    if result["success"]:
        data = result["data"]
        print(f"  Symbol: {data['symbol']}")
        print(f"  Current price: ${data['current_price']:.2f}")
        print(f"  Predicted price: ${data['predicted_price']:.2f}")
        print(f"  Lower bound: ${data['lower_bound']:.2f}")
        print(f"  Upper bound: ${data['upper_bound']:.2f}")
        print(f"  Change: {data['change_pct']:.2f}%")
    
    assert response.status_code == 200
    assert result["success"]


def test_list_models():
    """Test list models endpoint."""
    response = requests.get("http://localhost:8000/api/ml/models")
    result = response.json()
    
    print("\nAvailable models:")
    print(f"  Count: {result['data']['count']}")
    for model in result["data"]["models"]:
        print(f"  - {model['symbol']}: {model['model_type']}")
    
    assert response.status_code == 200
    assert result["success"]


if __name__ == "__main__":
    print("Testing ML Python Service\n")
    print("=" * 50)
    
    # Test health
    test_health()
    
    # Test training
    test_train()
    
    # Test prediction
    test_predict()
    
    # Test list models
    test_list_models()
    
    print("\n" + "=" * 50)
    print("✅ All tests passed!")

