"""LSTM model for time series prediction with proper BPTT."""

import logging
from typing import Literal

import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


class LSTMModel(nn.Module):
    """
    LSTM model for cryptocurrency price prediction.

    This is a proper implementation with:
    - Multiple LSTM layers
    - Dropout for regularization
    - Batch normalization
    - Proper BPTT (handled by PyTorch)
    """

    def __init__(
        self,
        input_size: int,
        hidden_size: int = 128,
        num_layers: int = 2,
        output_size: int = 1,
        dropout: float = 0.2,
        bidirectional: bool = False,
    ):
        """
        Initialize LSTM model.

        Args:
            input_size: Number of input features
            hidden_size: Number of hidden units
            num_layers: Number of LSTM layers
            output_size: Number of output features
            dropout: Dropout probability
            bidirectional: Whether to use bidirectional LSTM
        """
        super().__init__()

        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.output_size = output_size
        self.bidirectional = bidirectional

        # Input batch normalization
        self.input_bn = nn.BatchNorm1d(input_size)

        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
        )

        # Dropout
        self.dropout = nn.Dropout(dropout)

        # Output layer
        lstm_output_size = hidden_size * 2 if bidirectional else hidden_size
        self.fc = nn.Sequential(
            nn.Linear(lstm_output_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, output_size),
        )

        logger.info(
            f"Created LSTM model: input={input_size}, hidden={hidden_size}, "
            f"layers={num_layers}, output={output_size}, bidirectional={bidirectional}"
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.

        Args:
            x: Input tensor of shape (batch, sequence, features)

        Returns:
            Output tensor of shape (batch, output_size)
        """
        batch_size, seq_len, _ = x.shape

        # Batch normalization on features (transpose for BN)
        x = x.transpose(1, 2)  # (batch, features, sequence)
        x = self.input_bn(x)
        x = x.transpose(1, 2)  # (batch, sequence, features)

        # LSTM forward pass
        # No need to initialize hidden states - PyTorch does it automatically
        lstm_out, _ = self.lstm(x)

        # Use last output
        last_output = lstm_out[:, -1, :]  # (batch, hidden_size * directions)

        # Dropout
        last_output = self.dropout(last_output)

        # Fully connected layer
        output = self.fc(last_output)

        return output

    def predict_sequence(self, x: torch.Tensor, steps: int = 1) -> torch.Tensor:
        """
        Predict multiple steps ahead using recursive prediction.

        Args:
            x: Input tensor of shape (batch, sequence, features)
            steps: Number of steps to predict

        Returns:
            Predictions of shape (batch, steps)
        """
        self.eval()
        predictions = []
        current_seq = x.clone()

        with torch.no_grad():
            for _ in range(steps):
                # Predict next value
                pred = self.forward(current_seq)
                predictions.append(pred)

                # Update sequence: remove first element, add prediction
                # For simplicity, we only update the price feature (first feature)
                next_input = torch.zeros((x.shape[0], 1, x.shape[2]), device=x.device)
                next_input[:, 0, 0] = pred.squeeze(-1)  # Update price

                # Shift sequence
                current_seq = torch.cat([current_seq[:, 1:, :], next_input], dim=1)

        return torch.stack(predictions, dim=1).squeeze(-1)

    def get_num_parameters(self) -> int:
        """Get total number of trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


class GRUModel(nn.Module):
    """
    GRU model - often performs better than LSTM for time series.

    Advantages over LSTM:
    - Faster training (fewer parameters)
    - Often comparable or better performance
    - Less prone to overfitting
    """

    def __init__(
        self,
        input_size: int,
        hidden_size: int = 128,
        num_layers: int = 2,
        output_size: int = 1,
        dropout: float = 0.2,
        bidirectional: bool = False,
    ):
        """Initialize GRU model."""
        super().__init__()

        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.output_size = output_size
        self.bidirectional = bidirectional

        # Input batch normalization
        self.input_bn = nn.BatchNorm1d(input_size)

        # GRU layers
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
        )

        # Dropout
        self.dropout = nn.Dropout(dropout)

        # Output layer
        gru_output_size = hidden_size * 2 if bidirectional else hidden_size
        self.fc = nn.Sequential(
            nn.Linear(gru_output_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, output_size),
        )

        logger.info(
            f"Created GRU model: input={input_size}, hidden={hidden_size}, "
            f"layers={num_layers}, output={output_size}, bidirectional={bidirectional}"
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass."""
        # Batch normalization
        x = x.transpose(1, 2)
        x = self.input_bn(x)
        x = x.transpose(1, 2)

        # GRU forward
        gru_out, _ = self.gru(x)

        # Use last output
        last_output = gru_out[:, -1, :]

        # Dropout
        last_output = self.dropout(last_output)

        # FC layer
        output = self.fc(last_output)

        return output

    def get_num_parameters(self) -> int:
        """Get total number of trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


def create_model(
    model_type: Literal["LSTM", "GRU"],
    input_size: int,
    hidden_size: int = 128,
    num_layers: int = 2,
    output_size: int = 1,
    dropout: float = 0.2,
    bidirectional: bool = False,
) -> nn.Module:
    """
    Factory function to create models.

    Args:
        model_type: Type of model ("LSTM" or "GRU")
        input_size: Number of input features
        hidden_size: Number of hidden units
        num_layers: Number of layers
        output_size: Number of output features
        dropout: Dropout probability
        bidirectional: Whether to use bidirectional layers

    Returns:
        Model instance
    """
    if model_type == "LSTM":
        return LSTMModel(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            output_size=output_size,
            dropout=dropout,
            bidirectional=bidirectional,
        )
    if model_type == "GRU":
        return GRUModel(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            output_size=output_size,
            dropout=dropout,
            bidirectional=bidirectional,
        )
    raise ValueError(f"Unknown model type: {model_type}")

