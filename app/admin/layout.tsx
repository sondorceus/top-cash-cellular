// Scoping wrapper for the admin/backend surface. `display:contents` (set in
// globals.css) means it adds zero layout — it exists purely as a CSS hook so
// the glass theme can frost the admin's solid-dark modals/bars (which the
// global rule would otherwise turn transparent over the gradient).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="tcc-admin">{children}</div>;
}
