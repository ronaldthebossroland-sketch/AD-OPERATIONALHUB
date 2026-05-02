import { motion, useReducedMotion } from "framer-motion";

export default function AppSplashScreen({
  message = "Preparing your executive workspace",
}) {
  const prefersReducedMotion = useReducedMotion();

  const orbitAnimation = prefersReducedMotion
    ? {}
    : {
        rotate: 360,
      };

  const logoAnimation = prefersReducedMotion
    ? {}
    : {
        scale: [0.96, 1, 0.98, 1],
        y: [0, -4, 0],
      };

  return (
    <div className="app-splash" role="status" aria-live="polite">
      <div className="app-splash__grid" />
      <div className="app-splash__stage">
        <div className="app-splash__crest">
          <motion.div
            className="app-splash__orbit app-splash__orbit--gold"
            animate={orbitAnimation}
            transition={{ duration: 8, ease: "linear", repeat: Infinity }}
          />
          <motion.div
            className="app-splash__orbit app-splash__orbit--cyan"
            animate={prefersReducedMotion ? {} : { rotate: -360 }}
            transition={{ duration: 6.5, ease: "linear", repeat: Infinity }}
          />
          <motion.img
            src="/logo-mark.png"
            alt=""
            aria-hidden="true"
            className="app-splash__logo"
            animate={logoAnimation}
            transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
          />
        </div>

        <div className="app-splash__copy">
          <p className="app-splash__eyebrow">Executive command system</p>
          <h1>Executive Virtual AI Assistant</h1>
          <p>{message}</p>
        </div>

        <div className="app-splash__progress" aria-hidden="true">
          <div className="app-splash__progress-track">
            <motion.div
              className="app-splash__progress-bar"
              animate={prefersReducedMotion ? {} : { x: ["-72%", "118%"] }}
              transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
