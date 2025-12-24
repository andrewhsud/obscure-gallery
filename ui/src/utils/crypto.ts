import { getBytes, hexlify, keccak256, toUtf8Bytes } from 'ethers';

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] ^ key[i % key.length];
  }
  return output;
}

export function encryptIpfsHash(ipfsHash: string, address: string): string {
  const key = getBytes(keccak256(toUtf8Bytes(address.toLowerCase())));
  const data = toUtf8Bytes(ipfsHash);
  const encrypted = xorBytes(data, key);
  return hexlify(encrypted);
}

export function decryptIpfsHash(encryptedHash: string, address: string): string {
  const key = getBytes(keccak256(toUtf8Bytes(address.toLowerCase())));
  const data = getBytes(encryptedHash);
  const decrypted = xorBytes(data, key);
  return new TextDecoder().decode(decrypted);
}
