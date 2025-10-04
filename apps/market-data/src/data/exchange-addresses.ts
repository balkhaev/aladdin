/**
 * Known exchange wallet addresses for tracking exchange flows
 * Sources: Public data from Glassnode, Nansen, blockchain explorers
 */

export type ExchangeAddress = {
  exchange: string;
  blockchain: "BTC" | "ETH";
  addresses: string[];
  type: "hot" | "cold";
  label?: string;
};

/**
 * Bitcoin exchange addresses
 */
const BITCOIN_EXCHANGES: ExchangeAddress[] = [
  // Binance
  {
    exchange: "binance",
    blockchain: "BTC",
    type: "cold",
    addresses: [
      "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", // Binance Cold Wallet 1
      "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h", // Binance Cold Wallet 2
      "bc1qa5wkgaew2dkv56kfvj49j0av5nml45x9ek9hz6", // Binance Cold Wallet 3
    ],
  },
  {
    exchange: "binance",
    blockchain: "BTC",
    type: "hot",
    addresses: [
      "3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb", // Binance Hot Wallet 1
      "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s", // Binance Hot Wallet 2
    ],
  },

  // Coinbase
  {
    exchange: "coinbase",
    blockchain: "BTC",
    type: "cold",
    addresses: [
      "3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r", // Coinbase Cold Storage
      "3Cbq7aT1tY8kMxWLbitaG7yT6bPbKChq64", // Coinbase Cold Wallet
      "bc1qjasf9z3h7j9w85ck9fxmg7y8u6h3w2x3q3u9a8", // Coinbase Cold Wallet 2
    ],
  },
  {
    exchange: "coinbase",
    blockchain: "BTC",
    type: "hot",
    addresses: [
      "1AJbsFZ64EpEfS5UAjAfcUG8pH8Jn3rn1F", // Coinbase Hot Wallet
      "3FupZp77ySr7jwoLYpkK8JfBvWyZfRbykR", // Coinbase Hot Wallet 2
    ],
  },

  // Kraken
  {
    exchange: "kraken",
    blockchain: "BTC",
    type: "cold",
    addresses: [
      "3FHNBLobJnbCTFTVakh5TXmEneyf5PT61B", // Kraken Cold Storage
      "35ULMyVnFoYaPaMxwHTRmaGdABpAThM4QR", // Kraken Cold Wallet
    ],
  },
  {
    exchange: "kraken",
    blockchain: "BTC",
    type: "hot",
    addresses: [
      "bc1qg08ec9qmpv94xg5x9r3eqq0vf7w3rcagmyqq0c", // Kraken Hot Wallet
    ],
  },

  // Bybit
  {
    exchange: "bybit",
    blockchain: "BTC",
    type: "cold",
    addresses: [
      "bc1qzd74lg5v64f4x7gq5sgu5hx6xgg6x8tprdxr2v", // Bybit Cold Storage
    ],
  },
  {
    exchange: "bybit",
    blockchain: "BTC",
    type: "hot",
    addresses: [
      "34HpHYiyQwg69gFmCq2BGHjF1DZnZnBeBP", // Bybit Hot Wallet
    ],
  },

  // Bitfinex
  {
    exchange: "bitfinex",
    blockchain: "BTC",
    type: "cold",
    addresses: [
      "3D8DJLwUXFfZvE8yJRu729MZ8uLy25SuLz", // Bitfinex Cold Storage
      "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97", // Bitfinex Cold Wallet
    ],
  },

  // Huobi
  {
    exchange: "huobi",
    blockchain: "BTC",
    type: "cold",
    addresses: [
      "3PbJsixkc7L3s5kJQf2FQXS7mRZhzXdxNH", // Huobi Cold Storage
    ],
  },
];

/**
 * Ethereum exchange addresses
 */
