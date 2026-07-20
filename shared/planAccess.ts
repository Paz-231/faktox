export interface RecurringPlanUser {
  plan: string;
  planStatus: string;
}

export function canUseRecurringOrders(user: RecurringPlanUser): boolean {
  return (user.plan === "starter" || user.plan === "pro") && user.planStatus === "active";
}

export function recurringPlanError(user: RecurringPlanUser): string {
  if (user.plan === "free") {
    return "Wiederkehrende Aufträge sind im Starter- und Pro-Plan verfügbar";
  }
  if (user.planStatus !== "active") {
    return "Wiederkehrende Aufträge benötigen einen aktiven Starter- oder Pro-Tarif";
  }
  return "Wiederkehrende Aufträge sind für diesen Tarif nicht verfügbar";
}
