/**
 * Lambda handler for shows API endpoints
 * GET /api/shows - List shows with filters
 * POST /api/shows - Create a show (admin only)
 * GET /api/shows/{id} - Get show details
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CardShow, ShowQuery, PaginatedResponse } from '@shared/types/show';
import {
  queryShows,
  queryShowsByLocation,
  getShow,
  putShow,
  updateShow,
  deleteShow,
  scanShows,
} from '../database/dynamodb-client';

/**
 * Main handler for shows endpoints
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const path = event.path || '';
    const pathParts = path.split('/').filter(Boolean);

    // GET /api/shows
    if (method === 'GET' && path.endsWith('/shows')) {
      return await handleListShows(event);
    }

    // POST /api/shows (admin only)
    if (method === 'POST' && path.endsWith('/shows')) {
      return await handleCreateShow(event);
    }

    // GET /api/shows/{id}
    if (method === 'GET' && pathParts[pathParts.length - 2] === 'shows') {
      const showId = pathParts[pathParts.length - 1];
      return await handleGetShow(event, showId);
    }

    // PUT /api/shows/{id} (admin only)
    if (method === 'PUT' && pathParts[pathParts.length - 2] === 'shows') {
      const showId = pathParts[pathParts.length - 1];
      return await handleUpdateShow(event, showId);
    }

    // DELETE /api/shows/{id} (admin only)
    if (method === 'DELETE' && pathParts[pathParts.length - 2] === 'shows') {
      const showId = pathParts[pathParts.length - 1];
      return await handleDeleteShow(event, showId);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Error in shows handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Handle GET /api/shows with filters
 */
async function handleListShows(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const query: ShowQuery = {
    startDate: event.queryStringParameters?.startDate,
    endDate: event.queryStringParameters?.endDate,
    city: event.queryStringParameters?.city,
    latitude: event.queryStringParameters?.latitude ? parseFloat(event.queryStringParameters.latitude) : undefined,
    longitude: event.queryStringParameters?.longitude ? parseFloat(event.queryStringParameters.longitude) : undefined,
    radius: event.queryStringParameters?.radius ? parseInt(event.queryStringParameters.radius) : undefined,
    search: event.queryStringParameters?.search,
    tags: event.queryStringParameters?.tags?.split(','),
    limit: event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50,
    offset: event.queryStringParameters?.offset ? parseInt(event.queryStringParameters.offset) : 0,
    sortBy: (event.queryStringParameters?.sortBy as any) || 'date',
  };

  // Validate required params
  if (!query.startDate || !query.endDate) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'startDate and endDate are required',
      }),
    };
  }

  let shows: CardShow[] = [];

  // Query by location if city provided, otherwise query by date range
  if (query.city) {
    const { shows: locationShows } = await queryShowsByLocation(query.city, query.limit);
    shows = locationShows;
  } else {
    shows = await queryShows(query.startDate, query.endDate);
  }

  // Filter by tags if provided
  if (query.tags && query.tags.length > 0) {
    shows = shows.filter(show =>
      show.tags && show.tags.some(tag => query.tags!.includes(tag))
    );
  }

  // Filter by search text
  if (query.search) {
    const searchLower = query.search.toLowerCase();
    shows = shows.filter(show =>
      show.showName.toLowerCase().includes(searchLower) ||
      show.description?.toLowerCase().includes(searchLower)
    );
  }

  // Filter by distance if latitude/longitude provided
  if (query.latitude && query.longitude && query.radius) {
    shows = shows.filter(show =>
      getDistance(query.latitude!, query.longitude!, show.latitude, show.longitude) <= query.radius!
    );
  }

  // Sort results
  if (query.sortBy === 'date') {
    shows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } else if (query.sortBy === 'distance' && query.latitude && query.longitude) {
    shows.sort((a, b) =>
      getDistance(query.latitude!, query.longitude!, a.latitude, a.longitude) -
      getDistance(query.latitude!, query.longitude!, b.latitude, b.longitude)
    );
  }

  // Apply pagination
  const total = shows.length;
  const paginatedShows = shows.slice(query.offset, query.offset + query.limit!);

  const response: PaginatedResponse<CardShow> = {
    data: paginatedShows,
    total,
    page: Math.floor(query.offset! / query.limit!) + 1,
    limit: query.limit!,
    hasMore: query.offset! + query.limit! < total,
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=300', // 5 minute cache
    },
  };
}

/**
 * Handle POST /api/shows (create new show)
 */
async function handleCreateShow(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Check authorization
  const token = event.headers.Authorization?.replace('Bearer ', '');
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // TODO: Verify JWT token with Cognito

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing request body' }),
    };
  }

  const input = JSON.parse(event.body);

  // Validate required fields
  const required = ['showName', 'date', 'startTime', 'city', 'address'];
  for (const field of required) {
    if (!input[field]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Missing required field: ${field}` }),
      };
    }
  }

  const now = new Date().toISOString();
  const show: CardShow = {
    showId: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    showName: input.showName,
    date: input.date,
    startTime: input.startTime,
    timeZone: 'America/Vancouver',
    city: input.city,
    region: 'BC',
    address: input.address,
    websiteUrl: input.websiteUrl,
    phoneNumber: input.phoneNumber,
    email: input.email,
    description: input.description,
    tags: input.tags || [],
    source: 'manual',
    status: input.status || 'active',
    dataQualityScore: 0.8,
    createdAt: now,
    updatedAt: now,
    createdBy: 'admin', // TODO: Extract from JWT
    latitude: 49.2827, // TODO: Geocode
    longitude: -123.1207,
  };

  await putShow(show);

  return {
    statusCode: 201,
    body: JSON.stringify(show),
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Handle GET /api/shows/{id}
 */
async function handleGetShow(event: APIGatewayProxyEvent, showId: string): Promise<APIGatewayProxyResult> {
  const date = event.queryStringParameters?.date;

  if (!date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing date query parameter' }),
    };
  }

  const show = await getShow(showId, date);

  if (!show) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Show not found' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(show),
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=600',
    },
  };
}

/**
 * Handle PUT /api/shows/{id} (update show)
 */
async function handleUpdateShow(event: APIGatewayProxyEvent, showId: string): Promise<APIGatewayProxyResult> {
  // Check authorization
  const token = event.headers.Authorization?.replace('Bearer ', '');
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // TODO: Verify JWT token

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing request body' }),
    };
  }

  const updates = JSON.parse(event.body);
  const date = event.queryStringParameters?.date;

  if (!date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing date query parameter' }),
    };
  }

  await updateShow(showId, date, updates);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'Show updated' }),
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Handle DELETE /api/shows/{id}
 */
async function handleDeleteShow(event: APIGatewayProxyEvent, showId: string): Promise<APIGatewayProxyResult> {
  // Check authorization
  const token = event.headers.Authorization?.replace('Bearer ', '');
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const date = event.queryStringParameters?.date;

  if (!date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing date query parameter' }),
    };
  }

  await deleteShow(showId, date);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'Show deleted' }),
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Calculate distance between two coordinates (km)
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
