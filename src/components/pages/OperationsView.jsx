import { Building2, Radio, WalletCards } from "lucide-react";

import SectionHeader from "../shared/SectionHeader";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export default function OperationsView({ setAlerts }) {
  function addOperationalAlert() {
    const newAlert = {
      id: Date.now(),
      type: "Operations",
      title: "AI generated operations alert",
      detail:
        "Operational pressure detected across finance, property, and follow-up tasks.",
      severity: "High",
      icon: Radio,
    };

    setAlerts((prev) => [newAlert, ...prev]);
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Button onClick={addOperationalAlert} className="rounded-2xl">
          Generate Smart Alert
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={WalletCards}
              title="Finance Snapshot"
              subtitle="Budget and anomaly monitoring"
            />

            <div className="space-y-4">
              <div className="rounded-3xl bg-red-50 p-5 text-red-900">
                <h3 className="font-black">Vendor Rate Spike</h3>
                <p className="mt-2 text-sm leading-6">
                  Catering logistics estimate is 18% above the previous approved
                  rate. Compare vendor options before approval.
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <h3 className="font-black text-slate-950">Forecast</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Upcoming outreach expenses may exceed current allocation if
                  transport and media logistics are approved together.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Building2}
              title="Property Snapshot"
              subtitle="Maintenance and renewal tracking"
            />

            <div className="space-y-4">
              <div className="rounded-3xl bg-red-50 p-5 text-red-900">
                <h3 className="font-black">Urgent Generator Room Repair</h3>
                <p className="mt-2 text-sm leading-6">
                  Technician report suggests risk of service interruption.
                  Approval recommended before next major service day.
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <h3 className="font-black text-slate-950">
                  Upcoming Maintenance
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  AC servicing is due this week. Assign technician and confirm
                  completion note.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
