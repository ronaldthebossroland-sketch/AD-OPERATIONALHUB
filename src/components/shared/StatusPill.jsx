export default function StatusPill({ status }) {
  const tone =
    status === "High" ||
    status === "Overdue" ||
    status === "At Risk" ||
    status === "Delayed"
      ? "bg-red-50 text-red-700 border-red-100"
      : status === "Medium" || status === "Pending"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-emerald-50 text-emerald-700 border-emerald-100";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tone}`}
    >
      {status}
    </span>
  );
}
