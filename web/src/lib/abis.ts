// Minimal ABIs for the functions the UI uses.

export const tokenFactoryAbi = [
  {
    type: "function",
    name: "createToken",
    stateMutability: "payable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "totalSupply", type: "uint256" },
          { name: "metadataId", type: "bytes32" },
          { name: "basePrice", type: "uint256" },
          { name: "slope", type: "uint256" },
          { name: "graduationCap", type: "uint256" },
          { name: "tradingFeeBps", type: "uint16" },
          { name: "walletCap", type: "uint256" },
          { name: "earlyWindowEnd", type: "uint64" },
        ],
      },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
    ],
  },
  {
    type: "function",
    name: "tokenCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allTokens",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "records",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
      { name: "creator", type: "address" },
      { name: "createdAt", type: "uint64" },
      { name: "metadataId", type: "bytes32" },
      { name: "identityVerified", type: "bool" },
    ],
  },
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
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [{ name: "minTokensOut", type: "uint256" }],
    outputs: [{ name: "tokensOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenAmount", type: "uint256" },
      { name: "minOpnOut", type: "uint256" },
    ],
    outputs: [{ name: "opnOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "graduate",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "quoteBuy",
    stateMutability: "view",
    inputs: [{ name: "opnIn", type: "uint256" }],
    outputs: [
      { name: "tokensOut", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "spent", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "status",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "reserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "supplySold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "graduationCap",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "pool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const presaleAbi = [
  { type: "function", name: "buy", stateMutability: "payable", inputs: [], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "refund", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "isLive", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "totalRaised", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "hardCap", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "softCap", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "rate", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "contributed",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const questAbi = [
  {
    type: "function",
    name: "pointsOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "conversionOpen",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export const reputationAbi = [
  {
    type: "function",
    name: "reputationOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "launches", type: "uint32" },
          { name: "graduations", type: "uint32" },
          { name: "flags", type: "uint32" },
          { name: "score", type: "int64" },
        ],
      },
    ],
  },
] as const;

export const stakingFactoryAbi = [
  {
    type: "function",
    name: "createStaking",
    stateMutability: "nonpayable",
    inputs: [
      { name: "stakingToken", type: "address" },
      { name: "rewardToken", type: "address" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
  {
    type: "function",
    name: "poolCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allPools",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "StakingCreated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "stakingToken", type: "address", indexed: true },
      { name: "rewardToken", type: "address", indexed: true },
      { name: "pool", type: "address", indexed: false },
    ],
  },
] as const;

export const stakingAbi = [
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "earned",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalStaked",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "stakingToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "rewardToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const ammPairAbi = [
  {
    type: "function",
    name: "swapOPNForToken",
    stateMutability: "payable",
    inputs: [{ name: "minOut", type: "uint256" }],
    outputs: [{ name: "out", type: "uint256" }],
  },
  {
    type: "function",
    name: "swapTokenForOPN",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
    ],
    outputs: [{ name: "out", type: "uint256" }],
  },
  { type: "function", name: "reserveToken", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "reserveOPN", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
