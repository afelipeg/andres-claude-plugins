// ─── Settings Layout ────────────────────────────────────────────────
// Sub-nav for /app/settings/* pages

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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account, team, and preferences.</p>
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
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
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
