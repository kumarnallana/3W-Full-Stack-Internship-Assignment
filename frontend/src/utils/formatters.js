export function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "MS";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function formatPostTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
  ];

  let duration = seconds;
  for (const [amount, unit] of ranges) {
    if (Math.abs(duration) < amount) {
      return relativeTime.format(Math.round(duration), unit);
    }
    duration /= amount;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  }).format(date);
}

export function getUserDisplayName(user) {
  return user?.username || user?.name || user?.displayName || "Community member";
}

