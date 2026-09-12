"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Network,
  Truck,
  Factory,
  Handshake,
  ShoppingCart,
  BarChart3,
  KeyRound,
  Settings,
  Database,
  X,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { SessionFooter } from "@/components/SessionFooter";
import type { SessionInfo } from "@/app/auth-actions";

interface SidebarProps {
  dbStatus: { connected: boolean; provider: string };
  session: SessionInfo;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/purchases", label: "Purchase & GRN", icon: Truck },
  { href: "/materials", label: "Raw Materials", icon: Boxes },
  { href: "/bom", label: "BOM & Costing", icon: Network },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/jobwork", label: "Job Work", icon: Handshake },
  { href: "/sales", label: "Sales & Billing", icon: ShoppingCart },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations & Keys", icon: KeyRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ dbStatus, session, isMobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        className={`sidebar ${isMobileOpen ? "sidebar-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Logo size={44} variant="mark" priority />
          </div>
          <div className="brand-text">
            <p className="brand-name">Loknath Sofa Center</p>
            <p className="brand-sub">Production &amp; Inventory</p>
          </div>
          <button className="sidebar-close-btn" onClick={onCloseMobile} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Sections">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                onClick={onCloseMobile}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}

        </nav>

        <div className="sidebar-footer">
          <SessionFooter email={session.email} name={session.name} />
          <div
            className={`db-indicator ${dbStatus.connected ? "db-connected" : "db-demo"}`}
            title={
              dbStatus.connected
                ? "Connected to Vercel Postgres (Neon)"
                : "Running in demo mode. Set POSTGRES_URL to persist to Vercel Postgres."
            }
          >
            <Database size={14} />
            <span>{dbStatus.connected ? "Vercel Postgres" : "In-Memory Demo"}</span>
          </div>
        </div>
      </aside>

      <style jsx>{`
        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          z-index: 30;
        }

        @media (min-width: 1024px) {
          .sidebar-backdrop {
            display: none;
          }
        }

        .sidebar {
          width: var(--sidebar-width);
          flex-shrink: 0;
          background: var(--bg-surface);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 40;
          transform: translateX(-100%);
          transition: transform var(--transition-normal);
        }

        .sidebar.sidebar-open {
          transform: translateX(0);
          box-shadow: var(--shadow-lg);
        }

        @media (min-width: 1024px) {
          .sidebar {
            position: sticky;
            height: 100vh;
            transform: none;
            box-shadow: none;
          }
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        /* No tint or border — the logo carries its own colours and white ground. */
        .brand-icon {
          width: 44px;
          height: 44px;
          min-width: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-text {
          min-width: 0;
        }

        .brand-name {
          font-family: var(--font-heading);
          font-size: 0.925rem;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .brand-sub {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .sidebar-close-btn {
          margin-left: auto;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .sidebar-close-btn:hover {
          background: var(--bg-surface-elevated);
        }

        @media (min-width: 1024px) {
          .sidebar-close-btn {
            display: none;
          }
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.85rem;
          flex: 1;
        }

        .sidebar-nav :global(.nav-item) {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          width: 100%;
          text-align: left;
          padding: 0.65rem 0.75rem;
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: background-color var(--transition-fast), color var(--transition-fast);
        }

        .sidebar-nav :global(.nav-item:hover:not(:disabled)) {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
        }

        .sidebar-nav :global(.nav-item-active),
        .sidebar-nav :global(.nav-item-active:hover) {
          background: var(--primary-soft);
          color: var(--primary);
          font-weight: 600;
        }

        .sidebar-nav :global(.nav-item-disabled) {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sidebar-nav :global(.nav-soon) {
          margin-left: auto;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--text-muted);
          background: var(--bg-surface-elevated);
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-full);
        }

        .sidebar-footer {
          padding: 0.9rem;
          border-top: 1px solid var(--border-subtle);
        }

        .db-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.55rem 0.75rem;
          border-radius: var(--radius-md);
          font-size: 0.775rem;
          font-weight: 500;
        }

        .db-connected {
          background: var(--status-in-stock-bg);
          color: var(--status-in-stock-text);
          border: 1px solid var(--status-in-stock-border);
        }

        .db-demo {
          background: var(--primary-soft);
          color: var(--primary);
          border: 1px solid var(--primary-soft-border);
        }
      `}</style>
    </>
  );
}
