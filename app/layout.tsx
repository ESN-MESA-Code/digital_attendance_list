import type { Metadata } from "next";
import "./globals.css";
import LegalFooter from "@/components/LegalFooter";

export const metadata: Metadata = {
  title: "MES Attendance",
  description: "Digital attendance lists for MESA events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 min-h-screen font-sans flex flex-col">
        <div className="flex-1">{children}</div>
        <LegalFooter />
      </body>
    </html>
  );
}
