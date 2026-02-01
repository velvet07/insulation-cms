import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <div className="hero-wrapper">
        <section className="hero">
          <div className="hero-content">
            <div className="hero-icon">
              <span className="material-symbols-outlined">hvac</span>
            </div>
            <h1>
              <span className="text-primary">ThermoDesk</span> – A profi szigetelők digitális társa
            </h1>
            <p className="subtitle">
              Modernizálja munkafolyamatait az ajánlattételtől a kivitelezésig. Kevesebb adminisztráció, több elvégzett munka.
            </p>
            <p className="coming-soon">Digital survey sheet coming soon</p>
            <div className="hero-buttons">
              <Link href="#funkciok" className="btn btn-primary btn-lg">Megoldásaink</Link>
              <Link href="#elonyok" className="btn btn-secondary btn-lg">Részletek</Link>
            </div>
          </div>
        </section>
      </div>

      {/* Features Section */}
      <section id="funkciok">
        <div className="container">
          <h2 className="section-title">Minden, amire egy szigetelő vállalkozónak szüksége van</h2>
          <p className="section-subtitle">Optimalizált modulok a hatékony és hibamentes munkavégzéshez.</p>
          <div className="cards">
            <div className="card">
              <div className="card-icon">
                <span className="material-symbols-outlined">description</span>
              </div>
              <div>
                <h3>Egyszerűbb papírmunka</h3>
                <p>Kevesebb szkennelés, digitális adatbevitel és automatizált nyomtatványok.</p>
              </div>
            </div>
            <div className="card">
              <div className="card-icon">
                <span className="material-symbols-outlined">inventory_2</span>
              </div>
              <div>
                <h3>Anyaggazdálkodás</h3>
                <p>Pontos készletnyilvántartás és előrehaladott anyagtervezés minden projekthez.</p>
              </div>
            </div>
            <div className="card">
              <div className="card-icon">
                <span className="material-symbols-outlined">fact_check</span>
              </div>
              <div>
                <h3>Audit és jóváhagyás</h3>
                <p>Gyors és egyszerű projekt auditálás. Jóváhagyás közvetlenül a felületen.</p>
              </div>
            </div>
            <div className="card">
              <div className="card-icon">
                <span className="material-symbols-outlined">assignment_turned_in</span>
              </div>
              <div>
                <h3>Teljesítési igazolások</h3>
                <p>Automatikus generálás az alvállalkozók számára a munka befejeztével.</p>
              </div>
            </div>
            <div className="card">
              <div className="card-icon">
                <span className="material-symbols-outlined">folder_zip</span>
              </div>
              <div>
                <h3>ZIP export struktúra</h3>
                <p>Audit-kész mappaszerkezetben exportált dokumentáció egy kattintással.</p>
              </div>
            </div>
            <div className="card">
              <div className="card-icon">
                <span className="material-symbols-outlined">add_a_photo</span>
              </div>
              <div>
                <h3>Strukturált fotók</h3>
                <p>Rendszerezett feltöltés és kötelező fotók készítése a beküldés előtt.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contractor Section */}
      <div className="contractor-section" id="vallalkozok">
        <div className="container">
          <h2 className="contractor-title">
            <span className="text-secondary">Fővállalkozói</span> Megoldások
          </h2>
          <div className="contractor-card-wrap">
            <div className="contractor-image" />
            <div className="contractor-content">
              <span className="tag">Menedzsment</span>
              <h3>Alvállalkozók precíz követése</h3>
              <p>
                Minden beküldés előtt kötelező a teljes dokumentáció: fotók, mérések és aláírások. Nincs több hiányos projekt, csak audit-kész munkák.
              </p>
              <div className="flex gap-4">
                <Link href="#funkciok" className="btn btn-primary">Megoldásaink</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Why Section */}
      <section className="why-section" id="elonyok">
        <h2 className="section-title">Miért a <span style={{ color: '#F28C38' }}>Thermo</span><span style={{ color: '#207D82' }}>Desk</span>?</h2>
        <p className="section-subtitle">A szigetelőipar speciális igényeire szabva.</p>
        <div className="why-cards">
          <div className="why-card">
            <span className="material-symbols-outlined">hub</span>
            <h4>Centralizált Adatok</h4>
            <p>Minden projekt, ügyféladat és mérési jegyzőkönyv egyetlen, biztonságos felhő alapú helyen érhető el bárhonnan.</p>
          </div>
          <div className="why-card">
            <span className="material-symbols-outlined">verified_user</span>
            <h4>Kötelező beküldés</h4>
            <p>A rendszer megköveteli a teljes dokumentációt a beküldés előtt, így elkerülhetők a későbbi hiánypótlások.</p>
          </div>
          <div className="why-card">
            <span className="material-symbols-outlined">verified</span>
            <h4>Minőségbiztosítás</h4>
            <p>Kötelező ellenőrző listák és strukturált fotók készítése a munkafolyamat kritikus fázisaiban a hibátlan kivitelezésért.</p>
          </div>
        </div>
      </section>
    </>
  );
}
