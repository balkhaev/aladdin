# 📊 Portfolio Optimization

Реализация оптимизации портфеля по методу Mean-Variance Optimization (Markowitz).

## 🎯 Что это

**Portfolio Optimization** — автоматический поиск оптимальных весов активов в портфеле для максимизации доходности при заданном уровне риска.

Основано на **Modern Portfolio Theory (MPT)** Гарри Марковица (Nobel Prize 1990).

## 📐 Методы оптимизации

### 1. Maximum Sharpe Ratio (default)

**Цель:** Максимизировать соотношение доходность/риск

**Формула Sharpe Ratio:**

```
Sharpe = (Return - RiskFreeRate) / Risk
```

**Когда использовать:**

- Для поиска наиболее сбалансированного портфеля
- Когда нет конкретных ограничений по доходности или риску

### 2. Target Return Optimization

**Цель:** Минимизировать риск при заданной целевой доходности

**Когда использовать:**

- Есть конкретная цель по доходности
- Хотите минимизировать риск для достижения этой цели

### 3. Max Risk Optimization

**Цель:** Максимизировать доходность при ограничении на максимальный риск

**Когда использовать:**

- Есть лимит на допустимый риск
- Хотите максимальную доходность в рамках risk tolerance

## 🔧 API Endpoint

### POST /api/portfolio/:id/optimize

Оптимизирует веса активов в портфеле.

**Request Body:**

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

**Parameters:**

- `assets` (required): массив символов активов для оптимизации
- `days` (optional): период для расчета исторических данных (default: 30)
- `constraints` (optional): ограничения оптимизации
  - `minWeight`: минимальный вес актива (default: 0.0)
  - `maxWeight`: максимальный вес актива (default: 1.0)
  - `targetReturn`: целевая доходность (годовая)
  - `maxRisk`: максимальный риск/волатильность (годовая)
  - `allowShorts`: разрешить шорты (default: false)

**Response:**

```json
{
  "success": true,
  "data": {
    "weights": {
      "BTCUSDT": 0.45,
      "ETHUSDT": 0.35,
      "SOLUSDT": 0.2
    },
    "expectedReturn": 0.156,
    "expectedRisk": 0.185,
    "sharpeRatio": 0.735,
    "efficientFrontier": [
      {
        "risk": 0.15,
        "return": 0.12,
        "sharpe": 0.667
      },
      {
        "risk": 0.18,
        "return": 0.15,
        "sharpe": 0.722
      }
    ]
  },
  "timestamp": 1696435200000
}
```

## 📊 Efficient Frontier

**Efficient Frontier** — набор оптимальных портфелей, обеспечивающих максимальную доходность для каждого уровня риска.

**Визуализация:**

```
Return ^
       |     ⭐ Optimal (Max Sharpe)
       |    /
       |   /
       |  /  Efficient Frontier
       | /
       |/____________> Risk
```

**Интерпретация:**

- Точки на границе — эффективные портфели
- Точка с максимальным Sharpe Ratio — оптимальный портфель
- Точки ниже границы — неэффективные

## 💡 Пример использования

### 1. Базовая оптимизация (Max Sharpe)

```bash
curl -X POST "http://localhost:3012/api/portfolio/my-portfolio/optimize" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{
    "assets": ["BTCUSDT", "ETHUSDT", "BNBUSDT"],
    "days": 90
  }'
```

### 2. Оптимизация с целевой доходностью

```bash
curl -X POST "http://localhost:3012/api/portfolio/my-portfolio/optimize" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{
    "assets": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
    "days": 60,
    "constraints": {
      "targetReturn": 0.20
    }
  }'
```

**Результат:** Портфель с минимальным риском для достижения 20% годовой доходности.

### 3. Оптимизация с ограничением риска

```bash
curl -X POST "http://localhost:3012/api/portfolio/my-portfolio/optimize" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{
    "assets": ["BTCUSDT", "ETHUSDT", "ADAUSDT"],
    "days": 30,
    "constraints": {
      "maxRisk": 0.15
    }
  }'
```

**Результат:** Портфель с максимальной доходностью при риске не выше 15%.

### 4. Оптимизация с ограничениями весов

```bash
curl -X POST "http://localhost:3012/api/portfolio/my-portfolio/optimize" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{
    "assets": ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"],
    "days": 90,
    "constraints": {
      "minWeight": 0.10,
      "maxWeight": 0.40
    }
  }'
```

**Результат:** Каждый актив будет иметь вес от 10% до 40%.

## 🧮 Технические детали

### Алгоритм оптимизации

Используется **Gradient Descent** для поиска оптимальных весов:

1. Инициализация: равные веса для всех активов
2. Расчет целевой функции (Sharpe Ratio, риск, или доходность)
3. Вычисление градиента целевой функции
4. Обновление весов в направлении градиента
5. Нормализация весов (сумма = 1)
6. Проверка сходимости
7. Повторение шагов 2-6 до сходимости

### Расчет ковариационной матрицы

```typescript
Cov(i, j) = E[(Ri - E[Ri]) * (Rj - E[Rj])]
```

Где:

- `Ri`, `Rj` — доходности активов i и j
- `E[.]` — математическое ожидание

### Расчет риска портфеля

```typescript
Risk = sqrt(w ^ (T * Σ * w))
```

Где:

- `w` — вектор весов
- `Σ` — ковариационная матрица
- `^T` — транспонирование

### Расчет доходности портфеля

```typescript
Return = sum(wi * Ri)
```

Где:

- `wi` — вес актива i
- `Ri` — ожидаемая доходность актива i

## ⚠️ Ограничения

### Текущие ограничения реализации:

1. **Gradient Descent не гарантирует идеального соблюдения constraints**

   - Constraints применяются post-hoc через normalization
   - Для строгих constraints нужен Quadratic Programming

2. **Линейная корреляция**

   - Предполагается линейная зависимость между активами
   - Не учитывает нелинейные эффекты

3. **Исторические данные**

   - Оптимизация основана на исторических доходностях
   - Прошлые результаты не гарантируют будущих

4. **Нормальное распределение**
   - Предполагается нормальное распределение доходностей
   - В реальности распределения могут быть fat-tailed

## 🚀 Будущие улучшения

### Planned:

1. **Black-Litterman Model** — включение субъективных прогнозов
2. **Robust Optimization** — учет неопределенности в параметрах
3. **Multi-period Optimization** — оптимизация на несколько периодов
4. **Transaction Costs** — учет комиссий при rebalancing
5. **Hierarchical Risk Parity** — альтернативный метод (не требует инверсии ковариационной матрицы)
6. **Convex Optimization (CVXPY)** — точное решение с constraints
7. **Regime Switching** — адаптация к изменяющимся рыночным режимам

## 📚 Литература

1. **Markowitz, H. (1952)** - "Portfolio Selection" - Journal of Finance
2. **Sharpe, W. (1994)** - "The Sharpe Ratio" - Journal of Portfolio Management
3. **Black & Litterman (1992)** - "Global Portfolio Optimization"
4. **DeMiguel et al. (2009)** - "Optimal Versus Naive Diversification"

## 🔗 См. также

- [Portfolio Service](../README.md)
- [Risk Management](../../risk/ADVANCED_RISK_METRICS.md)
- [Aladdin Roadmap](../../../docs/ALADDIN_ROADMAP.md)
