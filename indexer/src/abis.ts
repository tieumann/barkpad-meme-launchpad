export const tokenFactoryAbi = [
  {
    type: "event",
    name: "TokenCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "curve", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "metadataId", type: "bytes32", indexed: false },
      { name: "identityVerified", type: "bool", indexed: false },
    ],
  },
] as const;

export const bondingCurveAbi = [
  {
    type: "event",
    name: "Trade",
    inputs: [
      { name: "trader", type: "address", indexed: true },
      { name: "isBuy", type: "bool", indexed: false },
      { name: "opnAmount", type: "uint256", indexed: false },
      { name: "tokenAmount", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Graduated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "pool", type: "address", indexed: false },
      { name: "lpAmount", type: "uint256", indexed: false },
      { name: "unlockTime", type: "uint64", indexed: false },
    ],
  },
  { type: "function", name: "status", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "reserve", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "supplySold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "graduationCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

export const tokenFactoryReadAbi = [
  {
    type: "function",
    name: "records",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
      { name: "creator", type: "address" },
      { name: "createdAt", type: "uint64" },
      { name: "metadataId", type: "bytes32" },
      { name: "identityVerified", type: "bool" },
    ],
  },
] as const;
