export const metadata = {
  title: 'Adatvédelmi Tájékoztató – ThermoDesk',
  description: 'ThermoDesk adatvédelmi és adatkezelési tájékoztató. GDPR megfelelőség.',
};

export default function AdatkezelesPage() {
  return (
    <div className="lg:px-40 flex flex-1 justify-center py-12">
      <div className="flex flex-col max-w-[900px] flex-1 px-4">
        <h1 className="text-white text-4xl font-black mb-8">Adatvédelmi Tájékoztató</h1>

        <div className="space-y-6 text-white/80 leading-relaxed">
          <p>
            <strong className="text-white">Milos Róbert ev.</strong> (a továbbiakban: Vállalkozás), egy egyéni vállalkozás, melynek működési száma: 52707131;
            székhelye: 3524 Miskolc, Mednyánszky u. 5 8/2.; adószáma: 66364591-1-25; e-mail:{' '}
            <a href="mailto:info@thermodesk.eu" className="text-[#207D82] hover:text-[#F28C38]">info@thermodesk.eu</a>;
            weboldal: <a href="https://thermodesk.eu" className="text-[#207D82] hover:text-[#F28C38]">thermodesk.eu</a>, mely az Ön személyes adatait kezeli,
            különös figyelmet fordít az adatvédelemre.
          </p>

          <p>
            A Vállalkozás által megvalósított adatkezelés összhangban van a vonatkozó Európai Uniós és a magyar nemzeti adatvédelmi
            jogszabályokkal, és a jelen Tájékoztatónak megfelelően történik, mind a jelenlegi, mind a korábbi és a leendő ügyfelei
            személyes adatai tekintetében.
          </p>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">A Tájékoztató jogszabályi háttere</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>A természetes személyeknek a személyes adatok kezelése tekintetében történő védelméről és az ilyen adatok szabad áramlásáról, valamint a 95/46/EK rendelet hatályon kívül helyezéséről szóló 2016/679/EU rendelet (Általános Adatvédelmi Rendelet, GDPR).</li>
            <li>Az információs önrendelkezési jogról és az információszabadságról szóló 2011. évi CXII. törvény.</li>
            <li>A Polgári Törvénykönyvről szóló 2013. évi V. törvény.</li>
            <li>A gazdasági reklámtevékenység alapvető feltételeiről és egyes korlátairól szóló 2008. évi XLVIII. törvény.</li>
            <li>Az elektronikus hírközlésről szóló 2003. évi C. törvény.</li>
            <li>Az elektronikus kereskedelmi szolgáltatások, valamint az információs társadalommal összefüggő szolgáltatások egyes kérdéseiről szóló 2001. évi CVIII. törvény.</li>
            <li>A számvitelről szóló 2000. évi C. törvény.</li>
          </ul>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Fogalmi meghatározások</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">GDPR:</strong> az Európa Parlament és az Európai Tanács 2016/679/EU rendelete a természetes személyeknek a személyes adatok kezelése tekintetében történő védelméről.</li>
            <li><strong className="text-white">Adatkezelés:</strong> a személyes adatokon vagy adatállományokon automatizált vagy nem automatizált módon végzett bármely művelet vagy műveletek összessége.</li>
            <li><strong className="text-white">Adatkezelő:</strong> az a természetes vagy jogi személy, amely a személyes adatok kezelésének céljait és eszközeit önállóan vagy másokkal együtt meghatározza.</li>
            <li><strong className="text-white">Adatfeldolgozó:</strong> az a természetes személy vagy jogi személy, amely az adatkezelő nevében személyes adatokat kezel.</li>
            <li><strong className="text-white">Személyes adat:</strong> azonosított vagy azonosítható természetes személyre vonatkozó bármely információ.</li>
            <li><strong className="text-white">Ügyfél:</strong> a Vállalkozás szolgáltatásai iránt személyesen, honlapunkon, telefonon vagy bármely más módon érdeklődők, illetve a Vállalkozással szerződést kötők.</li>
          </ul>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Felügyeleti hatóság</h2>
          <div className="bg-[#1c2127] p-6 rounded-xl border border-white/10">
            <p className="font-bold text-white mb-2">Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)</p>
            <p>Székhely: 1125 Budapest, Szilágyi Erzsébet fasor 22/C.</p>
            <p>Telefon: +36 1 391 1400</p>
            <p>E-mail: <a href="mailto:ugyfelszolgalat@naih.hu" className="text-[#207D82] hover:text-[#F28C38]">ugyfelszolgalat@naih.hu</a></p>
            <p>Weboldal: <a href="https://www.naih.hu" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">www.naih.hu</a></p>
          </div>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Az Ön személyes adatainak kezelése</h2>
          <p>
            Ez a Tájékoztató minden olyan személyes adat tekintetében alkalmazandó, amelyet Ön átad nekünk, illetve amelyet az Önnek
            a Vállalkozással fennálló viszonyával összefüggésben gyűjtünk és kezelünk.
          </p>

          <h3 className="text-white text-xl font-bold mt-8 mb-3">Gyűjtött és kezelt információk</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Önre vonatkozó információk (név, cím, e-mail cím, telefon)</li>
            <li>Az Ön által megvásárolt szolgáltatásokkal kapcsolatos információk</li>
            <li>A weboldalunk használatával kapcsolatos adatok (IP-cím, böngésző típusa, látogatási idő)</li>
            <li>A velünk folytatott kommunikációval kapcsolatos információk</li>
          </ul>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Technikai adatfeldolgozók</h2>
          <p>A ThermoDesk szolgáltatás működtetéséhez az alábbi technikai szolgáltatókat vesszük igénybe:</p>

          <div className="bg-[#1c2127] p-6 rounded-xl border border-white/10 mt-4">
            <h3 className="text-white text-xl font-bold mb-3">Tárhelyszolgáltatás - Vercel Inc.</h3>
            <ul className="space-y-1">
              <li><strong className="text-white">Szolgáltató:</strong> Vercel Inc.</li>
              <li><strong className="text-white">Székhely:</strong> 340 S Lemon Ave #4133, Walnut, CA 91789, USA</li>
              <li><strong className="text-white">Weboldal:</strong> <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">vercel.com</a></li>
              <li><strong className="text-white">Adatvédelmi tájékoztató:</strong> <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">vercel.com/legal/privacy-policy</a></li>
              <li><strong className="text-white">Kezelt adatok:</strong> A weboldal működéséhez szükséges technikai adatok (IP-cím, böngésző adatok, látogatási statisztikák)</li>
            </ul>
          </div>

          <div className="bg-[#1c2127] p-6 rounded-xl border border-white/10 mt-4">
            <h3 className="text-white text-xl font-bold mb-3">Adatbázis szolgáltatás - Supabase Inc.</h3>
            <ul className="space-y-1">
              <li><strong className="text-white">Szolgáltató:</strong> Supabase Inc.</li>
              <li><strong className="text-white">Székhely:</strong> 970 Toa Payoh North #07-04, Singapore 318992</li>
              <li><strong className="text-white">Weboldal:</strong> <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">supabase.com</a></li>
              <li><strong className="text-white">Adatvédelmi tájékoztató:</strong> <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">supabase.com/privacy</a></li>
              <li><strong className="text-white">Kezelt adatok:</strong> Felhasználói fiókok, projekt adatok, üzleti adatok</li>
            </ul>
          </div>

          <div className="bg-[#1c2127] p-6 rounded-xl border border-white/10 mt-4">
            <h3 className="text-white text-xl font-bold mb-3">E-mail szolgáltatás - Resend</h3>
            <ul className="space-y-1">
              <li><strong className="text-white">Szolgáltató:</strong> Resend Inc.</li>
              <li><strong className="text-white">Weboldal:</strong> <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">resend.com</a></li>
              <li><strong className="text-white">Adatvédelmi tájékoztató:</strong> <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#207D82] hover:text-[#F28C38]">resend.com/legal/privacy-policy</a></li>
              <li><strong className="text-white">Kezelt adatok:</strong> E-mail címek, kommunikációs tartalom</li>
            </ul>
          </div>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Cookie-k (Sütik)</h2>
          <p>
            Weboldalunk használata során a böngészője cookie-kat tárol az Ön eszközén. Célunk annak biztosítása, hogy weboldalunk
            látogatói megtalálják azt, amit keresnek, és hogy weboldalunkon a lehető legrelevánsabb tartalommal találkozzanak.
          </p>
          <p>
            Az Ön böngészője és eszköze által a weboldal használata során elküldött adatokat tároljuk. Ezeket az adatokat csak
            összesített, természetes személyek azonosítására alkalmatlan formában osztjuk meg harmadik személyekkel.
          </p>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Az adatok megőrzése</h2>
          <p>Személyes adatait addig kezeljük, amíg szükségesek annak a célnak az eléréséhez, amelyhez beszerezük őket.</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">Szerződéses adatok:</strong> a szerződés teljesítésétől számított 5 évig</li>
            <li><strong className="text-white">Számviteli célú dokumentumok:</strong> az érintett pénzügyi év lezárását követően 8 évig</li>
            <li><strong className="text-white">Marketing célú adatok:</strong> a hozzájárulás visszavonásáig</li>
          </ul>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Az Ön jogai</h2>
          <p>A GDPR hatálya alá tartozó adatkezeléssel kapcsolatban Ön a következő jogokkal rendelkezik:</p>
          <ol className="list-decimal pl-6 space-y-3 mt-4">
            <li><strong className="text-white">Hozzáférési jog:</strong> Ön jogosult visszajelzést kapni arra vonatkozóan, hogy kezeljük-e az Ön személyes adatait.</li>
            <li><strong className="text-white">Helyesbítéshez való jog:</strong> Ön kérheti a pontatlan személyes adatok helyesbítését.</li>
            <li><strong className="text-white">Törléshez való jog:</strong> Bizonyos esetekben Ön kérheti a személyes adatai törlését.</li>
            <li><strong className="text-white">Adatkezelés korlátozásához való jog:</strong> Bizonyos esetekben Ön kérheti személyes adatai kezelésének a korlátozását.</li>
            <li><strong className="text-white">Adathordozhatósághoz való jog:</strong> Ön jogosult arra, hogy az általa rendelkezésünkre bocsátott személyes adatokat tagolt, géppel olvasható formátumban megkapja.</li>
            <li><strong className="text-white">Tiltakozáshoz való jog:</strong> Bizonyos esetekben Ön tiltakozhat személyes adatainak kezelése ellen.</li>
          </ol>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Biztonság</h2>
          <p>
            Megfelelő technikai és szervezési intézkedéseket alkalmazunk annak érdekében, hogy megakadályozzuk az Ön személyes
            adatainak véletlen vagy jogellenes megsemmisítését, véletlen elvesztését, megváltoztatását, jogosulatlan közlését
            vagy az adatokhoz való jogosulatlan hozzáférést.
          </p>
          <p>
            Különös figyelmet fordítunk a személyes és a pénzügyi adatok biztonságos továbbítására. Ezek az adatok titkosított
            csatornákon keresztül kerülnek továbbításra, a legkorszerűbb SSL/TLS technológia segítségével.
          </p>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Kapcsolat</h2>
          <div className="bg-[#1c2127] p-6 rounded-xl border border-white/10">
            <p>Ha bármilyen kérdése vagy problémája van az adatkezeléssel kapcsolatban, az alábbi elérhetőségeken léphet kapcsolatba velünk:</p>
            <p className="mt-4">
              <strong className="text-white">E-mail:</strong> <a href="mailto:info@thermodesk.eu" className="text-[#207D82] hover:text-[#F28C38]">info@thermodesk.eu</a><br />
              <strong className="text-white">Cím:</strong> 3524 Miskolc, Mednyánszky u. 5 8/2.
            </p>
          </div>

          <h2 className="text-white text-2xl font-bold mt-10 mb-4">Vegyes rendelkezések</h2>
          <p>
            Ha módosítjuk a jelen Adatvédelmi Tájékoztatót, annak aktualizált változatát közzétesszük a weboldalunkon,
            a thermodesk.eu-n.
          </p>
          <p>
            A Vállalkozás fenntartja a jogot, hogy bármikor módosítsa a jelen Tájékoztatót. A Vállalkozás adott esetben
            levélben vagy e-mailben és minden esetben a vonatkozó jogszabályok szerint tájékoztatja a Tisztelt Ügyfeleket
            az ilyen módosításokról.
          </p>

          <p className="text-white/50 mt-10 pt-6 border-t border-white/10">
            Ez az Adatvédelmi Tájékoztató 2025. február 1-től hatályos.
          </p>
        </div>
      </div>
    </div>
  );
}
