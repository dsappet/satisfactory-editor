"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilePicker, PageDropTarget } from "@/components/file-picker";
import { SaveFileFinder } from "@/components/save-file-finder";
import { SaveSummary } from "@/components/save-summary";
import { PurityTab } from "@/components/purity-tab";
import { InventoryTab } from "@/components/inventory-tab";
import { MamResearchTab } from "@/components/mam-research-tab";
import { HardDriveTab } from "@/components/hard-drive-tab";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { PendingChanges } from "@/components/pending-changes";
import { PrivacyBanner } from "@/components/privacy-banner";
import { Hero } from "@/components/hero";
import { useSaveStore } from "@/store/save-store";

export default function Home() {
  const summary = useSaveStore((s) => s.summary);

  return (
    <PageDropTarget>
      <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-6 min-h-screen">
        <Hero />

        <PrivacyBanner />

        {!summary && (
          <>
            <FilePicker />
            <SaveFileFinder />
          </>
        )}

        {summary && (
          <>
            <SaveSummary />

            <Tabs defaultValue="purity">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="purity">Purity</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="research">MAM Research</TabsTrigger>
                <TabsTrigger value="harddrive">Hard Drives</TabsTrigger>
                <TabsTrigger value="phase">Game Phase</TabsTrigger>
              </TabsList>

              <TabsContent value="purity">
                <PurityTab />
              </TabsContent>
              <TabsContent value="inventory">
                <InventoryTab />
              </TabsContent>
              <TabsContent value="research">
                <MamResearchTab />
              </TabsContent>
              <TabsContent value="harddrive">
                <HardDriveTab />
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
