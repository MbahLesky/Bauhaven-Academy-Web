import { redirect } from "next/navigation";

export default function RootPage() {
  // Auth check belongs here once middleware/auth is wired up.
  redirect("/dashboard");
}
