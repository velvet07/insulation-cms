'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // TODO: Implement newsletter subscription with Supabase
    console.log('Subscribe:', email);
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="logo">
            <span className="logo-icon"></span> ThermoDesk
          </div>
          <p>
            ThermoDesk – Padlásfödém szigetelési projektek kezelése.
            A legmodernebb digitális asszisztens padlásfödém szigetelő vállalkozásoknak.
          </p>
        </div>

        <div>
          <h4>Termék</h4>
          <ul>
            <li><Link href="/#funkciok">Funkciók</Link></li>
            <li><Link href="/arazas">Árazás</Link></li>
            <li><Link href="/esettanulmanyok">Esettanulmányok</Link></li>
          </ul>
        </div>

        <div>
          <h4>Vállalat</h4>
          <ul>
            <li><Link href="/rolunk">Rólunk</Link></li>
            <li><Link href="/kapcsolat">Kapcsolat</Link></li>
            <li><Link href="/karrier">Karrier</Link></li>
          </ul>
        </div>

        <div className="newsletter">
          <label htmlFor="footer-email">Iratkozzon fel</label>
          {subscribed ? (
            <p className="text-sm text-green-400">Köszönjük a feliratkozást!</p>
          ) : (
            <form onSubmit={handleSubscribe} className="newsletter-input-wrap">
              <input
                type="email"
                id="footer-email"
                placeholder="Email cím"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" aria-label="Feliratkozás">➤</button>
            </form>
          )}
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} ThermoDesk SaaS. Minden jog fenntartva.</span>
        <div className="footer-legal">
          <Link href="/adatkezeles">Adatkezelés</Link>
          <Link href="/aszf">ÁSZF</Link>
          <Link href="/sutik">Sütik</Link>
        </div>
      </div>
    </footer>
  );
}
