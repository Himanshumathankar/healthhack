import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm">Loading password reset...</p>}
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
