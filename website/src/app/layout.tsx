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
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className={`${inter.variable} antialiased bg-[#101922] text-white font-sans`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
