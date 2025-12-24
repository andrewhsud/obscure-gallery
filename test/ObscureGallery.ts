import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ObscureGallery, ObscureGallery__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
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

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ObscureGallery")) as ObscureGallery__factory;
  const galleryContract = (await factory.deploy()) as ObscureGallery;
  const galleryContractAddress = await galleryContract.getAddress();

  return { galleryContract, galleryContractAddress };
}

describe("ObscureGallery", function () {
  let signers: Signers;
  let galleryContract: ObscureGallery;
  let galleryContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ galleryContract, galleryContractAddress } = await deployFixture());
  });

  it("stores and decrypts image metadata", async function () {
    const fileName = "noir-sky.png";
    const ipfsHash = "Qm" + "a".repeat(44);
    const addressA = ethers.Wallet.createRandom().address;
    const encryptedIpfsHash = encryptIpfsHash(ipfsHash, addressA);

    const encryptedInput = await fhevm
      .createEncryptedInput(galleryContractAddress, signers.alice.address)
      .addAddress(addressA)
      .encrypt();

    const tx = await galleryContract
      .connect(signers.alice)
      .addImage(fileName, encryptedIpfsHash, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const count = await galleryContract.getImageCount(signers.alice.address);
    expect(count).to.eq(1);

    const [storedName, storedEncryptedHash, storedEncryptedAddress] = await galleryContract.getImage(
      signers.alice.address,
      0,
    );

    expect(storedName).to.eq(fileName);
    expect(storedEncryptedHash).to.eq(encryptedIpfsHash);

    const decryptedAddress = await fhevm.userDecryptEaddress(
      FhevmType.eaddress,
      storedEncryptedAddress,
      galleryContractAddress,
      signers.alice,
    );

    expect(ethers.getAddress(decryptedAddress)).to.eq(ethers.getAddress(addressA));

    const decryptedHash = decryptIpfsHash(storedEncryptedHash, decryptedAddress);
    expect(decryptedHash).to.eq(ipfsHash);
  });
});
