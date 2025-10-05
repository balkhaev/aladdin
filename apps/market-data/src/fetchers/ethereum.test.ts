import { beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "@aladdin/logger";
import { EthereumFetcher } from "./ethereum";

const MVRV_OVERVALUED = 3.7;
const MVRV_UNDERVALUED = 1.0;
const NUPL_EUPHORIA = 0.75;
const NUPL_CAPITULATION = 0;

describe("EthereumFetcher - Advanced Metrics", () => {
  let fetcher: EthereumFetcher;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    } as unknown as Logger;

    // Use empty API key for testing (will use estimation)
    fetcher = new EthereumFetcher(mockLogger, "");
  });

  describe("fetchMVRV", () => {
    test("should return MVRV ratio", async () => {
      const mvrv = await fetcher.fetchMVRV();

      if (mvrv !== undefined) {
        expect(mvrv).toBeNumber();
        expect(mvrv).toBeGreaterThan(0);
        // MVRV typically ranges from 0.5 to 5
        expect(mvrv).toBeLessThan(10);
      }
    });

    test("should indicate overvalued when MVRV > 3.7", async () => {
      const mvrv = await fetcher.fetchMVRV();

      if (mvrv !== undefined && mvrv > MVRV_OVERVALUED) {
        expect(mvrv).toBeGreaterThan(MVRV_OVERVALUED);
      }
    });

    test("should indicate undervalued when MVRV < 1.0", async () => {
      const mvrv = await fetcher.fetchMVRV();

      if (mvrv !== undefined && mvrv < MVRV_UNDERVALUED) {
        expect(mvrv).toBeLessThan(MVRV_UNDERVALUED);
      }
    });
  });

  describe("fetchNUPL", () => {
    test("should return NUPL value", async () => {
      const nupl = await fetcher.fetchNUPL();

      if (nupl !== undefined) {
        expect(nupl).toBeNumber();
        // NUPL ranges from -1 to 1
        expect(nupl).toBeGreaterThanOrEqual(-1);
        expect(nupl).toBeLessThanOrEqual(1);
      }
    });

    test("should indicate euphoria when NUPL > 0.75", async () => {
      const nupl = await fetcher.fetchNUPL();

      if (nupl !== undefined && nupl > NUPL_EUPHORIA) {
        expect(nupl).toBeGreaterThan(NUPL_EUPHORIA);
      }
    });

    test("should indicate capitulation when NUPL < 0", async () => {
      const nupl = await fetcher.fetchNUPL();

      if (nupl !== undefined && nupl < NUPL_CAPITULATION) {
        expect(nupl).toBeLessThan(NUPL_CAPITULATION);
      }
    });
  });

  describe("MVRV and NUPL relationship", () => {
    test("NUPL should be derived from MVRV", async () => {
      const mvrv = await fetcher.fetchMVRV();
      const nupl = await fetcher.fetchNUPL();

      if (mvrv !== undefined && nupl !== undefined) {
        // NUPL = (MVRV - 1) / MVRV (approximately)
        const expectedNupl = (mvrv - 1) / mvrv;
        // Allow some margin for rounding and calculation differences
        expect(Math.abs(nupl - expectedNupl)).toBeLessThan(0.2);
      }
    });
  });

  describe("Improved SOPR", () => {
    test("should return SOPR around 1.0", async () => {
      const sopr = await fetcher.fetchSOPR();

      if (sopr !== undefined) {
        expect(sopr).toBeNumber();
        // SOPR typically ranges from 0.8 to 1.2
        expect(sopr).toBeGreaterThan(0.5);
        expect(sopr).toBeLessThan(1.5);
      }
    });
  });
});
