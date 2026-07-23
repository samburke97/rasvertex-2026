// app/api/maps/geocode/route.ts
// Proxies Google's Geocoding API through a dedicated, server-only key —
// kept separate from NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY (which necessarily runs
// in the browser) so geocoding has its own key, quota, and restrictions.

import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return Response.json({ error: "Missing address" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_GEOCODING_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GOOGLE_GEOCODING_KEY is not configured" },
      { status: 500 },
    );
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(address)}&region=au&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    return Response.json(
      { error: `Geocoding request failed: HTTP ${res.status}` },
      { status: res.status },
    );
  }

  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) {
    return Response.json(
      { error: `Couldn't locate that address (${data.status})` },
      { status: 404 },
    );
  }

  const { lat, lng } = data.results[0].geometry.location;
  return Response.json({ lat, lng });
}
