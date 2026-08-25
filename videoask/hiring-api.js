export function hiringApiBase() {
  const host = location.hostname;
  if (host === "127.0.0.1" || host === "localhost") return "http://127.0.0.1:3000/api/hiring";
  return "https://ventura-dashboard-xi.vercel.app/api/hiring";
}

export async function publishHiring(payload) {
  const res = await fetch(hiringApiBase(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ ok: false }));
}

export async function fetchHiringAsk(id) {
  const res = await fetch(`${hiringApiBase()}?public=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.ask || null;
}
