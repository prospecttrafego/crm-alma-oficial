import { google, calendar_v3 } from 'googleapis';
import crypto from 'crypto';
import type { CalendarEvent, GoogleOAuthToken, InsertGoogleOAuthToken } from '@shared/schema';

// OAuth2 scopes for Google Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Token encryption utilities
function getEncryptionKey(): Buffer {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    // If no key is set, use a derived key from SESSION_SECRET (not ideal but fallback)
    const sessionSecret = process.env.SESSION_SECRET || 'default-secret-key-change-me';
    return crypto.scryptSync(sessionSecret, 'google-calendar-salt', 32);
  }
  return Buffer.from(key, 'base64');
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export class GoogleCalendarService {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`
    );
  }

  /**
   * Check if Google Calendar integration is configured
   */
  isConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state,
      prompt: 'consent', // Force consent to always get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date;
    scope: string;
    tokenType: string;
    email: string;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    // Get user email
    this.oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || null,
      expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
      scope: tokens.scope || SCOPES.join(' '),
      tokenType: tokens.token_type || 'Bearer',
      email: userInfo.data.email || '',
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: Date;
  }> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();

    return {
      accessToken: credentials.access_token!,
      expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000),
    };
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeTokens(accessToken: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(accessToken);
    } catch (error) {
      // Token might already be revoked, that's okay
      console.log('Token revocation failed (may already be revoked):', error);
    }
  }

  /**
   * Get Calendar API client with valid access token
   */
  private getCalendarClient(accessToken: string): calendar_v3.Calendar {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * List user's calendars
   */
  async listCalendars(accessToken: string): Promise<Array<{
    id: string;
    summary: string;
    primary: boolean;
  }>> {
    const calendar = this.getCalendarClient(accessToken);
    const response = await calendar.calendarList.list();

    return (response.data.items || []).map(cal => ({
      id: cal.id || '',
      summary: cal.summary || '',
      primary: cal.primary || false,
    }));
  }

  /**
   * List events from Google Calendar (supports incremental sync)
   */
  async listEvents(
    accessToken: string,
    calendarId: string = 'primary',
    options: {
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
      syncToken?: string;
    } = {}
  ): Promise<{
    events: Array<{
      id: string;
      summary: string;
      description?: string;
      location?: string;
      start: Date;
      end: Date;
      allDay: boolean;
      attendees?: string[];
      updated: Date;
      cancelled: boolean;
    }>;
    nextSyncToken?: string;
    syncTokenInvalid?: boolean;
  }> {
    const calendar = this.getCalendarClient(accessToken);

    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      singleEvents: true,
      maxResults: options.maxResults || 250,
      showDeleted: options.syncToken ? true : false, // Show deleted events when using syncToken
    };

    if (options.syncToken) {
      params.syncToken = options.syncToken;
    } else {
      params.orderBy = 'startTime';
      params.timeMin = (options.timeMin || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString();
      params.timeMax = (options.timeMax || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)).toISOString();
    }

    try {
      const response = await calendar.events.list(params);

      return {
        events: (response.data.items || []).map(event => ({
          id: event.id || '',
          summary: event.summary || '(No title)',
          description: event.description || undefined,
          location: event.location || undefined,
          start: new Date(event.start?.dateTime || event.start?.date || ''),
          end: new Date(event.end?.dateTime || event.end?.date || ''),
          allDay: !event.start?.dateTime,
          attendees: event.attendees?.map(a => a.email || '').filter(Boolean),
          updated: new Date(event.updated || ''),
          cancelled: event.status === 'cancelled',
        })),
        nextSyncToken: response.data.nextSyncToken || undefined,
      };
    } catch (error: any) {
      // Handle 410 GONE - syncToken is invalid, need full sync
      if (error?.code === 410 || error?.response?.status === 410) {
        return {
          events: [],
          syncTokenInvalid: true,
        };
      }
      throw error;
    }
  }

  /**
   * Create event in Google Calendar
   */
  async createEvent(
    accessToken: string,
    calendarId: string = 'primary',
    event: {
      title: string;
      description?: string;
      location?: string;
      startTime: Date;
      endTime: Date;
      allDay?: boolean;
      attendees?: string[];
    }
  ): Promise<string> {
    const calendar = this.getCalendarClient(accessToken);

    const eventResource: calendar_v3.Schema$Event = {
      summary: event.title,
      description: event.description,
      location: event.location,
      attendees: event.attendees?.map(email => ({ email })),
    };

    if (event.allDay) {
      eventResource.start = { date: event.startTime.toISOString().split('T')[0] };
      eventResource.end = { date: event.endTime.toISOString().split('T')[0] };
    } else {
      eventResource.start = { dateTime: event.startTime.toISOString() };
      eventResource.end = { dateTime: event.endTime.toISOString() };
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventResource,
    });

    return response.data.id || '';
  }

  /**
   * Update event in Google Calendar
   */
  async updateEvent(
    accessToken: string,
    calendarId: string = 'primary',
    eventId: string,
    event: {
      title?: string;
      description?: string;
      location?: string;
      startTime?: Date;
      endTime?: Date;
      allDay?: boolean;
      attendees?: string[];
    }
  ): Promise<void> {
    const calendar = this.getCalendarClient(accessToken);

    const eventResource: calendar_v3.Schema$Event = {};

    if (event.title !== undefined) eventResource.summary = event.title;
    if (event.description !== undefined) eventResource.description = event.description;
    if (event.location !== undefined) eventResource.location = event.location;
    if (event.attendees !== undefined) eventResource.attendees = event.attendees.map(email => ({ email }));

    if (event.startTime && event.endTime) {
      if (event.allDay) {
        eventResource.start = { date: event.startTime.toISOString().split('T')[0] };
        eventResource.end = { date: event.endTime.toISOString().split('T')[0] };
      } else {
        eventResource.start = { dateTime: event.startTime.toISOString() };
        eventResource.end = { dateTime: event.endTime.toISOString() };
      }
    }

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: eventResource,
    });
  }

  /**
   * Delete event from Google Calendar
   */
  async deleteEvent(
    accessToken: string,
    calendarId: string = 'primary',
    eventId: string
  ): Promise<void> {
    const calendar = this.getCalendarClient(accessToken);

    await calendar.events.delete({
      calendarId,
      eventId,
    });
  }

  /**
   * Convert CRM event to Google event format
   */
  crmEventToGoogleEvent(event: CalendarEvent): {
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    allDay: boolean;
    attendees?: string[];
  } {
    return {
      title: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime),
      allDay: event.allDay || false,
      attendees: event.attendees || undefined,
    };
  }

  /**
   * Convert Google event to CRM event format
   */
  googleEventToCrmEvent(
    googleEvent: {
      id: string;
      summary: string;
      description?: string;
      location?: string;
      start: Date;
      end: Date;
      allDay: boolean;
      attendees?: string[];
    },
    userId: string,
    organizationId: number,
    calendarId: string
  ): Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      title: googleEvent.summary,
      description: googleEvent.description || null,
      type: 'meeting',
      startTime: googleEvent.start,
      endTime: googleEvent.end,
      allDay: googleEvent.allDay,
      location: googleEvent.location || null,
      contactId: null,
      dealId: null,
      activityId: null,
      organizationId,
      userId,
      attendees: googleEvent.attendees || null,
      color: null,
      googleEventId: googleEvent.id,
      googleCalendarId: calendarId,
      syncSource: 'google',
      lastSyncedAt: new Date(),
    };
  }
}

// Singleton instance
export const googleCalendarService = new GoogleCalendarService();
