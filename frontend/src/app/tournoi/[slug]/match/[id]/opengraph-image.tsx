import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Score du match";
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

  let match: {
    display_home: string;
    display_away: string;
    score_home: number | null;
    score_away: number | null;
    status: string;
    category_name: string;
    field_name: string | null;
    phase: string;
    start_time: string;
  } | null = null;

  let tournamentName = "Kickoff";

  try {
    const [matchRes, tournamentRes] = await Promise.all([
      fetch(`${API_BASE}/public/tournaments/${slug}/matches/${id}/`, {
        next: { revalidate: 30 },
      }),
      fetch(`${API_BASE}/public/tournaments/${slug}/`, {
        next: { revalidate: 300 },
      }),
    ]);
    if (matchRes.ok) match = await matchRes.json();
    if (tournamentRes.ok) {
      const t = await tournamentRes.json();
      tournamentName = t.name;
    }
  } catch {
    // Fallback
  }

  if (!match) {
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

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;

  const PHASE_LABELS: Record<string, string> = {
    group: "Phase de poules",
    r16: "Huitièmes de finale",
    quarter: "Quarts de finale",
    semi: "Demi-finales",
    third: "3e place",
    final: "Finale",
  };

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 24,
            opacity: 0.8,
            marginBottom: 8,
          }}
        >
          ⚽ {tournamentName}
        </div>

        {/* Phase + category */}
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 20,
            opacity: 0.6,
            marginBottom: 40,
          }}
        >
          <span>{match.category_name}</span>
          <span>•</span>
          <span>{PHASE_LABELS[match.phase] ?? match.phase}</span>
        </div>

        {/* Teams & score */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 60,
            width: "100%",
          }}
        >
          {/* Home */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: "#ffffff22",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {(match.display_home || "?").charAt(0).toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                textAlign: "center",
                maxWidth: 300,
              }}
            >
              {match.display_home}
            </div>
          </div>

          {/* Score */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {showScore ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <span style={{ fontSize: 80, fontWeight: 800 }}>
                  {match.score_home ?? 0}
                </span>
                <span
                  style={{
                    fontSize: 40,
                    fontWeight: 300,
                    opacity: 0.5,
                  }}
                >
                  –
                </span>
                <span style={{ fontSize: 80, fontWeight: 800 }}>
                  {match.score_away ?? 0}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 48, fontWeight: 300, opacity: 0.5 }}>
                VS
              </div>
            )}
            {isLive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 12,
                  fontSize: 18,
                  color: "#ef4444",
                  fontWeight: 600,
                }}
              >
                🔴 EN DIRECT
              </div>
            )}
            {isFinished && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 18,
                  opacity: 0.6,
                }}
              >
                Terminé
              </div>
            )}
          </div>

          {/* Away */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: "#ffffff22",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {(match.display_away || "?").charAt(0).toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                textAlign: "center",
                maxWidth: 300,
              }}
            >
              {match.display_away}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 40,
            fontSize: 18,
            opacity: 0.5,
          }}
        >
          {match.field_name && <span>{match.field_name}</span>}
          <span>
            {new Date(match.start_time).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
