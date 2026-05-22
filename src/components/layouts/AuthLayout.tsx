import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1A1A1A] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo-cosl.png"
            alt="COSL — Comité Olympique et Sportif Luxembourgeois"
            className="h-32 w-auto"
          />
          <p className="text-[#F5F5F5] text-xs uppercase tracking-[0.2em] font-medium mt-2">
            Plateforme de gestion sportive
          </p>
        </div>
        <div className="rounded-lg bg-white shadow-2xl p-8">{children}</div>
        <p className="text-center text-[#717171] text-xs">
          COSLxBloobiz — Luxembourg Online S.A.
        </p>
      </div>
    </div>
  );
}
