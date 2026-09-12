import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Loknath Sofa Center | Production & Inventory",
  description:
    "Manufacturing and retail management for Loknath Sofa Center, Barasat — raw material, BOM, production, job work, sales and khata.",
  // Next serves src/app/icon.png and apple-icon.png automatically; naming them
  // here keeps the home-screen title short when saved on a phone.
  appleWebApp: { title: "Loknath", capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // data-scroll-behavior tells Next.js the smooth scrolling in globals.css is
    // intentional, so it jumps rather than animates on route transitions.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${outfit.variable} ${inter.variable}`}
    >
      <body>
        {children}
      </body>
    </html>
  );
}
