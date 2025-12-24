# Obscure Gallery

Obscure Gallery is a privacy-first image metadata vault built on FHEVM. Users pick local images, generate a mock IPFS
hash, encrypt that hash with a freshly generated EVM address, and store the encrypted package on-chain. Later, the user
can decrypt the address with Zama's FHE relayer and recover the IPFS hash without ever putting the hash in plaintext on
chain.

## Why This Project Exists

Public blockchains make it easy to prove ownership but hard to keep metadata private. Image hashes and file names can
leak personal history or sensitive context. Obscure Gallery solves the privacy gap by keeping the decryption key itself
encrypted under FHE, while storing only encrypted metadata on-chain.

## What It Solves

- Prevents plaintext IPFS hashes from being exposed on-chain.
- Avoids centralized custody of encryption keys.
- Provides verifiable, user-owned storage of encrypted image metadata.
- Demonstrates practical use of FHEVM for consumer-facing privacy.

## Key Advantages

- **End-to-end privacy for metadata**: the IPFS hash never appears in plaintext on-chain.
- **User-owned access**: only the uploader can request decryption of the address key.
- **Minimal trust surface**: Zama relayer is used only for FHE decryption, not for storing data.
- **Simple UX**: upload, store, view, decrypt, recover.
- **Composable**: works as a base layer for future sharing, galleries, or paid access.

## How It Works (End-to-End Flow)

1. User selects a local image in the UI.
2. The UI simulates an IPFS upload and generates a random IPFS hash.
3. The UI creates a random EVM address `A`.
4. The IPFS hash is encrypted locally using `A`.
5. The address `A` is encrypted with Zama FHE and sent to the contract.
6. The contract stores:
   - file name
   - encrypted IPFS hash
   - FHE-encrypted address `A`
7. When the user clicks "Decrypt":
   - the relayer decrypts `A`
   - the UI uses `A` to decrypt the IPFS hash
   - the plaintext IPFS hash is revealed only to the user

## Data Model

On-chain storage is per user:

- `fileName`: original name of the image file.
- `encryptedIpfsHash`: hash encrypted off-chain with address `A`.
- `encryptedAddress`: FHE-encrypted form of `A`.

Contract: `contracts/ObscureGallery.sol`.

## Architecture Overview

**On-chain**

- `ObscureGallery` contract stores encrypted metadata.
- Uses Zama FHE primitives for encrypted address storage.
- Emits `ImageStored` event per entry.

**Off-chain**

- Frontend generates IPFS hashes (mock upload).
- Frontend generates EVM address `A`.
- Frontend encrypts/decrypts IPFS hash using `A`.
- Zama relayer decrypts the encrypted address.

## Technology Stack

**Smart Contracts**

- Solidity + Hardhat
- FHEVM / Zama FHE libraries
- Hardhat Deploy and TypeChain

**Frontend**

- React + Vite
- viem for reads
- ethers for writes
- RainbowKit / wagmi for wallet UX
- Zama relayer SDK

## Repository Structure

```
.
├── contracts/         # Solidity contracts
├── deploy/            # Deployment scripts
├── tasks/             # Hardhat tasks
├── test/              # Contract tests
├── docs/              # Zama docs references
├── ui/                # React frontend
└── hardhat.config.ts  # Hardhat configuration
```

## Setup

### Prerequisites

- Node.js 20+
- npm 7+
- A funded Sepolia account
- `.env` configured with `INFURA_API_KEY` and `PRIVATE_KEY` (no mnemonic)

### Install Dependencies

Root (contracts, tasks, deploy scripts):

```bash
npm install
```

Frontend:

```bash
cd ui
npm install
```

### Compile and Test

```bash
npm run compile
npm run test
```

### Local Node (Contracts Only)

```bash
npm run chain
```

Note: the frontend is designed for Sepolia and does not connect to localhost networks.

### Deploy to Sepolia

```bash
npm run deploy:sepolia
```

Optional verification:

```bash
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

### Update Frontend ABI

Copy the ABI from `deployments/sepolia` into the frontend contract module. The frontend must always use the latest
generated ABI from deployment.

### Run the Frontend

```bash
cd ui
npm run dev
```

## Design Constraints (Intentional)

- No Tailwind CSS.
- No frontend environment variables.
- No localhost network support in the UI.
- No localStorage usage.
- No JSON files in frontend code.
- Contract view functions do not use `msg.sender`.

## Security and Privacy Notes

- The IPFS hash is encrypted off-chain before storage.
- The encryption address `A` is never stored in plaintext on-chain.
- Only the uploader can request decryption of `A` via the relayer.
- On-chain data is minimal and intentionally opaque.
- This project is a privacy demo, not a production-secure vault.

## Known Limitations

- IPFS upload is mocked; only a random hash is produced.
- No content retrieval from IPFS is included.
- No sharing or multi-user access controls yet.
- No on-chain pagination for large galleries.
- Relayer availability is required for decryption of `A`.

## Future Roadmap

- Real IPFS uploads with optional pinning providers.
- Encrypted metadata indexing for search.
- Sharing flows with delegated access.
- Key rotation and access revocation.
- Batch uploads and bulk decrypt flows.
- Thumbnail previews with encrypted content distribution.
- Gas optimizations and contract upgrades.

## License

BSD-3-Clause-Clear. See `LICENSE`.
