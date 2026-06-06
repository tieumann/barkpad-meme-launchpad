import { ethers, network } from "hardhat";

/**
 * Pre-deploy sanity check: confirms your wallet is connected to OPN Chain
 * and has enough OPN to pay for gas. Run before deploy:
 *   npx hardhat run scripts/check-wallet.ts --network opnTestnet
 */
async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signer found. Set PRIVATE_KEY in contracts/.env");
  }
  const me = signers[0];
  const net = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(me.address);

  console.log(`Network:  ${network.name} (chainId ${net.chainId})`);
  console.log(`Wallet:   ${me.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} OPN`);

  if (net.chainId !== 984n) {
    console.warn("WARNING: chainId is not 984 (OPN testnet). Check your RPC config.");
  }
  if (balance === 0n) {
    console.warn("WARNING: balance is 0. Fund your wallet at https://faucet.iopn.tech/");
  } else {
    console.log("Wallet looks ready for deployment.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
