import { readFile, writeFile } from "node:fs/promises";

async function replace(path, from, to) {
  const source = await readFile(path, "utf8");
  if (!source.includes(from)) throw new Error(`Expected source not found in ${path}`);
  await writeFile(path, source.replace(from, to));
}

await replace(
  "src/RecurringOrderModal.tsx",
  `  const profile = useQuery(api.profile.get, { userId: userId as any, sessionToken });\n  const createTemplate = useMutation(api.recurringOrders.createTemplate);`,
  `  const profile = useQuery(api.profile.get, { userId: userId as any, sessionToken });\n  const access = useQuery(api.recurringOrderAccess.getAccess, { sessionToken });\n  const createTemplate = useMutation(api.recurringOrders.createTemplate);`,
);

await replace(
  "src/RecurringOrderModal.tsx",
  `    if (plan === "free") {\n      setError("Wiederkehrende Aufträge sind im Starter- und Pro-Plan verfügbar.");\n      return;\n    }`,
  `    if (!access?.allowed) {\n      setError(access?.reason || "Tarifstatus wird noch geprüft. Bitte versuche es gleich erneut.");\n      return;\n    }`,
);

await replace(
  "src/RecurringOrderModal.tsx",
  `          {plan === "free" && (\n            <div style={{ padding: "0.875rem", border: "1px solid var(--accent)", background: "var(--surface-2)", marginBottom: "1rem" }}>\n              <strong style={{ display: "block", marginBottom: "0.25rem" }}>Starter- oder Pro-Funktion</strong>\n              <p style={{ fontSize: "0.8125rem", color: "var(--fg-2)", marginBottom: "0.75rem" }}>\n                Wiederkehrende Aufträge automatisieren regelmäßig anfallende Leistungen.\n              </p>\n              <button className="btn btn-primary btn-sm" onClick={onUpgrade}>Tarif ansehen</button>\n            </div>\n          )}`,
  `          {access && !access.allowed && (\n            <div style={{ padding: "0.875rem", border: "1px solid var(--accent)", background: "var(--surface-2)", marginBottom: "1rem" }}>\n              <strong style={{ display: "block", marginBottom: "0.25rem" }}>Aktiver Starter- oder Pro-Tarif erforderlich</strong>\n              <p style={{ fontSize: "0.8125rem", color: "var(--fg-2)", marginBottom: "0.75rem" }}>\n                {access.reason || "Wiederkehrende Aufträge sind für diesen Tarif derzeit nicht verfügbar."}\n              </p>\n              <button className="btn btn-primary btn-sm" onClick={onUpgrade}>Tarif ansehen</button>\n            </div>\n          )}`,
);

await replace(
  "src/RecurringOrderModal.tsx",
  `disabled={creating || plan === "free" || !profile}`,
  `disabled={creating || access === undefined || !access.allowed || !profile}`,
);

await replace(
  "src/RecurringOrdersList.tsx",
  `  const templatesQuery = useQuery(api.recurringOrders.listTemplates, { sessionToken });\n  const templates = templatesQuery ?? [];`,
  `  const templatesQuery = useQuery(api.recurringOrders.listTemplates, { sessionToken });\n  const access = useQuery(api.recurringOrderAccess.getAccess, { sessionToken });\n  const templates = templatesQuery ?? [];`,
);

await replace(
  "src/RecurringOrdersList.tsx",
  `  if (templatesQuery === undefined) {`,
  `  if (templatesQuery === undefined || access === undefined) {`,
);

await replace(
  "src/RecurringOrdersList.tsx",
  `  if (plan === "free") {\n    return (\n      <div className="empty-state" style={{ padding: "3rem 1.25rem", textAlign: "center" }}>\n        <h3>Wiederkehrende Aufträge</h3>\n        <p style={{ maxWidth: "560px", margin: "0.5rem auto 1rem" }}>\n          Automatisiere monatliche oder jährliche Leistungen. Zu jedem Termin entsteht ein neuer Auftrag als Entwurf.\n        </p>\n        <button className="btn btn-primary" onClick={onUpgrade}>Starter- und Pro-Tarife ansehen</button>\n      </div>\n    );\n  }`,
  `  if (!access.allowed) {\n    return (\n      <div className="empty-state" style={{ padding: "3rem 1.25rem", textAlign: "center" }}>\n        <h3>Wiederkehrende Aufträge</h3>\n        <p style={{ maxWidth: "560px", margin: "0.5rem auto 0.5rem" }}>\n          Automatisiere monatliche oder jährliche Leistungen. Zu jedem Termin entsteht ein neuer Auftrag als Entwurf.\n        </p>\n        <p style={{ maxWidth: "560px", margin: "0 auto 1rem", color: "var(--fg-3)", fontSize: "0.8125rem" }}>\n          {access.reason || "Ein aktiver Starter- oder Pro-Tarif ist erforderlich."}\n        </p>\n        <button className="btn btn-primary" onClick={onUpgrade}>Tarif und Zahlung prüfen</button>\n      </div>\n    );\n  }`,
);

console.log("Recurring access UI patch applied.");
