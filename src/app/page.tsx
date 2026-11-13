import { BloodMoonBackdrop } from "@/components/ui/BloodMoonBackdrop";
import { RoleDemoShowcase } from "@/components/game/RoleDemoShowcase";

export default function HomePage() {
  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-between overflow-x-clip px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <BloodMoonBackdrop />
      <RoleDemoShowcase />
    </main>
  );
}
