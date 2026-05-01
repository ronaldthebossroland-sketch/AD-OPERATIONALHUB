import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Card, CardContent } from "../ui/card";

export default function SummaryCard({ icon: Icon, label, value, note }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Card className="luxury-summary-card rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="luxury-soft-icon rounded-2xl bg-slate-100 p-3">
              <Icon className="h-5 w-5 text-slate-700" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-5 text-sm font-medium text-slate-500">{label}</p>
          <h3 className="mt-1 text-3xl font-black text-slate-950">{value}</h3>
          <p className="mt-2 text-xs text-slate-500">{note}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
