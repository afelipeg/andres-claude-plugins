// ─── Folder Manager ─────────────────────────────────────────────────
// Idempotent system folder creation and run-specific subfolder management.

import type { KBFolderRepo, KBFolder } from './repos.js';

/**
 * Ensure the 4 system folders exist for a client. Idempotent.
 */
export async function ensureSystemFolders(
  folderRepo: KBFolderRepo,
  agencyId: string,
  clientId: string,
): Promise<KBFolder[]> {
  return folderRepo.ensureSystemFolders(agencyId, clientId);
}

/**
 * Get or create a subfolder under "Engine Outputs" for a specific run.
 * Creates a folder named after the run_id to group engine output files.
 */
export async function getOrCreateRunFolder(
  folderRepo: KBFolderRepo,
  agencyId: string,
  clientId: string,
  runId: string,
): Promise<KBFolder> {
  // Ensure system folders exist first
  await ensureSystemFolders(folderRepo, agencyId, clientId);

  // Find the "Engine Outputs" system folder
  const engineOutputs = await folderRepo.findSystemFolder(clientId, 'Engine Outputs');
  if (!engineOutputs) {
    throw new Error(`System folder "Engine Outputs" not found for client ${clientId}`);
  }

  // Check if run subfolder already exists
  // We search by listing all children and filtering
  const children = await folderRepo.listByClient(clientId);
  const existing = children.find(
    (f) => f.parent_folder_id === engineOutputs.id && f.name === runId,
  );
  if (existing) return existing;

  // Create the run subfolder
  return folderRepo.create({
    agency_id: agencyId,
    client_id: clientId,
    name: runId,
    parent_folder_id: engineOutputs.id,
    is_system: false,
  });
}
