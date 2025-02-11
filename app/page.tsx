import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-500 to-purple-600 text-white">
      <h1 className="text-6xl font-bold mb-4">Koulu Wrapped</h1>
      <p className="text-xl mb-8">Discover your school year, wrapped up!</p>
      <Link href="/signin">
        <Button variant="secondary" size="lg" className="rounded-full">
          Sign in with Wilma
        </Button>
      </Link>
    </div>
  );
}