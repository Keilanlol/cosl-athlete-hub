import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: "#ED2939" }}
            />
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: "#003F87" }}
            />
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">
            COSL<span className="text-indigo-500">x</span>Bloobiz
          </h1>
          <p className="mt-1 text-sm text-slate-500">Games Management Platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
