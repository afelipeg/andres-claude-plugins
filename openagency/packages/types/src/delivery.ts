// ─── Delivery Engine Types ───────────────────────────────────────────

// ─── Plinth Template ────────────────────────────────────────────────

export interface PlinthBrandColors {
  primary: '#000000';
  secondary: '#666666';
  accent: '#FFFFFF';
  highlight: '#3B82F6';
}

export interface PlinthTemplate {
  colors: PlinthBrandColors;
  fonts: { heading: 'Raleway'; body: 'Raleway' };
  logo_path: string;   // e.g. 'assets/plinth-logo.png'
  footer: 'Plinth by Polanyi — plinth.polanyi.tech';
}

// ─── File Output ─────────────────────────────────────────────────────

export type DeliveryFileType = 'pptx' | 'pdf' | 'docx' | 'xlsx';

export interface DeliveryFileRecord {
  id: string;           // ULID
  client_id: string;
  skill_id: string;
  run_id: string;
  file_type: DeliveryFileType;
  file_path: string;    // local path or S3 key
  size_bytes: number;
  created_at: string;   // ISO 8601
  expires_at: string;   // ISO 8601 — default TTL 90 days
}

export interface DeliveryFileOutput {
  file_id: string;
  file_type: DeliveryFileType;
  file_path: string;
  size_bytes: number;
  download_url: string;
  metadata: Record<string, unknown>;
}

// ─── Skill Input / Output ────────────────────────────────────────────

/** Results from the 4 Layer-1 engines, passed as context to Delivery skills */
export interface LayerOneResults {
  leak_detector?: unknown;
  media_architect?: unknown;
  campaign_ops?: unknown;
  executive_bridge?: unknown;
  run_id?: string;
  client_id?: string;
  period_start?: string;
  period_end?: string;
}

export interface DeliverySkillInput {
  client_id: string;
  run_id: string;
  layer_one_results: LayerOneResults;
  /** Additional context specific to each skill */
  context?: Record<string, unknown>;
}

export interface DeliverySkillOutput {
  skill_id: string;
  file: DeliveryFileOutput;
  /** Additional files for skills that produce multiple formats (e.g. scorecard-export). */
  additional_files?: DeliveryFileOutput[];
  summary: string;       // 1-3 sentence summary of the deliverable
  generated_at: string;  // ISO 8601
}

// ─── Web Search ──────────────────────────────────────────────────────

export interface WebSearchQuery {
  query: string;
  num_results?: number;
  freshness?: 'day' | 'week' | 'month';
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  published_at?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  cached: boolean;
  fetched_at: string;
}

// ─── Ad Library ──────────────────────────────────────────────────────

export interface AdLibraryQuery {
  advertiser_name: string;
  country?: string;
  ad_type?: 'all' | 'political' | 'housing' | 'employment' | 'credit';
  limit?: number;
}

export interface AdLibraryAd {
  id: string;
  advertiser_name: string;
  ad_creative_body?: string;
  ad_creative_link_title?: string;
  impressions?: string;
  spend?: string;
  currency?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  platforms?: string[];
}

export interface AdLibraryResponse {
  platform: 'meta' | 'google';
  advertiser_name: string;
  ads: AdLibraryAd[];
  total_count: number;
  fetched_at: string;
  cached: boolean;
}

// ─── Delivery Events ─────────────────────────────────────────────────

export interface DeliveryFileGeneratedPayload {
  file_id: string;
  client_id: string;
  run_id: string;
  skill_id: string;
  file_type: DeliveryFileType;
  size_bytes: number;
}

export interface DeliverySkillCompletedPayload {
  skill_id: string;
  client_id: string;
  run_id: string;
  file_id: string;
  duration_ms: number;
}

export interface DeliverySearchCompletedPayload {
  query: string;
  source: 'web' | 'meta_ad_library' | 'google_ads_transparency';
  result_count: number;
  cached: boolean;
}
