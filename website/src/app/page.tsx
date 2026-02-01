import Link from 'next/link';

// Feature card icons
const FolderIcon = () => (
  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
  </svg>
);

const DocumentIcon = () => (
  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
  </svg>
);

const CubeIcon = () => (
  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
  </svg>
);

const LayoutIcon = () => (
  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
  </svg>
);

const DownloadIcon = () => (
  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
  </svg>
);

const ShieldIcon = () => (
  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
  </svg>
);

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <h1>ThermoDesk – Padlásfödém szigetelés, egy helyen</h1>
        <p className="subtitle">
          Szoftver a padlásfödém szigetelési projektek kezeléséhez, dokumentációjához és anyaggazdálkodásához. Fővállalkozóknak és alvállalkozóknak egyaránt.
        </p>
        <div className="hero-buttons">
          <Link href="/demo" className="btn btn-primary btn-lg">Demó kérése</Link>
          <Link href="#funkciok" className="btn btn-secondary btn-lg">Részletek</Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="funkciok">
        <h2 className="section-title">Minden, amire egy szigetelő vállalkozónak szüksége van</h2>
        <p className="section-subtitle">Hatékonyabb munkavégzés, kevesebb adminisztráció, digitális pontosság.</p>
        <div className="cards container">
          <div className="card">
            <FolderIcon />
            <h3>Projektkezelés</h3>
            <p>
              Projektek egy helyen: ügyfél adatok, cím, terület (m²), státusz – áttekinthető táblázatban.
              Státusz követés: függőben → folyamatban → átnézésre vár → jóváhagyva → befejezve.
              Keresés és szűrés név, cím, státusz és tulajdonos szerint.
            </p>
          </div>
          <div className="card">
            <DocumentIcon />
            <h3>Dokumentumok és aláírás</h3>
            <p>
              Dokumentum generálás sablonokból PDF-ben projekthez – felmérőlap, szerződések, nyilatkozatok.
              Digitális aláírás böngészőben, tableten – aláírod, a rendszer menti.
              Scannelt dokumentumok feltöltése PDF vagy kép formátumban.
            </p>
          </div>
          <div className="card">
            <CubeIcon />
            <h3>Anyaggazdálkodás</h3>
            <p>
              Készlet / egyenleg anyagtípusonként (paletta, tekercs) – látható, ki mit vett fel és hol áll az egyenleg.
              Anyagfelvétel rögzítése: felvétel dátuma, anyag, mennyiség.
              Riasztás: negatív egyenleg kiemelése.
            </p>
          </div>
        </div>
      </section>

      {/* Contractor Section */}
      <section className="contractor-section" id="fovallalkozoknak">
        <div className="container">
          <h2 className="section-title">Fővállalkozói Megoldások</h2>
        </div>
        <div className="contractor-wrap container">
          <div className="chart-placeholder">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
              <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 16l4-8 4 4 6-10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="contractor-card">
            <span className="tag">Menedzsment</span>
            <h2>Alvállalkozók hatékony követése</h2>
            <p>
              Lássa át a teljes munkafolyamatot egyetlen felületen.
              Projektek szűrése tulajdonos szerint: saját projektek és alvállalkozók projektjei külön-külön vagy együtt.
              Anyagok alvállalkozónként; jóváhagyott projektek listája, csoportos befejezés.
              Egy helyen a teljes lánc: projektek, dokumentumok, fotók, anyagmozgás.
            </p>
            <div className="contractor-buttons">
              <Link href="/megoldasaink" className="btn btn-primary">Megoldásaink</Link>
              <Link href="/video" className="btn btn-secondary">Bemutató videó</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section className="why-section" id="elonyok">
        <h2 className="section-title">Miért a ThermoDesk?</h2>
        <p className="section-subtitle">A szigetelőipar speciális igényeire szabva.</p>
        <div className="cards container">
          <div className="card">
            <LayoutIcon />
            <h3>Egy rendszer</h3>
            <p>
              Projektek, dokumentumok, fotók, anyag – nem szétszórt táblázatok és mappák.
              Minden egy helyen, biztonságos felhő alapú környezetben, bárhonnan elérhetően.
            </p>
          </div>
          <div className="card">
            <DownloadIcon />
            <h3>Egykattintásos Export</h3>
            <p>
              Több projekt anyaga egy ZIP-ben, előre rögzített mappastruktúrával – gyors leadás, audit.
              Generáljon audit-kész ZIP csomagokat minden dokumentumból, fotóból és aláírásból.
            </p>
          </div>
          <div className="card">
            <ShieldIcon />
            <h3>Fővállalkozó és alvállalkozó</h3>
            <p>
              Mindkét oldal ugyanabban a környezetben dolgozik; a fővállalkozó átlátja az alvállalkozóit.
              Dokumentum és aláírás: generálás, feltöltés, aláírás – auditor- és leadásbarát struktúrával.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="hogyan" style={{ textAlign: 'center', paddingBottom: '6rem' }}>
        <h2 className="section-title">Készen áll a hatékonyabb munkára?</h2>
        <p className="section-subtitle">
          Próbálja ki a ThermoDesk-et 14 napig ingyen, kötelezettségek nélkül.
        </p>
        <div className="hero-buttons">
          <Link href="/demo" className="btn btn-primary btn-lg">Ingyenes próba indítása</Link>
          <Link href="/kapcsolat" className="btn btn-secondary btn-lg">Kapcsolatfelvétel</Link>
        </div>
      </section>
    </>
  );
}
