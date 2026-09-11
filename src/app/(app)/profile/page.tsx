import Link from "next/link";
import { getProfile, type Profile } from "@/lib/profile-queries";
import { getInitials } from "@/lib/initials";
import { SignOutButton } from "@/components/profile/SignOutButton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Per-user, never statically cached across users.
export const dynamic = "force-dynamic";

const PROFILE_LINKS = [
  { href: "/testimony", label: "My feedback" },
  { href: "/requests", label: "My requests" },
  { href: "/report", label: "Reported issues" },
] as const;

export default async function ProfilePage() {
  // A failed read throws to error.tsx: a signed-in person always has a profile, so a blank
  // one is a fault, not a state.
  const profile = await getProfile();

  return (
    <div className="pt-2">
      <ProfileHeader profile={profile} />

      <Card className="mb-5 divide-y divide-neutral-200">
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

      <ContactSection profile={profile} />
      <ProgrammesSection programmes={profile.programmes} />

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
        // next/image needs a configured remote host; photos aren't uploaded from Academy yet.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="font-display flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-lg font-bold text-white"
        >
          {getInitials(profile.name)}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="font-display truncate text-lg font-bold">{profile.name}</h1>
        <p className="truncate text-sm text-neutral-500">{profile.email}</p>
      </div>
    </div>
  );
}

/**
 * Contact and learner details, read-only. The email and phone are also sign-in details, and
 * changing them safely needs a re-verification flow of its own.
 */
function ContactSection({ profile }: { profile: Profile }) {
  const details = [
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone },
    { label: "Location", value: profile.location },
    { label: "Education", value: profile.education },
  ];

  return (
    <>
      <SectionTitle>Your details</SectionTitle>
      <Card className="mb-5 divide-y divide-neutral-200">
        {details.map((detail) => (
          <Row key={detail.label} label={detail.label}>
            {/* An empty field says so, rather than a blank that reads like a loading failure. */}
            <span className="truncate text-sm text-neutral-500">{detail.value ?? "Not set"}</span>
          </Row>
        ))}
      </Card>
      <p className="-mt-3 mb-5 text-[11px] text-neutral-500">Ask your coordinator to update these for now.</p>
    </>
  );
}

function ProgrammesSection({ programmes }: { programmes: Profile["programmes"] }) {
  return (
    <>
      <SectionTitle>Your programmes</SectionTitle>
      {programmes.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">No programmes yet.</CardContent>
        </Card>
      ) : (
        <Card className="divide-y divide-neutral-200">
          {programmes.map((programme) => (
            <div key={programme.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <span className="min-w-0 text-sm">
                <span className="font-medium">{programme.label}</span>
                <span className="text-neutral-500"> — {programme.role}</span>
              </span>
              <Badge variant="success" className="shrink-0">
                {programme.status}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-5 py-3">
      <span className="shrink-0 text-sm">{label}</span>
      {children}
    </div>
  );
}
