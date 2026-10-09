import { Suspense } from "react";
import { VerifyEmailClient } from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading verification</main>}>
      <VerifyEmailClient />
    </Suspense>
  );
}
