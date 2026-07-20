import { readFile, writeFile } from "node:fs/promises";

async function replace(path, from, to) {
  const source = await readFile(path, "utf8");
  if (!source.includes(from)) throw new Error(`Expected source not found in ${path}`);
  await writeFile(path, source.replace(from, to));
}

await replace(
  "src/RecurringOrderModal.tsx",
  "taxRate: item.taxRate ?? profileTaxRate,",
  "taxRate: profileTaxRate,",
);

await replace(
  "src/RecurringOrderModal.tsx",
  `    if (plan === "free") {\n      setError("Wiederkehrende Aufträge sind im Starter- und Pro-Plan verfügbar.");\n      return;\n    }\n    if (!title.trim()) {`,
  `    if (plan === "free") {\n      setError("Wiederkehrende Aufträge sind im Starter- und Pro-Plan verfügbar.");\n      return;\n    }\n    if (!profile) {\n      setError("Das Unternehmensprofil wird noch geladen. Bitte versuche es gleich erneut.");\n      return;\n    }\n    if (!title.trim()) {`,
);

await replace(
  "src/RecurringOrderModal.tsx",
  `disabled={creating || plan === "free"}`,
  `disabled={creating || plan === "free" || !profile}`,
);

await replace(
  "src/RecurringOrdersList.tsx",
  `  const templates = useQuery(api.recurringOrders.listTemplates, { sessionToken }) ?? [];`,
  `  const templatesQuery = useQuery(api.recurringOrders.listTemplates, { sessionToken });\n  const templates = templatesQuery ?? [];`,
);

await replace(
  "src/RecurringOrdersList.tsx",
  `  const [expandedId, setExpandedId] = useState<string | null>(null);\n\n  const visibleTemplates = filter === "all"`,
  `  const [expandedId, setExpandedId] = useState<string | null>(null);\n\n  if (templatesQuery === undefined) {\n    return (\n      <div className="empty-state" style={{ padding: "3rem 1.25rem", textAlign: "center" }} aria-live="polite">\n        <h3>Wiederkehrende Aufträge werden geladen</h3>\n        <p style={{ marginTop: "0.5rem" }}>Serien und nächste Termine werden abgerufen.</p>\n      </div>\n    );\n  }\n\n  const visibleTemplates = filter === "all"`,
);

console.log("Recurring UI review fixes applied.");
