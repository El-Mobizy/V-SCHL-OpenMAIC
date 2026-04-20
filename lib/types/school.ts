export interface SchoolUser {
  email: string;
  name: string;
  role: 'admin' | 'student';
  department: string;
  program: string;
  level: string;
  /** Crockford base32 ULID; empty string for non-students per guide §1. */
  student_uuid: string;
  /** Crockford base32 ULID identifying the school; empty string for tokens issued before 2026-04-20. */
  school_uuid: string;
  /** Display name of the school; empty string for tokens issued before 2026-04-20. */
  school_name: string;
}

export interface Course {
  uuid: string;
  title: string;
  description: string;
  /** Null until an admin sets it (guide §3.1). */
  objectives: string | null;
  department: string | null;
  program: string | null;
  level: string | null;
  thumbnail_url?: string;
  /** Detail-only fields (guide §3.1b), absent in list responses. */
  code?: string | null;
  units?: number | null;
}

export interface CourseProgress {
  course_uuid: string;
  current_scene_index: number;
  completed_scenes: number[];
  last_accessed: string;
  total_scenes: number;
}

export interface TokenQuota {
  max_tokens: number;
  used_tokens: number;
  reset_date: string;
}

export interface SchoolBranding {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  school_name: string;
  favicon_url?: string;
}

export interface ModelCapabilities {
  vision?: boolean;
  tools?: boolean;
  streaming?: boolean;
}

export interface AvailableModel {
  id: string;
  name: string;
  capabilities?: ModelCapabilities;
  contextWindow?: number;
  outputWindow?: number;
}

export interface AvailableProvider {
  id: string;
  name: string;
  models: AvailableModel[];
}

export interface SuggestedModel {
  id: string;
  name: string;
}

export interface ApiKey {
  provider: string;
  api_key?: string;
  base_url?: string | null;
  models: SuggestedModel[];
  has_key?: boolean;
  suggested_base_url?: string | null;
  suggested_models?: SuggestedModel[];
  catalog_updated_at?: string;
}

export interface ProviderCatalogEntry {
  provider: string;
  default_base_url: string | null;
  suggested_models: SuggestedModel[];
  updated_at: string;
}

export interface UsageEntry {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  timestamp: string;
}

export interface Student {
  uuid: string;
  matric_no: string | null;
  firstname: string;
  lastname: string;
  email: string;
  department: string | null;
  program: string | null;
  level: string | null;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface AdminStats {
  students: number;
  active_students: number;
  courses: number;
  syllabuses: number;
  tokens_today: number;
  tokens_this_week: number;
  tokens_this_month: number;
}

export interface StudentStats {
  tokens_used: number;
  tokens_max: number;
  tokens_reset_date: string;
  syllabuses_generated: number;
  courses_in_progress: number;
  courses_completed: number;
  tokens_this_month: number;
  last_activity_at: string | null;
}
