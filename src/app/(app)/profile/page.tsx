import Link from "next/link";
import { getProfile, type Profile } from "@/lib/profile-queries";
import { getInitials } from "@/lib/initials";
import { LanguageToggle } from "@/components/profile/LanguageToggle";
import { SignOutButton } from "@/components/profile/SignOutButton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Per-user, never statically cached across users.
export const dynamic = "force-dynamic";

/** The three list links the wireframe puts here, pointing at screens that already exist. */
const PROFILE_LINKS = [
  { href: "/testimony", label: "My testimonies" },
  { href: "/requests", label: "My requests" },
  { href: "/report", label: "Reported issues" },
] as const;

export default async function ProfilePage() {
  const { profile, error } = await getProfile();

  // Hands off to error.tsx. There's no meaningful empty state here — a signed-in person
  // always has at least a name and an email — so a blank profile is a fault, not a state.
  if (error || !profile) {
    console.error("Academy profile fetch failed:", error);
    throw new Error("Couldn't load your profile.");
  }

  return (
    <div className="pt-2">
      <ProfileHeader profile={profile} />

      <Card className="mb-5 divide-y divide-neutral-200">
        <Row label="Language">
          <LanguageToggle current={profile.language} />
        </Row>

        {PROFILE_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="block">
            <Row label={link.label}>
              <span aria-hidden="true" className="text-neutral-300">
                ›
              </span>
            </Row>
          </Link>
        ))}
      </Card>

      {/*
        The toggle writes `users.preferred_language` for real, and the testimony form
        already reads it — so this is a working setting, not a placeholder. What it can't
        do yet is translate the interface: next-intl has never been set up in either app.
        Saying so is better than letting someone tap FR and conclude the app is broken.
      */}
      <p className="mb-5 -mt-3 text-[11px] text-neutral-500">
        Your language is saved and used for anything you write. The app&apos;s own labels
        are still English only — translation is coming.
      </p>

      <ContactSection profile={profile} />
      <RolesSection roles={profile.roles} />

      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}

function ProfileHeader({ profile }: { profile: Profile }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      {profile.photoUrl ? (
        // next/image needs a configured remote host, and no storage bucket exists to
        // know the host of yet. Revisit when photo upload lands.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.photoUrl}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="font-display flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-lg font-bold text-white"
        >
          {getInitials(profile.name)}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="font-display truncate text-lg font-bold">{profile.name}</h1>
        {profile.email && (
          <p className="truncate text-sm text-neutral-500">{profile.email}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Contact details, read-only this pass.
 *
 * The columns are all there and `users_update_own` would allow the writes — but `email`
 * and `phone` are also the credentials someone signs in with, and `public.users` holds
 * them separately from `auth.users`. Changing one without the other silently desynchronises
 * an account from its login, which is a worse outcome than not offering the edit yet. It
 * needs `supabase.auth.updateUser` and a re-verification flow, which is its own piece of
 * work. `location` alone would be an edit control for one field of three.
 */
function ContactSection({ profile }: { profile: Profile }) {
  const details = [
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone },
    { label: "Location", value: profile.location },
  ];

  return (
    <>
      <SectionTitle>Contact information</SectionTitle>
      <Card className="mb-5 divide-y divide-neutral-200">
        {details.map((detail) => (
          <Row key={detail.label} label={detail.label}>
            <span className="text-sm text-neutral-500">
              {/* An empty field says so, rather than rendering a blank the student can't
                  tell apart from a loading failure. */}
              {detail.value ?? "Not set"}
            </span>
          </Row>
        ))}
      </Card>
      <p className="mb-5 -mt-3 text-[11px] text-neutral-500">
        Ask a mentor to update these for now.
      </p>
    </>
  );
}

/**
 * Roles, read-only.
 *
 * **Not a switcher.** Choosing which role's data a session acts as needs a real "acting
 * as" concept — somewhere to persist it, and screens whose content actually varies by it —
 * and none of that exists. A dropdown that changed nothing would be worse than a list that
 * is honest about being a list. See `Bauhaven-Academy-Feature-Spec.md` §7, "Profile".
 */
function RolesSection({ roles }: { roles: Profile["roles"] }) {
  return (
    <>
      <SectionTitle>Roles</SectionTitle>
      {roles.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">
            No active roles yet — a mentor or admin assigns these.
          </CardContent>
        </Card>
      ) : (
        <Card className="divide-y divide-neutral-200">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <span className="min-w-0 text-sm">
                <span className="font-medium">{role.label}</span>
                {role.programName && (
                  <span className="text-neutral-500"> — {role.programName}</span>
                )}
              </span>
              <Badge variant="success" className="flex-shrink-0">
                Active
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-5 py-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
