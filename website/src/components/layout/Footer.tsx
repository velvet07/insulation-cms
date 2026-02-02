import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-[#1c2127] border-t border-white/10 pt-20 pb-10">
      <div className="lg:px-40 flex flex-col items-center">
        <div className="flex flex-col max-w-[1200px] w-full px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 text-white">
                <Image
                  src="/logo_thermodesk.png"
                  alt="ThermoDesk Logo"
                  width={32}
                  height={32}
                  className="h-8 w-auto"
                />
                <h2 className="text-xl font-black">
                  <span className="text-[#F28C38]">Thermo</span>
                  <span className="text-[#207D82]">Desk</span>
                </h2>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">
                A legmodernebb digitális asszisztens padlásfödém szigetelő vállalkozásoknak. Optimalizálja profitját kevesebb adminisztrációval.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="font-bold text-white">Termék</h5>
              <Link href="#funkciok" className="text-white/50 hover:text-[#F28C38] text-sm transition-colors">
                Funkciók
              </Link>
              <Link href="#" className="text-white/50 hover:text-[#F28C38] text-sm transition-colors">
                Árazás
              </Link>
              <Link href="#" className="text-white/50 hover:text-[#F28C38] text-sm transition-colors">
                Esettanulmányok
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="font-bold text-white">Vállalat</h5>
              <Link href="#" className="text-white/50 hover:text-[#F28C38] text-sm transition-colors">
                Rólunk
              </Link>
              <Link href="/kapcsolat" className="text-white/50 hover:text-[#F28C38] text-sm transition-colors">
                Kapcsolat
              </Link>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-t border-white/5 pt-10">
            <p className="text-white/30 text-xs">© 2024 ThermoDesk SaaS. Minden jog fenntartva.</p>
            <div className="flex gap-6">
              <Link href="/adatkezeles" className="text-white/30 hover:text-white text-xs transition-colors">
                Adatkezelés
              </Link>
              <Link href="/aszf" className="text-white/30 hover:text-white text-xs transition-colors">
                ÁSZF
              </Link>
              <Link href="/sutik" className="text-white/30 hover:text-white text-xs transition-colors">
                Sütik
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
