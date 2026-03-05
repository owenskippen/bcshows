/**
 * DynamoDB client wrapper for BC Card Shows
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { CardShow, Location, ScrapeLog } from '@shared/types/show';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
    convertClassInstanceToMap: true,
  },
});

export const TABLES = {
  SHOWS: process.env.DYNAMODB_SHOWS_TABLE || 'CardShows',
  LOCATIONS: process.env.DYNAMODB_LOCATIONS_TABLE || 'Locations',
  SCRAPE_LOG: process.env.DYNAMODB_SCRAPE_LOG_TABLE || 'ScrapeLog',
};

/**
 * Create DynamoDB tables (for development/setup)
 */
export async function createTables(): Promise<void> {
  // In production, this would be handled by Terraform
  // This is a helper for local development
  console.log('DynamoDB tables should be created via Terraform infrastructure code');
}

/**
 * Put a show into DynamoDB
 */
export async function putShow(show: CardShow): Promise<void> {
  const pk = `SHOW#${show.date.slice(0, 7)}#${show.region}`;
  const sk = `SHOW#${show.showId}#${show.date}T${show.startTime}`;

  const item = {
    pk,
    sk,
    ...show,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.SHOWS,
    Item: item,
  }));
}

/**
 * Get a show by ID
 */
export async function getShow(showId: string, date: string): Promise<CardShow | null> {
  const regionMatch = date.match(/(\d{4})-(\d{2})/);
  if (!regionMatch) return null;

  const pk = `SHOW#${date.slice(0, 7)}#BC`;
  const sk = `SHOW#${showId}#${date}`;

  const result = await docClient.send(new GetCommand({
    TableName: TABLES.SHOWS,
    Key: { pk, sk },
  }));

  return (result.Item as CardShow) || null;
}

/**
 * Query shows by date range
 */
export async function queryShows(startDate: string, endDate: string, city?: string): Promise<CardShow[]> {
  // Extract year-month from startDate
  const yearMonth = startDate.slice(0, 7);

  const params: any = {
    TableName: TABLES.SHOWS,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :skStart AND :skEnd',
    ExpressionAttributeValues: {
      ':pk': `SHOW#${yearMonth}#BC`,
      ':skStart': `SHOW#${startDate}`,
      ':skEnd': `SHOW#${endDate}~`, // ~ is higher than all characters
    },
  };

  if (city) {
    params.FilterExpression = 'city = :city';
    params.ExpressionAttributeValues[':city'] = city;
  }

  const result = await docClient.send(new QueryCommand(params));
  return (result.Items as CardShow[]) || [];
}

/**
 * Query shows by location (city) using GSI
 */
export async function queryShowsByLocation(city: string, limit: number = 50, startKey?: any): Promise<{ shows: CardShow[]; nextStartKey?: any }> {
  const params: any = {
    TableName: TABLES.SHOWS,
    IndexName: 'CityIndex',
    KeyConditionExpression: 'city = :city',
    ExpressionAttributeValues: {
      ':city': city,
    },
    Limit: limit,
  };

  if (startKey) {
    params.ExclusiveStartKey = startKey;
  }

  const result = await docClient.send(new QueryCommand(params));
  return {
    shows: (result.Items as CardShow[]) || [],
    nextStartKey: result.LastEvaluatedKey,
  };
}

/**
 * Scan all shows (use with caution - expensive operation)
 */
export async function scanShows(filterExpression?: string, expressionAttributeValues?: any): Promise<CardShow[]> {
  const params: any = {
    TableName: TABLES.SHOWS,
  };

  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeValues = expressionAttributeValues;
  }

  const result = await docClient.send(new ScanCommand(params));
  return (result.Items as CardShow[]) || [];
}

/**
 * Update a show
 */
export async function updateShow(showId: string, date: string, updates: Partial<CardShow>): Promise<void> {
  const pk = `SHOW#${date.slice(0, 7)}#BC`;
  const sk = `SHOW#${showId}#${date}`;

  const updateExpressions: string[] = [];
  const expressionAttributeValues: any = {};
  const expressionAttributeNames: any = {};

  let counter = 0;
  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'pk' && key !== 'sk') {
      const placeholder = `:val${counter}`;
      const nameKey = `#name${counter}`;
      updateExpressions.push(`${nameKey} = ${placeholder}`);
      expressionAttributeValues[placeholder] = value;
      expressionAttributeNames[nameKey] = key;
      counter++;
    }
  }

  updateExpressions.push('#updatedAt = :now');
  expressionAttributeValues[':now'] = new Date().toISOString();
  expressionAttributeNames['#updatedAt'] = 'updatedAt';

  await docClient.send(new UpdateCommand({
    TableName: TABLES.SHOWS,
    Key: { pk, sk },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}

/**
 * Delete a show (soft delete by setting deletedAt)
 */
export async function deleteShow(showId: string, date: string): Promise<void> {
  await updateShow(showId, date, {
    deletedAt: new Date().toISOString(),
    status: 'cancelled',
  });
}

/**
 * Put a location
 */
export async function putLocation(location: Location): Promise<void> {
  const item = {
    pk: `LOCATION#${location.city}`,
    sk: `CITY#${location.province}`,
    ...location,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.LOCATIONS,
    Item: item,
  }));
}

/**
 * Get all BC locations
 */
export async function getBCLocations(): Promise<Location[]> {
  const params: any = {
    TableName: TABLES.LOCATIONS,
    FilterExpression: 'province = :province',
    ExpressionAttributeValues: {
      ':province': 'BC',
    },
  };

  const result = await docClient.send(new ScanCommand(params));
  return (result.Items as Location[]) || [];
}

/**
 * Put scrape log
 */
export async function putScrapeLog(source: string, log: any): Promise<void> {
  const item = {
    pk: `SCRAPE#${source}`,
    sk: `TIMESTAMP#${new Date().toISOString()}`,
    source,
    ...log,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.SCRAPE_LOG,
    Item: item,
  }));
}

/**
 * Get latest scrape log for a source
 */
export async function getLatestScrapeLog(source: string): Promise<ScrapeLog | null> {
  const params: any = {
    TableName: TABLES.SCRAPE_LOG,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': `SCRAPE#${source}`,
    },
    ScanIndexForward: false, // Descending order
    Limit: 1,
  };

  const result = await docClient.send(new QueryCommand(params));
  return (result.Items?.[0] as ScrapeLog) || null;
}
