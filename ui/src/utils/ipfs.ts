const IPFS_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function generateIpfsHash(): string {
  const bytes = new Uint8Array(44);
  crypto.getRandomValues(bytes);
  let hash = 'Qm';
  for (let i = 0; i < bytes.length; i++) {
    hash += IPFS_ALPHABET[bytes[i] % IPFS_ALPHABET.length];
  }
  return hash;
}

export async function simulateIpfsUpload(
  file: File,
  onProgress?: (message: string) => void,
): Promise<{ hash: string }> {
  onProgress?.('Reading file locally...');
  await file.arrayBuffer();

  onProgress?.('Seeding an IPFS hash...');
  await new Promise((resolve) => setTimeout(resolve, 400));

  const hash = generateIpfsHash();
  onProgress?.('Hash finalized.');

  return { hash };
}
