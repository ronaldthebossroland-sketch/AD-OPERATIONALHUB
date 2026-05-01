export default function SectionHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div className="flex items-center gap-3">
        <div className="luxury-soft-icon rounded-2xl bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {action}
    </div>
  );
}
