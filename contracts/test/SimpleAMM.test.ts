import { expect } from "chai";
import { ethers } from "hardhat";
import { SimpleAMM, MockERC20 } from "../typechain-types";

describe("SimpleAMM", () => {
  async function deploy() {
    const [deployer, lpRecipient, trader] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = (await Token.deploy("Meme", "MEME")) as unknown as MockERC20;
    await token.waitForDeployment();

    const AMM = await ethers.getContractFactory("SimpleAMM");
    const amm = (await AMM.deploy()) as unknown as SimpleAMM;
    await amm.waitForDeployment();

    return { token, amm, deployer, lpRecipient, trader };
  }

  it("creates a pair and mints LP to the recipient", async () => {
    const { token, amm, deployer, lpRecipient } = await deploy();
    const tokenAmount = ethers.parseEther("1000");
    await token.mint(deployer.address, tokenAmount);
    await token.connect(deployer).approve(await amm.getAddress(), tokenAmount);

    await amm
      .connect(deployer)
      .addLiquidityOPN(await token.getAddress(), tokenAmount, lpRecipient.address, {
        value: ethers.parseEther("10"),
      });

    const pairAddr = await amm.pairOf(await token.getAddress());
    expect(pairAddr).to.not.equal(ethers.ZeroAddress);

    const pair = await ethers.getContractAt("SimpleAMMPair", pairAddr);
    expect(await pair.balanceOf(lpRecipient.address)).to.be.gt(0);
    expect(await pair.reserveOPN()).to.equal(ethers.parseEther("10"));
    expect(await pair.reserveToken()).to.equal(tokenAmount);
  });

  it("allows swapping OPN for tokens after liquidity is added", async () => {
    const { token, amm, deployer, lpRecipient, trader } = await deploy();
    const tokenAmount = ethers.parseEther("1000");
    await token.mint(deployer.address, tokenAmount);
    await token.connect(deployer).approve(await amm.getAddress(), tokenAmount);
    await amm
      .connect(deployer)
      .addLiquidityOPN(await token.getAddress(), tokenAmount, lpRecipient.address, {
        value: ethers.parseEther("10"),
      });

    const pairAddr = await amm.pairOf(await token.getAddress());
    const pair = await ethers.getContractAt("SimpleAMMPair", pairAddr);

    const before = await token.balanceOf(trader.address);
    await pair.connect(trader).swapOPNForToken(0, { value: ethers.parseEther("1") });
    const after = await token.balanceOf(trader.address);
    expect(after - before).to.be.gt(0);
  });
});
