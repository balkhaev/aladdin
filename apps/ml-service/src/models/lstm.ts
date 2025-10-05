/**
 * Simple LSTM-like Recurrent Neural Network
 * Lightweight implementation for time series prediction
 */

type Matrix = number[][];
type Vector = number[];

export type LSTMConfig = {
  inputSize: number;
  hiddenSize: number;
  outputSize: number;
  learningRate: number;
  sequenceLength: number;
};

export type TrainingData = {
  input: number[][];
  output: number[];
};

/**
 * LSTM Cell implementation
 */
class LSTMCell {
  // Gates weights
  private Wf: Matrix; // Forget gate
  private Wi: Matrix; // Input gate
  private Wc: Matrix; // Cell gate
  private Wo: Matrix; // Output gate

  // Biases
  private bf: Vector;
  private bi: Vector;
  private bc: Vector;
  private bo: Vector;

  constructor(inputSize: number, hiddenSize: number) {
    // Initialize weights randomly
    this.Wf = this.randomMatrix(hiddenSize + inputSize, hiddenSize);
    this.Wi = this.randomMatrix(hiddenSize + inputSize, hiddenSize);
    this.Wc = this.randomMatrix(hiddenSize + inputSize, hiddenSize);
    this.Wo = this.randomMatrix(hiddenSize + inputSize, hiddenSize);

    this.bf = this.randomVector(hiddenSize);
    this.bi = this.randomVector(hiddenSize);
    this.bc = this.randomVector(hiddenSize);
    this.bo = this.randomVector(hiddenSize);
  }

  /**
   * Forward pass через LSTM cell
   */
  forward(
    input: Vector,
    prevH: Vector,
    prevC: Vector
  ): { h: Vector; c: Vector } {
    // Concatenate input and previous hidden state
    const combined = [...prevH, ...input];

    // Gates
    const ft = this.sigmoid(this.multiply(combined, this.Wf, this.bf));
    const it = this.sigmoid(this.multiply(combined, this.Wi, this.bi));
    const cTilde = this.tanh(this.multiply(combined, this.Wc, this.bc));
    const ot = this.sigmoid(this.multiply(combined, this.Wo, this.bo));

    // New cell state
    const c = this.add(
      this.elementWise(ft, prevC),
      this.elementWise(it, cTilde)
    );

    // New hidden state
    const h = this.elementWise(ot, this.tanh(c));

    return { h, c };
  }

  /**
   * Sigmoid activation
   */
  private sigmoid(x: Vector): Vector {
    return x.map((val) => 1 / (1 + Math.exp(-val)));
  }

  /**
   * Tanh activation
   */
  private tanh(x: Vector): Vector {
    return x.map((val) => Math.tanh(val));
  }

  /**
   * Matrix-vector multiplication with bias
   */
  private multiply(x: Vector, W: Matrix, b: Vector): Vector {
    const result: Vector = [];

    for (let i = 0; i < W[0].length; i++) {
      let sum = b[i];
      for (let j = 0; j < x.length; j++) {
        sum += x[j] * W[j][i];
      }
      result.push(sum);
    }

    return result;
  }

  /**
   * Element-wise multiplication
   */
  private elementWise(a: Vector, b: Vector): Vector {
    return a.map((val, i) => val * b[i]);
  }

  /**
   * Vector addition
   */
  private add(a: Vector, b: Vector): Vector {
    return a.map((val, i) => val + b[i]);
  }

  /**
   * Initialize random matrix
   */
  private randomMatrix(rows: number, cols: number): Matrix {
    const matrix: Matrix = [];
    const scale = Math.sqrt(2 / (rows + cols)); // Xavier initialization

    for (let i = 0; i < rows; i++) {
      const row: Vector = [];
      for (let j = 0; j < cols; j++) {
        row.push((Math.random() * 2 - 1) * scale);
      }
      matrix.push(row);
    }

    return matrix;
  }

  /**
   * Initialize random vector
   */
  private randomVector(size: number): Vector {
    return Array.from({ length: size }, () => Math.random() * 0.1);
  }
}

/**
 * LSTM Network for time series prediction
 */
export class LSTMNetwork {
  private cell: LSTMCell;
  private outputWeights: Matrix;
  private outputBias: Vector;
  private config: LSTMConfig;

