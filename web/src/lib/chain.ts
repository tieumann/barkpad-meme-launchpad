import { defineChain } from "viem";

/** OPN Chain testnet (Chain ID 984). */
export const opnTestnet = defineChain({
  id: 984,
  name: "OPN Testnet",
  nativeCurrency: { name: "OPN", symbol: "OPN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.iopn.tech"] },
    public: { http: ["https://testnet-rpc.iopn.tech"] },
  },
  testnet: true,
});

export const FAUCET_URL = "https://faucet.iopn.tech/";
