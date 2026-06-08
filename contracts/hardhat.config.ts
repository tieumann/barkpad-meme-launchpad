import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const OPN_RPC_URL = process.env.OPN_RPC_URL ?? "https://testnet-rpc.iopn.tech";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    opnTestnet: {
      url: OPN_RPC_URL,
      chainId: 984,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: 8_000_000_000, // 8 Gwei (OPN min is 7 Gwei)
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
  },
  // OPN testnet runs a Blockscout explorer at https://testnet.iopn.tech.
  // Blockscout accepts any non-empty apiKey.
  etherscan: {
    apiKey: {
      opnTestnet: "blockscout",
    },
    customChains: [
      {
        network: "opnTestnet",
        chainId: 984,
        urls: {
          apiURL: "https://testnet.iopn.tech/api",
          browserURL: "https://testnet.iopn.tech",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
