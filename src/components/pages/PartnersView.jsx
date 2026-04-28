import { UserRoundCheck } from "lucide-react";

import { partnerBriefs } from "../../data/mockData";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export default function PartnersView() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {partnerBriefs.map((partner) => (
        <Card
          key={partner.id}
          className="rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-100 p-3">
                <UserRoundCheck className="h-6 w-6 text-slate-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  {partner.name}
                </h3>
                <p className="text-sm text-slate-500">
                  Last contact: {partner.lastContact}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-slate-50 p-5">
              <p className="text-sm font-bold text-slate-700">Milestone</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {partner.milestone}
              </p>
            </div>

            <div className="mt-4 rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-sm font-bold">Suggested next step</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {partner.nextStep}
              </p>
            </div>

            <Button className="mt-5 w-full rounded-2xl">
              Draft Follow-up Email
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
