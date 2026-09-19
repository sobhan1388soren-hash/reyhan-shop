import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { startUserGatewayPayment } from "@/lib/payments/service";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

// POST /api/payments/start — begin the live gateway flow for one order.
//
// Security model:
//   - user identity from the signed session only; no ids trusted from input
//   - payable amount ALWAYS re-derived from the stored order row
//   - the gateway request + authority persistence happen server-side; the
//     client only receives the hosted-checkout redirect URL
//   - credentials never appear in the response or logs

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let orderId: unknown;
  try {
    const body = (await req.json()) as { orderId?: unknown };
    orderId = body?.orderId;
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  if (typeof orderId !== "string" || !orderId) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  // Absolute callback URL — the gateway must return the browser to our
  // callback route; the path is fixed, never client-supplied.
  const callbackUrl = `${SITE_URL}/api/payments/callback`;

  try {
    const outcome = await startUserGatewayPayment({
      userId: user.id,
      orderId,
      callbackUrl,
      siteName: SITE_NAME,
    });

    if (!outcome.ok) {
      // Generic codes only — no internal details, no existence leaks.
      const status =
        outcome.code === "NOT_FOUND" ? 404 : outcome.code === "NOT_PAYABLE" ? 409 : 502;
      return NextResponse.json({ error: outcome.code }, { status });
    }

    switch (outcome.kind) {
      case "REDIRECT":
        return NextResponse.json({ redirectUrl: outcome.redirectUrl });
      case "VERIFIED_EXISTING":
        return NextResponse.json(
          { alreadyPaid: true, orderId: outcome.orderId },
          { status: 200 }
        );
      case "ALREADY_PAID":
        // Order id echo is safe (it was validated against the session),
        // but the outcome variant does not carry it — re-echo the input.
        return NextResponse.json(
          { alreadyPaid: true, orderId },
          { status: 200 }
        );
    }
  } catch {
    return NextResponse.json({ error: "GATEWAY_ERROR" }, { status: 502 });
  }
}
