import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/store/store-provider";
import { LayoutGrid, Home as HomeIcon, CheckSquare, Settings, User, Bell } from "lucide-react";

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
          <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar - Desktop */}
            <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-background/50 backdrop-blur-xl">
              <div className="p-6">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-lg">e</div>
                  <span className="font-bold tracking-tight text-xl">emi</span>
                </div>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-1">
                <NavItem icon={<HomeIcon size={20} />} label="Hogar" active />
                <NavItem icon={<CheckSquare size={20} />} label="Tareas" />
                <NavItem icon={<LayoutGrid size={20} />} label="Dashboard" />
                <NavItem icon={<Settings size={20} />} label="Ajustes" />
              </nav>

              <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-white/10">
                    <User size={20} className="text-neutral-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Emilio</span>
                    <span className="text-[11px] text-neutral-500">Plan Premium</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-y-auto">
              {/* Header */}
              <header className="sticky top-0 z-30 h-16 border-b border-white/5 bg-background/80 backdrop-blur-xl px-6 flex items-center justify-between">
                <div className="md:hidden flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary flex items-center justify-center font-bold text-sm">e</div>
                  <span className="font-bold text-lg">emi</span>
                </div>
                <div className="hidden md:block">
                  <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-widest px-2">Gestor de Tareas</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2.5 rounded-full hover:bg-white/5 transition-colors relative">
                    <Bell size={20} className="text-neutral-400" />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
                  </button>
                  <div className="md:hidden w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-white/10">
                    <User size={16} className="text-neutral-400" />
                  </div>
                </div>
              </header>

              <div className="p-4 md:p-8 max-w-5xl mx-auto w-full pb-32 md:pb-8">
                {children}
              </div>
            </main>

            {/* Tab Bar - Mobile */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 glass border-t border-white/10 px-6 flex items-center justify-around z-50">
              <MobileNavItem icon={<HomeIcon size={24} />} active />
              <MobileNavItem icon={<CheckSquare size={24} />} />
              <div className="-mt-12">
                <button className="w-14 h-14 bg-primary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center text-white active:scale-95 transition-transform">
                  <span className="text-3xl font-light">+</span>
                </button>
              </div>
              <MobileNavItem icon={<LayoutGrid size={24} />} />
              <MobileNavItem icon={<Settings size={24} />} />
            </nav>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-200 group ${active ? 'bg-primary/10 text-primary' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}>
      <span className={active ? 'text-primary' : 'group-hover:text-white transition-colors'}>
        {icon}
      </span>
      <span className="font-semibold text-sm">{label}</span>
    </div>
  );
}

function MobileNavItem({ icon, active = false }: { icon: React.ReactNode, active?: boolean }) {
  return (
    <div className={`p-3 rounded-2xl transition-all duration-200 ${active ? 'text-primary bg-primary/5' : 'text-neutral-500'}`}>
      {icon}
    </div>
  );
}
