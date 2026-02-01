import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ThermoDesk – A profi szigetelők digitális társa",
  description: "Modernizálja munkafolyamatait az ajánlattételtől a kivitelezésig. Kevesebb adminisztráció, több elvégzett munka.",
  keywords: ["padlásfödém szigetelés", "szigetelés", "projektkezelés", "dokumentumkezelés", "anyaggazdálkodás", "ThermoDesk"],
  authors: [{ name: "ThermoDesk" }],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "ThermoDesk – A profi szigetelők digitális társa",
    description: "Modernizálja munkafolyamatait az ajánlattételtől a kivitelezésig. Kevesebb adminisztráció, több elvégzett munka.",
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
    <html lang="hu" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
