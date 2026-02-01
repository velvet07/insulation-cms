import Link from 'next/link';

const LogoSVG = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 15L15 45H25V85H75V45H85L50 15Z" fill="url(#footer-gradient)" />
    <defs>
      <linearGradient gradientUnits="userSpaceOnUse" id="footer-gradient" x1="15" x2="85" y1="15" y2="85">
        <stop offset="0%" stopColor="#F28C38" />
        <stop offset="100%" stopColor="#207D82" />
      </linearGradient>
    </defs>
  </svg>
);

export default function Footer() {
  return (
    <footer className="bg-[#1c2127] border-t border-white/10 pt-20 pb-10">
      <div className="lg:px-40 flex flex-col items-center">
        <div className="flex flex-col max-w-[1200px] w-full px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 text-white">
                <div className="size-8 text-[#F28C38] flex items-center justify-center">
                  <LogoSVG />
                </div>
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
              <Link href="#" className="text-white/30 hover:text-white text-xs transition-colors">
                Sütik
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