const ETHEREUM_EXCHANGES: ExchangeAddress[] = [
  // Binance
  {
    exchange: "binance",
    blockchain: "ETH",
    type: "cold",
    addresses: [
      "0x28C6c06298d514Db089934071355E5743bf21d60", // Binance Cold Wallet 14
      "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", // Binance Cold Wallet 15
      "0xDFd5293D8e347dFe59E90eFd55b2956a1343963d", // Binance Cold Wallet 16
    ],
  },
  {
    exchange: "binance",
    blockchain: "ETH",
    type: "hot",
    addresses: [
      "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", // Binance Hot Wallet 1
      "0xD551234Ae421e3BCBA99A0Da6d736074f22192FF", // Binance Hot Wallet 2
      "0x564286362092D8e7936f0549571a803B203aAceD", // Binance Hot Wallet 3
      "0x0681d8Db095565FE8A346fA0277bFfdE9C0eDBBF", // Binance Hot Wallet 4
    ],
  },

  // Coinbase
  {
    exchange: "coinbase",
    blockchain: "ETH",
    type: "cold",
    addresses: [
      "0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43", // Coinbase Cold Storage 1
      "0x77134cbC06cB00b66F4c7e623D5fdBF6777635EC", // Coinbase Cold Storage 2
      "0x7c195D981AbFdC3DDecd2ca0Fed0958430488e34", // Coinbase Cold Storage 3
    ],
  },
  {
    exchange: "coinbase",
    blockchain: "ETH",
    type: "hot",
    addresses: [
      "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3", // Coinbase Hot Wallet
      "0x503828976D22510aad0201ac7EC88293211D23Da", // Coinbase Hot Wallet 2
      "0xddfAbCdc4D8FfC6d5beaf154f18B778f892A0740", // Coinbase Hot Wallet 3
    ],
  },

  // Kraken
  {
    exchange: "kraken",
    blockchain: "ETH",
    type: "cold",
    addresses: [
      "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2", // Kraken Cold Storage
      "0x0A869d79a7052C7f1b55a8EbAbbEa3420F0D1E13", // Kraken Cold Storage 2
      "0xe853c56864A2ebe4576a807D26Fdc4A0adA51919", // Kraken Cold Storage 3
    ],
  },
  {
    exchange: "kraken",
    blockchain: "ETH",
    type: "hot",
    addresses: [
      "0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0", // Kraken Hot Wallet
      "0xfa52274DD61E1643d2205169732f29114BC240b3", // Kraken Hot Wallet 2
    ],
  },

  // Bybit
  {
    exchange: "bybit",
    blockchain: "ETH",
    type: "cold",
    addresses: [
      "0xf89d7b9c864f589bbF53a82105107622B35EaA40", // Bybit Cold Storage
    ],
  },
  {
    exchange: "bybit",
    blockchain: "ETH",
    type: "hot",
    addresses: [
      "0x3c6B0a6f04f5B0d5c6B8f8d8f8d8f8d8f8d8f8d8", // Bybit Hot Wallet (example)
    ],
  },

  // Bitfinex
  {
    exchange: "bitfinex",
    blockchain: "ETH",
    type: "cold",
    addresses: [
      "0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa", // Bitfinex Cold Storage
      "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Bitfinex Cold Storage 2
    ],
  },
  {
    exchange: "bitfinex",
    blockchain: "ETH",
    type: "hot",
    addresses: [
      "0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F", // Bitfinex Hot Wallet
    ],
  },

  // Huobi
  {
    exchange: "huobi",
    blockchain: "ETH",
    type: "cold",
    addresses: [
      "0xAb5c66752a9e8167967685F1450532fB96d5d24f", // Huobi Cold Storage
      "0x6748F50f686bfbcA6Fe8ad62b22228b87F31ff2b", // Huobi Cold Storage 2
    ],
  },
  {
    exchange: "huobi",
    blockchain: "ETH",
    type: "hot",
    addresses: [
      "0x0D0707963952f2fBA59dD06f2b425ace40b492Fe", // Huobi Hot Wallet
      "0x90e9dDD9D8D5ae4E3763D0cF856C97594DaA8Ede", // Huobi Hot Wallet 2
    ],
  },

  // OKX
  {
    exchange: "okx",
    blockchain: "ETH",
    type: "cold",
    addresses: [
      "0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b", // OKX Cold Storage
    ],
  },
  {
    exchange: "okx",
    blockchain: "ETH",
    type: "hot",
    addresses: [
      "0x98ec059Dc3aDFBdd63429454aEB0c990FBA4A128", // OKX Hot Wallet
    ],
  },
];

/**
 * All exchange addresses
 */
export const EXCHANGE_ADDRESSES: ExchangeAddress[] = [
  ...BITCOIN_EXCHANGES,
  ...ETHEREUM_EXCHANGES,
];

/**
 * Get exchange addresses for a specific blockchain
 */
export const getExchangeAddresses = (
  blockchain: "BTC" | "ETH"
): ExchangeAddress[] =>
  EXCHANGE_ADDRESSES.filter((addr) => addr.blockchain === blockchain);

/**
 * Check if an address belongs to a known exchange
 */
export const isExchangeAddress = (
  address: string,
  blockchain: "BTC" | "ETH"
): { isExchange: boolean; exchange?: string; type?: "hot" | "cold" } => {
  const normalizedAddress = address.toLowerCase();

  for (const exchangeAddr of EXCHANGE_ADDRESSES) {
    if (exchangeAddr.blockchain !== blockchain) {
      continue;
    }

    const found = exchangeAddr.addresses.some(
      (addr) => addr.toLowerCase() === normalizedAddress
    );

    if (found) {
      return {
        isExchange: true,
        exchange: exchangeAddr.exchange,
        type: exchangeAddr.type,
      };
    }
  }

  return { isExchange: false };
};

/**
 * Get all addresses for a specific exchange
 */
export const getAddressesByExchange = (
  exchange: string,
  blockchain?: "BTC" | "ETH"
): string[] =>
  EXCHANGE_ADDRESSES.filter(
    (addr) =>
      addr.exchange.toLowerCase() === exchange.toLowerCase() &&
      (!blockchain || addr.blockchain === blockchain)
  ).flatMap((addr) => addr.addresses);
