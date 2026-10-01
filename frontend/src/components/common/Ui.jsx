import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6" data-testid={testid}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, accent = "#0B1F3A", testid }) {
  return (
    <div
      data-testid={testid}
      className="bg-white border border-slate-200 rounded-lg p-5 flex items-center justify-between shadow-sm relative overflow-hidden"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-[#0B1F3A] mt-1">{value}</p>
      </div>
      {Icon && (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}

export function StatusPill({ style, label, testid }) {
  return (
    <span
      data-testid={testid}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: style.bg, color: style.text, borderColor: style.border || style.text }}
    >
      {label}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Icon size={26} />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cn("bg-white border border-slate-200 shadow-sm rounded-lg", className)} {...props}>
      {children}
    </div>
  );
}
