import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { previewInvitation } from "@/lib/accept-invitation";
import { AcceptForm } from "@/components/invite/AcceptForm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Accepting an invitation.
 *
 * Lives in the `(auth)` group, not `(app)` — the whole point is that the person opening it
 * has no account yet, so middleware must not bounce them to `/login`. See `middleware.ts`,
 * where `/invite` joins `/login` as a route reachable without a session.
 *
 * `params` is a Promise in this version of Next — awaited, not destructured in the
 * signature.
 */
export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const [invitation, { data: { user } }] = await Promise.all([
    previewInvitation(token),
    supabase.auth.getUser(),
  ]);

  // One message for invalid, used and expired alike. Distinguishing them would tell
  // whoever found the link which one it is — and confirm that an address was invited.
  if (!invitation) return <InvalidNotice />;

  // A different account being signed in is its own trap: accepting would grant the role to
  // *them*, not to the person invited. `redeem_invitation` refuses on the email check, but
  // saying so up front beats letting someone press a button that can only fail.
  if (user && user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return <WrongAccountNotice signedInAs={user.email ?? "another account"} invited={invitation.email} />;
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-10">
      <h1 className="font-display text-xl font-bold">You&apos;ve been invited</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        Set up your Bauhaven Academy account as {invitation.roleLabel}.
      </p>

      <AcceptForm
        token={token}
        email={invitation.email}
        signedIn={!!user}
        destination="/dashboard"
      />
    </div>
  );
}

function InvalidNotice() {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-10">
      <Card><CardContent className="py-8 text-center">
        <p className="font-display mb-1.5 text-sm font-bold">This link isn&apos;t valid</p>
        <p className="mx-auto mb-5 max-w-xs text-sm text-neutral-500">
          It may have been used already, or expired. Ask whoever invited you to send a new
          one — they can do that in seconds.
        </p>
        <Link href="/login" className="text-sm font-semibold text-accent">
          Go to sign in
        </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function WrongAccountNotice({
  signedInAs,
  invited,
}: {
  signedInAs: string;
  invited: string;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-10">
      <Card><CardContent className="py-8 text-center">
        <p className="font-display mb-1.5 text-sm font-bold">Signed in as someone else</p>
        <p className="mx-auto mb-5 max-w-xs text-sm text-neutral-500">
          This invitation is for <span className="font-semibold">{invited}</span>, but
          you&apos;re signed in as <span className="font-semibold">{signedInAs}</span>. Sign
          out and open the link again.
        </p>
        <Link href="/login" className="text-sm font-semibold text-accent">
          Go to sign in
        </Link>
        </CardContent>
      </Card>
    </div>
  );
}
