export const metadata = {
  title: 'Adatkezelési tájékoztató – ThermoDesk',
};

export default function PrivacyPage() {
  return (
    <>
      <div className="page-hero">
        <h1>Adatkezelési tájékoztató</h1>
        <p>Hatályos: 2024. január 1-től</p>
      </div>

      <div className="page-content">
        <h2>1. Adatkezelő</h2>
        <p>
          ThermoDesk Kft.<br />
          Székhely: [Cím]<br />
          Email: info@thermodesk.hu
        </p>

        <h2>2. Kezelt adatok köre</h2>
        <p>A weboldal működése során az alábbi személyes adatokat kezeljük:</p>
        <ul>
          <li>Név, email cím (demó kérés, kapcsolatfelvétel esetén)</li>
          <li>Cégnév, telefonszám (opcionális)</li>
          <li>Technikai adatok (IP cím, böngésző típusa)</li>
        </ul>

        <h2>3. Adatkezelés célja</h2>
        <ul>
          <li>Szolgáltatásaink bemutatása és értékesítése</li>
          <li>Ügyfélkapcsolat-tartás</li>
          <li>Hírlevél küldése (hozzájárulás esetén)</li>
        </ul>

        <h2>4. Adatkezelés jogalapja</h2>
        <p>
          Az adatkezelés az érintett hozzájárulásán (GDPR 6. cikk (1) bekezdés a) pont),
          illetve jogos érdeken alapul (GDPR 6. cikk (1) bekezdés f) pont).
        </p>

        <h2>5. Adatok tárolásának időtartama</h2>
        <p>
          A személyes adatokat a cél megvalósulásáig, de legfeljebb a hozzájárulás
          visszavonásáig kezeljük.
        </p>

        <h2>6. Az érintett jogai</h2>
        <ul>
          <li>Hozzáférési jog</li>
          <li>Helyesbítéshez való jog</li>
          <li>Törléshez való jog</li>
          <li>Adatkezelés korlátozásához való jog</li>
          <li>Adathordozhatósághoz való jog</li>
          <li>Tiltakozáshoz való jog</li>
        </ul>

        <h2>7. Kapcsolat</h2>
        <p>
          Adatkezeléssel kapcsolatos kérdéseivel forduljon hozzánk:
          info@thermodesk.hu
        </p>
      </div>
    </>
  );
}
