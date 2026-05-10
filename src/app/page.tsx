"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilePicker, PageDropTarget } from "@/components/file-picker";
import { SaveSummary } from "@/components/save-summary";
import { PurityTab } from "@/components/purity-tab";
import { InventoryTab } from "@/components/inventory-tab";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { PendingChanges } from "@/components/pending-changes";
import { PrivacyBanner } from "@/components/privacy-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSaveStore } from "@/store/save-store";

export default function Home() {
  const summary = useSaveStore((s) => s.summary);

  return (
    <PageDropTarget>
      <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-6 min-h-screen">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Satisfactory Save Editor</h1>
            <p className="text-sm text-muted-foreground">
              Edit your 1.2 save in-browser. No upload, no backend.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <PrivacyBanner />

        {!summary && <FilePicker />}

        {summary && (
          <>
            <SaveSummary />

            <Tabs defaultValue="purity">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="purity">Purity</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="schematics">Schematics</TabsTrigger>
                <TabsTrigger value="research">MAM Research</TabsTrigger>
                <TabsTrigger value="phase">Game Phase</TabsTrigger>
              </TabsList>

              <TabsContent value="purity">
                <PurityTab />
              </TabsContent>
              <TabsContent value="inventory">
                <InventoryTab />
              </TabsContent>
              <TabsContent value="schematics">
                <ComingSoonTab
                  title="Schematics"
                  body="Bulk-unlock alternates, MAM, AWESOME shop, etc. Coming soon. The plumbing is in place; the UI for cross-referencing Docs.json is the next milestone."
                />
              </TabsContent>
              <TabsContent value="research">
                <ComingSoonTab
                  title="MAM research trees"
                  body="Coming soon. Will toggle entries in BP_ResearchManager_C.mUnlockedResearchTrees, with a clear note that individual nodes still need to be unlocked separately."
                />
              </TabsContent>
              <TabsContent value="phase">
                <ComingSoonTab
                  title="Game phase skip"
                  body="Coming soon. Will set both mCurrentGamePhase and mTargetGamePhase on BP_GamePhaseManager_C, with a one-way change warning."
                />
              </TabsContent>
            </Tabs>

            <PendingChanges />
          </>
        )}

        <footer className="mt-auto pt-4 text-xs text-muted-foreground">
          Built on{" "}
          <a
            className="underline"
            href="https://www.npmjs.com/package/@etothepii/satisfactory-file-parser"
            target="_blank"
            rel="noreferrer"
          >
            @etothepii/satisfactory-file-parser
          </a>
          . Not affiliated with Coffee Stain Studios.
        </footer>
      </div>
    </PageDropTarget>
  );
}
