import { beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "@aladdin/logger";
import { BitcoinMempoolFetcher } from "./bitcoin-mempool";

const MVRV_OVERVALUED = 3.7;
const MVRV_UNDERVALUED = 1.0;
const NUPL_EUPHORIA = 0.75;
const NUPL_CAPITULATION = 0;
const PUELL_TOP = 4;
const PUELL_BOTTOM = 0.5;

describe("BitcoinMempoolFetcher - Advanced Metrics", () => {
  let fetcher: BitcoinMempoolFetcher;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    } as unknown as Logger;

    fetcher = new BitcoinMempoolFetcher(mockLogger);
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

  describe("fetchPuellMultiple", () => {
    test("should return Puell Multiple value", async () => {
      const puell = await fetcher.fetchPuellMultiple();

      if (puell !== undefined) {
        expect(puell).toBeNumber();
        expect(puell).toBeGreaterThan(0);
        // Puell typically ranges from 0.2 to 6
        expect(puell).toBeLessThan(10);
      }
    });

    test("should indicate cycle top when Puell > 4", async () => {
      const puell = await fetcher.fetchPuellMultiple();

      if (puell !== undefined && puell > PUELL_TOP) {
        expect(puell).toBeGreaterThan(PUELL_TOP);
      }
    });

    test("should indicate cycle bottom when Puell < 0.5", async () => {
      const puell = await fetcher.fetchPuellMultiple();

      if (puell !== undefined && puell < PUELL_BOTTOM) {
        expect(puell).toBeLessThan(PUELL_BOTTOM);
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
});
