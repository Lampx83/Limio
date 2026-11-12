import Link from "next/link";
import type { SpaceBrand } from "@/lib/space/types";

/** Chân trang cho các trang thuộc một space: về trang chủ space, không dẫn ra khu Limio chung. */
export default function SpaceFooter({ space }: { space: SpaceBrand }) {
  return (
    <footer className="mt-auto border-t-4 border-[rgb(var(--brand))] py-6 text-sm text-muted">
      <nav aria-label={space.name} className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4">
        <Link href={space.homeHref} className="link font-semibold" prefetch={false}>
          {space.name}
        </Link>
        <Link href={`${space.homeHref}#courses`} className="link" prefetch={false}>
          Courses
        </Link>
      </nav>
      <p className="mx-auto mt-3 max-w-3xl px-4 text-center text-xs">
        {space.poweredByLabel}{" "}
        <Link href="/" className="link font-semibold">
          Limio
        </Link>
      </p>
    </footer>
  );
}
