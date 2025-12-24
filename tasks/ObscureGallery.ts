import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { randomBytes } from "crypto";

const IPFS_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function generateIpfsHash(): string {
  const bytes = randomBytes(44);
  let hash = "Qm";
  for (let i = 0; i < bytes.length; i++) {
    hash += IPFS_ALPHABET[bytes[i] % IPFS_ALPHABET.length];
  }
  return hash;
}

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] ^ key[i % key.length];
  }
  return output;
}

function encryptIpfsHash(ipfsHash: string, address: string, ethers: typeof import("ethers")): string {
  const key = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase())));
  const data = ethers.toUtf8Bytes(ipfsHash);
  const encrypted = xorBytes(data, key);
  return ethers.hexlify(encrypted);
}

function decryptIpfsHash(encryptedHash: string, address: string, ethers: typeof import("ethers")): string {
  const key = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase())));
  const data = ethers.getBytes(encryptedHash);
  const decrypted = xorBytes(data, key);
  return new TextDecoder().decode(decrypted);
}

task("task:gallery-address", "Prints the ObscureGallery address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { deployments } = hre;
  const gallery = await deployments.get("ObscureGallery");
  console.log("ObscureGallery address is " + gallery.address);
});

task("task:add-image", "Stores an encrypted image entry")
  .addOptionalParam("address", "Optionally specify the ObscureGallery contract address")
  .addParam("name", "Image file name")
  .addOptionalParam("hash", "Plain IPFS hash (if omitted, a random hash is generated)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const galleryDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ObscureGallery");
    console.log(`ObscureGallery: ${galleryDeployment.address}`);

    const signers = await ethers.getSigners();
    const galleryContract = await ethers.getContractAt("ObscureGallery", galleryDeployment.address);

    const ipfsHash = taskArguments.hash ?? generateIpfsHash();
    const addressA = ethers.Wallet.createRandom().address;
    const encryptedHash = encryptIpfsHash(ipfsHash, addressA, ethers);

    const encryptedInput = await fhevm
      .createEncryptedInput(galleryDeployment.address, signers[0].address)
      .addAddress(addressA)
      .encrypt();

    const tx = await galleryContract
      .connect(signers[0])
      .addImage(taskArguments.name, encryptedHash, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Stored file name      : ${taskArguments.name}`);
    console.log(`Plain IPFS hash       : ${ipfsHash}`);
    console.log(`Encrypted IPFS hash   : ${encryptedHash}`);
    console.log(`Random address A      : ${addressA}`);
  });

task("task:decrypt-image", "Decrypts the stored address and IPFS hash for an image")
  .addOptionalParam("address", "Optionally specify the ObscureGallery contract address")
  .addParam("index", "Image index to decrypt")
  .addOptionalParam("user", "User address to query (defaults to signer 0)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const galleryDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ObscureGallery");
    const galleryContract = await ethers.getContractAt("ObscureGallery", galleryDeployment.address);

    const signers = await ethers.getSigners();
    const user = taskArguments.user ?? signers[0].address;

    const [fileName, encryptedIpfsHash, encryptedAddress] = await galleryContract.getImage(
      user,
      BigInt(taskArguments.index),
    );

    const decryptedAddress = await fhevm.userDecryptEaddress(
      FhevmType.eaddress,
      encryptedAddress,
      galleryDeployment.address,
      signers[0],
    );

    const decryptedHash = decryptIpfsHash(encryptedIpfsHash, decryptedAddress, ethers);

    console.log(`File name             : ${fileName}`);
    console.log(`Encrypted IPFS hash   : ${encryptedIpfsHash}`);
    console.log(`Decrypted address A   : ${decryptedAddress}`);
    console.log(`Decrypted IPFS hash   : ${decryptedHash}`);
  });
