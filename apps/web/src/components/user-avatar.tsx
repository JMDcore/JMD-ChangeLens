import Image from "next/image";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 36,
  className = "",
}: {
  name: string;
  avatarUrl: string | null;
  size?: number;
  className?: string;
}) {
  const classes = ["user-avatar", className].filter(Boolean).join(" ");

  return avatarUrl ? (
    <span className={classes} style={{ width: size, height: size }}>
      <Image src={avatarUrl} alt={`${name} profile photo`} width={size} height={size} priority />
    </span>
  ) : (
    <span className={classes} style={{ width: size, height: size }} aria-label={name}>
      {initials(name)}
    </span>
  );
}
