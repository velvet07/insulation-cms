import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <div className="relative flex h-auto w-full flex-col overflow-x-hidden">
        <div className="lg:px-40 flex flex-1 justify-center py-10 md:py-20">
          <div className="flex flex-col max-w-[1200px] flex-1 px-4">
            <div
              className="flex min-h-[580px] flex-col gap-6 md:gap-8 rounded-xl items-center justify-center p-8 relative overflow-hidden shadow-2xl bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `linear-gradient(rgba(16, 25, 34, 0.75), rgba(16, 25, 34, 0.75)), url("/hero.jpeg")`
              }}
            >
              <div className="flex flex-col gap-4 text-center max-w-[850px] relative z-10">
                <div className="flex justify-center mb-2">
                  <div className="bg-[#207D82]/80 backdrop-blur-sm p-3 rounded-full inline-flex items-center justify-center shadow-lg border border-white/10">
                    <span className="material-symbols-outlined text-white text-3xl">hvac</span>
                  </div>
                </div>
                <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] md:text-6xl">
                  <span className="text-[#F28C38]">ThermoDesk</span> – A profi szigetelők digitális társa
                </h1>
                <h2 className="text-white/90 text-base font-normal leading-relaxed md:text-xl px-10">
                  Modernizálja munkafolyamatait az ajánlattételtől a kivitelezésig. Kevesebb adminisztráció, több elvégzett munka.
                </h2>
              </div>
              <div className="flex-wrap gap-4 flex justify-center relative z-10 mt-4">
                <Link
                  href="#funkciok"
                  className="flex min-w-[180px] cursor-pointer items-center justify-center rounded-lg h-14 px-8 bg-[#F28C38] text-white text-base font-bold shadow-lg shadow-[#F28C38]/30 hover:scale-105 transition-transform"
                >
                  Megoldásaink
                </Link>
                <Link
                  href="#elonyok"
                  className="flex min-w-[180px] cursor-pointer items-center justify-center rounded-lg h-14 px-8 bg-white/10 backdrop-blur-md text-white text-base font-bold border border-white/20 hover:bg-white/20 transition-all"
                >
                  Részletek
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative flex h-auto w-full flex-col overflow-x-hidden" id="funkciok">
        <div className="lg:px-40 flex flex-1 justify-center py-12">
          <div className="flex flex-col max-w-[1200px] flex-1 px-4">
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-4 text-center md:text-left">
                <h2 className="text-white text-[32px] font-black leading-tight md:text-4xl tracking-tight">
                  Minden, amire egy szigetelő vállalkozónak szüksége van
                </h2>
                <p className="text-white/60 text-lg font-normal leading-normal max-w-[720px]">
                  Optimalizált modulok a hatékony és hibamentes munkavégzéshez.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-0">
                {/* Card 1 */}
                <div className="flex flex-1 gap-5 rounded-xl border border-white/10 bg-[#1c2127] p-8 flex-col hover:border-[#207D82] transition-colors group">
                  <div className="text-[#207D82] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl">description</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-bold leading-tight">Egyszerűbb papírmunka</h3>
                    <p className="text-[#9dabb9] text-base font-normal leading-relaxed">
                      Kevesebb szkennelés, digitális adatbevitel és automatizált nyomtatványok.
                    </p>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="flex flex-1 gap-5 rounded-xl border border-white/10 bg-[#1c2127] p-8 flex-col hover:border-[#207D82] transition-colors group">
                  <div className="text-[#207D82] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl">inventory_2</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-bold leading-tight">Anyaggazdálkodás</h3>
                    <p className="text-[#9dabb9] text-base font-normal leading-relaxed">
                      Pontos készletnyilvántartás és előrehaladott anyagtervezés minden projekthez.
                    </p>
                  </div>
                </div>
                {/* Card 3 */}
                <div className="flex flex-1 gap-5 rounded-xl border border-white/10 bg-[#1c2127] p-8 flex-col hover:border-[#207D82] transition-colors group">
                  <div className="text-[#207D82] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl">fact_check</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-bold leading-tight">Audit és jóváhagyás</h3>
                    <p className="text-[#9dabb9] text-base font-normal leading-relaxed">
                      Gyors és egyszerű projekt auditálás. Jóváhagyás közvetlenül a felületen.
                    </p>
                  </div>
                </div>
                {/* Card 4 */}
                <div className="flex flex-1 gap-5 rounded-xl border border-white/10 bg-[#1c2127] p-8 flex-col hover:border-[#207D82] transition-colors group">
                  <div className="text-[#207D82] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl">assignment_turned_in</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-bold leading-tight">Teljesítési igazolások</h3>
                    <p className="text-[#9dabb9] text-base font-normal leading-relaxed">
                      Automatikus generálás az alvállalkozók számára a munka befejeztével.
                    </p>
                  </div>
                </div>
                {/* Card 5 */}
                <div className="flex flex-1 gap-5 rounded-xl border border-white/10 bg-[#1c2127] p-8 flex-col hover:border-[#207D82] transition-colors group">
                  <div className="text-[#207D82] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl">folder_zip</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-bold leading-tight">ZIP export struktúra</h3>
                    <p className="text-[#9dabb9] text-base font-normal leading-relaxed">
                      Audit-kész mappaszerkezetben exportált dokumentáció egy kattintással.
                    </p>
                  </div>
                </div>
                {/* Card 6 */}
                <div className="flex flex-1 gap-5 rounded-xl border border-white/10 bg-[#1c2127] p-8 flex-col hover:border-[#207D82] transition-colors group">
                  <div className="text-[#207D82] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-bold leading-tight">Strukturált fotók</h3>
                    <p className="text-[#9dabb9] text-base font-normal leading-relaxed">
                      Rendszerezett feltöltés és kötelező fotók készítése a beküldés előtt.
                    </p>
                  </div>
                </div>
                {/* Card 7 */}
                <div className="flex flex-1 gap-5 rounded-xl border border-white/10 bg-[#1c2127] p-8 flex-col hover:border-[#207D82] transition-colors group">
                  <div className="text-[#207D82] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl">table_view</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-bold leading-tight">Projekt import Excelből</h3>
                    <p className="text-[#9dabb9] text-base font-normal leading-relaxed">
                      Tömeges projektadatok importálása Excel táblázatból gyors és egyszerű adatfeltöltéshez.
                    </p>
                  </div>
                </div>
                {/* Card 8 - Coming Soon */}
                <div className="flex flex-1 gap-5 rounded-xl border border-[#F28C38]/30 bg-[#1c2127] p-8 flex-col hover:border-[#F28C38] transition-colors group relative overflow-hidden">
                  <div className="absolute top-3 right-3 bg-[#F28C38] text-white text-xs font-bold px-2 py-1 rounded">
                    Hamarosan
                  </div>
                  <div className="text-[#F28C38] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl">assignment</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-bold leading-tight">Digitális felmérőlap</h3>
                    <p className="text-[#9dabb9] text-base font-normal leading-relaxed">
                      Online felmérőlap kitöltés helyszínen, automatikus adatátvitel a projektekhez.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contractor Section Title */}
      <div className="lg:px-40 flex flex-1 justify-center" id="vallalkozok">
        <div className="flex flex-col max-w-[1200px] flex-1 px-4">
          <h2 className="text-white text-3xl font-black leading-tight tracking-tight px-0 pb-6 pt-16 border-t border-white/5">
            <span className="text-[#207D82]">Fővállalkozói</span> Megoldások
          </h2>
        </div>
      </div>

      {/* Contractor Card */}
      <div className="lg:px-40 flex flex-1 justify-center py-5">
        <div className="flex flex-col max-w-[1200px] flex-1 px-4">
          <div className="flex flex-col items-center justify-start rounded-xl overflow-hidden lg:flex-row lg:items-stretch shadow-2xl bg-[#1c2127] border border-white/10">
            <div className="w-full lg:w-1/2 relative aspect-video">
              <Image
                src="/fovallalkozoi.jpeg"
                alt="Fővállalkozói megoldások"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex w-full lg:w-1/2 grow flex-col items-start justify-center gap-6 p-8 lg:p-12">
              <div className="flex flex-col gap-2">
                <span className="text-[#207D82] font-bold text-sm tracking-widest uppercase">Menedzsment</span>
                <h3 className="text-white text-2xl font-black leading-tight">Alvállalkozók precíz követése</h3>
              </div>
              <p className="text-[#9dabb9] text-lg font-normal leading-relaxed">
                Minden beküldés előtt kötelező a teljes dokumentáció: fotók, mérések és aláírások. Nincs több hiányos projekt, csak audit-kész munkák.
              </p>
              <div className="flex gap-4">
                <Link
                  href="#funkciok"
                  className="flex min-w-[140px] cursor-pointer items-center justify-center rounded-lg h-12 px-6 bg-[#F28C38] text-white text-sm font-bold shadow-lg shadow-[#F28C38]/20 hover:bg-[#d9782a] transition-colors"
                >
                  Megoldásaink
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Why Section */}
      <div className="lg:px-40 flex flex-1 justify-center py-20" id="elonyok">
        <div className="flex flex-col max-w-[1200px] flex-1 px-4">
          <div className="text-center mb-16">
            <h2 className="text-white text-4xl font-black mb-4">
              Miért a <span className="text-[#F28C38]">Thermo</span><span className="text-[#207D82]">Desk</span>?
            </h2>
            <p className="text-white/60 text-lg">A szigetelőipar speciális igényeire szabva.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-[#207D82]/5 border border-[#207D82]/20 p-8 rounded-xl flex flex-col gap-4 hover:border-[#207D82] transition-all">
              <span className="material-symbols-outlined text-[#207D82] text-3xl">hub</span>
              <h4 className="text-xl font-bold">Centralizált Adatok</h4>
              <p className="text-white/60 leading-relaxed">
                Minden projekt, ügyféladat és mérési jegyzőkönyv egyetlen, biztonságos felhő alapú helyen érhető el bárhonnan.
              </p>
            </div>
            <div className="bg-[#207D82]/5 border border-[#207D82]/20 p-8 rounded-xl flex flex-col gap-4 hover:border-[#207D82] transition-all">
              <span className="material-symbols-outlined text-[#207D82] text-3xl">verified_user</span>
              <h4 className="text-xl font-bold">Kötelező beküldés</h4>
              <p className="text-white/60 leading-relaxed">
                A rendszer megköveteli a teljes dokumentációt a beküldés előtt, így elkerülhetők a későbbi hiánypótlások.
              </p>
            </div>
            <div className="bg-[#207D82]/5 border border-[#207D82]/20 p-8 rounded-xl flex flex-col gap-4 hover:border-[#207D82] transition-all">
              <span className="material-symbols-outlined text-[#207D82] text-3xl">verified</span>
              <h4 className="text-xl font-bold">Minőségbiztosítás</h4>
              <p className="text-white/60 leading-relaxed">
                Kötelező ellenőrző listák és strukturált fotók készítése a munkafolyamat kritikus fázisaiban a hibátlan kivitelezésért.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
