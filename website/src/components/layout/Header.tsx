'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

// Logo SVG component matching the design
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
    <div className="header-wrapper sticky top-0 z-50 bg-[#101922]">
      <header className="header">
        <Link href="/" className="logo">
          <LogoSVG />
          <span className="logo-text-primary">Thermo</span>
          <span className="logo-text-secondary">Desk</span>
        </Link>

        {/* Mobile menu button */}
        <button
          className="mobile-menu-btn"
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

        <div className={`flex flex-1 justify-end gap-8 items-center`}>
          <nav className={`nav ${mobileMenuOpen ? 'nav-open' : ''}`}>
            <Link href="#mukodes" onClick={() => setMobileMenuOpen(false)}>Hogyan működik</Link>
            <Link href="#funkciok" onClick={() => setMobileMenuOpen(false)}>Funkciók</Link>
            <Link href="#vallalkozok" onClick={() => setMobileMenuOpen(false)}>Fővállalkozóknak</Link>
            <Link href="#elonyok" onClick={() => setMobileMenuOpen(false)}>Előnyök</Link>
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link href="/demo" className="btn btn-login" onClick={() => setMobileMenuOpen(false)}>
              Belépés
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
