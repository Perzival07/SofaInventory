import Image from "next/image";

/**
 * The shop's logo, in two forms.
 *
 *   "full" — the complete lockup: illustration plus the "Loknath" and
 *            "Sofa Center" wordmarks. Needs room; use at 96px and above.
 *   "mark" — just the circular illustration, cropped out of the lockup.
 *            At sidebar size the wordmarks inside the full logo render as an
 *            illegible smudge next to the shop name already set in real type,
 *            so small placements use the mark instead.
 */
export function Logo({
  size = 40,
  variant = "mark",
  priority = false,
  className = "",
}: {
  size?: number;
  variant?: "full" | "mark";
  priority?: boolean;
  className?: string;
}) {
  const src = variant === "full" ? "/logo.png" : "/logo-mark.png";

  return (
    <Image
      src={src}
      alt="Loknath Sofa Center"
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}
