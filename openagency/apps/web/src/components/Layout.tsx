import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Clock,
  Bot,
  Plus,
  MessageSquare,
  Pencil,
  Star,
  Trash2,
  Cpu,
  Upload,
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
import {
  listConversations,
  renameConversation,
  toggleStarConversation,
  deleteConversation,
  type Conversation,
} from '../api/assistant';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface NavItem {
  path: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  path?: string; // If set, group header is clickable (navigates here)
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

// Nav items excluding Assistant (handled separately)
const NAV_ITEMS_TOP: NavItem[] = [
  { path: '', label: 'Home', Icon: Home },
];

const NAV_STRUCTURE: NavEntry[] = [
  // Command Center — clickable parent with Scorecard submenu
  {
    label: 'Command Center',
    Icon: Monitor,
    path: '/command-center',
    children: [
      { path: '/scorecard', label: 'Scorecard', Icon: BarChart3 },
    ],
  },
  // A2A Engines — group header (not clickable)
  {
    label: 'A2A Engines',
    Icon: Cpu,
    children: [
      { path: '/leak-detector', label: 'Leak Detector', Icon: Search },
      { path: '/media-architect', label: 'Media Architect', Icon: TrendingUp },
      { path: '/campaign-ops', label: 'Campaign Ops', Icon: Megaphone },
      { path: '/executive-bridge', label: 'Executive Bridge', Icon: Layers },
      { path: '/architecture', label: 'Architecture', Icon: FileText },
      { path: '/history', label: 'History', Icon: Clock },
    ],
  },
  // Integrations — clickable parent with Data submenu
  {
    label: 'Integrations',
    Icon: Link,
    path: '/integrations',
    children: [
      { path: '/data', label: 'Data', Icon: Upload },
    ],
  },
  // Standalone items
  { path: '/consumption', label: 'Usage & Runs', Icon: Activity },
  { path: '/billing', label: 'Outcome Base Fee', Icon: CreditCard },
  { path: '/settings', label: 'Settings', Icon: Settings },
];

function getPageTitle(pathname: string): string {
  const segment = pathname.replace('/app', '').replace(/^\//, '').split('/')[0];
  const titles: Record<string, string> = {
    '': 'Home',
    assistant: 'Assistant',
    scorecard: 'Scorecard',
    billing: 'Outcome Base Fee',
    'command-center': 'Command Center',
    'leak-detector': 'Leak Detector',
    'media-architect': 'Media Architect',
    'campaign-ops': 'Campaign Ops',
    'executive-bridge': 'Executive Bridge',
    integrations: 'Integrations',
    architecture: 'Architecture',
    consumption: 'Usage & Runs',
    history: 'History',
    data: 'Data',
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

// ─── Conversation item in sidebar ─────────────────────────────────────

function ConvSidebarItem({
  conv,
  isActive,
  onSelect,
  onRenameStart,
  renamingId,
  renameValue,
  setRenameValue,
  onRenameSubmit,
  onStar,
  onDelete,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRenameStart: (id: string, title: string) => void;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onStar: (id: string, starred: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const renaming = renamingId === conv.id;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  return (
    <div
      className={cn(
        'group relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-colors',
        isActive
          ? 'bg-[#02c98d]/10 text-[#02c98d]'
          : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200',
      )}
      onClick={() => !renaming && onSelect(conv.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MessageSquare className="h-3 w-3 shrink-0 opacity-60" />

      {renaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameSubmit(conv.id);
            if (e.key === 'Escape') onRenameSubmit('__cancel__');
            e.stopPropagation();
          }}
          onBlur={() => onRenameSubmit(conv.id)}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent text-xs text-white outline-none border-b border-zinc-600 pb-0.5"
        />
      ) : (
        <span className="flex-1 min-w-0 truncate">{conv.title}</span>
      )}

      {/* Action buttons — appear on hover, same order as Claude.ai: Rename · Star · Delete */}
      {hovered && !renaming && (
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onRenameStart(conv.id, conv.title)}
            className="rounded p-0.5 text-zinc-500 transition-colors hover:text-white"
            title="Rename"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onStar(conv.id, conv.starred)}
            className={cn('rounded p-0.5 transition-colors', conv.starred ? 'text-yellow-400 hover:text-yellow-300' : 'text-zinc-500 hover:text-yellow-400')}
            title={conv.starred ? 'Unstar' : 'Star'}
          >
            <Star className={cn('h-3 w-3', conv.starred && 'fill-yellow-400')} />
          </button>
          <button
            onClick={() => onDelete(conv.id)}
            className="rounded p-0.5 text-zinc-500 transition-colors hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Star indicator when not hovered */}
      {conv.starred && !hovered && (
        <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />
      )}
    </div>
  );
}

// ─── Assistant nav with expandable conversation list ──────────────────

function AssistantNav({
  pathname,
  collapsed,
}: {
  pathname: string;
  collapsed: boolean;
}) {
  const navigate = useNavigate();
  const isOnAssistant = pathname.startsWith('/app/assistant');
  const [expanded, setExpanded] = useState(isOnAssistant);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Auto-expand when on assistant route
  useEffect(() => {
    if (isOnAssistant) setExpanded(true);
  }, [isOnAssistant]);

  // Re-fetch conversations when expanded OR when pathname changes within assistant
  useEffect(() => {
    if (!expanded) return;
    void listConversations().then(setConversations).catch(() => {});
  }, [expanded, pathname]);

  // Derive active conversation id from URL
  const activeConvId = pathname.startsWith('/app/assistant/')
    ? pathname.replace('/app/assistant/', '')
    : null;

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (!isOnAssistant) navigate('/app/assistant');
  };

  const handleSelect = (id: string) => {
    navigate(`/app/assistant/${id}`);
  };

  const handleNew = () => {
    navigate('/app/assistant');
  };

  const handleRenameStart = (id: string, title: string) => {
    setRenamingId(id);
    setRenameValue(title);
  };

  const handleRenameSubmit = async (id: string) => {
    if (id === '__cancel__' || !renamingId) {
      setRenamingId(null);
      return;
    }
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== conversations.find((c) => c.id === id)?.title) {
      await renameConversation(id, trimmed).catch(() => {});
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)));
    }
    setRenamingId(null);
  };

  const handleStar = async (id: string, starred: boolean) => {
    const newVal = !starred;
    await toggleStarConversation(id, newVal).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, starred: newVal } : c)).sort((a, b) => {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        return b.updated_at.localeCompare(a.updated_at);
      }),
    );
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id).catch(() => {});
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) navigate('/app/assistant');
  };

  // Collapsed: just show Bot icon
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to="/app/assistant"
            className={cn('plinth-nav-item plinth-nav-collapsed')}
          >
            <Bot className="h-5 w-5 shrink-0" />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right">Assistant</TooltipContent>
      </Tooltip>
    );
  }

  const starred = conversations.filter((c) => c.starred);
  const unstarred = conversations.filter((c) => !c.starred);

  return (
    <div>
      {/* Assistant toggle button */}
      <button
        onClick={handleToggle}
        className={cn(
          'plinth-nav-item w-full',
          isOnAssistant && 'bg-[rgba(2,201,141,0.12)] text-[#02c98d]',
        )}
      >
        <Bot className="h-5 w-5 shrink-0" />
        <span className="ml-3 flex-1 text-left">Assistant</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
        )}
      </button>

      {/* Expanded conversation list */}
      {expanded && (
        <div className="mt-0.5 pl-2 space-y-0.5">
          {/* New conversation */}
          <button
            onClick={handleNew}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-300"
          >
            <Plus className="h-3 w-3" />
            <span>New conversation</span>
          </button>

          {/* Starred conversations */}
          {starred.map((conv) => (
            <ConvSidebarItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConvId}
              onSelect={handleSelect}
              onRenameStart={handleRenameStart}
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onRenameSubmit={(id) => void handleRenameSubmit(id)}
              onStar={handleStar}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}

          {/* Unstarred conversations */}
          {unstarred.map((conv) => (
            <ConvSidebarItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConvId}
              onSelect={handleSelect}
              onRenameStart={handleRenameStart}
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onRenameSubmit={(id) => void handleRenameSubmit(id)}
              onStar={handleStar}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}

          {conversations.length === 0 && (
            <p className="px-2 py-1 text-[10px] text-zinc-600">No conversations yet</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible nav group ────────────────────────────────────────────

function NavGroupSection({
  group,
  pathname,
  collapsed,
  base,
  renderChild,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  base: string;
  renderChild: (item: NavItem) => React.ReactNode;
}) {
  const isChildActive = group.children.some((item) =>
    pathname.startsWith(`${base}${item.path}`),
  );
  const isParentActive = group.path
    ? pathname === `${base}${group.path}` || pathname.startsWith(`${base}${group.path}/`)
    : false;
  const isActive = isChildActive || isParentActive;
  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {group.path ? (
            <NavLink
              to={`${base}${group.path}`}
              className={cn('plinth-nav-item plinth-nav-collapsed')}
            >
              <group.Icon className="h-5 w-5 shrink-0" />
            </NavLink>
          ) : (
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn('plinth-nav-item plinth-nav-collapsed', isActive && 'text-[#02c98d]')}
            >
              <group.Icon className="h-5 w-5 shrink-0" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent side="right">{group.label}</TooltipContent>
      </Tooltip>
    );
  }

  const handleClick = () => {
    setExpanded(!expanded);
  };

  return (
    <div>
      {group.path ? (
        // Clickable parent — clicking the label navigates, chevron toggles children
        <div className="flex items-center">
          <NavLink
            to={`${base}${group.path}`}
            className={cn(
              'plinth-nav-item flex-1',
              (isParentActive || isChildActive) && 'bg-[rgba(2,201,141,0.12)] text-[#02c98d]',
            )}
          >
            <group.Icon className="h-5 w-5 shrink-0" />
            <span className="ml-3 flex-1 text-left">{group.label}</span>
          </NavLink>
          <button
            onClick={handleClick}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ) : (
        // Non-clickable group header — entire row toggles
        <button
          onClick={handleClick}
          className={cn(
            'plinth-nav-item w-full',
            isActive && 'text-[#02c98d]',
          )}
        >
          <group.Icon className="h-5 w-5 shrink-0" />
          <span className="ml-3 flex-1 text-left">{group.label}</span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
          )}
        </button>
      )}

      {expanded && (
        <div className="mt-0.5 pl-4 space-y-0.5">
          {group.children.map(renderChild)}
        </div>
      )}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = '/app';
  const isAssistant = pathname.startsWith('/app/assistant');

  useEffect(() => {
    const token = localStorage.getItem('plinth_token');
    if (!token) return;
    fetch(`${API_URL}/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setUser(data.user ?? data); })
      .catch(() => {});
  }, []);

  const { events } = useEventStream({ types: ['hfl.escalated', 'mesh.pipeline.failed', 'assistant.pipeline_ready'] });
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
    } else if (latest.type === 'assistant.pipeline_ready') {
      push({
        id: latest.id,
        type: 'hfl_escalation',
        urgency: 'high',
        title: 'Pipeline Analysis Ready',
        message: 'Your pipeline run has been analyzed. Review the AI summary and approve or reject.',
        timestamp: latest.timestamp,
        meta: payload, // includes conversation_id
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

  const renderNavItem = (item: NavItem) => (
    <Tooltip key={item.path}>
      <TooltipTrigger asChild>
        <NavLink
          to={`${base}${item.path}`}
          end={item.path === ''}
          className={cn('plinth-nav-item', collapsed ? 'plinth-nav-collapsed' : '')}
        >
          <item.Icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="ml-3">{item.label}</span>}
        </NavLink>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
    </Tooltip>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside
        className={cn(
          'relative flex flex-col shrink-0 bg-zinc-950 transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-white/[0.06] px-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-950">
            <PlinthLogo />
          </div>
          {!collapsed && (
            <div className="ml-3 flex flex-col leading-none min-w-0">
              <span className="text-[15px] font-bold text-white tracking-tight whitespace-nowrap">Plinth</span>
              <span className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase whitespace-nowrap">by Polanyi</span>
            </div>
          )}
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
            {/* Home */}
            {NAV_ITEMS_TOP.map(renderNavItem)}

            {/* Assistant — expandable with conversation list */}
            <AssistantNav pathname={pathname} collapsed={collapsed} />

            {/* Grouped nav structure */}
            {NAV_STRUCTURE.map((entry) =>
              isNavGroup(entry) ? (
                <NavGroupSection
                  key={entry.label}
                  group={entry}
                  pathname={pathname}
                  collapsed={collapsed}
                  base={base}
                  renderChild={renderNavItem}
                />
              ) : (
                renderNavItem(entry)
              ),
            )}
          </TooltipProvider>
        </nav>

        {/* User footer */}
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

        <main className={cn('flex-1 overflow-hidden', isAssistant ? 'flex flex-col' : 'overflow-y-auto p-6')}>
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
