export function Button({ children, className = "", variant = "default", ...props }) {
  const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50";

  const styles = {
    default: "bg-slate-950 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    darkOutline:
      "border border-white/30 bg-slate-900 text-white hover:bg-slate-800",
  };

  return (
    <button className={`${base} ${styles[variant] || styles.default} ${className}`} {...props}>
      {children}
    </button>
  );
}
