export function formatDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d.length === 10 ? d + "T00:00:00" : d);
    return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

export function formatDateTime(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export function initials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export const ATTENDANCE_STATUS_STYLE = {
  hadir: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  terlambat: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  izin: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  sakit: { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
  dinas: { bg: "#EEF2FF", text: "#3730A3", border: "#C7D2FE" },
  cuti: { bg: "#F0FDFA", text: "#0F766E", border: "#99F6E4" },
  tanpa_keterangan: { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3" },
};

export const DUE_STATUS_STYLE = {
  aman: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "Aman" },
  mendekati: { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A", label: "Mendekati" },
  jatuh_tempo: { bg: "#FFEDD5", text: "#C2410C", border: "#FED7AA", label: "Jatuh Tempo" },
  terlambat: { bg: "#FFE4E6", text: "#E11D48", border: "#FECDD3", label: "Terlambat" },
};
