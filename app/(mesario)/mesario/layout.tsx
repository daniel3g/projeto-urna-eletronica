export default function MesarioLayout({ children }: LayoutProps<"/mesario">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
