import { NextResponse } from "next/server";
import { readPublicListings } from "../../lib/shop-listings";

// Public storefront feed. Serves everything a buyer may see — listed units,
// on-hold units (badged, so a second buyer isn't burned at inquiry time),
// and sold units (social proof). costCents never leaves the server: the
// store lib's toPublic() strips it before this route ever touches the data.
//
// No cache: a listing that sells must vanish on the next load. The blob
// read behind this is list()+fetch(no-store), same as price overrides.
export const dynamic = "force-dynamic";

export async function GET() {
  const listings = await readPublicListings();
  // Newest first — the shop reads like a feed, and "just posted" is the
  // whole energy of a one-of-one store.
  listings.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  return NextResponse.json({ listings });
}
