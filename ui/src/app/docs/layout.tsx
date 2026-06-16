import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

/**
 * Shared chrome for every /docs page: the site Nav on top, a sticky sidebar on
 * the left (desktop), and the rendered Markdown on the right. Keeps the user on
 * the website to read docs instead of bouncing to GitHub.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <div className="mx-auto flex max-w-6xl gap-10 px-5 pt-24 pb-20 lg:pt-28">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <DocsSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </>
  );
}
