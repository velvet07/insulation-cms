import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ThermoDesk – Padlásfödém szigetelés, egy helyen",
  description: "Szoftver a padlásfödém szigetelési projektek kezeléséhez, dokumentációjához és anyaggazdálkodásához. Fővállalkozóknak és alvállalkozóknak egyaránt.",
  keywords: ["padlásfödém szigetelés", "szigetelés", "projektkezelés", "dokumentumkezelés", "anyaggazdálkodás"],
  authors: [{ name: "ThermoDesk" }],
  openGraph: {
    title: "ThermoDesk – Padlásfödém szigetelés, egy helyen",
    description: "Szoftver a padlásfödém szigetelési projektek kezeléséhez.",
    type: "website",
    locale: "hu_HU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className={`${geistSans.variable} antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
