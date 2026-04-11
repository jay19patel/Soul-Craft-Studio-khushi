import { Geist, Climate_Crisis } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { GoogleOAuthProvider } from "@react-oauth/google";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const climateCrisis = Climate_Crisis({
  variable: "--font-climate-crisis",
  subsets: ["latin"],
});

export const metadata = {
  title: "Soul Craft Studio | Handcrafted Wool Art",
  description: "Discover our exclusive collection of handcrafted wool art, decorations, and unique keychains that tell a story.",
  icons: {
    icon: '/favicon.ico',
  },
};

import { AuthProvider } from "../context/AuthContext";

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${climateCrisis.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "your_google_client_id_here.apps.googleusercontent.com"}>
          <AuthProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>

    </html>
  );
}
