import Script from 'next/script';
import { AuthProvider } from '../contexts/AuthContext';
import { ImportStatusProvider } from '../contexts/ImportStatusContext';
import Navbar from '../components/Navbar';
import ImportStatusPopup from '../components/ImportStatusPopup';
import './globals.css';

export const metadata = {
  title: 'Lore',
  description: 'Experience TV shows and movies with friends',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://kit.fontawesome.com/96509c7481.js"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <AuthProvider>
          <ImportStatusProvider>
            <Navbar />
            {children}
            <ImportStatusPopup />
          </ImportStatusProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
