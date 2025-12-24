import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <p className="header-eyebrow">Encrypted archive</p>
            <h1 className="header-title">Obscure Gallery</h1>
            <p className="header-subtitle">
              Encrypt image references with a one-time address, then store them on-chain for controlled reveal.
            </p>
          </div>
          <div className="header-actions">
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
