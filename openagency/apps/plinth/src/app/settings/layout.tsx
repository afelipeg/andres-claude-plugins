'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  User,
  Users,
  CreditCard,
  Cable,
  Store,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';

const TABS = [
  { label: 'Profile', href: '/settings/profile', icon: User },
  { label: 'Team', href: '/settings/team', icon: Users },
  { label: 'Billing', href: '/settings/billing', icon: CreditCard },
  { label: 'Connections', href: '/settings/connections', icon: Cable },
  { label: 'Marketplace', href: '/settings/marketplace', icon: Store },
  { label: 'Usage', href: '/settings/usage', icon: BarChart3 },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/chat"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to chat
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-4">Settings</h1>

        {/* Tab bar */}
        <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Settings tabs">
          {TABS.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== '/settings' && pathname.startsWith(tab.href));
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
