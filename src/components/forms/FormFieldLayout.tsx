import { cn } from "@/lib/utils";
import { FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import type { ReactNode } from "react";

type Props = {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
};

export function FormFieldLayout({
  label,
  htmlFor,
  required,
  error,
  children,
  className,
}: Props) {
  return (
    <FormItem className={cn("space-y-1.5", className)}>
      <FormLabel htmlFor={htmlFor} className="font-medium text-sm">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </FormLabel>
      <FormControl>{children}</FormControl>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <FormMessage />
      )}
    </FormItem>
  );
}