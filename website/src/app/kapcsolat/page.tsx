'use client';

import { useState } from 'react';
import { submitContactMessage } from '@/lib/supabase';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
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
      await submitContactMessage(formData);
      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Error submitting contact message:', err);
      setError('Hiba történt a küldés során. Kérjük, próbálja újra később.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (success) {
    return (
      <>
        <div className="page-hero">
          <h1>Üzenet elküldve!</h1>
          <p>Köszönjük megkeresését, hamarosan válaszolunk.</p>
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
        <h1>Kapcsolat</h1>
        <p>Van kérdése? Írjon nekünk, és hamarosan válaszolunk!</p>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Elérhetőségek</h2>
            <p>
              <strong>Email:</strong><br />
              <a href="mailto:info@thermodesk.hu" style={{ color: 'var(--primary)' }}>info@thermodesk.hu</a>
            </p>
            <p>
              <strong>Telefon:</strong><br />
              <a href="tel:+36301234567" style={{ color: 'var(--primary)' }}>+36 30 123 4567</a>
            </p>
            <p>
              <strong>Ügyfélszolgálat:</strong><br />
              Hétfő - Péntek: 9:00 - 17:00
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Név *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
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
              />
            </div>

            <div className="form-group">
              <label htmlFor="subject">Tárgy</label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">Üzenet *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
              />
            </div>

            {error && (
              <p style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Küldés...' : 'Üzenet küldése'}
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
