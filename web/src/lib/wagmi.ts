import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { opnTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Barkpad",
  // Injected (MetaMask) works without a projectId; set NEXT_PUBLIC_WC_PROJECT_ID
  // to enable WalletConnect QR for mobile wallets.
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "barkpad_demo_projectid_0000000000",
  chains: [opnTestnet],
  ssr: true,
});
