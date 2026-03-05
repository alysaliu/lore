import Script from 'next/script';
import { AuthProvider } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
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
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
