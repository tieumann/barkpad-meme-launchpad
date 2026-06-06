import { defineChain } from "viem";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const opnTestnet = defineChain({
  id: 984,
  name: "OPN Testnet",
  nativeCurrency: { name: "OPN", symbol: "OPN", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.iopn.tech"] } },
  testnet: true,
});

// Load deployed addresses from the contracts workspace.
const deployPath = join(__dirname, "..", "..", "contracts", "deployments", "opnTestnet.json");
export const deployment = JSON.parse(readFileSync(deployPath, "utf-8")) as {
  contracts: Record<string, string>;
  dogon?: Record<string, string>;
};

export const ADDRESSES = deployment.contracts;
export const PORT = Number(process.env.PORT ?? 4000);
export const DB_PATH = process.env.DB_PATH ?? join(__dirname, "..", "barkpad.db");
export const POLL_INTERVAL_MS = 4000;
