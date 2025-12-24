import { useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract, Wallet } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { simulateIpfsUpload } from '../utils/ipfs';
import { encryptIpfsHash } from '../utils/crypto';
import '../styles/UploadPanel.css';

type UploadPanelProps = {
  onStored: () => void;
};

// const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function UploadPanel({ onStored }: UploadPanelProps) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [ipfsHash, setIpfsHash] = useState('');
  const [encryptedHash, setEncryptedHash] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isStoring, setIsStoring] = useState(false);
  const [storeSuccess, setStoreSuccess] = useState(false);

  const isConfigured = true
  const resetForm = () => {
    setFile(null);
    setPreviewUrl('');
    setFileName('');
    setIpfsHash('');
    setEncryptedHash('');
    setStatusMessage('');
    setIsUploading(false);
    setIsStoring(false);
    setStoreSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setStoreSuccess(false);
    setIpfsHash('');
    setEncryptedHash('');
    setStatusMessage('');

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (selected) {
      setFileName(selected.name);
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setFileName('');
      setPreviewUrl('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatusMessage('Select a local image first.');
      return;
    }

    setIsUploading(true);
    setStatusMessage('Preparing secure upload...');
    try {
      const result = await simulateIpfsUpload(file, (step) => setStatusMessage(step));
      setIpfsHash(result.hash);
      setStatusMessage('Upload complete. Hash is ready.');
    } catch (error) {
      setStatusMessage(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStoreOnChain = async () => {
    if (!isConfigured) {
      setStatusMessage('Contract address is not configured.');
      return;
    }
    if (!address || !instance || !signerPromise) {
      setStatusMessage('Connect your wallet and wait for the encryption service.');
      return;
    }
    if (!fileName || !ipfsHash) {
      setStatusMessage('Upload to IPFS before storing on-chain.');
      return;
    }

    setIsStoring(true);
    setStatusMessage('Encrypting the IPFS hash with a fresh address...');
    try {
      const addressA = Wallet.createRandom().address;
      const encryptedIpfsHash = encryptIpfsHash(ipfsHash, addressA);

      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(addressA)
        .encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer not available.');
      }

      const galleryContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setStatusMessage('Submitting encrypted metadata to the contract...');
      const tx = await galleryContract.addImage(
        fileName,
        encryptedIpfsHash,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );

      setStatusMessage(`Waiting for confirmation: ${tx.hash}`);
      await tx.wait();

      setEncryptedHash(encryptedIpfsHash);
      setStoreSuccess(true);
      setStatusMessage('Stored on-chain. Your encrypted entry is now live.');
      onStored();
    } catch (error) {
      setStatusMessage(`Storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsStoring(false);
    }
  };

  return (
    <section className="panel upload-panel">
      <div className="panel-header">
        <div>
          <p className="panel-label">Upload</p>
          <h3 className="panel-title">Seal a new image reference</h3>
        </div>
        <button type="button" onClick={resetForm} className="ghost-button">
          Reset
        </button>
      </div>

      {!isConfigured ? (
        <div className="panel-warning">
          <p>Contract address is missing. Update `ui/src/config/contracts.ts` before submitting.</p>
        </div>
      ) : null}

      <div className="upload-form">
        <label className="field">
          <span className="field-label">Select an image</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="file-input"
          />
        </label>

        {previewUrl ? (
          <div className="preview-card">
            <img src={previewUrl} alt="Preview" className="preview-image" />
            <div className="preview-meta">
              <input
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                className="text-input"
                placeholder="File name"
              />
              <button
                type="button"
                onClick={handleUpload}
                className="primary-button"
                disabled={isUploading || !file}
              >
                {isUploading ? 'Uploading...' : ipfsHash ? 'Re-upload hash' : 'Upload to IPFS'}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-preview">
            <p>Drop in a local image to start the encryption flow.</p>
          </div>
        )}

        <div className="hash-card">
          <div>
            <p className="hash-label">IPFS hash</p>
            <p className="hash-value">{ipfsHash || 'Awaiting upload'}</p>
          </div>
          <div>
            <p className="hash-label">Encrypted hash</p>
            <p className="hash-value">{encryptedHash || 'Generated on-chain submission'}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStoreOnChain}
          className="primary-button full-width"
          disabled={!isConfigured || !address || !ipfsHash || isStoring || zamaLoading}
        >
          {zamaLoading ? 'Initializing encryption...' : isStoring ? 'Storing on-chain...' : 'Store on-chain'}
        </button>

        {zamaError ? <p className="panel-error">{zamaError}</p> : null}
        {statusMessage ? <p className="panel-status">{statusMessage}</p> : null}
        {storeSuccess ? (
          <div className="panel-success">
            <p>Entry stored. Switch to the gallery to decrypt when needed.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
