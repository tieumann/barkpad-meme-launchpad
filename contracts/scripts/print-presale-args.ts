import { ethers } from "hardhat";

// Reads the on-chain immutable constructor params of the deployed Presale so we
// can verify it with the exact arguments.
async function main() {
  const p = await ethers.getContractAt("Presale", "0xd37778ED6EF9D3cF8D03F5711636Baa240175CA9");
  const [token, rate, startTime, endTime, softCap, hardCap, maxPerWallet, claimUnlockTime] =
    await Promise.all([
      p.token(),
      p.rate(),
      p.startTime(),
      p.endTime(),
      p.softCap(),
      p.hardCap(),
      p.maxPerWallet(),
      p.claimUnlockTime(),
    ]);
  const admin = "0x6440a649C0cbFd61Ea887A2253045BF7a47B95C8";
  console.log(
    JSON.stringify(
      [
        token,
        rate.toString(),
        startTime.toString(),
        endTime.toString(),
        softCap.toString(),
        hardCap.toString(),
        maxPerWallet.toString(),
        claimUnlockTime.toString(),
        admin,
      ],
      null,
      2
    )
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
