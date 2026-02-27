"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { DashboardPage } from "@/components/pages/dashboard-page";
import { ContentHunterPage } from "@/components/pages/content-hunter-page";
import { AiWriterPage } from "@/components/pages/ai-writer-page";
import { AffiliateLinksPage } from "@/components/pages/affiliate-links-page";
import { PublisherPage } from "@/components/pages/publisher-page";
import { SettingsPage } from "@/components/pages/settings-page";
import { TooltipProvider } from "@/components/ui/tooltip";

const pages: Record<string, { title: string; component: React.ComponentType }> = {
  dashboard: { title: "Dashboard", component: DashboardPage },
  "content-hunter": { title: "Content Hunter", component: ContentHunterPage },
  "ai-writer": { title: "AI Writer", component: AiWriterPage },
  "affiliate-links": { title: "Affiliate Links", component: AffiliateLinksPage },
  publisher: { title: "Publisher", component: PublisherPage },
  settings: { title: "Cài đặt", component: SettingsPage },
};

export default function Home() {
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPage = pages[activePage];
  const PageComponent = currentPage.component;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#FAFAFA]">
        <Sidebar
          activePage={activePage}
          onNavigate={(page) => {
            setActivePage(page);
            setSidebarOpen(false);
          }}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <main className="lg:ml-[260px] min-h-screen transition-all duration-300">
          <Topbar
            title={currentPage.title}
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <div className="p-6" key={activePage}>
            <div className="animate-fade-in-up">
              <PageComponent />
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
