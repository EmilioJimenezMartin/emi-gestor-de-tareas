// Login page has its own layout — no navigation or auth guard
export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
