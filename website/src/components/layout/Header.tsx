'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="header">
      <Link href="/" className="logo">
        <span className="logo-icon"></span>
        ThermoDesk
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

      <nav className={`nav ${mobileMenuOpen ? 'nav-open' : ''}`}>
        <Link href="/#hogyan" onClick={() => setMobileMenuOpen(false)}>Hogyan működik</Link>
        <Link href="/#funkciok" onClick={() => setMobileMenuOpen(false)}>Funkciók</Link>
        <Link href="/#fovallalkozoknak" onClick={() => setMobileMenuOpen(false)}>Fővállalkozóknak</Link>
        <Link href="/#elonyok" onClick={() => setMobileMenuOpen(false)}>Előnyök</Link>
        <Link href="/demo" className="btn btn-primary" onClick={() => setMobileMenuOpen(false)}>Demó kérése</Link>
      </nav>
    </header>
  );
}
