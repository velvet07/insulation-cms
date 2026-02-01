'use client';

import Link from 'next/link';

// Logo SVG component matching the design
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
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="logo">
            <LogoSVG />
            <span className="logo-text-primary">Thermo</span>
            <span className="logo-text-secondary">Desk</span>
          </div>
          <p>
            A legmodernebb digitális asszisztens padlásfödém szigetelő vállalkozásoknak. Optimalizálja profitját kevesebb adminisztrációval.
          </p>
        </div>

        <div>
          <h5>Termék</h5>
          <ul>
            <li><Link href="#funkciok">Funkciók</Link></li>
            <li><Link href="#">Árazás</Link></li>
            <li><Link href="#">Esettanulmányok</Link></li>
          </ul>
        </div>

        <div>
          <h5>Vállalat</h5>
          <ul>
            <li><Link href="#">Rólunk</Link></li>
            <li><Link href="/kapcsolat">Kapcsolat</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2024 ThermoDesk SaaS. Minden jog fenntartva.</span>
        <div className="footer-legal">
          <Link href="/adatkezeles">Adatkezelés</Link>
          <Link href="/aszf">ÁSZF</Link>
          <Link href="#">Sütik</Link>
        </div>
      </div>
    </footer>
  );
}
