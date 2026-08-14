import { SignOutButton } from "@/components/profile/SignOutButton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MyApplication } from "@/lib/application-status";

/**
 * What somebody sees between signing up and being approved.
 *
 * **Academy had no gate at all before this.** Any signed-in account got the whole app, so
 * a pending applicant would have seen Tasks, Attendance, Requests and Profile — all empty,
 * because they have no enrolment and no role. Empty screens read as "this is broken", not
 * as "you're not approved yet", and the person can't tell which.
 *
 * The four states below say genuinely different things, so they aren't collapsed into one
 * "pending" message. `declined` in particular has to be honest and still leave a door open,
 * because the decision recorded for declines is that the account stays and they can apply
 * again.
 */
export function PendingApprovalNotice({ application }: { application: MyApplication | null }) {
  const content = describe(application);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Card>
        <CardContent className="py-8 text-center">
          {content.badge && (
            <div className="mb-4 flex justify-center">
              <Badge variant={content.badge.variant}>{content.badge.label}</Badge>
            </div>
          )}

          <h1 className="font-display mb-2 text-lg font-bold">{content.title}</h1>
          <p className="mx-auto mb-2 max-w-xs text-sm text-neutral-500">{content.body}</p>

          {application?.programName && (
            <p className="mx-auto max-w-xs text-xs text-neutral-400">
              {application.programName}
              {application.appliedOn && ` · applied ${application.appliedOn}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* The only control here. Somebody on this screen has exactly one thing they can
          usefully do, and there's no app shell around them to offer it. */}
      <div className="mt-6">
        <SignOutButton />
      </div>
    </main>
  );
}

function describe(application: MyApplication | null): {
  title: string;
  body: string;
  badge: { label: string; variant: "warning" | "neutral" | "danger" } | null;
} {
  if (!application) {
    /*
     * No application at all. Reachable three ways: an Admin created the account without
     * one, it was seeded, or the application insert failed right after sign-up. All three
     * leave somebody signed in with nothing to do, so this says who to ask rather than
     * pretending a review is under way.
     */
    return {
      title: "Your account isn't set up yet",
      body: "You're signed in, but you're not enrolled on a programme and there's no application on file. Speak to Bauhaven and they'll sort it out.",
      badge: null,
    };
  }

  switch (application.status) {
    case "submitted":
      return {
        title: "Your application is with us",
        body: "Someone at Bauhaven will look at it and get back to you. Once you're approved, everything opens up here — tasks, attendance, and the rest.",
        badge: { label: "Being reviewed", variant: "warning" },
      };
    case "confirmed":
      /*
       * A real, separate state: Staff have looked and passed it on, but final approval is
       * an Admin's. Worth distinguishing — "someone has read it" is meaningfully different
       * news from "it's in a queue", and it's the honest answer at that point.
       */
      return {
        title: "You've passed the first review",
        body: "Your application has been checked and is waiting on final approval. Nothing more is needed from you.",
        badge: { label: "Almost there", variant: "neutral" },
      };
    case "approved":
      /*
       * Approved but still here means the enrolment or the role grant didn't land — the
       * approval writes three things and nothing makes them atomic. Saying "you're
       * approved, but something's incomplete" beats leaving them staring at a pending
       * message that is now false.
       */
      return {
        title: "You're approved — one step left",
        body: "Your application was approved, but your programme place hasn't finished setting up. Let Bauhaven know and they can finish it.",
        badge: { label: "Approved", variant: "neutral" },
      };
    case "declined":
      return {
        title: "This application wasn't accepted",
        body: "Your account stays open, so you can apply again for another programme or a later intake. Speak to Bauhaven if you'd like to know more.",
        badge: { label: "Not accepted", variant: "danger" },
      };
  }
}
