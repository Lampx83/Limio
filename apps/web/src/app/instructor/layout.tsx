import InstructorLeftMenu from "@/components/InstructorLeftMenu";

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full">
      <InstructorLeftMenu />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
