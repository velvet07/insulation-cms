export const metadata = {
  title: 'Általános Szerződési Feltételek – ThermoDesk',
};

export default function TermsPage() {
  return (
    <>
      <div className="page-hero">
        <h1>Általános Szerződési Feltételek</h1>
        <p>Hatályos: 2024. január 1-től</p>
      </div>

      <div className="page-content">
        <h2>1. Szolgáltató adatai</h2>
        <p>
          Cégnév: ThermoDesk Kft.<br />
          Székhely: [Cím]<br />
          Cégjegyzékszám: [Szám]<br />
          Adószám: [Szám]<br />
          Email: info@thermodesk.hu
        </p>

        <h2>2. A szolgáltatás leírása</h2>
        <p>
          A ThermoDesk egy felhő alapú szoftver (SaaS), amely padlásfödém szigetelési
          projektek kezelésére, dokumentálására és anyaggazdálkodására szolgál.
        </p>

        <h2>3. Felhasználási feltételek</h2>
        <p>
          A szolgáltatás igénybevétele regisztrációhoz kötött. A felhasználó köteles
          valós adatokat megadni és azokat naprakészen tartani.
        </p>

        <h2>4. Díjszabás és fizetés</h2>
        <p>
          A szolgáltatás díjait az aktuális árlista tartalmazza. A díjak
          előre fizetendők, havi vagy éves számlázási ciklusokban.
        </p>

        <h2>5. Felelősség</h2>
        <p>
          A szolgáltató törekszik a folyamatos és hibamentes működésre, de nem
          vállal felelősséget a szolgáltatás esetleges kimaradásaiért.
        </p>

        <h2>6. Adatvédelem</h2>
        <p>
          A személyes adatok kezelésére vonatkozó információkat az Adatkezelési
          tájékoztató tartalmazza.
        </p>

        <h2>7. Szerződés megszűnése</h2>
        <p>
          A felhasználó bármikor törölheti fiókját. A szolgáltató jogosult a
          szerződést azonnali hatállyal felmondani szerződésszegés esetén.
        </p>

        <h2>8. Záró rendelkezések</h2>
        <p>
          Jelen ÁSZF-ben nem szabályozott kérdésekben a magyar jog az irányadó.
          Jogvita esetén a felek a magyar bíróságok illetékességét kötik ki.
        </p>
      </div>
    </>
  );
}
