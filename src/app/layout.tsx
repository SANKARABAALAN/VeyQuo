import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VEYQUO - See every choice. Know the right one.",
  description: "VEYQUO AI Decision Intelligence Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Geist:wght@500&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col bg-[#08090B] text-[#e3e2e5]">
        {children}
      </body>
    </html>
  );
}
