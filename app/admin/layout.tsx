import "./admin-shell.css";
import AdminShell from "./AdminShell";

// Scoping wrapper for the admin/backend surface. `display:contents` (set in
// globals.css) means it adds zero layout — it exists purely as a CSS hook so
// the glass theme can frost the admin's solid-dark modals/bars (which the
// global rule would otherwise turn transparent over the gradient).
// AdminShell adds the shared topbar + tab nav around every admin page.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tcc-admin">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
