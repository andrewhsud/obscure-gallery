import { useState } from 'react';
import { Header } from './Header';
import { UploadPanel } from './UploadPanel';
import { GalleryList } from './GalleryList';
import '../styles/GalleryApp.css';

export function GalleryApp() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="gallery-app">
      <Header />
      <main className="gallery-main">
        <section className="gallery-hero">
          <div>
            <p className="hero-label">Private by default</p>
            <h2 className="hero-title">Turn every upload into a sealed vault.</h2>
            <p className="hero-description">
              Each file gets a fresh address that encrypts its IPFS hash. The address is sealed with Zama FHE, so
              only the uploader can reveal the original hash later.
            </p>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-label">Encrypted artifacts</span>
              <span className="stat-value">IPFS hash + FHE address</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Reveal flow</span>
              <span className="stat-value">User-controlled decrypt</span>
            </div>
          </div>
        </section>

        <div className="gallery-panels">
          <UploadPanel onStored={() => setRefreshKey((prev) => prev + 1)} />
          <GalleryList refreshKey={refreshKey} />
        </div>
      </main>
    </div>
  );
}
