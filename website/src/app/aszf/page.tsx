import Link from 'next/link';

export const metadata = {
  title: 'Általános Szerződési Feltételek (ÁSZF) – ThermoDesk',
  description: 'ThermoDesk SaaS alkalmazás általános szerződési feltételei.',
};

export default function AszfPage() {
  return (
    <div className="lg:px-40 flex flex-1 justify-center py-12">
      <div className="flex flex-col max-w-[900px] flex-1 px-4">
        <h1 className="text-white text-4xl font-black mb-4">Általános Szerződési Feltételek (ÁSZF)</h1>
        <p className="text-white/50 mb-8">thermodesk.eu | Hatályos: 2025. február 1-től</p>

        <div className="space-y-6 text-white/80 leading-relaxed">

          {/* Tartalomjegyzék */}
          <div className="bg-[#1c2127] p-6 rounded-xl border border-white/10 mb-8">
            <h2 className="text-white text-xl font-bold mb-4">Tartalomjegyzék</h2>
            <ol className="list-decimal pl-6 space-y-1 text-[#207D82]">
              <li><a href="#preambulum" className="hover:text-[#F28C38]">Preambulum</a></li>
              <li><a href="#szolgaltato" className="hover:text-[#F28C38]">A Szolgáltató adatai</a></li>
              <li><a href="#fogalmak" className="hover:text-[#F28C38]">Fogalmak</a></li>
              <li><a href="#szolgaltatas" className="hover:text-[#F28C38]">A Szolgáltatás leírása</a></li>
              <li><a href="#regisztracio" className="hover:text-[#F28C38]">Regisztráció és fiókkezelés</a></li>
              <li><a href="#arazas" className="hover:text-[#F28C38]">Árazás és fizetési feltételek</a></li>
              <li><a href="#felhasznalasi" className="hover:text-[#F28C38]">Felhasználási feltételek</a></li>
              <li><a href="#szellemi" className="hover:text-[#F28C38]">Szellemi tulajdon</a></li>
              <li><a href="#felelosseg" className="hover:text-[#F28C38]">Felelősség korlátozása</a></li>
              <li><a href="#adatvedelem" className="hover:text-[#F28C38]">Adatvédelem</a></li>
              <li><a href="#megszunes" className="hover:text-[#F28C38]">Szerződés megszűnése</a></li>
              <li><a href="#panasz" className="hover:text-[#F28C38]">Panaszkezelés és jogérvényesítés</a></li>
              <li><a href="#zaro" className="hover:text-[#F28C38]">Záró rendelkezések</a></li>
            </ol>
          </div>

          {/* 1. Preambulum */}
          <section id="preambulum">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">1. Preambulum</h2>
            <p>
              Üdvözöljük a ThermoDesk weboldalán! Köszönjük, hogy szolgáltatásunk igénybevétele során bennünket tisztel meg bizalmával!
            </p>
            <p className="mt-4">
              Kérjük, hogy a szolgáltatás igénybevétele előtt figyelmesen olvassa el a jelen dokumentumot, mert a regisztráció
              véglegesítésével Ön elfogadja a jelen ÁSZF tartalmát!
            </p>
            <p className="mt-4">
              Ha a jelen Általános Szerződési Feltételekkel, a szolgáltatás használatával kapcsolatban kérdése merült fel,
              vagy amennyiben egyedi igényét szeretné velünk megbeszélni, úgy kérjük, vegye fel munkatársunkkal a kapcsolatot
              a megadott elérhetőségeken!
            </p>
          </section>

          {/* 2. Szolgáltató adatai */}
          <section id="szolgaltato">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">2. A Szolgáltató adatai</h2>
            <div className="bg-[#1c2127] p-6 rounded-xl border border-white/10">
              <ul className="space-y-2">
                <li><strong className="text-white">Név:</strong> Milos Róbert e.v.</li>
                <li><strong className="text-white">Székhely:</strong> 3524 Miskolc, Mednyánszky u. 5 8/2.</li>
                <li><strong className="text-white">Levelezési cím:</strong> 3524 Miskolc, Mednyánszky u. 5 8/2.</li>
                <li><strong className="text-white">Nyilvántartásba vevő hatóság:</strong> Borsod-Abaúj-Zemplén Megyei Kormányhivatal Miskolci Járási Hivatala</li>
                <li><strong className="text-white">Egyéni vállalkozói nyilvántartási szám:</strong> 52707131</li>
                <li><strong className="text-white">Adószám:</strong> 66364591-1-25</li>
                <li><strong className="text-white">Képviselő:</strong> Milos Róbert</li>
                <li><strong className="text-white">E-mail:</strong> <a href="mailto:info@thermodesk.eu" className="text-[#207D82] hover:text-[#F28C38]">info@thermodesk.eu</a></li>
                <li><strong className="text-white">Honlap:</strong> <a href="https://thermodesk.eu" className="text-[#207D82] hover:text-[#F28C38]">thermodesk.eu</a></li>
              </ul>
            </div>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">Technikai szolgáltatók</h3>
            <div className="space-y-4">
              <div className="bg-[#1c2127] p-4 rounded-xl border border-white/10">
                <p><strong className="text-white">Tárhelyszolgáltató:</strong> Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA)</p>
              </div>
              <div className="bg-[#1c2127] p-4 rounded-xl border border-white/10">
                <p><strong className="text-white">Adatbázis szolgáltató:</strong> Supabase Inc. (970 Toa Payoh North #07-04, Singapore 318992)</p>
              </div>
              <div className="bg-[#1c2127] p-4 rounded-xl border border-white/10">
                <p><strong className="text-white">E-mail szolgáltató:</strong> Resend Inc.</p>
              </div>
            </div>
          </section>

          {/* 3. Fogalmak */}
          <section id="fogalmak">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">3. Fogalmak</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Felek:</strong> Szolgáltató és Felhasználó együttesen</li>
              <li><strong className="text-white">Felhasználó/Ön:</strong> A Szolgáltatást igénybe vevő természetes vagy jogi személy, aki regisztrál és szerződést köt</li>
              <li><strong className="text-white">Szolgáltatás:</strong> A ThermoDesk felhő alapú szoftver (SaaS) alkalmazás és kapcsolódó szolgáltatások</li>
              <li><strong className="text-white">SaaS (Software as a Service):</strong> Felhő alapú szoftverszolgáltatás, amely internetkapcsolaton keresztül érhető el</li>
              <li><strong className="text-white">Fiók:</strong> A Felhasználó egyedi hozzáférése a Szolgáltatáshoz, amely e-mail címhez és jelszóhoz kötött</li>
              <li><strong className="text-white">Előfizetés:</strong> A Szolgáltatás használatára vonatkozó időszakos jogosultság</li>
              <li><strong className="text-white">Projekt:</strong> A Szolgáltatásban létrehozott szigetelési munka egység</li>
              <li><strong className="text-white">Felhasználói tartalom:</strong> A Felhasználó által a Szolgáltatásba feltöltött adatok, dokumentumok, képek</li>
            </ul>
          </section>

          {/* 4. Szolgáltatás leírása */}
          <section id="szolgaltatas">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">4. A Szolgáltatás leírása</h2>
            <p>
              A ThermoDesk egy felhő alapú szoftver (SaaS), amely padlásfödém szigetelési projektek kezelésére,
              dokumentálására és anyaggazdálkodására szolgál. A Szolgáltatás főbb funkciói:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Projektek létrehozása és kezelése</li>
              <li>Anyaggazdálkodás és készletnyilvántartás</li>
              <li>Dokumentumkezelés és strukturált fotók feltöltése</li>
              <li>Audit és jóváhagyási folyamatok</li>
              <li>Teljesítési igazolások generálása</li>
              <li>ZIP export audit-kész mappaszerkezetben</li>
              <li>Alvállalkozók kezelése és követése</li>
              <li>Jelentések és statisztikák</li>
            </ul>
            <p className="mt-4">
              A Szolgáltatás internet-hozzáféréssel rendelkező eszközökön (számítógép, tablet, okostelefon) érhető el
              modern webböngészőn keresztül. A Szolgáltató törekszik a folyamatos és zavartalan működés biztosítására,
              de nem garantálja a 100%-os rendelkezésre állást.
            </p>
          </section>

          {/* 5. Regisztráció */}
          <section id="regisztracio">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">5. Regisztráció és fiókkezelés</h2>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">5.1. Regisztráció</h3>
            <p>
              A Szolgáltatás igénybevétele regisztrációhoz kötött. A regisztráció során a Felhasználó köteles valós
              és pontos adatokat megadni. A Szolgáltató fenntartja a jogot, hogy a regisztrációt visszautasítsa vagy
              a fiókot felfüggessze, amennyiben a megadott adatok valótlannak bizonyulnak.
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">5.2. Fiókbiztonság</h3>
            <p>
              A Felhasználó felelős a fiókjához tartozó bejelentkezési adatok bizalmas kezeléséért. A Felhasználó
              köteles haladéktalanul értesíteni a Szolgáltatót, amennyiben a fiókjához illetéktelen hozzáférés
              történt vagy annak gyanúja merült fel.
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">5.3. Felhasználói szerepkörök</h3>
            <p>
              A Szolgáltatás különböző felhasználói szerepköröket támogat (pl. adminisztrátor, fővállalkozó,
              alvállalkozó). Az egyes szerepkörökhöz eltérő jogosultságok tartoznak, amelyeket a rendszer
              adminisztrátora állíthat be.
            </p>
          </section>

          {/* 6. Árazás */}
          <section id="arazas">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">6. Árazás és fizetési feltételek</h2>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">6.1. Egyedi árajánlat</h3>
            <div className="bg-[#207D82]/10 border border-[#207D82]/30 p-6 rounded-xl">
              <p>
                <strong className="text-white">A ThermoDesk szolgáltatás díjazása egyedi árajánlat alapján történik.</strong>{' '}
                Az árajánlat a Felhasználó igényeinek felmérése után kerül kialakításra, figyelembe véve:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-3">
                <li>A felhasználók számát</li>
                <li>A várható projektek mennyiségét</li>
                <li>Az igényelt funkciókat és modulokat</li>
                <li>Az egyedi testreszabási igényeket</li>
                <li>A támogatási szint igényét</li>
              </ul>
            </div>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">6.2. Fizetési feltételek</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>A szolgáltatási díj előre fizetendő, havi vagy éves számlázási ciklusokban az egyedi megállapodás szerint.</li>
              <li>A Szolgáltató elektronikus számlát állít ki, amelyet e-mailben küld meg a Felhasználónak.</li>
              <li>A fizetési határidő a számla kiállításától számított 8 nap, eltérő megállapodás hiányában.</li>
              <li>Késedelmes fizetés esetén a Szolgáltató jogosult a Szolgáltatás felfüggesztésére.</li>
            </ul>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">6.3. Árváltoztatás</h3>
            <p>
              A Szolgáltató fenntartja a jogot az árak módosítására. Az árváltozásról a Szolgáltató legalább 30 nappal
              korábban értesíti a Felhasználót. Az árváltozás a következő számlázási ciklustól lép hatályba.
            </p>
          </section>

          {/* 7. Felhasználási feltételek */}
          <section id="felhasznalasi">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">7. Felhasználási feltételek</h2>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">7.1. Megengedett használat</h3>
            <p>A Felhasználó jogosult a Szolgáltatást a szerződésben meghatározott célra, a szerződött felhasználószámmal használni.</p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">7.2. Tiltott tevékenységek</h3>
            <p>A Felhasználó nem jogosult:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>A Szolgáltatást jogsértő célra használni</li>
              <li>A Szolgáltatás működését megzavarni vagy megakadályozni</li>
              <li>A Szolgáltatáshoz kapcsolódó biztonsági intézkedéseket megkerülni</li>
              <li>A Szolgáltatást harmadik félnek továbbértékesíteni vagy bérbe adni</li>
              <li>A Szolgáltatás forráskódját visszafejteni vagy módosítani</li>
              <li>Vírusokat vagy más káros kódokat feltölteni</li>
              <li>Más felhasználók adataihoz jogosulatlanul hozzáférni</li>
            </ul>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">7.3. Felhasználói tartalom</h3>
            <p>
              A Felhasználó által feltöltött tartalom (adatok, dokumentumok, képek) a Felhasználó tulajdonában marad.
              A Felhasználó felelős azért, hogy a feltöltött tartalom ne sértsen harmadik fél jogait, és megfeleljen
              a vonatkozó jogszabályoknak.
            </p>
          </section>

          {/* 8. Szellemi tulajdon */}
          <section id="szellemi">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">8. Szellemi tulajdon</h2>
            <p>
              A Szolgáltatás, beleértve annak szoftverét, dizájnját, logóját, szöveges tartalmait és egyéb elemeit,
              a Szolgáltató szellemi tulajdonát képezi, és a szerzői jogi törvények védelme alatt áll.
            </p>
            <p className="mt-4">
              A Felhasználó nem jogosult a Szolgáltatás vagy annak bármely részének másolására, módosítására,
              terjesztésére, nyilvánosságra hozatalára a Szolgáltató előzetes írásbeli engedélye nélkül.
            </p>
            <p className="mt-4">
              A ThermoDesk név és logó a Szolgáltató védjegye. A védjegy használata kizárólag a Szolgáltató
              előzetes írásbeli engedélyével lehetséges.
            </p>
          </section>

          {/* 9. Felelősség */}
          <section id="felelosseg">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">9. Felelősség korlátozása</h2>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">9.1. Szolgáltatás rendelkezésre állása</h3>
            <p>
              A Szolgáltató törekszik a folyamatos és hibamentes működésre, de nem garantálja a Szolgáltatás
              megszakítás nélküli vagy hibamentes működését. A Szolgáltató nem vállal felelősséget:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Karbantartási munkák miatti átmeneti leállásokért</li>
              <li>Harmadik fél szolgáltatásainak (internet, cloud szolgáltatók) hibáiért</li>
              <li>Vis maior eseményekért (természeti katasztrófa, háború, sztrájk stb.)</li>
            </ul>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">9.2. Adatvesztés</h3>
            <p>
              A Szolgáltató rendszeres biztonsági mentéseket készít, azonban nem vállal felelősséget a Felhasználói
              tartalom elvesztéséért vagy sérüléséért. A Felhasználó felelős saját adatainak rendszeres mentéséért.
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">9.3. Kártérítés korlátozása</h3>
            <p>
              A Szolgáltató felelőssége a Felhasználó felé a jelen szerződésből eredő bármely kárért nem haladhatja
              meg a Felhasználó által az adott évben fizetett szolgáltatási díj összegét. A Szolgáltató nem felel
              közvetett károkért, elmaradt haszonért vagy következményi károkért.
            </p>
          </section>

          {/* 10. Adatvédelem */}
          <section id="adatvedelem">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">10. Adatvédelem</h2>
            <p>
              A személyes adatok kezelésére vonatkozó részletes információkat az{' '}
              <Link href="/adatkezeles" className="text-[#207D82] hover:text-[#F28C38] underline">
                Adatvédelmi Tájékoztató
              </Link>{' '}
              tartalmazza, amely a jelen ÁSZF elválaszthatatlan részét képezi.
            </p>
            <p className="mt-4">
              A Szolgáltató az Európai Unió Általános Adatvédelmi Rendeletének (GDPR) megfelelően kezeli a
              Felhasználók személyes adatait.
            </p>
          </section>

          {/* 11. Megszűnés */}
          <section id="megszunes">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">11. Szerződés megszűnése</h2>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">11.1. Felmondás a Felhasználó részéről</h3>
            <p>
              A Felhasználó a szerződést a számlázási időszak végére mondhatja fel, legalább 30 napos felmondási
              idővel. A felmondást írásban (e-mailben) kell közölni.
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">11.2. Felmondás a Szolgáltató részéről</h3>
            <p>A Szolgáltató jogosult a szerződést azonnali hatállyal felmondani, amennyiben a Felhasználó:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Súlyosan megszegi a jelen ÁSZF rendelkezéseit</li>
              <li>A fizetési kötelezettségével 30 napot meghaladó késedelembe esik</li>
              <li>A Szolgáltatást jogsértő célra használja</li>
            </ul>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">11.3. Adatok kezelése megszűnéskor</h3>
            <p>
              A szerződés megszűnését követően a Felhasználó 30 napig hozzáférhet adataihoz és exportálhatja azokat.
              Ezt követően a Szolgáltató jogosult az adatok törlésére, kivéve, ha jogszabály hosszabb megőrzési
              időt ír elő.
            </p>
          </section>

          {/* 12. Panaszkezelés */}
          <section id="panasz">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">12. Panaszkezelés és jogérvényesítés</h2>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">12.1. Panaszbejelentés</h3>
            <p>A Felhasználó a Szolgáltatással kapcsolatos panaszait az alábbi elérhetőségeken terjesztheti elő:</p>
            <div className="bg-[#1c2127] p-4 rounded-xl border border-white/10 mt-2">
              <p>E-mail: <a href="mailto:info@thermodesk.eu" className="text-[#207D82] hover:text-[#F28C38]">info@thermodesk.eu</a></p>
              <p>Weboldal: <a href="https://thermodesk.eu" className="text-[#207D82] hover:text-[#F28C38]">thermodesk.eu</a></p>
              <p>Cím: 3524 Miskolc, Mednyánszky u. 5 8/2.</p>
            </div>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">12.2. Panaszkezelési eljárás</h3>
            <p>
              Az írásbeli panaszt a Szolgáltató a beérkezését követően 30 napon belül köteles írásban érdemben
              megválaszolni. A panaszt elutasító álláspontját a Szolgáltató indokolni köteles.
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">12.3. Békéltető testület</h3>
            <p>
              Amennyiben a fogyasztói jogvita a tárgyalások során nem rendeződik, a fogyasztó jogosult a lakóhelye
              vagy tartózkodási helye szerint illetékes Békéltető Testülethez fordulni.
            </p>
            <div className="bg-[#1c2127] p-4 rounded-xl border border-white/10 mt-2">
              <p className="font-bold text-white">Borsod-Abaúj-Zemplén Vármegyei Békéltető Testület</p>
              <p>Cím: 3525 Miskolc, Szentpáli u. 1.</p>
              <p>Telefon: +36 46 501 091</p>
              <p>E-mail: bekeltetes@bokik.hu</p>
            </div>
            <p className="mt-4">
              További információ a békéltető testületekről:{' '}
              <a href="https://bekeltetes.hu" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">
                bekeltetes.hu
              </a>
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">12.4. Felügyeleti hatóság</h3>
            <p>
              Fogyasztóvédelmi ügyekben a fogyasztó a lakóhelye szerint illetékes járási hivatalhoz fordulhat.
              Információ:{' '}
              <a href="https://jarasinfo.gov.hu" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">
                jarasinfo.gov.hu
              </a>
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">12.5. Bírósági eljárás</h3>
            <p>
              A Felhasználó jogosult a fogyasztói jogvitából származó követelésének bíróság előtti érvényesítésére
              polgári eljárás keretében a Polgári Törvénykönyvről szóló 2013. évi V. törvény, valamint a Polgári
              Perrendtartásról szóló 2016. évi CXXX. törvény rendelkezései szerint.
            </p>
          </section>

          {/* 13. Záró rendelkezések */}
          <section id="zaro">
            <h2 className="text-white text-2xl font-bold mt-10 mb-4">13. Záró rendelkezések</h2>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">13.1. Vonatkozó jogszabályok</h3>
            <p>A jelen ÁSZF-ben nem szabályozott kérdésekben különösen az alábbi jogszabályok az irányadók:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>2013. évi V. törvény a Polgári Törvénykönyvről</li>
              <li>2001. évi CVIII. törvény az elektronikus kereskedelmi szolgáltatásokról</li>
              <li>1997. évi CLV. törvény a fogyasztóvédelemről</li>
              <li>2011. évi CXII. törvény az információs önrendelkezési jogról</li>
              <li>2016/679/EU rendelet (GDPR) a személyes adatok védelméről</li>
            </ul>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">13.2. Szerződés nyelve</h3>
            <p>A jelen ÁSZF hatálya alá tartozó szerződések nyelve a magyar nyelv.</p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">13.3. Részleges érvénytelenség</h3>
            <p>
              Amennyiben a jelen ÁSZF valamely rendelkezése érvénytelen vagy végrehajthatatlan, az nem érinti a
              többi rendelkezés érvényességét.
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">13.4. Módosítás</h3>
            <p>
              A Szolgáltató fenntartja a jogot a jelen ÁSZF módosítására. A módosításról a Szolgáltató legalább
              15 nappal korábban értesíti a Felhasználókat e-mailben. A módosított ÁSZF a közzétételtől számított
              15. napon lép hatályba.
            </p>

            <h3 className="text-white text-xl font-bold mt-6 mb-3">13.5. Elérhetőség</h3>
            <p>
              A mindenkor hatályos ÁSZF elérhető a{' '}
              <a href="https://thermodesk.eu/aszf" className="text-[#207D82] hover:text-[#F28C38]">
                thermodesk.eu/aszf
              </a>{' '}
              címen.
            </p>
          </section>

          <p className="text-white/50 mt-10 pt-6 border-t border-white/10">
            Ez az Általános Szerződési Feltételek dokumentum 2025. február 1-től hatályos.
          </p>
        </div>
      </div>
    </div>
  );
}
