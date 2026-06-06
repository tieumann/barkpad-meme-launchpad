import { expect } from "chai";
import { ethers } from "hardhat";
import { CurveMathHarness } from "../typechain-types";

describe("CurveMath", () => {
  async function deploy() {
    const Factory = await ethers.getContractFactory("CurveMathHarness");
    const harness = (await Factory.deploy()) as unknown as CurveMathHarness;
    await harness.waitForDeployment();
    return harness;
  }

  const base = ethers.parseEther("0.0000001"); // base price per whole token
  const slope = ethers.parseEther("0.00000000001");

  it("cost of empty range is zero", async () => {
    const h = await deploy();
    expect(await h.costBetween(base, slope, 100n, 100n)).to.equal(0n);
  });

  it("cost is monotonic increasing in range size", async () => {
    const h = await deploy();
    const c1 = await h.costBetween(base, slope, 0n, 1000n);
    const c2 = await h.costBetween(base, slope, 0n, 2000n);
    expect(c2).to.be.gt(c1);
  });

  it("tokensForOPN cost never exceeds the input (rounding-safe)", async () => {
    const h = await deploy();
    const opnIn = ethers.parseEther("5");
    const [n1, cost] = await h.tokensForOPN(base, slope, 0n, opnIn);
    expect(cost).to.be.lte(opnIn);
    expect(n1).to.be.gt(0n);
  });

  it("tokensForOPN is consistent with costBetween (round-trip)", async () => {
    const h = await deploy();
    const opnIn = ethers.parseEther("3");
    const [n1, cost] = await h.tokensForOPN(base, slope, 500n, opnIn);
    const recomputed = await h.costBetween(base, slope, 500n, n1);
    expect(recomputed).to.equal(cost);
    // Buying one more whole token would exceed the budget.
    const costPlusOne = await h.costBetween(base, slope, 500n, n1 + 1n);
    expect(costPlusOne).to.be.gt(opnIn);
  });

  it("handles zero slope (constant price)", async () => {
    const h = await deploy();
    const opnIn = ethers.parseEther("1");
    const [n1, cost] = await h.tokensForOPN(base, 0n, 0n, opnIn);
    expect(n1).to.equal(opnIn / base);
    expect(cost).to.equal((opnIn / base) * base);
  });
});
