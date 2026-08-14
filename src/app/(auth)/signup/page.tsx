import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Sign up and apply, in one step.
 *
 * In the `(auth)` group so middleware lets it through without a session — the whole point
 * is that the person has no account yet.
 *
 * The programme list comes from the real `programs` table rather than the marketing site's
 * category slugs. `programs_select_all` is `using (true)`, so an anonymous visitor can read
 * the catalogue — which means an approved application already names the cohort to enrol
 * them on, and nobody has to map a slug to a programme afterwards.
 */
export default async function SignUpPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("programs")
    .select("id, title_en")
    .order("title_en", { ascending: true });

  if (error) {
    console.error("Programme list failed:", error.code, error.message);
  }

  const programs = (data ?? []).map((row) => ({ id: row.id, title: row.title_en }));

  return (
    <div className="mx-auto w-full max-w-md px-5 py-10">
      <h1 className="font-display text-xl font-bold">Apply to Bauhaven</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        Tell us a little about yourself and choose what you&apos;d like to join.
      </p>

      {programs.length === 0 ? (
        /*
         * No programmes to apply to. Real and worth its own state: an empty catalogue means
         * the form cannot be completed at all, and `program_id` is required. Showing the
         * form with an empty picker would let someone fill everything in and then fail.
         */
        <Card>
          <CardContent className="py-8 text-center">
            <p className="font-display mb-1.5 text-sm font-bold">
              Nothing open for applications
            </p>
            <p className="mx-auto mb-5 max-w-xs text-sm text-neutral-500">
              There are no programmes taking applications right now. Check back, or get in
              touch with Bauhaven directly.
            </p>
            <Link href="/login" className="text-sm font-semibold text-accent">
              Go to sign in
            </Link>
          </CardContent>
        </Card>
      ) : (
        <SignUpForm programs={programs} />
      )}
    </div>
  );
}
