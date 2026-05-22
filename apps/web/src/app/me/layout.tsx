import StudentLeftMenu from "@/components/StudentLeftMenu";

export default function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full">
      <StudentLeftMenu />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
