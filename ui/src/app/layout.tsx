import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Codejaguar — Local-first AI code review CLI",
  description:
    "AI code review, security scanning, and DevSecOps analysis that runs entirely on your machine. No cloud. No accounts. Bring your own API key.",
  openGraph: {
    title: "Codejaguar",
    description: "Local-first AI code review CLI.",
    type: "website",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Codejaguar",
    description: "Local-first AI code review CLI.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="bg-term-black text-text-primary min-h-screen">
        {children}
      </body>
    </html>
  );
}
