import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCheckoutAddresses } from "@/lib/checkout/validate";

// GET /api/checkout/addresses — session-scoped address list for the inline
// "add address" flow in checkout. Authorization comes from the signed
// session cookie; no user id is ever accepted from the request.

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const addresses = await getCheckoutAddresses(user.id);
    return NextResponse.json({ addresses });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
