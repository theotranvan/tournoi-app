import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Équipe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  let team: {
    name: string;
    category: { name: string } | null;
  } | null = null;

  let matches: {
    status: string;
    display_home: string;
    display_away: string;
    score_home: number | null;
    score_away: number | null;
  }[] = [];

  let tournamentName = "Kickoff";

  try {
    const [teamRes, tournamentRes] = await Promise.all([
      fetch(`${API_BASE}/public/tournaments/${slug}/teams/${id}/`, {
        next: { revalidate: 60 },
      }),
      fetch(`${API_BASE}/public/tournaments/${slug}/`, {
        next: { revalidate: 300 },
      }),
    ]);
    if (teamRes.ok) {
      const data = await teamRes.json();
      team = data.team;
      matches = data.matches || [];
    }
    if (tournamentRes.ok) {
      const t = await tournamentRes.json();
      tournamentName = t.name;
    }
  } catch {
    // Fallback
  }

  if (!team) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            color: "white",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          ⚽ {tournamentName}
        </div>
      ),
      { ...size }
    );
  }

  // Compute stats
  let won = 0,
    drawn = 0,
    lost = 0,
    gf = 0,
    ga = 0;
  for (const m of matches) {
    if (m.status !== "finished") continue;
    const isHome = m.display_home === team.name;
    const f = isHome ? (m.score_home ?? 0) : (m.score_away ?? 0);
    const a = isHome ? (m.score_away ?? 0) : (m.score_home ?? 0);
    gf += f;
    ga += a;
    if (f > a) won++;
    else if (f === a) drawn++;
    else lost++;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          color: "white",
          padding: "40px 60px",
        }}
      >
        {/* Tournament name */}
        <div style={{ fontSize: 22, opacity: 0.6, marginBottom: 24 }}>
          ⚽ {tournamentName}
        </div>

        {/* Team avatar */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "#ffffff22",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          {team.name.charAt(0).toUpperCase()}
        </div>

        {/* Team name */}
        <div style={{ fontSize: 48, fontWeight: 800, marginBottom: 8 }}>
          {team.name}
        </div>

        {/* Category */}
        {team.category && (
          <div
            style={{
              fontSize: 22,
              opacity: 0.7,
              marginBottom: 32,
              padding: "4px 16px",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 8,
            }}
          >
            {team.category.name}
          </div>
        )}

        {/* Stats */}
        {won + drawn + lost > 0 && (
          <div
            style={{
              display: "flex",
              gap: 40,
              fontSize: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 800, color: "#22c55e" }}>
                {won}
              </span>
              <span style={{ fontSize: 16, opacity: 0.6 }}>Victoires</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 800, color: "#f59e0b" }}>
                {drawn}
              </span>
              <span style={{ fontSize: 16, opacity: 0.6 }}>Nuls</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 800, color: "#ef4444" }}>
                {lost}
              </span>
              <span style={{ fontSize: 16, opacity: 0.6 }}>Défaites</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 800 }}>
                {gf}-{ga}
              </span>
              <span style={{ fontSize: 16, opacity: 0.6 }}>Buts</span>
            </div>
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
