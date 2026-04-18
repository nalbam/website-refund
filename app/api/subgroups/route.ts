import { NextResponse } from 'next/server';
import { getSubgroups } from '@/lib/config';

export async function GET() {
  try {
    const subgroups = getSubgroups();
    if (subgroups.length === 0) {
      return NextResponse.json(
        { error: 'No valid subgroups configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({ subgroups });
  } catch (error) {
    console.error('Error loading subgroups:', error);
    return NextResponse.json(
      { error: 'Failed to load subgroups' },
      { status: 500 }
    );
  }
}
