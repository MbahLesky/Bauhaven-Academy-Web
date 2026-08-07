import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects an unauthenticated request away from here, so
  // this is belt-and-braces rather than the only gate — but it means `/` sends
  // someone somewhere sensible rather than bouncing them through a dashboard
  // they can't see, which is what the previous unconditional redirect did.
  redirect(user ? "/dashboard" : "/login");
}
