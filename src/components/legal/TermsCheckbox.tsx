/** "I agree to the Terms of Service and Privacy Policy" — required on every way to sign up.
 *  Submits as `acceptTerms=on`; the server checks it too. */
export function TermsCheckbox({ name = "acceptTerms", checked, onChange }: {
  name?: string;
  /** Controlled use (forms that don't submit FormData) */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-(--color-text-primary) cursor-pointer">
      <input
        type="checkbox"
        name={name}
        required
        className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-primary)"
        {...(checked !== undefined ? { checked, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.checked) } : {})}
      />
      <span>
        I agree to the{" "}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-(--color-secondary) underline">Terms of Service</a>
        {" "}and{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-(--color-secondary) underline">Privacy Policy</a>.
      </span>
    </label>
  );
}

export const TERMS_REQUIRED = "Please agree to the Terms of Service and Privacy Policy.";
