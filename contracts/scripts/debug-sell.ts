import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const d = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "deployments", "opnTestnet.json"), "utf-8")
);

async function main() {
  const [me] = await ethers.getSigners();
  const factory = await ethers.getContractAt("TokenFactory", d.contracts.TokenFactory);
  const treasury = await ethers.getContractAt("Treasury", d.contracts.Treasury);
  const fee = await treasury.creationFee();

  const params = {
    name: "Sell Debug",
    symbol: "SDBG",
    totalSupply: ethers.parseEther("1000000"),
    metadataId: ethers.ZeroHash,
    basePrice: ethers.parseEther("0.0001"),
    slope: ethers.parseEther("0.0000001"),
    graduationCap: ethers.parseEther("3"),
    tradingFeeBps: 100,
    walletCap: ethers.parseEther("1000000"),
    earlyWindowEnd: 0,
  };
  const tx = await factory.createToken(params, { value: fee });
  const rc = await tx.wait();
  const ev = rc!.logs
    .map((l) => {
      try {
        return factory.interface.parseLog(l as any);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "TokenCreated");
  const tokenAddr = ev!.args.token as string;
  const curveAddr = ev!.args.curve as string;
  const curve = await ethers.getContractAt("BondingCurve", curveAddr);
  const token = await ethers.getContractAt("MemeToken", tokenAddr);

  await (await curve.buy(0, { value: ethers.parseEther("1") })).wait();
  const bal = await token.balanceOf(me.address);
  console.log("balance:", ethers.formatEther(bal));
  console.log("reserve:", ethers.formatEther(await curve.reserve()));
  console.log("supplySold:", (await curve.supplySold()).toString());

  const half = (bal / 2n / ethers.parseEther("1")) * ethers.parseEther("1");
  console.log("selling:", ethers.formatEther(half));

  // Quote first.
  const q = await curve.quoteSell(half);
  console.log("quoteSell out/fee:", ethers.formatEther(q[0]), ethers.formatEther(q[1]));

  await (await token.approve(curveAddr, half)).wait();
  console.log("allowance:", ethers.formatEther(await token.allowance(me.address, curveAddr)));

  // Try staticCall to get the revert reason.
  try {
    await curve.sell.staticCall(half, 0);
    console.log("staticCall sell OK — would succeed");
  } catch (e: any) {
    console.log("sell revert reason:", e.shortMessage ?? e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
