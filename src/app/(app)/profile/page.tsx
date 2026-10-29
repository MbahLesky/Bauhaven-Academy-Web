import Link from "next/link";
import { getProfile, type Profile } from "@/lib/profile-queries";
import { ProfileHeaderEditor } from "@/components/profile/ProfileHeaderEditor";
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
  const profile = await getProfile();

  return (
    <div className="pt-2">
      <ProfileHeaderEditor
        initialName={profile.name}
        initialEmail={profile.email}
        initialPhotoUrl={profile.photoUrl}
      />

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

      <Card className="mt-5 p-4 bg-neutral-50/70 border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm text-neutral-900">Bauhaven Hub for Android</div>
            <div className="text-xs text-neutral-500">v1.1.2 (Build 4) • Standalone APK</div>
          </div>
          <a
            href="/downloads/bauhaven-hub.apk"
            download="bauhaven-hub.apk"
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
          >
            Download
          </a>
        </div>
      </Card>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}

/**
 * Contact and learner details.
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
            <span className="truncate text-sm text-neutral-500">{detail.value ?? "Not set"}</span>
          </Row>
        ))}
      </Card>
      <p className="-mt-3 mb-5 text-[11px] text-neutral-500">Contact coordinator to update contact or academic info.</p>
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
