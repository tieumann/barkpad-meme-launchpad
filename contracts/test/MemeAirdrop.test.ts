import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MemeAirdrop, MockERC20 } from "../typechain-types";

type Entry = { index: number; account: string; amount: bigint };

// Leaf = keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))))
// This double-hash matches OpenZeppelin's standard leaf encoding used on-chain.
function leafHash(e: Entry): string {
  const inner = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint256"],
      [e.index, e.account, e.amount]
    )
  );
  return ethers.keccak256(inner);
}

// Build a sorted-pair Merkle tree compatible with OZ MerkleProof.verify.
function buildTree(leaves: string[]): { root: string; layers: string[][] } {
  let layer = [...leaves];
  const layers = [layer];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 === layer.length) {
        next.push(layer[i]);
      } else {
        const [a, b] = [layer[i], layer[i + 1]].sort();
        next.push(ethers.keccak256(ethers.concat([a, b])));
      }
    }
    layers.push(next);
    layer = next;
  }
  return { root: layer[0], layers };
}

function getProof(layers: string[][], index: number): string[] {
  const proof: string[] = [];
  let idx = index;
  for (let l = 0; l < layers.length - 1; l++) {
    const layer = layers[l];
    const pairIndex = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (pairIndex < layer.length) proof.push(layer[pairIndex]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

describe("MemeAirdrop", () => {
  async function deploy() {
    const [owner, a, b, c] = await ethers.getSigners();

    const entries: Entry[] = [
      { index: 0, account: a.address, amount: ethers.parseEther("100") },
      { index: 1, account: b.address, amount: ethers.parseEther("250") },
      { index: 2, account: c.address, amount: ethers.parseEther("50") },
    ];
    const leaves = entries.map(leafHash);
    const { root, layers } = buildTree(leaves);
    const total = entries.reduce((s, e) => s + e.amount, 0n);

    const Token = await ethers.getContractFactory("MockERC20");
    const token = (await Token.deploy("Air", "AIR")) as unknown as MockERC20;
    await token.waitForDeployment();

    const expiry = (await time.latest()) + 7 * 24 * 60 * 60;
    const Airdrop = await ethers.getContractFactory("MemeAirdrop");
    const airdrop = (await Airdrop.deploy(
      await token.getAddress(),
      root,
      expiry,
      owner.address
    )) as unknown as MemeAirdrop;
    await airdrop.waitForDeployment();

    await token.mint(await airdrop.getAddress(), total);

    return { owner, a, b, c, entries, layers, token, airdrop, expiry, total };
  }

  it("allows a valid claim exactly once", async () => {
    const { a, entries, layers, token, airdrop } = await deploy();
    const proof = getProof(layers, 0);

    await expect(airdrop.claim(0, a.address, entries[0].amount, proof))
      .to.emit(airdrop, "Claimed")
      .withArgs(0, a.address, entries[0].amount);
    expect(await token.balanceOf(a.address)).to.equal(entries[0].amount);
    expect(await airdrop.isClaimed(0)).to.equal(true);

    await expect(
      airdrop.claim(0, a.address, entries[0].amount, proof)
    ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed");
  });

  it("rejects an invalid proof", async () => {
    const { a, entries, layers, airdrop } = await deploy();
    const wrongProof = getProof(layers, 1); // proof for index 1, used for index 0
    await expect(
      airdrop.claim(0, a.address, entries[0].amount, wrongProof)
    ).to.be.revertedWithCustomError(airdrop, "InvalidProof");
  });

  it("rejects a tampered amount", async () => {
    const { a, layers, airdrop } = await deploy();
    const proof = getProof(layers, 0);
    await expect(
      airdrop.claim(0, a.address, ethers.parseEther("999"), proof)
    ).to.be.revertedWithCustomError(airdrop, "InvalidProof");
  });

  it("lets multiple recipients claim and tracks total", async () => {
    const { a, b, entries, layers, airdrop } = await deploy();
    await airdrop.claim(0, a.address, entries[0].amount, getProof(layers, 0));
    await airdrop.claim(1, b.address, entries[1].amount, getProof(layers, 1));
    expect(await airdrop.totalClaimed()).to.equal(entries[0].amount + entries[1].amount);
  });

  it("allows the owner to sweep only after expiry", async () => {
    const { owner, token, airdrop, expiry, total } = await deploy();
    await expect(airdrop.connect(owner).sweep(owner.address)).to.be.revertedWithCustomError(
      airdrop,
      "NotExpired"
    );
    await time.increaseTo(expiry + 1);
    await airdrop.connect(owner).sweep(owner.address);
    expect(await token.balanceOf(owner.address)).to.equal(total);
  });

  it("rejects claims after expiry", async () => {
    const { a, entries, layers, airdrop, expiry } = await deploy();
    await time.increaseTo(expiry + 1);
    await expect(
      airdrop.claim(0, a.address, entries[0].amount, getProof(layers, 0))
    ).to.be.revertedWithCustomError(airdrop, "Expired");
  });
});
