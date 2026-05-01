export function Button({ children, className = "", variant = "default", ...props }) {
  const base =
    "inline-flex items-center justify-center px-4 py-2 text-sm font-black rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  const styles = {
    default: "luxury-button-primary bg-slate-950 text-white hover:bg-slate-800",
    outline:
      "luxury-button-outline border border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    darkOutline:
      "luxury-button-dark-outline border border-white/30 bg-slate-900 text-white hover:bg-slate-800",
  };

  return (
    <button
      className={`${base} ${styles[variant] || styles.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
