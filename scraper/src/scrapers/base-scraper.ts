/**
 * Abstract base class for all scrapers
 * Provides common functionality for data extraction, deduplication, and uploading
 */

import { CardShow } from '@shared/types/show';

export interface ScraperConfig {
  name: string;
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
  requestDelayMs: [number, number]; // [min, max] random delay between requests
  timeout: number;
}

export interface ScraperResult {
  source: string;
  startTime: Date;
  endTime: Date;
  shows: CardShow[];
  failedUrls: string[];
  errors: string[];
  success: boolean;
}

export abstract class BaseScraper {
  protected config: ScraperConfig;
  protected shows: CardShow[] = [];
  protected errors: string[] = [];
  protected failedUrls: string[] = [];
  protected startTime: Date = new Date();

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  /**
   * Main entry point for scraper
   */
  async run(): Promise<ScraperResult> {
    if (!this.config.enabled) {
      console.log(`Scraper ${this.config.name} is disabled, skipping`);
      return this.getResult();
    }

    try {
      console.log(`Starting ${this.config.name} scraper...`);
      await this.initialize();
      await this.scrape();
      await this.normalize();
      return this.getResult();
    } catch (error) {
      this.errors.push(`Critical error in scraper: ${error}`);
      console.error(`Error in ${this.config.name}:`, error);
      return this.getResult();
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize scraper (e.g., open browser, setup headers)
   * Override in subclasses as needed
   */
  protected async initialize(): Promise<void> {
    // Default: no initialization
  }

  /**
   * Main scraping logic - must be implemented by subclasses
   */
  protected abstract scrape(): Promise<void>;

  /**
   * Normalize and clean scraped data
   */
  protected async normalize(): Promise<void> {
    this.shows = this.shows.map(show => this.normalizeShow(show));

    // Deduplication: Remove shows with duplicate (name + date + city + time)
    const seen = new Set<string>();
    const deduplicated: CardShow[] = [];

    for (const show of this.shows) {
      const key = `${show.showName}|${show.date}|${show.city}|${show.startTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(show);
      }
    }

    this.shows = deduplicated;
    console.log(`${this.config.name}: Deduplicated to ${this.shows.length} unique shows`);
  }

  /**
   * Normalize individual show data
   */
  protected normalizeShow(show: CardShow): CardShow {
    return {
      ...show,
      // Trim all string fields
      showName: show.showName?.trim() || '',
      city: show.city?.trim() || '',
      address: show.address?.trim() || '',
      websiteUrl: show.websiteUrl?.trim() || show.websiteUrl,
      phoneNumber: show.phoneNumber?.trim() || show.phoneNumber,
      email: show.email?.trim() || show.email,

      // Standardize dates
      date: this.formatDate(show.date),
      startTime: this.formatTime(show.startTime),
      endTime: show.endTime ? this.formatTime(show.endTime) : undefined,

      // Clean tags
      tags: show.tags?.map(t => t.toLowerCase().trim()) || [],

      // Calculate data quality score
      dataQualityScore: this.calculateQualityScore(show),
    };
  }

  /**
   * Calculate data quality score (0-1)
   * Based on field completeness
   */
  protected calculateQualityScore(show: CardShow): number {
    const fields = [
      show.showName,
      show.date,
      show.startTime,
      show.city,
      show.address,
      show.latitude && show.longitude ? 'coords' : null,
      show.websiteUrl,
      show.email,
      show.phoneNumber,
      show.description,
    ];

    const filledFields = fields.filter(f => f).length;
    const score = filledFields / fields.length;

    // Minimum score of 0.5 for shows with basic info
    return Math.max(0.5, score);
  }

  /**
   * Format date to ISO 8601 YYYY-MM-DD
   */
  protected formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr; // Return as-is if parsing fails
    }
  }

  /**
   * Format time to HH:MM
   */
  protected formatTime(timeStr: string): string {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const [, hours, minutes] = match;
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
    return timeStr;
  }

  /**
   * Sleep for random duration between min and max ms
   */
  protected async randomDelay(): Promise<void> {
    const [min, max] = this.config.requestDelayMs;
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Retry logic for failed requests
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    operation: string = 'operation'
  ): Promise<T | null> {
    for (let i = 0; i < this.config.maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        console.warn(`${operation} attempt ${i + 1} failed:`, error);
        if (i < this.config.maxRetries - 1) {
          await this.sleep(this.config.retryDelayMs * Math.pow(2, i)); // Exponential backoff
        }
      }
    }
    this.errors.push(`${operation} failed after ${this.config.maxRetries} attempts`);
    return null;
  }

  /**
   * Sleep for specified ms
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup (e.g., close browser)
   * Override in subclasses as needed
   */
  protected async cleanup(): Promise<void> {
    // Default: no cleanup
  }

  /**
   * Get final result object
   */
  protected getResult(): ScraperResult {
    return {
      source: this.config.name,
      startTime: this.startTime,
      endTime: new Date(),
      shows: this.shows,
      failedUrls: this.failedUrls,
      errors: this.errors,
      success: this.errors.length === 0 && this.shows.length > 0,
    };
  }
}
