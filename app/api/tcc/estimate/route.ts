import { NextRequest, NextResponse } from "next/server";
import {
  DEVICES,
  CONDITION_TIERS,
  STORAGE_TIERS,
  CARRIERS,
  computeQuote,
  type ConditionId,
  type StorageId,
  type CarrierId,
} from "@/app/lib/devices";

type EstimateBody = {
  deviceSlug?: string;
  basePrice?: number;
  condition?: ConditionId;
  storage?: StorageId;
  carrier?: CarrierId;
};

export async function POST(req: NextRequest) {
  let data: EstimateBody;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { deviceSlug, basePrice, condition, storage, carrier } = data;

  if (!condition || !storage) {
    return NextResponse.json(
      { error: "condition and storage are required" },
      { status: 400 }
    );
  }

  let resolvedBase: number | undefined = basePrice;
  let device: (typeof DEVICES)[number] | undefined;
  if (deviceSlug) {
    device = DEVICES.find((d) => d.slug === deviceSlug);
    if (!device) {
      return NextResponse.json({ error: `Unknown deviceSlug "${deviceSlug}"` }, { status: 404 });
    }
    resolvedBase = device.price;
  }

  if (typeof resolvedBase !== "number" || resolvedBase <= 0) {
    return NextResponse.json(
      { error: "Provide either deviceSlug (curated catalog) or basePrice (number > 0)" },
      { status: 400 }
    );
  }

  const result = computeQuote({ basePrice: resolvedBase, condition, storage, carrier });
  if (!result) {
    return NextResponse.json(
      { error: "Invalid condition, storage, or carrier value" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    quote: result.quote,
    device: device
      ? { slug: device.slug, name: device.name, category: device.category, basePrice: device.price }
      : { basePrice: resolvedBase },
    inputs: { condition, storage, carrier: carrier ?? "unlocked" },
    multipliers: result.multipliers,
  });
}

export async function GET() {
  return NextResponse.json({
    devices: DEVICES.map((d) => ({ slug: d.slug, name: d.name, category: d.category, basePrice: d.price })),
    conditions: CONDITION_TIERS,
    storage: STORAGE_TIERS,
    carriers: CARRIERS,
    formula: "round(basePrice * storage.multiplier * condition.multiplier * carrier.multiplier)",
  });
}
