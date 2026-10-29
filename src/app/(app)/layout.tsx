import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerContext } from "@/lib/enrolment";
import { NotEnrolledNotice } from "@/components/app-shell/NotEnrolledNotice";
import { PushNotificationBanner } from "@/components/notifications/PushNotificationBanner";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/attendance", label: "Attendance" },
  { href: "/profile", label: "Profile" },
] as const;

/**
 * The app shell, and its gate: Academy is for people enrolled on a programme.
 *
 * Signing in proves who someone is; an enrolment is what gives them anything here. Without
 * one, every screen would be empty in a way that looks broken, so the whole app is replaced
 * by a notice that says where they stand.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const learner = await getLearnerContext();

  // Middleware already sends a signed-out request to /login; this covers the gap.
  if (!learner) redirect("/login");

  if (learner.enrolments.length === 0) return <NotEnrolledNotice />;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between px-5 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Bauhaven Hub" className="h-6 w-6 rounded-md object-contain" />
          <span className="font-display text-sm font-bold text-neutral-900">Bauhaven Hub</span>
        </div>
        <a
          href="/downloads/bauhaven-hub.apk"
          download="bauhaven-hub.apk"
          className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition"
          title="Download Android App"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Get App</span>
        </a>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-24">
        <PushNotificationBanner />
        {children}
      </main>

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
