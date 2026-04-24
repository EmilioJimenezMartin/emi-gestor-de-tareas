"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Home as HomeIcon, CheckSquare, Settings } from "lucide-react";

export function NavItem({ icon, label, href }: { icon: React.ReactNode, label: string, href: string }) {
    const pathname = usePathname();
    const active = pathname === href;

    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${active ? 'bg-primary/10 text-primary' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
        >
            <span className={active ? 'text-primary' : 'group-hover:text-white transition-colors'}>
                {icon}
            </span>
            <span className="font-semibold text-sm">{label}</span>
        </Link>
    );
}

export function MobileNavItem({ icon, href }: { icon: React.ReactNode, href: string }) {
    const pathname = usePathname();
    const active = pathname === href;

    return (
        <Link
            href={href}
            className={`p-3 rounded-2xl transition-all duration-200 ${active ? 'text-primary bg-primary/5' : 'text-neutral-500'}`}
        >
            {icon}
        </Link>
    );
}
