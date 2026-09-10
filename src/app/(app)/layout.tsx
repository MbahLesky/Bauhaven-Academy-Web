import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyApplication } from "@/lib/application-status";
import { PendingApprovalNotice } from "@/components/app-shell/PendingApprovalNotice";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/attendance", label: "Attendance" },
  { href: "/profile", label: "Profile" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  /**
   * **The gate Academy has never had.**
   *
   * Middleware guarantees a session and that was the whole check, so any signed-in account
   * got the entire app. That was harmless while accounts existed only by invitation — an
   * invited student is enrolled by definition. Self-signup breaks that: somebody applying
   * has a valid session and no enrolment, and would have landed on Tasks, Attendance and
   * Requests, all empty. Empty screens read as "broken", not as "not approved yet".
   *
   * Enrolment is the test rather than the role, because enrolment is what every screen
   * below actually needs — tasks, attendance and requests are all scoped to a programme.
   * Somebody with a role but no active enrolment (a finished student, an applicant
   * approved but not yet placed) is in the same position as an applicant: nothing here
   * works for them, and saying so beats showing empty lists.
   */
  const supabase = await createClient();

  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    // Fails closed, and says so through the same screen — an unverifiable enrolment is not
    // an enrolment, and rendering the app on a failed check would show empty screens with
    // no explanation, which is the exact confusion this gate exists to prevent.
    console.error("Enrollment gate lookup failed:", error.code, error.message);
    return <PendingApprovalNotice application={null} />;
  }

  if (!enrollment) {
    // Only queried when the gate is closed — the common path costs nothing.
    return <PendingApprovalNotice application={await getMyApplication()} />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex h-14 flex-shrink-0 items-center px-5">
        {/* Wordmark only for now — real logo asset not yet provided, see Bauhaven-Brand-Guidelines.md */}
        <span className="font-display text-sm font-bold">Bauhaven Academy</span>
        {/* Sign-out used to sit here as a stopgap through the Auth pass. It now lives on
            the Profile screen, where the wireframe puts it and where the Profile tab in
            the nav below reaches in one tap. */}
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