  constructor(config: LSTMConfig) {
    this.config = config;
    this.cell = new LSTMCell(config.inputSize, config.hiddenSize);

    // Output layer weights
    this.outputWeights = this.randomMatrix(
      config.hiddenSize,
      config.outputSize
    );
    this.outputBias = this.randomVector(config.outputSize);
  }

  /**
   * Predict next value(s) given sequence
   */
  predict(sequence: number[][]): number[] {
    let h = this.zeros(this.config.hiddenSize);
    let c = this.zeros(this.config.hiddenSize);

    // Process sequence
    for (const input of sequence) {
      const result = this.cell.forward(input, h, c);
      h = result.h;
      c = result.c;
    }

    // Output layer
    return this.linearOutput(h);
  }

  /**
   * Train network on data
   */
  train(data: TrainingData[], epochs: number): number[] {
    const losses: number[] = [];

    for (let epoch = 0; epoch < epochs; epoch++) {
      let epochLoss = 0;

      for (const sample of data) {
        const predicted = this.predict(sample.input);
        const loss = this.mse(predicted, sample.output);
        epochLoss += loss;

        // Simplified gradient descent (in real LSTM would use BPTT)
        this.updateWeights(sample.input, sample.output, predicted);
      }

      epochLoss /= data.length;
      losses.push(epochLoss);

      // Early stopping if loss is very small
      if (epochLoss < 0.001) {
        break;
      }
    }

    return losses;
  }

  /**
   * Predict multiple steps ahead
   */
  predictMultiStep(sequence: number[][], steps: number): number[][] {
    const predictions: number[][] = [];
    let currentSequence = [...sequence];

    for (let i = 0; i < steps; i++) {
      const prediction = this.predict(currentSequence);
      predictions.push(prediction);

      // Use prediction as next input
      currentSequence = [...currentSequence.slice(1), prediction];
    }

    return predictions;
  }

  /**
   * Linear output layer
   */
  private linearOutput(h: Vector): Vector {
    const output: Vector = [];

    for (let i = 0; i < this.config.outputSize; i++) {
      let sum = this.outputBias[i];
      for (let j = 0; j < h.length; j++) {
        sum += h[j] * this.outputWeights[j][i];
      }
      output.push(sum);
    }

    return output;
  }

  /**
   * Mean Squared Error loss
   */
  private mse(predicted: Vector, actual: Vector): number {
    let sum = 0;
    for (let i = 0; i < predicted.length; i++) {
      const diff = predicted[i] - actual[i];
      sum += diff * diff;
    }
    return sum / predicted.length;
  }

  /**
   * Update weights (simplified gradient descent)
   */
  private updateWeights(
    _input: number[][],
    actual: Vector,
    predicted: Vector
  ): void {
    const error = actual.map((a, i) => a - predicted[i]);

    // Update output layer weights
    for (let i = 0; i < this.outputWeights.length; i++) {
      for (let j = 0; j < this.outputWeights[i].length; j++) {
        const gradient = error[j];
        this.outputWeights[i][j] += this.config.learningRate * gradient;
      }
    }

    // Update biases
    for (let i = 0; i < this.outputBias.length; i++) {
      this.outputBias[i] += this.config.learningRate * error[i];
    }
  }

  /**
   * Create zero vector
   */
  private zeros(size: number): Vector {
    return Array.from({ length: size }, () => 0);
  }

  /**
   * Initialize random matrix
   */
  private randomMatrix(rows: number, cols: number): Matrix {
    const matrix: Matrix = [];
    const scale = Math.sqrt(2 / (rows + cols));

    for (let i = 0; i < rows; i++) {
      const row: Vector = [];
      for (let j = 0; j < cols; j++) {
        row.push((Math.random() * 2 - 1) * scale);
      }
      matrix.push(row);
    }

    return matrix;
  }

  /**
   * Initialize random vector
   */
  private randomVector(size: number): Vector {
    return Array.from({ length: size }, () => Math.random() * 0.1);
  }

  /**
   * Serialize model to JSON
   */
  toJSON(): string {
    return JSON.stringify({
      config: this.config,
      outputWeights: this.outputWeights,
      outputBias: this.outputBias,
    });
  }

  /**
   * Load model from JSON
   */
  static fromJSON(json: string): LSTMNetwork {
    const data = JSON.parse(json);
    const model = new LSTMNetwork(data.config);
    model.outputWeights = data.outputWeights;
    model.outputBias = data.outputBias;
    return model;
  }
}
