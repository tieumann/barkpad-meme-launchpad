import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { IdentityGate } from "../typechain-types";

// Policy enum: 0 = BLOCK_UNVERIFIED, 1 = ALLOW_UNVERIFIED
const BLOCK = 0;
const ALLOW = 1;

describe("IdentityGate", () => {
  async function deploy(policy: number) {
    const [admin, creator, relayer] = await ethers.getSigners();
    // Use a fresh wallet as the trusted verifier so we control its key.
    const verifier = ethers.Wallet.createRandom().connect(ethers.provider);

    const Factory = await ethers.getContractFactory("IdentityGate");
    const gate = (await Factory.deploy(admin.address, verifier.address, policy)) as unknown as IdentityGate;
    await gate.waitForDeployment();

    return { gate, admin, creator, relayer, verifier };
  }

  async function signAttestation(
    gate: IdentityGate,
    verifier: ReturnType<typeof ethers.Wallet.createRandom>,
    account: string,
    expiry: number
  ) {
    const hash = await gate.attestationHash(account, expiry);
    // toEthSignedMessageHash + recover == signMessage over the raw 32-byte hash.
    return verifier.signMessage(ethers.getBytes(hash));
  }

  it("verifies a valid attestation signed by the trusted verifier", async () => {
    const { gate, creator, relayer, verifier } = await deploy(BLOCK);
    const expiry = (await time.latest()) + 3600;
    const sig = await signAttestation(gate, verifier, creator.address, expiry);

    await expect(gate.connect(relayer).submitAttestation(creator.address, expiry, sig))
      .to.emit(gate, "Verified")
      .withArgs(creator.address);
    expect(await gate.isVerified(creator.address)).to.equal(true);
  });

  it("rejects a signature from a non-verifier", async () => {
    const { gate, creator } = await deploy(BLOCK);
    const [, , , impostor] = await ethers.getSigners();
    const expiry = (await time.latest()) + 3600;
    const hash = await gate.attestationHash(creator.address, expiry);
    const badSig = await impostor.signMessage(ethers.getBytes(hash));

    await expect(
      gate.submitAttestation(creator.address, expiry, badSig)
    ).to.be.revertedWithCustomError(gate, "InvalidAttestation");
  });

  it("rejects an expired attestation", async () => {
    const { gate, creator, verifier } = await deploy(BLOCK);
    const expiry = (await time.latest()) - 1;
    const sig = await signAttestation(gate, verifier, creator.address, expiry);
    await expect(
      gate.submitAttestation(creator.address, expiry, sig)
    ).to.be.revertedWithCustomError(gate, "AttestationExpired");
  });

  it("checkLaunch reverts for unverified creator under BLOCK policy", async () => {
    const { gate, creator } = await deploy(BLOCK);
    await expect(gate.checkLaunch(creator.address)).to.be.revertedWithCustomError(gate, "NotVerified");
  });

  it("checkLaunch returns false (no revert) for unverified creator under ALLOW policy", async () => {
    const { gate, creator } = await deploy(ALLOW);
    expect(await gate.checkLaunch(creator.address)).to.equal(false);
  });

  it("checkLaunch returns true for a verified creator", async () => {
    const { gate, creator, verifier } = await deploy(BLOCK);
    const expiry = (await time.latest()) + 3600;
    const sig = await signAttestation(gate, verifier, creator.address, expiry);
    await gate.submitAttestation(creator.address, expiry, sig);
    expect(await gate.checkLaunch(creator.address)).to.equal(true);
  });
});
