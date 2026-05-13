import { getFooterSettings } from "@/lib/site-settings";

export default async function Footer() {
  const { text, enabled } = await getFooterSettings();
  if (!enabled || !text.trim()) return null;

  return (
    <footer className="mt-auto border-t border-token py-6 text-center text-sm text-muted">
      <p className="mx-auto max-w-3xl px-4">{text}</p>
    </footer>
  );
}
