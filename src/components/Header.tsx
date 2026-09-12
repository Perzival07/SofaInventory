"use client";

import { Plus, Menu } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onActionClick?: () => void;
  onMenuClick: () => void;
}

export function Header({ title, subtitle, actionLabel, onActionClick, onMenuClick }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="menu-btn"
          onClick={onMenuClick}
          aria-label="Open menu"
          id="btn-open-sidebar"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="topbar-title">{title}</h1>
          <p className="topbar-subtitle">{subtitle}</p>
        </div>
      </div>

      {actionLabel && onActionClick && (
        <button
          onClick={onActionClick}
          className="btn btn-primary btn-add-item"
          id="btn-add-item-header"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>{actionLabel}</span>
        </button>
      )}

      <style jsx>{`
        .topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.25rem;
        }

        @media (min-width: 1024px) {
          .topbar {
            padding: 1.1rem 2.25rem;
          }
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
        }

        .menu-btn {
          width: 38px;
          height: 38px;
          min-width: 38px;
          border-radius: var(--radius-md);
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .menu-btn:hover {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
        }

        @media (min-width: 1024px) {
          .menu-btn {
            display: none;
          }
        }

        .topbar-title {
          font-size: 1.15rem;
          line-height: 1.3;
          color: var(--text-primary);
        }

        @media (min-width: 768px) {
          .topbar-title {
            font-size: 1.35rem;
          }
        }

        .topbar-subtitle {
          color: var(--text-secondary);
          font-size: 0.825rem;
          margin-top: 0.1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-add-item span {
          display: none;
        }

        @media (min-width: 560px) {
          .btn-add-item span {
            display: inline;
          }
        }
      `}</style>
    </header>
  );
}
