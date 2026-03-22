// ─── Settings Layout ────────────────────────────────────────────────
import { Outlet, NavLink } from 'react-router-dom';

const SETTINGS_NAV = [
  { path: 'profile', label: 'Profile' },
  { path: 'users', label: 'Users' },
  { path: 'usage', label: 'Usage & Limits' },
  { path: 'billing', label: 'Billing' },
  { path: 'notifications', label: 'Notifications' },
];

export function SettingsLayout() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/50">Manage your account, team, and preferences.</p>
      </div>

      <div className="flex gap-6">
        {/* Settings sub-nav */}
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {SETTINGS_NAV.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={`/app/settings/${item.path}`}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#00F5FF]/10 text-[#00F5FF] border border-[#00F5FF]/20'
                        : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Settings content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
