// app/api/maps/static-map/route.ts
// Proxies Google's Static Maps API so the (server-only) key never reaches
// the browser. Used by the anchor report's zone map editor, and by the
// /maps-compare imagery-comparison tool.

import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  // Precise lat/lng (from a live map the user has already framed) is always
  // preferred — it skips a second, less reliable address-string geocode.
  const center = lat && lng ? `${lat},${lng}` : address;
  if (!center) {
    return new Response("Missing address or lat/lng", { status: 400 });
  }

  const apiKey = process.env.MAPS_DEMO;
  if (!apiKey) {
    return new Response("MAPS_DEMO is not configured", { status: 500 });
  }

  const zoom = req.nextUrl.searchParams.get("zoom") ?? "19";
  const size = req.nextUrl.searchParams.get("size") ?? "640x400";

  const url =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${encodeURIComponent(center)}` +
    `&zoom=${encodeURIComponent(zoom)}` +
    `&size=${encodeURIComponent(size)}` +
    `&scale=2&maptype=satellite&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const message = await res.text();
    return new Response(
      `Google Static Maps request failed (${res.status}): ${message}`,
      { status: res.status },
    );
  }

  const buffer = await res.arrayBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "no-store",
    },
  });
}
