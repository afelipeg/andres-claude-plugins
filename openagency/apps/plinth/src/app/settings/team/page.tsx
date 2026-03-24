'use client';

import { Users } from 'lucide-react';

export default function TeamPage() {
  return (
    <div className="max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Team Management</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Invite team members, manage roles and permissions for your agency.
            This feature is coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
