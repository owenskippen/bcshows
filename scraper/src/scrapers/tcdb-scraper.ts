/**
 * TCDB.com scraper for British Columbia card shows
 * Scrapes shows from TCDB's CardShows directory
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { BaseScraper, ScraperConfig } from './base-scraper';
import { CardShow } from '@shared/types/show';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
];

export class TcdbScraper extends BaseScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(config: ScraperConfig) {
    super(config);
  }

  protected async initialize(): Promise<void> {
    // Add stealth plugin
    const puppeteerExtra = require('puppeteer-extra');
    puppeteerExtra.use(StealthPlugin());

    // Launch browser
    this.browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Overcome limited resource problems
        '--disable-software-rasterizer',
        '--disable-extensions',
      ],
    });

    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewport({ width: 1280, height: 720 });

    // Set user agent
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await this.page.setUserAgent(userAgent);

    // Set timeouts
    this.page.setDefaultTimeout(this.config.timeout);
    this.page.setDefaultNavigationTimeout(this.config.timeout);
  }

  protected async scrape(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    const bcUrl = 'https://www.tcdb.com/CardShows.cfm?MODE=Location&State=British%20Columbia&Country=Canada';

    try {
      console.log('Navigating to TCDB BC shows page...');
      await this.page.goto(bcUrl, { waitUntil: 'networkidle2' });

      // Wait for shows to load
      await this.page.waitForSelector('table', { timeout: 10000 }).catch(() => {
        console.warn('Table not found, trying alternative selector');
      });

      // Extract show rows
      const shows = await this.page.evaluate(() => {
        const rows: any[] = [];
        const tableRows = document.querySelectorAll('table tbody tr');

        tableRows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            rows.push({
              name: cells[0]?.textContent?.trim() || '',
              date: cells[1]?.textContent?.trim() || '',
              time: cells[2]?.textContent?.trim() || '',
              city: cells[3]?.textContent?.trim() || '',
              address: cells[4]?.textContent?.trim() || '',
              url: (cells[0]?.querySelector('a') as HTMLAnchorElement)?.href || '',
            });
          }
        });

        return rows;
      });

      console.log(`Found ${shows.length} shows on TCDB`);

      // Process each show
      for (const show of shows) {
        if (!show.name || !show.date) {
          continue; // Skip incomplete entries
        }

        await this.randomDelay();

        const cardShow: CardShow = {
          showId: `tcdb-${show.name.replace(/\s+/g, '-').toLowerCase()}-${show.date.replace(/\//g, '-')}`,
          showName: show.name,
          date: this.parseTcdbDate(show.date),
          startTime: this.parseTcdbTime(show.time),
          timeZone: 'America/Vancouver',
          city: show.city,
          region: 'BC',
          address: show.address,
          websiteUrl: show.url,
          source: 'tcdb',
          sourceSiteUrl: bcUrl,
          status: 'active',
          dataQualityScore: 0.8,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          latitude: 49.2827, // Default to BC center - will be geocoded later
          longitude: -123.1207,
          tags: ['trading-cards'], // Default tag
        };

        this.shows.push(cardShow);
      }
    } catch (error) {
      this.errors.push(`Error scraping TCDB: ${error}`);
      throw error;
    }
  }

  /**
   * Parse TCDB date format (e.g., "March 15, 2024" or "3/15/2024")
   */
  private parseTcdbDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // Fall through to default
    }

    // Default to today if parsing fails
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Parse TCDB time format (e.g., "10:00 AM - 4:00 PM")
   */
  private parseTcdbTime(timeStr: string): string {
    try {
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        const [, hours, minutes] = match;
        return `${hours.padStart(2, '0')}:${minutes}`;
      }
    } catch (e) {
      // Fall through to default
    }

    return '10:00'; // Default opening time
  }

  protected async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
