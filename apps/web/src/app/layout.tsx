import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/store/store-provider";
import { NavigationWrapper } from "@/components/layout/navigation-wrapper";

export const metadata: Metadata = {
  title: "emi | Gestor de Tareas",
  description: "Gestión de tareas premium inspirada en Revolut",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased selection:bg-primary/30">
        <StoreProvider>
          <NavigationWrapper>
            {children}
          </NavigationWrapper>
        </StoreProvider>
      </body>
    </html>
  );
}

