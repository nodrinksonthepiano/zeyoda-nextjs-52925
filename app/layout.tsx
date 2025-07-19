import type { Metadata } from "next";
import { Geist, Geist_Mono, Bungee } from "next/font/google";
import "./globals.css";
import "./styles/orbit.css";
import { MagicProvider } from './components/MagicProvider'
import { ToastProvider } from './contexts/ToastContext';
import { ArtistRegistryProvider } from './contexts/ArtistRegistryContext';
import { ChatWizardProvider } from './contexts/ChatWizardContext';
import { GlobalChatProvider } from './contexts/GlobalChatContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bungee = Bungee({
  variable: "--font-bungee",
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zeyoda",
  description: "A new music platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning={true}
        className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} antialiased`}
      >
        <ToastProvider>
          <MagicProvider>
            <ArtistRegistryProvider>
              <GlobalChatProvider>
                <ChatWizardProvider>
                  {children}
                </ChatWizardProvider>
              </GlobalChatProvider>
            </ArtistRegistryProvider>
          </MagicProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
