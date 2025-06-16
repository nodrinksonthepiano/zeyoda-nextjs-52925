import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const newArtistProfile = await request.json();

    // Validate incoming data (basic)
    if (!newArtistProfile || !newArtistProfile.id || !newArtistProfile.config) {
      return NextResponse.json({ message: 'Invalid profile data' }, { status: 400 });
    }

    const configPath = path.join(process.cwd(), 'public', 'artists', 'config.json');
    
    // Read the existing config file
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(fileContent);

    // Add the new artist profile
    config.artists[newArtistProfile.id] = newArtistProfile.config;

    // Write the updated config back to the file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ message: 'Profile created successfully', artistId: newArtistProfile.id }, { status: 200 });

  } catch (error) {
    console.error('Error in /api/profiles:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
} 