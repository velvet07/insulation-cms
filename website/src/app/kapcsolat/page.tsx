'use client';

import { useState } from 'react';
import Link from 'next/link';
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
      <div className="bg-[#101922] min-h-screen">
        <div className="lg:px-40 flex flex-col items-center py-16">
          <div className="flex flex-col max-w-[900px] w-full px-4 text-center">
            <div className="mb-8">
              <span className="material-symbols-outlined text-[#207D82] text-6xl mb-4">check_circle</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Üzenet elküldve!
            </h1>
            <p className="text-white/70 text-lg mb-8">
              Köszönjük megkeresését, hamarosan válaszolunk.
            </p>
            <div>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-[#207D82] hover:bg-[#207D82]/80 text-white font-semibold rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined mr-2">arrow_back</span>
                Vissza a főoldalra
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101922] min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#1c2127] to-[#101922] py-16">
        <div className="lg:px-40 flex flex-col items-center">
          <div className="flex flex-col max-w-[900px] w-full px-4 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Kapcsolat
            </h1>
            <p className="text-white/70 text-lg">
              Van kérdése? Írjon nekünk, és hamarosan válaszolunk!
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="lg:px-40 flex flex-col items-center py-12">
        <div className="flex flex-col max-w-[1000px] w-full px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="bg-[#1c2127] rounded-2xl p-8 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-6">Elérhetőségek</h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#207D82]/20 text-[#207D82]">
                    <span className="material-symbols-outlined">mail</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Email</h3>
                    <a
                      href="mailto:info@thermodesk.eu"
                      className="text-[#F28C38] hover:underline"
                    >
                      info@thermodesk.eu
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#207D82]/20 text-[#207D82]">
                    <span className="material-symbols-outlined">schedule</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Ügyfélszolgálat</h3>
                    <p className="text-white/70">Hétfő - Péntek: 9:00 - 17:00</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#207D82]/20 text-[#207D82]">
                    <span className="material-symbols-outlined">support_agent</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Támogatás</h3>
                    <p className="text-white/70">Technikai segítség meglévő ügyfeleknek</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-white/10">
                <h3 className="text-white font-semibold mb-3">Gyors válasz</h3>
                <p className="text-white/50 text-sm">
                  Az üzenetekre általában 24 órán belül válaszolunk munkanapokon.
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-[#1c2127] rounded-2xl p-8 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-6">Írjon nekünk</h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-white/80 text-sm font-medium mb-2">
                    Név <span className="text-[#F28C38]">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-[#101922] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#207D82] focus:ring-1 focus:ring-[#207D82] transition-colors"
                    placeholder="Az Ön neve"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-white/80 text-sm font-medium mb-2">
                    Email <span className="text-[#F28C38]">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-[#101922] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#207D82] focus:ring-1 focus:ring-[#207D82] transition-colors"
                    placeholder="pelda@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-white/80 text-sm font-medium mb-2">
                    Tárgy
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[#101922] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#207D82] focus:ring-1 focus:ring-[#207D82] transition-colors"
                    placeholder="Miben segíthetünk?"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-white/80 text-sm font-medium mb-2">
                    Üzenet <span className="text-[#F28C38]">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 bg-[#101922] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#207D82] focus:ring-1 focus:ring-[#207D82] transition-colors resize-none"
                    placeholder="Írja le kérdését vagy megjegyzését..."
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-[#F28C38] hover:bg-[#F28C38]/90 disabled:bg-[#F28C38]/50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>
                      Küldés...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">send</span>
                      Üzenet küldése
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-flex items-center text-[#F28C38] hover:text-[#F28C38]/80 transition-colors"
            >
              <span className="material-symbols-outlined mr-2">arrow_back</span>
              Vissza a főoldalra
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
