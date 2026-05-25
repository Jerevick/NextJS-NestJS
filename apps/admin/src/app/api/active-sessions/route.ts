import { NextResponse } from 'next/server';
import { getActiveSessions } from '@/lib/platform-api';

export async function GET() {
  const snapshot = await getActiveSessions();
  return NextResponse.json(snapshot);
}
