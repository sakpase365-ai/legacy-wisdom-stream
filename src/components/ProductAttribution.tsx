/** Attaches Breadcrumbs to the Ron Carpenter AI product family and native mobile apps. */
export default function ProductAttribution({ className }: { className?: string }) {
  return (
    <p
      className={
        className ??
        'text-center text-[11px] text-muted-foreground/55 leading-relaxed tracking-wide max-w-sm mx-auto'
      }
    >
      <span className="text-muted-foreground/75">Ron Carpenter AI</span>
      {' — '}
      Breadcrumbs on <span className="text-muted-foreground/75">iOS</span>
      ,{' '}
      <span className="text-muted-foreground/75">Android</span>
      , and the web.
    </p>
  );
}
