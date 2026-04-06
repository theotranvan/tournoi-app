import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function fetchTournament(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/public/tournaments/${slug}/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await fetchTournament(slug);

  if (!tournament) {
    return { title: "Tournoi — Kickoff" };
  }

  const title = `${tournament.name} — Kickoff`;
  const description =
    tournament.description ||
    `Suivez le tournoi ${tournament.name} en direct sur Kickoff.`;
  const url = `/tournoi/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Kickoff",
      type: "website",
      ...(tournament.cover_image && {
        images: [{ url: tournament.cover_image, width: 1200, height: 630 }],
      }),
    },
    twitter: {
      card: tournament.cover_image ? "summary_large_image" : "summary",
      title,
      description,
      ...(tournament.cover_image && { images: [tournament.cover_image] }),
    },
  };
}

export default function PublicTournamentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Public header */}
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-card/95 backdrop-blur-md flex items-center px-4 gap-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-lg font-bold text-primary">⚽ Kickoff</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
