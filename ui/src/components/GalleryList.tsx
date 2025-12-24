import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { decryptIpfsHash } from '../utils/crypto';
import '../styles/GalleryList.css';

type GalleryListProps = {
  refreshKey: number;
};

type GalleryEntry = {
  index: number;
  fileName: string;
  encryptedIpfsHash: string;
  encryptedAddress: `0x${string}`;
  decryptedIpfsHash?: string;
  decryptedAddress?: string;
  isDecrypting?: boolean;
  error?: string;
};

// const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function GalleryList({ refreshKey }: GalleryListProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const isConfigured = true
  const { data: imageCount, refetch: refetchCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getImageCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConfigured,
    },
  });

  useEffect(() => {
    if (refreshKey > 0) {
      refetchCount();
    }
  }, [refreshKey, refetchCount]);

  useEffect(() => {
    let isMounted = true;

    const loadImages = async () => {
      if (!address || !publicClient || !isConfigured) {
        setEntries([]);
        return;
      }

      const count = imageCount ? Number(imageCount) : 0;
      if (!count) {
        setEntries([]);
        return;
      }

      setIsLoading(true);
      setLoadError('');

      try {
        const items: GalleryEntry[] = [];
        for (let i = 0; i < count; i++) {
          const data = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getImage',
            args: [address, BigInt(i)],
          });

          const [fileName, encryptedIpfsHash, encryptedAddress] = data as [
            string,
            string,
            `0x${string}`,
          ];

          items.push({
            index: i,
            fileName,
            encryptedIpfsHash,
            encryptedAddress,
          });
        }

        if (isMounted) {
          setEntries(items);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load images.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadImages();

    return () => {
      isMounted = false;
    };
  }, [address, imageCount, publicClient, isConfigured, refreshKey]);

  const decryptEntry = async (entry: GalleryEntry) => {
    if (!address || !instance || !signerPromise) {
      setLoadError('Connect your wallet and wait for the encryption service.');
      return;
    }

    setEntries((prev) =>
      prev.map((item) =>
        item.index === entry.index ? { ...item, isDecrypting: true, error: undefined } : item,
      ),
    );

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: entry.encryptedAddress,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer not available.');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedAddress = result[entry.encryptedAddress as string];
      if (!decryptedAddress) {
        throw new Error('Decryption returned an empty address.');
      }

      const decryptedHash = decryptIpfsHash(entry.encryptedIpfsHash, decryptedAddress);

      setEntries((prev) =>
        prev.map((item) =>
          item.index === entry.index
            ? {
                ...item,
                decryptedAddress,
                decryptedIpfsHash: decryptedHash,
                isDecrypting: false,
              }
            : item,
        ),
      );
    } catch (error) {
      setEntries((prev) =>
        prev.map((item) =>
          item.index === entry.index
            ? {
                ...item,
                isDecrypting: false,
                error: error instanceof Error ? error.message : 'Decryption failed.',
              }
            : item,
        ),
      );
    }
  };

  if (!isConfigured) {
    return (
      <section className="panel gallery-panel">
        <div className="panel-header">
          <div>
            <p className="panel-label">Gallery</p>
            <h3 className="panel-title">Your encrypted entries</h3>
          </div>
        </div>
        <p className="panel-warning">Contract address is missing. Update `ui/src/config/contracts.ts`.</p>
      </section>
    );
  }

  if (!address) {
    return (
      <section className="panel gallery-panel">
        <div className="panel-header">
          <div>
            <p className="panel-label">Gallery</p>
            <h3 className="panel-title">Your encrypted entries</h3>
          </div>
        </div>
        <p className="panel-warning">Connect your wallet to load your stored entries.</p>
      </section>
    );
  }

  return (
    <section className="panel gallery-panel">
      <div className="panel-header">
        <div>
          <p className="panel-label">Gallery</p>
          <h3 className="panel-title">Your encrypted entries</h3>
        </div>
        <button
          type="button"
          onClick={() => refetchCount()}
          className="ghost-button"
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      {isLoading ? <p className="panel-status">Loading entries...</p> : null}
      {loadError ? <p className="panel-error">{loadError}</p> : null}
      {zamaLoading ? <p className="panel-status">Encryption service is initializing.</p> : null}
      {zamaError ? <p className="panel-error">{zamaError}</p> : null}

      {!isLoading && entries.length === 0 ? (
        <div className="empty-state">
          <p>No encrypted entries yet. Upload a file to start.</p>
        </div>
      ) : (
        <div className="entry-grid">
          {entries.map((entry) => (
            <article key={entry.index} className="entry-card">
              <div className="entry-header">
                <div>
                  <p className="entry-label">File</p>
                  <h4 className="entry-title">{entry.fileName}</h4>
                </div>
                <span className="entry-index">#{entry.index + 1}</span>
              </div>

              <div className="entry-body">
                <p className="entry-meta">
                  Encrypted hash: <span>{entry.encryptedIpfsHash.slice(0, 22)}...</span>
                </p>
                {entry.decryptedIpfsHash ? (
                  <div className="entry-decrypted">
                    <p>
                      Decrypted address: <span>{entry.decryptedAddress}</span>
                    </p>
                    <p>
                      Decrypted IPFS hash: <span>{entry.decryptedIpfsHash}</span>
                    </p>
                  </div>
                ) : (
                  <p className="entry-meta">Decrypted hash: ***</p>
                )}
              </div>

              {entry.error ? <p className="panel-error">{entry.error}</p> : null}

              <button
                type="button"
                className="secondary-button"
                onClick={() => decryptEntry(entry)}
                disabled={entry.isDecrypting || !instance || !signerPromise}
              >
                {entry.isDecrypting ? 'Decrypting...' : 'Decrypt address and hash'}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
