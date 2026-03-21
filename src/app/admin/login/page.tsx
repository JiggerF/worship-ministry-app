import { headers } from "next/headers";
import { Suspense } from "react";
import Spinner from "@/app/components/Spinner";
import { AdminLoginForm } from "./LoginForm";

// Page shell — statically renderable. <Suspense> satisfies Next.js's requirement
// that any component calling useSearchParams() is wrapped in a suspense boundary.
export default async function AdminLoginPage() {
  const h = await headers();
  const orgName = h.get("x-tenant-name") ?? "Worship Ministry";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="max-w-sm w-full bg-white rounded-xl border border-gray-200 p-6 flex justify-center">
            <Spinner />
          </div>
        }
      >
        <AdminLoginForm orgName={orgName} />
      </Suspense>
    </div>
  );
}
