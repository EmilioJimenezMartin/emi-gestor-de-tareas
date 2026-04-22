import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "emi-gestor-de-tareas",
  description: "Gestor de tareas: Next.js + Fastify + MongoDB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
