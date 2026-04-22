import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/store/store-provider";

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
      <body className="min-h-full flex flex-col">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
