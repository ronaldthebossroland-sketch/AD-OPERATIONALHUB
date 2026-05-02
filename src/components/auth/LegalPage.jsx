import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";

const lastUpdated = "May 2, 2026";
const supportEmail = "ronald.thebossroland@gmail.com";

const legalContent = {
  privacy: {
    title: "Privacy Policy",
    eyebrow: "AD Operational Hub",
    intro:
      "This Privacy Policy explains how Executive Virtual AI Assistant, operated as part of AD Operational Hub, collects, uses, and protects information when you use the app.",
    icon: ShieldCheck,
    sections: [
      {
        heading: "Information We Collect",
        body: [
          "Account information such as your name, email address, and sign-in provider details.",
          "Operational records you create or manage in the app, including meetings, tasks, reminders, calendar items, projects, partners, transcripts, approvals, emails, and operations.",
          "Optional Google account data only after you choose to connect Google or Gmail. This may include your Google profile, email address, and Gmail messages needed for features such as reading, summarizing, drafting, or sending emails.",
          "Voice and transcription input when you use voice assistant or transcription features.",
          "Technical information needed to keep the app secure and working, such as device type, browser/app environment, session state, and diagnostic logs.",
        ],
      },
      {
        heading: "How We Use Information",
        body: [
          "To authenticate you and keep your account secure.",
          "To create, update, organize, and retrieve your operational records.",
          "To power assistant features that help with meetings, tasks, reminders, emails, operations, partners, projects, approvals, and transcripts.",
          "To provide notifications, alarms, and reminders you request.",
          "To improve reliability, troubleshoot issues, and prevent misuse of the app.",
        ],
      },
      {
        heading: "Google API Data",
        body: [
          "If you connect Google or Gmail, the app only requests the permissions needed for the features you choose to use.",
          "Google user data is used to provide user-facing features such as sign-in, Gmail review, email drafting, and sending messages you authorize.",
          "Executive Virtual AI Assistant's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
        ],
      },
      {
        heading: "Sharing And Service Providers",
        body: [
          "We do not sell your personal information.",
          "We may process information through trusted service providers that help operate the app, including hosting, database, authentication, AI, voice, transcription, notification, and email services.",
          "Information may be disclosed when required by law, to protect users, or to secure the app.",
        ],
      },
      {
        heading: "Retention And Deletion",
        body: [
          "Operational records are retained while your account is active or as needed to provide the service.",
          "You can request deletion of your account data by contacting support.",
          "Some limited records may be retained where required for security, legal compliance, or audit purposes.",
        ],
      },
      {
        heading: "Contact",
        body: [
          `For privacy questions or deletion requests, contact ${supportEmail}.`,
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    eyebrow: "AD Operational Hub",
    intro:
      "These Terms of Service govern your use of Executive Virtual AI Assistant, operated as part of AD Operational Hub.",
    icon: FileText,
    sections: [
      {
        heading: "Use Of The App",
        body: [
          "You may use the app to manage executive operations, meetings, tasks, reminders, emails, approvals, transcripts, projects, partners, and related records.",
          "You are responsible for keeping your account credentials secure and for activity performed through your account.",
          "You agree not to misuse the app, interfere with its security, or use it for unlawful activity.",
        ],
      },
      {
        heading: "Connected Services",
        body: [
          "Some features depend on third-party services such as Google, Gmail, Supabase, AI providers, voice services, hosting providers, and notification services.",
          "When you connect a third-party service, you authorize the app to use that service only for the features you request.",
          "You can revoke third-party access through the provider's account settings.",
        ],
      },
      {
        heading: "AI And Voice Features",
        body: [
          "AI and voice assistant outputs are provided to help you work faster, but they may need review before you rely on them.",
          "You remain responsible for confirming dates, times, recipients, message content, reminders, and operational decisions before acting on them.",
        ],
      },
      {
        heading: "Availability",
        body: [
          "We aim to keep the app reliable, but service interruptions may occur because of maintenance, network issues, provider outages, or device settings.",
          "You should not rely on the app as the only place for emergency, legal, medical, financial, or safety-critical instructions.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "We may update these Terms as the app improves or legal requirements change.",
          "Continued use of the app after updates means you accept the updated Terms.",
        ],
      },
      {
        heading: "Contact",
        body: [`For questions about these Terms, contact ${supportEmail}.`],
      },
    ],
  },
};

export default function LegalPage({ type }) {
  const page = legalContent[type] || legalContent.privacy;
  const Icon = page.icon;

  return (
    <main className="luxury-auth min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <a
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </a>

        <article className="luxury-login-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <img
              src="/logo-mark.png"
              alt="AD Operational Hub logo"
              className="luxury-logo h-16 w-16 shrink-0 rounded-2xl shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                {page.eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {page.title}
              </h1>
              <p className="mt-3 text-sm font-bold text-slate-500">
                Last updated: {lastUpdated}
              </p>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                {page.intro}
              </p>
            </div>
            <div className="luxury-soft-icon hidden rounded-2xl bg-blue-50 p-3 text-blue-600 sm:block">
              <Icon className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {page.sections.map((section) => (
              <section
                key={section.heading}
                className="rounded-3xl border border-slate-200 bg-white p-5"
              >
                <h2 className="text-lg font-black text-slate-950">
                  {section.heading}
                </h2>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                  {section.body.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-5 text-sm font-black">
            <a className="text-blue-700 hover:text-blue-800" href="/privacy">
              Privacy Policy
            </a>
            <span className="text-slate-300">/</span>
            <a className="text-blue-700 hover:text-blue-800" href="/terms">
              Terms of Service
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}
