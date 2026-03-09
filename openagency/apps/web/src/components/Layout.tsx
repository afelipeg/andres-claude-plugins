import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Settings,
  Home,
  BarChart3,
  CreditCard,
  Monitor,
  Search,
  TrendingUp,
  Megaphone,
  Layers,
  Link,
  FileText,
  Activity,
} from 'lucide-react';
import { SyncStatus } from './SyncStatus';
import { ErrorBoundary } from './ErrorBoundary';
import { NotificationBanner } from './NotificationBanner';
import { useEventStream } from '../hooks/useEventStream';
import { useNotifications } from '../hooks/useNotifications';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface NavItem {
  path: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { path: '', label: 'Home', Icon: Home },
  { path: '/scorecard', label: 'Scorecard', Icon: BarChart3 },
  { path: '/command-center', label: 'Command Center', Icon: Monitor },
  { path: '/leak-detector', label: 'Leak Detector', Icon: Search },
  { path: '/media-architect', label: 'Media Architect', Icon: TrendingUp },
  { path: '/campaign-ops', label: 'Campaign Ops', Icon: Megaphone },
  { path: '/executive-bridge', label: 'Executive Bridge', Icon: Layers },
  { path: '/integrations', label: 'Integrations', Icon: Link },
  { path: '/architecture', label: 'Architecture', Icon: FileText },
  { path: '/consumption', label: 'Consumption', Icon: Activity },
  { path: '/billing', label: 'Billing', Icon: CreditCard },
  { path: '/settings', label: 'Settings', Icon: Settings },
];

function getPageTitle(pathname: string): string {
  const segment = pathname.replace('/app', '').replace(/^\//, '').split('/')[0];
  const titles: Record<string, string> = {
    '': 'Home',
    scorecard: 'Scorecard',
    billing: 'Billing',
    'command-center': 'Command Center',
    'leak-detector': 'Leak Detector',
    'media-architect': 'Media Architect',
    'campaign-ops': 'Campaign Ops',
    'executive-bridge': 'Executive Bridge',
    integrations: 'Integrations',
    architecture: 'Architecture',
    consumption: 'Consumption',
    settings: 'Settings',
  };
  return (segment !== undefined ? titles[segment] : undefined) ?? 'Dashboard';
}

function PlinthLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7l4 4-4 4" />
      <path d="M12 7l4 4-4 4" />
      <line x1="20" y1="7" x2="20" y2="15" />
    </svg>
  );
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = '/app';

  useEffect(() => {
    const token = localStorage.getItem('plinth_token');
    if (!token) return;
    fetch(`${API_URL}/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setUser(data.user ?? data); })
      .catch(() => {});
  }, []);

  const { events } = useEventStream({ types: ['hfl.escalated', 'mesh.pipeline.failed'] });
  const { active, push, dismiss, dismissAll } = useNotifications();

  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[0];
    if (!latest) return;
    const payload = latest.payload as Record<string, unknown> | null;
    if (!payload) return;
    if (latest.type === 'hfl.escalated') {
      push({
        id: latest.id,
        type: 'hfl_escalation',
        urgency: (payload['urgency'] as 'low' | 'medium' | 'high' | 'critical') ?? 'high',
        title: 'HFL Escalation Required',
        message: (payload['reason'] as string) ?? 'Pipeline run requires human review.',
        timestamp: latest.timestamp,
        meta: payload,
      });
    } else if (latest.type === 'mesh.pipeline.failed') {
      push({
        id: latest.id,
        type: 'pipeline_failed',
        urgency: 'critical',
        title: 'Pipeline Failed',
        message: `Pipeline ${payload['pipeline_id'] ?? 'unknown'} failed for run ${payload['run_id'] ?? '?'}.`,
        timestamp: latest.timestamp,
        meta: payload,
      });
    }
  }, [events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSignOut() {
    localStorage.removeItem('plinth_token');
    navigate('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside
        className={cn(
          'relative flex flex-col shrink-0 bg-zinc-950 transition-all duration-300 ease-in-out overflow-hidden',
          collapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-white/[0.06] px-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-950">
            <PlinthLogo />
          </div>
          {/* Label: kept in DOM, fades out on collapse */}
          <div
            className={cn(
              'ml-3 flex flex-col leading-none min-w-0 transition-all duration-300 overflow-hidden',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            <span className="text-[15px] font-bold text-white tracking-tight whitespace-nowrap">Plinth</span>
            <span className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase whitespace-nowrap">by Polanyi</span>
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white shadow-md transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-0.5">
          <TooltipProvider delayDuration={0}>
            {NAV_ITEMS.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={`${base}${item.path}`}
                    end={item.path === ''}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 overflow-hidden',
                        isActive
                          ? 'bg-white text-zinc-950'
                          : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                      )
                    }
                  >
                    <item.Icon className="h-5 w-5 shrink-0" />
                    {/* Label stays in DOM — CSS transition hides it on collapse */}
                    <span
                      className={cn(
                        'whitespace-nowrap overflow-hidden transition-all duration-300',
                        collapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-3'
                      )}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
            ))}
          </TooltipProvider>
        </nav>

        {/* User footer / Sign out */}
        <div className="shrink-0 border-t border-white/[0.06] p-2">
          {collapsed ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center justify-center rounded-lg p-2.5 text-zinc-400 hover:bg-white/[0.06] hover:text-red-400 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-lg p-2 hover:bg-white/[0.06] transition-colors outline-none">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-white truncate leading-none">
                      {user?.name || 'Admin'}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 truncate leading-none">
                      {user?.email || '—'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel>
                  {user?.role ? user.role.replace('_', ' ') : 'admin'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/app/settings/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-400 focus:text-red-400 focus:bg-red-400/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-zinc-900 truncate">
              {getPageTitle(pathname)}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <SyncStatus />
          </div>
        </header>

        <NotificationBanner notifications={active} onDismiss={dismiss} onDismissAll={dismissAll} />

        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
