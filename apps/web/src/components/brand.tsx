import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="ChangeLens dashboard">
      <Image src="/brand/mark.svg" alt="" width={36} height={36} priority />
      {!compact && (
        <span>
          Change<span>Lens</span>
        </span>
      )}
    </Link>
  );
}
