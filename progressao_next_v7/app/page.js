import { LegacyBootstrap } from "@/components/legacy-bootstrap";
import { legacyMarkup } from "@/components/legacy-markup";

export default function HomePage() {
  return (
    <>
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: legacyMarkup }} />
      <LegacyBootstrap />
    </>
  );
}
