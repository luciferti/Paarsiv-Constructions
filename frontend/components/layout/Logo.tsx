import Link from "next/link";

/** "Site Plan" wordmark — circle-cross survey mark + mono type. */
export function Wordmark({
  href = "/",
  dark = false,
  label = "HRMS AI-OS",
}: {
  href?: string;
  dark?: boolean;
  label?: string;
}) {
  return (
    <Link href={href} className={`wordmark${dark ? " wordmark-dark" : ""}`}>
      <span className="mark" aria-hidden="true" />
      {label}
    </Link>
  );
}
