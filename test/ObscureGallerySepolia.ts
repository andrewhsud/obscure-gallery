import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ObscureGallery } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] ^ key[i % key.length];
  }
  return output;
}

function encryptIpfsHash(ipfsHash: string, address: string): string {
  const key = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase())));
  const data = ethers.toUtf8Bytes(ipfsHash);
  const encrypted = xorBytes(data, key);
  return ethers.hexlify(encrypted);
}

function decryptIpfsHash(encryptedHash: string, address: string): string {
  const key = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase())));
  const data = ethers.getBytes(encryptedHash);
  const decrypted = xorBytes(data, key);
  return new TextDecoder().decode(decrypted);
}

describe("ObscureGallerySepolia", function () {
  let signers: Signers;
  let galleryContract: ObscureGallery;
  let galleryContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const galleryDeployment = await deployments.get("ObscureGallery");
      galleryContractAddress = galleryDeployment.address;
      galleryContract = await ethers.getContractAt("ObscureGallery", galleryDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("stores and decrypts an image entry", async function () {
    steps = 10;
    this.timeout(4 * 40000);

    const fileName = "sepolia-sample.png";
    const ipfsHash = "Qm" + "b".repeat(44);
    const addressA = ethers.Wallet.createRandom().address;
    const encryptedIpfsHash = encryptIpfsHash(ipfsHash, addressA);

    progress("Encrypting address A...");
    const encryptedInput = await fhevm
      .createEncryptedInput(galleryContractAddress, signers.alice.address)
      .addAddress(addressA)
      .encrypt();

    progress(`Calling addImage() on ${galleryContractAddress}...`);
    const tx = await galleryContract
      .connect(signers.alice)
      .addImage(fileName, encryptedIpfsHash, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    progress("Reading stored entry...");
    const [storedName, storedEncryptedHash, storedEncryptedAddress] = await galleryContract.getImage(
      signers.alice.address,
      0,
    );
    expect(storedName).to.eq(fileName);
    expect(storedEncryptedHash).to.eq(encryptedIpfsHash);

    progress("Decrypting address A...");
    const decryptedAddress = await fhevm.userDecryptEaddress(
      FhevmType.eaddress,
      storedEncryptedAddress,
      galleryContractAddress,
      signers.alice,
    );
    expect(ethers.getAddress(decryptedAddress)).to.eq(ethers.getAddress(addressA));

    progress("Decrypting IPFS hash...");
    const decryptedHash = decryptIpfsHash(storedEncryptedHash, decryptedAddress);
    expect(decryptedHash).to.eq(ipfsHash);
  });
});
