export function formatTeamCode(eventSlug: string, sequence: number) {
  const prefix = eventSlug
    .split("-")
    .map((part) => part.at(0)?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
  return `${prefix || "EVT"}-T-${sequence.toString().padStart(5, "0")}`;
}
