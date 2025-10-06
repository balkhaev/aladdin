"""Model training with proper validation and early stopping."""

import logging
import time
from pathlib import Path
from typing import Literal

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from src.config import get_settings
from src.features.normalization import Normalizer

logger = logging.getLogger(__name__)
settings = get_settings()


class Trainer:
    """
    Model trainer with proper validation, early stopping, and checkpointing.

    Features:
    - Train/validation/test split
    - Early stopping based on validation loss
    - Learning rate scheduling
    - Model checkpointing
    - Training metrics tracking
    """

    def __init__(
        self,
        model: nn.Module,
        device: torch.device,
        learning_rate: float = 0.001,
        weight_decay: float = 1e-5,
    ):
        """
        Initialize trainer.

        Args:
            model: PyTorch model
            device: Device to train on
            learning_rate: Initial learning rate
            weight_decay: L2 regularization coefficient
        """
        self.model = model.to(device)
        self.device = device
        self.optimizer = torch.optim.Adam(
            model.parameters(), lr=learning_rate, weight_decay=weight_decay
        )
        self.criterion = nn.MSELoss()
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode="min", factor=0.5, patience=5, verbose=True
        )

        self.train_losses = []
        self.val_losses = []
        self.best_val_loss = float("inf")
        self.best_model_state = None
        self.epochs_without_improvement = 0

        logger.info(f"Initialized trainer with {model.get_num_parameters():,} parameters")

    def train_epoch(self, train_loader: DataLoader) -> float:
        """
        Train for one epoch.

        Args:
            train_loader: Training data loader

        Returns:
            Average training loss
        """
        self.model.train()
        total_loss = 0.0
        num_batches = 0

        for batch_X, batch_y in train_loader:
            batch_X = batch_X.to(self.device)
            batch_y = batch_y.to(self.device)

            # Forward pass
            self.optimizer.zero_grad()
            predictions = self.model(batch_X)

            # Calculate loss
            loss = self.criterion(predictions.squeeze(), batch_y)

            # Backward pass
            loss.backward()

            # Gradient clipping to prevent exploding gradients
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)

            # Update weights
            self.optimizer.step()

            total_loss += loss.item()
            num_batches += 1

        avg_loss = total_loss / num_batches
        return avg_loss

    def validate(self, val_loader: DataLoader) -> float:
        """
        Validate model.

        Args:
            val_loader: Validation data loader

        Returns:
            Average validation loss
        """
        self.model.eval()
        total_loss = 0.0
        num_batches = 0

        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X = batch_X.to(self.device)
                batch_y = batch_y.to(self.device)

                predictions = self.model(batch_X)
                loss = self.criterion(predictions.squeeze(), batch_y)

                total_loss += loss.item()
                num_batches += 1

        avg_loss = total_loss / num_batches
        return avg_loss

    def train(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        epochs: int = 100,
        early_stopping_patience: int = 10,
        checkpoint_dir: Path | None = None,
    ) -> dict:
        """
        Train model with validation and early stopping.

        Args:
            train_loader: Training data loader
            val_loader: Validation data loader
            epochs: Maximum number of epochs
            early_stopping_patience: Patience for early stopping
            checkpoint_dir: Directory to save checkpoints

        Returns:
            Training history dict
        """
        logger.info(f"Starting training for {epochs} epochs")
        start_time = time.time()

        for epoch in range(epochs):
            epoch_start = time.time()

            # Train
            train_loss = self.train_epoch(train_loader)
            self.train_losses.append(train_loss)

            # Validate
            val_loss = self.validate(val_loader)
            self.val_losses.append(val_loss)

            # Learning rate scheduling
            self.scheduler.step(val_loss)

            epoch_time = time.time() - epoch_start

            logger.info(
                f"Epoch {epoch + 1}/{epochs} - "
                f"train_loss: {train_loss:.6f}, "
                f"val_loss: {val_loss:.6f}, "
                f"time: {epoch_time:.2f}s"
            )

            # Check for improvement
            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss
                self.best_model_state = self.model.state_dict().copy()
                self.epochs_without_improvement = 0

                # Save checkpoint
                if checkpoint_dir:
                    checkpoint_path = checkpoint_dir / "best_model.pt"
                    self.save_checkpoint(checkpoint_path)
                    logger.info(f"Saved best model to {checkpoint_path}")
            else:
                self.epochs_without_improvement += 1

            # Early stopping
            if self.epochs_without_improvement >= early_stopping_patience:
                logger.info(
                    f"Early stopping triggered after {epoch + 1} epochs "
                    f"(best val_loss: {self.best_val_loss:.6f})"
                )
                break

        # Restore best model
        if self.best_model_state:
            self.model.load_state_dict(self.best_model_state)
            logger.info("Restored best model weights")

        training_time = time.time() - start_time

        return {
            "epochs": len(self.train_losses),
            "best_val_loss": self.best_val_loss,
            "train_losses": self.train_losses,
            "val_losses": self.val_losses,
            "training_time": training_time,
        }

    def evaluate(self, test_loader: DataLoader) -> dict:
        """
        Evaluate model on test set.

        Args:
            test_loader: Test data loader

        Returns:
            Evaluation metrics
        """
        self.model.eval()
        all_predictions = []
        all_targets = []

        with torch.no_grad():
            for batch_X, batch_y in test_loader:
                batch_X = batch_X.to(self.device)
                batch_y = batch_y.to(self.device)

                predictions = self.model(batch_X)
                all_predictions.extend(predictions.squeeze().cpu().numpy())
                all_targets.extend(batch_y.cpu().numpy())

        predictions = np.array(all_predictions)
        targets = np.array(all_targets)

        # Calculate metrics
        mae = np.mean(np.abs(predictions - targets))
        mse = np.mean((predictions - targets) ** 2)
        rmse = np.sqrt(mse)
        mape = np.mean(np.abs((predictions - targets) / targets)) * 100

        # R² score
        ss_res = np.sum((targets - predictions) ** 2)
        ss_tot = np.sum((targets - np.mean(targets)) ** 2)
        r2 = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

        # Directional accuracy
        direction_correct = np.sum(np.sign(predictions) == np.sign(targets))
        directional_accuracy = direction_correct / len(predictions) * 100

        metrics = {
            "mae": float(mae),
            "rmse": float(rmse),
            "mape": float(mape),
            "r2_score": float(r2),
            "directional_accuracy": float(directional_accuracy),
        }

        logger.info(f"Test metrics: {metrics}")

        return metrics

    def save_checkpoint(self, path: Path) -> None:
        """
        Save model checkpoint.

        Args:
            path: Path to save checkpoint
        """
        checkpoint = {
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "scheduler_state_dict": self.scheduler.state_dict(),
            "train_losses": self.train_losses,
            "val_losses": self.val_losses,
            "best_val_loss": self.best_val_loss,
        }

        torch.save(checkpoint, path)
        logger.info(f"Saved checkpoint to {path}")

    def load_checkpoint(self, path: Path) -> None:
        """
        Load model checkpoint.

        Args:
            path: Path to load checkpoint from
        """
        checkpoint = torch.load(path, map_location=self.device)

        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
        self.train_losses = checkpoint["train_losses"]
        self.val_losses = checkpoint["val_losses"]
        self.best_val_loss = checkpoint["best_val_loss"]

        logger.info(f"Loaded checkpoint from {path}")


def create_data_loaders(
    X_train: torch.Tensor,
    y_train: torch.Tensor,
    X_val: torch.Tensor,
    y_val: torch.Tensor,
    batch_size: int = 32,
) -> tuple[DataLoader, DataLoader]:
    """
    Create training and validation data loaders.

    Args:
        X_train: Training features
        y_train: Training targets
        X_val: Validation features
        y_val: Validation targets
        batch_size: Batch size

    Returns:
        Tuple of (train_loader, val_loader)
    """
    train_dataset = TensorDataset(X_train, y_train)
    val_dataset = TensorDataset(X_val, y_val)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    logger.info(
        f"Created data loaders: train={len(train_dataset)}, "
        f"val={len(val_dataset)}, batch_size={batch_size}"
    )

    return train_loader, val_loader

