import Link from "next/link";
import { SignOutButton } from "@/components/app-shell/SignOutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/attendance", label: "Attendance" },
  { href: "/profile", label: "Profile" },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex h-14 flex-shrink-0 items-center justify-between px-5">
        {/* Wordmark only for now — real logo asset not yet provided, see Bauhaven-Brand-Guidelines.md */}
        <span className="font-display text-sm font-bold">Bauhaven Academy</span>
        {/* Temporary home for sign-out until the Profile screen exists to hold it
            properly — see SignOutButton. Everything under this layout is already
            behind middleware's session gate, so this is always a real session. */}
        <SignOutButton />
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 border-t border-neutral-200 bg-white px-2 pb-2 pt-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[11px] font-semibold text-neutral-400"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
