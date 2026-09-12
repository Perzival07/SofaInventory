"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { getDbStatus } from "@/app/actions";
import { getSessionInfoAction, type SessionInfo } from "@/app/auth-actions";

interface AppShellProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

/**
 * Shared page frame: sidebar navigation + sticky top bar + content container.
 */
export function AppShell({ title, subtitle, actionLabel, onAction, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState({ connected: false, provider: "Checking..." });
  const [session, setSession] = useState<SessionInfo>({
    email: null, name: null, authenticated: false,
  });

  useEffect(() => {
    getDbStatus()
      .then((status) => setDbStatus(status))
      .catch(() => setDbStatus({ connected: false, provider: "Unknown" }));
    getSessionInfoAction()
      .then(setSession)
      .catch(() => setSession({ email: null, name: null, authenticated: false }));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar
        dbStatus={dbStatus}
        session={session}
        isMobileOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      <div className="app-main">
        <Header
          title={title}
          subtitle={subtitle}
          actionLabel={actionLabel}
          onActionClick={onAction}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="app-container">{children}</main>
      </div>

      <style jsx>{`
        .app-shell {
          display: flex;
          min-height: 100vh;
          background: var(--bg-main);
        }

        .app-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}
