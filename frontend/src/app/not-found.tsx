import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <span className="text-6xl mb-4">⚽</span>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-muted-foreground max-w-sm mb-6">
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link href="/">
        <Button className="gap-2">Retour à l&apos;accueil</Button>
      </Link>
    </div>
  );
}
