# Portfolio Management Guide

> **Полное руководство по управлению портфелями, оптимизации и ребалансировке**

## 📋 Содержание

- [Portfolio Optimization](#portfolio-optimization)
- [Portfolio Rebalancing](#portfolio-rebalancing)
- [Risk Management](#risk-management)
- [API Reference](#api-reference)

---

## 📊 Portfolio Optimization

### Обзор

**Portfolio Optimization** — автоматический поиск оптимальных весов активов для максимизации доходности при заданном риске. Основано на **Modern Portfolio Theory (MPT)** Гарри Марковица.

### Методы оптимизации

#### 1. Maximum Sharpe Ratio

**Цель:** Максимизировать соотношение доходность/риск

**Формула:**

```
Sharpe = (Return - RiskFreeRate) / Risk
```

**Когда использовать:**

- Поиск сбалансированного портфеля
- Нет конкретных ограничений

#### 2. Target Return

**Цель:** Минимизировать риск при заданной доходности

**Когда использовать:**

- Есть цель по доходности
- Нужно минимизировать риск

#### 3. Max Risk

**Цель:** Максимизировать доходность при ограничении риска

**Когда использовать:**

- Есть лимит на риск
- Нужна максимальная доходность в рамках risk tolerance

### API

```bash
POST /api/portfolio/:id/optimize
```

**Request:**

```json
{
  "assets": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
  "days": 90,
  "constraints": {
    "minWeight": 0.05,
    "maxWeight": 0.5,
    "targetReturn": 0.15,
    "maxRisk": 0.2,
    "allowShorts": false
  }
}
```

**Response:**

```json
{
  "weights": {
    "BTCUSDT": 0.4,
    "ETHUSDT": 0.35,
    "SOLUSDT": 0.25
  },
  "expectedReturn": 0.182,
  "expectedRisk": 0.156,
  "sharpeRatio": 1.167,
  "efficientFrontier": [...]
}
```

---

## 🔄 Portfolio Rebalancing

### Обзор

**Portfolio Rebalancing** — автоматический процесс возвращения портфеля к целевым весам после отклонения.

**Зачем:**

- Поддерживать риск/доходность
- Фиксировать прибыль
- Докупать подешевевшие активы

### Стратегии

#### 1. Periodic (Календарная)

**Описание:** Ребалансировка по расписанию

**Плюсы:**

- Простота и предсказуемость
- Минимальные издержки

**Минусы:**

- Может пропустить отклонения
- Не учитывает волатильность

**Когда использовать:** Долгосрочные портфели

#### 2. Threshold (Пороговая)

**Описание:** Ребалансировка при отклонении веса на X%

**Плюсы:**

- Реагирует на отклонения
- Гибкость настройки

**Минусы:**

- Требует мониторинга
- Может быть частой

**Когда использовать:** Активные портфели

#### 3. Opportunistic (Оппортунистическая)

**Описание:** Ребалансировка при благоприятных условиях

**Плюсы:**

- Учитывает рынок
- Лучшие цены

**Минусы:**

- Сложность определения

**Когда использовать:** Опытные трейдеры

### API

```bash
POST /api/portfolio/:id/rebalance
```

**Request:**

```json
{
  "strategy": "threshold",
  "targetWeights": {
    "BTCUSDT": 0.4,
    "ETHUSDT": 0.35,
    "SOLUSDT": 0.25
  },
  "thresholds": {
    "percentage": 5
  }
}
```

**Response:**

```json
{
  "needsRebalancing": true,
  "currentWeights": {...},
  "targetWeights": {...},
  "trades": [
    {
      "symbol": "BTCUSDT",
      "action": "SELL",
      "quantity": 0.05,
      "reason": "Weight exceeded target by 7%"
    }
  ],
  "estimatedCost": {
    "tradingFees": 15.50,
    "slippage": 8.20,
    "total": 23.70
  }
}
```

---

## ⚠️ Risk Management

### Value at Risk (VaR)

**Описание:** Оценка максимального убытка с заданной вероятностью

**Confidence Levels:**

- 95% — обычный риск
- 99% — высокий риск

**API:**

```bash
GET /api/portfolio/:id/risk/var?confidenceLevel=95
```

**Response:**

```json
{
  "var": -5420.5,
  "confidenceLevel": 95,
  "interpretation": "95% вероятность, что потери не превысят $5,420.50 за 1 день"
}
```

### Conditional VaR (CVaR)

**Описание:** Средний убыток в худших случаях

**API:**

```bash
GET /api/portfolio/:id/risk/cvar?confidenceLevel=95
```

### Stress Testing

**Описание:** Моделирование экстремальных сценариев

**Сценарии:**

1. Crypto Winter (-70% BTC, -75% ETH, -85% Alts)
2. Flash Crash (-30% за час)
3. Exchange Hack (делистинг)
4. Regulatory Crackdown (-80% volume)
5. Black Swan (-50% BTC, -90% liquidity)

**API:**

```bash
POST /api/portfolio/:id/risk/stress-test
```

### Correlation Analysis

**Описание:** Корреляция между активами портфеля

**API:**

```bash
GET /api/portfolio/:id/risk/correlation?window=30d
```

**Response:**

```json
{
  "matrix": [[1.0, 0.85, 0.72], ...],
  "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
  "avgCorrelation": 0.79,
  "diversificationScore": 0.21
}
```

---

## 📖 API Reference

### Optimization

| Endpoint                                | Method | Description             |
| --------------------------------------- | ------ | ----------------------- |
| `/api/portfolio/:id/optimize`           | POST   | Оптимизировать портфель |
| `/api/portfolio/:id/efficient-frontier` | GET    | Эффективная граница     |

### Rebalancing

| Endpoint                               | Method | Description                 |
| -------------------------------------- | ------ | --------------------------- |
| `/api/portfolio/:id/rebalance`         | POST   | Ребалансировать портфель    |
| `/api/portfolio/:id/rebalance/preview` | GET    | Предпросмотр ребалансировки |
| `/api/portfolio/:id/rebalance/history` | GET    | История ребалансировок      |

### Risk Management

| Endpoint                              | Method | Description           |
| ------------------------------------- | ------ | --------------------- |
| `/api/portfolio/:id/risk/var`         | GET    | Value at Risk         |
| `/api/portfolio/:id/risk/cvar`        | GET    | Conditional VaR       |
| `/api/portfolio/:id/risk/stress-test` | POST   | Стресс-тестирование   |
| `/api/portfolio/:id/risk/correlation` | GET    | Корреляционный анализ |

### Performance

| Endpoint                                     | Method | Description             |
| -------------------------------------------- | ------ | ----------------------- |
| `/api/portfolio/:id/performance`             | GET    | Метрики эффективности   |
| `/api/portfolio/:id/performance/attribution` | GET    | Performance attribution |

---

## 🎯 Best Practices

1. **Регулярная оптимизация** — раз в месяц для долгосрочных портфелей
2. **Threshold rebalancing** — 5-10% отклонение для активных портфелей
3. **Минимальные комиссии** — учитывайте trading fees при ребалансировке
4. **Диверсификация** — correlation < 0.7 между активами
5. **Stress testing** — проверяйте портфель на экстремальные сценарии
6. **Risk limits** — устанавливайте max risk per asset
7. **Stop-loss** — используйте protective stops для высокорисковых активов

---

**Made with 💼 for portfolio managers**
