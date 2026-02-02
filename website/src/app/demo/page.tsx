'use client';

import { useState } from 'react';
import { submitDemoRequest } from '@/lib/supabase';

export default function DemoPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    company_size: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await submitDemoRequest(formData);

      // Send email notifications
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'demo', ...formData }),
      });

      setSuccess(true);
      setFormData({
        name: '',
        email: '',
        company: '',
        phone: '',
        company_size: '',
        message: '',
      });
    } catch (err) {
      console.error('Error submitting demo request:', err);
      setError('Hiba történt a küldés során. Kérjük, próbálja újra később.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (success) {
    return (
      <>
        <div className="page-hero">
          <h1>Köszönjük!</h1>
          <p>Megkaptuk az igényét, hamarosan felvesszük Önnel a kapcsolatot.</p>
        </div>
        <div className="page-content" style={{ textAlign: 'center' }}>
          <a href="/" className="btn btn-primary">Vissza a főoldalra</a>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-hero">
        <h1>Demó kérése</h1>
        <p>
          Töltse ki az alábbi űrlapot, és csapatunk hamarosan felveszi Önnel a kapcsolatot
          egy személyre szabott bemutató egyeztetéséhez.
        </p>
      </div>

      <div className="page-content">
        <form onSubmit={handleSubmit} style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="form-group">
            <label htmlFor="name">Név *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Teljes név"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="email@cegnev.hu"
            />
          </div>

          <div className="form-group">
            <label htmlFor="company">Cégnév</label>
            <input
              type="text"
              id="company"
              name="company"
              value={formData.company}
              onChange={handleChange}
              placeholder="Vállalkozás neve"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefonszám</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+36 30 123 4567"
            />
          </div>

          <div className="form-group">
            <label htmlFor="company_size">Cégméret</label>
            <select
              id="company_size"
              name="company_size"
              value={formData.company_size}
              onChange={handleChange}
            >
              <option value="">Válasszon...</option>
              <option value="1-5">1-5 fő</option>
              <option value="6-20">6-20 fő</option>
              <option value="21-50">21-50 fő</option>
              <option value="50+">50+ fő</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="message">Üzenet</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Kérdése vagy megjegyzése..."
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Küldés...' : 'Demó kérése'}
          </button>
        </form>
      </div>
    </>
  );
}
