import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/store/store-provider";
import { Sidebar } from "@/components/layout/sidebar";

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
    <html lang="es" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <StoreProvider>
          <Sidebar />
          <main className="flex-1 w-full md:pl-64 pb-16 md:pb-0">
            {children}
          </main>
        </StoreProvider>
      </body>
    </html>
  );
}
