/**
 * Core types for BC Card Shows Aggregator
 */

export interface CardShow {
  // Identifiers
  showId: string;
  showName: string;

  // Date and Time
  date: string; // ISO 8601 format YYYY-MM-DD
  startTime: string; // HH:MM format
  endTime?: string; // HH:MM format (optional)
  timeZone: string; // e.g., "America/Vancouver"

  // Location
  city: string;
  region: string; // e.g., "BC"
  address: string;
  postalCode?: string;
  latitude: number;
  longitude: number;

  // Show Details
  websiteUrl?: string;
  phoneNumber?: string;
  email?: string;
  organizer?: string;
  description?: string;
  admissionPrice?: string; // e.g., "$5", "Free"
  imageUrl?: string;

  // Card Game Tags
  tags?: string[]; // e.g., ["pokemon", "mtg", "yugioh", "sports-cards"]

  // Recurring Pattern (if applicable)
  isRecurring?: boolean;
  recurringPattern?: "weekly" | "biweekly" | "monthly" | "quarterly";
  recurringStart?: string; // ISO 8601
  recurringEnd?: string; // ISO 8601
  daysOfWeek?: number[]; // 0=Sunday, 6=Saturday
  exceptions?: string[]; // Dates when the recurring show is cancelled (ISO 8601)

  // Capacity & Vendor Info
  capacity?: number;
  vendorCount?: number;

  // System Fields
  source: "tcdb" | "scrape" | "manual"; // Data source
  sourceSiteUrl?: string; // Original URL if scraped
  status: "active" | "cancelled" | "rescheduled" | "draft";
  dataQualityScore: number; // 0-1 based on completeness
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  createdBy?: string; // User ID
  deletedAt?: string; // ISO 8601 (for soft deletes)
}

export interface Location {
  city: string;
  province: string; // e.g., "BC"
  region?: string; // e.g., "Lower Mainland"
  latitude: number;
  longitude: number;
  radius?: number; // Search radius in km
  popularity?: number; // Number of shows in this location
  lastUpdated: string; // ISO 8601
}

export interface ScrapeLog {
  source: string; // e.g., "tcdb"
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  status: "success" | "partial" | "failed";
  showsScraped: number;
  showsAdded: number;
  showsUpdated: number;
  showsSkipped: number;
  errorCount: number;
  errors: string[];
  details?: {
    bannedDetected: boolean;
    rateLimitHit: boolean;
    dataChanged: boolean;
  };
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  timestamp: string;
}

export interface ShowQuery {
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
  city?: string;
  latitude?: number; // For radius search
  longitude?: number; // For radius search
  radius?: number; // km
  search?: string; // Text search
  tags?: string[]; // Filter by card game types
  limit?: number;
  offset?: number;
  sortBy?: "date" | "distance" | "relevance";
}

export interface AdminShow extends Partial<CardShow> {
  // Admin can create/update shows with these fields
  showName: string;
  date: string;
  startTime: string;
  city: string;
  address: string;
  status?: "draft" | "active";
  imageUrl?: string;
  tags?: string[];
}
