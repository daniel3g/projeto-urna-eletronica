export default function UrnaLayout({ children }: LayoutProps<"/urna">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-950 text-neutral-50">
      {children}
    </div>
  );
}
