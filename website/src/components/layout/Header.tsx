'use client';

import Link from 'next/link';
import { useState } from 'react';

const LogoSVG = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 15L15 45H25V85H75V45H85L50 15Z" fill="url(#logo-gradient)" />
    <defs>
      <linearGradient gradientUnits="userSpaceOnUse" id="logo-gradient" x1="15" x2="85" y1="15" y2="85">
        <stop offset="0%" stopColor="#F28C38" />
        <stop offset="100%" stopColor="#207D82" />
      </linearGradient>
    </defs>
  </svg>
);

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative flex h-auto w-full flex-col overflow-x-hidden">
      <div className="lg:px-40 flex flex-1 justify-center py-5 border-b border-solid border-white/10">
        <div className="flex flex-col max-w-[1200px] flex-1 px-4">
          <header className="flex items-center justify-between whitespace-nowrap py-3">
            <Link href="/" className="flex items-center gap-4 text-white">
              <div className="h-10 w-auto flex items-center">
                <LogoSVG />
                <h2 className="text-white text-xl font-black leading-tight tracking-tight ml-2">
                  <span className="text-[#F28C38]">Thermo</span>
                  <span className="text-[#207D82]">Desk</span>
                </h2>
              </div>
            </Link>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-white p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <div className="hidden md:flex flex-1 justify-end gap-8 items-center">
              <nav className="flex items-center gap-9">
                <Link href="#mukodes" className="text-white/80 hover:text-[#F28C38] text-sm font-medium transition-colors">
                  Hogyan működik
                </Link>
                <Link href="#funkciok" className="text-white/80 hover:text-[#F28C38] text-sm font-medium transition-colors">
                  Funkciók
                </Link>
                <Link href="#vallalkozok" className="text-white/80 hover:text-[#F28C38] text-sm font-medium transition-colors">
                  Fővállalkozóknak
                </Link>
                <Link href="#elonyok" className="text-white/80 hover:text-[#F28C38] text-sm font-medium transition-colors">
                  Előnyök
                </Link>
              </nav>
              <div className="flex items-center gap-2">
                <Link
                  href="/demo"
                  className="flex min-w-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-white/10 text-white text-sm font-bold tracking-tight hover:bg-white/20 transition-colors"
                >
                  Belépés
                </Link>
              </div>
            </div>
          </header>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <nav className="md:hidden flex flex-col gap-4 py-4 border-t border-white/10">
              <Link href="#mukodes" className="text-white/80 hover:text-[#F28C38] text-sm font-medium transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Hogyan működik
              </Link>
              <Link href="#funkciok" className="text-white/80 hover:text-[#F28C38] text-sm font-medium transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Funkciók
              </Link>
              <Link href="#vallalkozok" className="text-white/80 hover:text-[#F28C38] text-sm font-medium transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Fővállalkozóknak
              </Link>
              <Link href="#elonyok" className="text-white/80 hover:text-[#F28C38] text-sm font-medium transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Előnyök
              </Link>
              <Link
                href="/demo"
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-white/10 text-white text-sm font-bold tracking-tight hover:bg-white/20 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Belépés
              </Link>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
