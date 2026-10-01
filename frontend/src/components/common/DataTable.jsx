import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/common/Ui";

export function DataTable({ columns, rows, loading, empty, onRowClick, testid }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px]" data-testid={testid}>
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-slate-200">
              {columns.map((c) => (
                <th key={c.key} className="text-xs font-bold uppercase tracking-wider text-slate-600 text-left py-3 px-4 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  <Loader2 className="animate-spin inline mr-2" size={18} /> Memuat...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-2">
                  <EmptyState title={empty || "Tidak ada data"} />
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-slate-100 text-sm text-slate-800 hover:bg-slate-50/80 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  data-testid={`row-${row.id || i}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="py-3 px-4 whitespace-nowrap">
                      {c.render ? c.render(row) : row[c.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
