import type { Metadata } from "next";
import "./globals.css";
import Preloader from "@/components/Preloader";
import { Toaster } from "@/components/ui/Toaster";

export const metadata: Metadata = {
  title: "F*ck Fast Fashion | Roorq.com",
  description: "Campus-exclusive weekly-drop fashion platform for IIT Roorkee",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Toaster />
        <Preloader />
        {children}
      </body>
    </html>
  );
}
