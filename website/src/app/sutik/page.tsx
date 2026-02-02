'use client';

import Link from 'next/link';

export default function SutikPage() {
  return (
    <div className="bg-[#101922] min-h-screen">
      <div className="lg:px-40 flex flex-col items-center py-16">
        <div className="flex flex-col max-w-[900px] w-full px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
            Sütik (cookie) kezelése
          </h1>

          <div className="prose prose-invert prose-lg max-w-none">
            <p className="text-white/70 mb-6">
              A ThermoDesk weboldala sütiket használ a weboldal működtetése, használatának megkönnyítése, a weboldalon végzett tevékenység nyomon követése és releváns ajánlatok megjelenítése érdekében.
            </p>

            <p className="text-white/70 mb-8">
              Kérjük, hogy a dokumentumot figyelmesen olvassa el és csak akkor vegye igénybe a weboldal szolgáltatásait, amennyiben minden pontjával egyetért és azokat Önre (a továbbiakban: Felhasználó) nézve kötelező érvényűnek elfogadja. Felhívjuk figyelmét, hogy jelen szabályzat csak az adott weboldalon történő cookie-kezelésre vonatkozik.
            </p>

            {/* Mi az a Cookie? */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#207D82] mb-4">Mi az a Cookie?</h2>
              <p className="text-white/70">
                A cookie (magyarul &quot;süti&quot;) egy olyan kisméretű adatcsomag, amit az internetes szolgáltatások a böngészőben tárolnak el. A hatékony és modern felhasználói élményt nyújtó online szolgáltatás működéséhez elengedhetetlen technológia, amelyet manapság minden böngésző támogat.
              </p>
            </section>

            {/* Hogyan keletkezik a Cookie? */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#207D82] mb-4">Hogyan keletkezik a Cookie?</h2>
              <p className="text-white/70">
                Először a kliens gép küld egy kérést a kiszolgáló irányába. Ekkor a kiszolgáló létrehoz egy egyedi azonosítót és ezt eltárolja a saját adatbázisában, majd az így létrehozott cookie-t az összes információval visszaküldi a kliensnek. Az így visszakapott információs cookie eltárolódik a kliens gépen.
              </p>
            </section>

            {/* Hogyan hasznosul a Cookie? */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#207D82] mb-4">Hogyan hasznosul a Cookie?</h2>
              <p className="text-white/70">
                Amikor a kliens gép újra kapcsolatba lép a kiszolgálóval már párosítja az előzőleg már létrehozott és eltárolt cookie-t. A kiszolgáló összehasonlítja a kapott és az általa tárolt cookie tartalmát. Ez által könnyedén azonosítja pl. a bejelentkezett regisztrált felhasználót. Enélkül például nem lehetne bejelentkezni egy weboldalra.
              </p>
            </section>

            {/* Milyen sütiket és mire használ a weboldal? */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#207D82] mb-4">Milyen sütiket és mire használ a weboldal?</h2>
              <p className="text-white/70 mb-4">A weboldal a sütiket a következő célokból használja:</p>
              <ul className="list-disc list-inside text-white/70 space-y-2 ml-4">
                <li>weboldalunk fejlesztése,</li>
                <li>az Ön navigációjának megkönnyítése weboldalunkon és az oldal funkcióinak használata során, így biztosítva a zökkenőmentes felhasználói élményt,</li>
                <li>információ gyűjtése azzal kapcsolatban, hogy hogyan használja weboldalunkat - annak felmérésével, hogy weboldalunk melyik részeit látogatja vagy használja leginkább, így megtudhatjuk, hogyan biztosítsunk Önnek még jobb felhasználói élményt, ha ismét meglátogatja oldalunkat,</li>
                <li>böngésző felhasználók megkülönböztetése, azonosítása,</li>
                <li>a weboldalon végzett tevékenységek nyomon követésére azért, hogy általuk még inkább kifejezetten az Önt érdeklő vagy az Ön számára fontos, releváns ajánlatokról üzenetet juttathassunk el az Ön számára.</li>
              </ul>
            </section>

            {/* A sütik típusai */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#F28C38] mb-6">A sütik típusai</h2>

              {/* Alapműködést biztosító sütik */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-[#207D82] mb-3">Alapműködést biztosító sütik</h3>
                <p className="text-white/70 mb-3">
                  Ezen sütik biztosítják a weboldal megfelelő működését, megkönnyítik annak használatát, és látogatóink azonosítása nélkül gyűjtenek információt a használatáról.
                </p>
                <p className="text-white/70 mb-3">
                  Ide tartozik például a sütikezelés elfogadásának státusza, bejelentkezési módok és adatok megjegyzése, weboldal értesítési üzenetek státusza.
                </p>
                <p className="text-white/70 font-medium">
                  Ne feledje, ezen sütik alkalmazása nélkül nem tudjuk garantálni Önnek weboldalunk kényelmes használatát.
                </p>
              </div>

              {/* Statisztikai célú sütik */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-[#207D82] mb-3">Statisztikai célú sütik</h3>
                <p className="text-white/70">
                  Weboldalunk fejlesztésének, valamint a felhasználók számára biztosított élmények javításának céljával olyan sütiket is használunk, melyek lehetővé teszik számunkra, hogy információt gyűjtsünk azzal kapcsolatban, hogyan használják látogatóink weboldalunkat. Ezek a sütik nem tudják Önt személyesen beazonosítani, olyan információkat gyűjtenek, mint pl. hogy melyik oldalt nézte meg a látogatónk, a felhasználó a weboldal mely részére kattintott, hány oldalt keresett fel, milyen hosszú volt az egyes munkamenetek megtekintési ideje, melyek voltak az esetleges hibaüzenetek.
                </p>
              </div>

              {/* Teljesítményt biztosító sütik */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-[#207D82] mb-3">Teljesítményt biztosító sütik</h3>
                <p className="text-white/70 mb-3">
                  Ilyen teljesítményt biztosító sütik a Google Analytics sütijei is. A Google Analytics sütikkel kapcsolatos további tudnivalók érdekében kérjük, kattintson ide:{' '}
                  <a
                    href="https://developers.google.com/analytics/devguides/collection/analyticsjs/cookie-usage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F28C38] hover:underline"
                  >
                    https://developers.google.com/analytics/devguides/collection/analyticsjs/cookie-usage
                  </a>
                </p>
              </div>

              {/* Célzó- és hirdetési sütik */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-[#207D82] mb-3">Célzó- és hirdetési sütik</h3>
                <p className="text-white/70 mb-3">
                  Ezeknek a sütiknek az a célja, hogy általuk még inkább az Önt érdeklő vagy az Ön számára releváns hirdetések jelenjenek meg a weboldalakon. Ezek a sütik az Ön hozzájárulása nélkül nem tudják Önt személyesen beazonosítani, olyan információkat gyűjtenek, mint pl. hogy melyik oldalt nézte meg a látogatónk, a felhasználó a weboldal mely részére kattintott, hány oldalt keresett fel, mindezt az Ön érdeklődésére számot tartó tartalmak megismerése érdekében.
                </p>
                <p className="text-white/70">
                  Amennyiben azonban ehhez hozzájárult, a weboldal használat nyomon követése során összegyűjtött információkat együttesen használhatjuk fel az Ön személyes adataival, annak érdekében, hogy marketing kommunikációnkat még jobban az Ön igényeihez igazíthassuk és az Ön számára minél inkább személyre szabott ajánlatokra hívjuk fel a figyelmét.
                </p>
              </div>
            </section>

            {/* Honlapunkon használt szolgáltatók */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#207D82] mb-4">Honlapunkon az alábbi szolgáltatók sütikeit használjuk:</h2>

              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-white">Cookiebot</h4>
                  <p className="text-white/70">
                    A süti hozzájárulás kezeléséért felelős szolgáltatás. Részletes tájékoztató:{' '}
                    <a
                      href="https://www.cookiebot.com/en/privacy-policy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#F28C38] hover:underline"
                    >
                      https://www.cookiebot.com/en/privacy-policy/
                    </a>
                  </p>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white">Google Analytics</h4>
                  <p className="text-white/70">
                    A szolgáltatással kapcsolatos részletes tájékoztató:{' '}
                    <a
                      href="https://www.google.com/intl/hu/policies/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#F28C38] hover:underline"
                    >
                      https://www.google.com/intl/hu/policies/privacy
                    </a>
                  </p>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white">Vercel Analytics</h4>
                  <p className="text-white/70">
                    A szolgáltatással kapcsolatos részletes tájékoztató:{' '}
                    <a
                      href="https://vercel.com/legal/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#F28C38] hover:underline"
                    >
                      https://vercel.com/legal/privacy-policy
                    </a>
                  </p>
                </div>
              </div>
            </section>

            {/* Hogyan ellenőrizheti és kikapcsolhatja a sütiket? */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#F28C38] mb-4">Hogyan ellenőrizheti és hogyan tudja kikapcsolni a sütiket?</h2>
              <p className="text-white/70 mb-4">
                Minden modern böngésző engedélyezi a sütik beállításának a változtatását. A legtöbb böngésző alapértelmezettként automatikusan elfogadja a sütiket, ezek a beállítások azonban általában megváltoztathatók, így a böngésző meg tudja akadályozni az automatikus elfogadást, és minden alkalommal fel tudja ajánlani a választás lehetőségét, hogy engedélyezi-e a sütiket.
              </p>
              <p className="text-white/70 mb-6">
                Felhívjuk figyelmét, hogy mivel a sütik célja weboldalunk használhatóságának és folyamatainak megkönnyítése vagy lehetővé tétele, a cookie-k alkalmazásának megakadályozása vagy törlése miatt előfordulhat, hogy nem tudja weboldalunk funkcióit teljes körűen használni, illetve hogy a weboldal a tervezettől eltérően fog működni böngészőjében.
              </p>

              <h3 className="text-xl font-semibold text-[#207D82] mb-4">A legnépszerűbb böngészők süti beállításairól az alábbi linkeken tájékozódhat:</h3>
              <ul className="list-disc list-inside text-white/70 space-y-2 ml-4">
                <li>
                  <a
                    href="https://support.google.com/accounts/answer/61416?hl=hu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F28C38] hover:underline"
                  >
                    Google Chrome
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.mozilla.org/hu/kb/sutik-informacio-amelyet-weboldalak-tarolnak-szami"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F28C38] hover:underline"
                  >
                    Firefox
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.microsoft.com/hu-hu/help/17442/windows-internet-explorer-delete-manage-cookies"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F28C38] hover:underline"
                  >
                    Microsoft Internet Explorer
                  </a>
                </li>
                <li>
                  <a
                    href="https://privacy.microsoft.com/hu-hu/windows-10-microsoft-edge-and-privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F28C38] hover:underline"
                  >
                    Microsoft Edge
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.apple.com/hu-hu/guide/safari/manage-cookies-and-website-data-sfri11471/mac"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F28C38] hover:underline"
                  >
                    Safari
                  </a>
                </li>
              </ul>
            </section>

            {/* Süti beállítások */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#207D82] mb-4">Süti beállítások módosítása</h2>
              <p className="text-white/70 mb-4">
                A weboldalunkon használt sütik beállításait bármikor módosíthatja az alábbi gombra kattintva:
              </p>
              <button
                type="button"
                className="px-6 py-3 bg-[#207D82] hover:bg-[#207D82]/80 text-white font-semibold rounded-lg transition-colors"
                onClick={() => {
                  // @ts-expect-error - Cookiebot is loaded externally
                  if (typeof window !== 'undefined' && window.Cookiebot) {
                    // @ts-expect-error - Cookiebot is loaded externally
                    window.Cookiebot.renew();
                  }
                }}
              >
                Süti beállítások módosítása
              </button>
            </section>

            {/* Kapcsolat */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-[#207D82] mb-4">Kapcsolat</h2>
              <p className="text-white/70">
                Amennyiben kérdése van a sütik kezelésével kapcsolatban, kérjük vegye fel velünk a kapcsolatot a{' '}
                <a href="mailto:info@thermodesk.eu" className="text-[#F28C38] hover:underline">
                  info@thermodesk.eu
                </a>
                {' '}e-mail címen.
              </p>
            </section>

            {/* Utolsó módosítás */}
            <p className="text-white/50 text-sm mt-12">
              Utolsó módosítás: 2025. február 2.
            </p>

            {/* Vissza link */}
            <div className="mt-8">
              <Link
                href="/"
                className="inline-flex items-center text-[#F28C38] hover:text-[#F28C38]/80 transition-colors"
              >
                <span className="material-symbols-outlined mr-2">arrow_back</span>
                Vissza a főoldalra
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
