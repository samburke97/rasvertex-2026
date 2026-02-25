// app/(list)/layout.tsx
import MainLayout from "@/components/layouts/MainLayout";

export default function ListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
