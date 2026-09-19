import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { handleUserGatewayCallback } from "@/lib/payments/service";

// GET /api/payments/callback — ZarinPal returns the customer's browser
// here with Authority + Status query params.
//
// Security model:
//   - the callback params are ONLY a hint — NEVER proof of payment
//   - success is recorded exclusively after the server-to-server
//     verification with the stored authoritative order amount
//   - the payment is identified through the session user (ownership
//     join); foreign/unknown authorities resolve to a generic error page
//   - duplicate callbacks are idempotent no-ops (Phase 10-A engine)
//   - the user lands on a Persian/RTL result page; no provider data is
//     reflected back into the URL

function resultUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, "http://placeholder.local");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.pathname + "?" + url.searchParams.toString();
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    // Signed-out callback (session expired at the gateway): land on the
    // generic gateway-error result page; no payment is touched.
    return NextResponse.redirect(
      new URL(resultUrl("/payment/result", { state: "gateway-error" }), req.nextUrl)
    );
  }

  const sp = req.nextUrl.searchParams;
  const authority = sp.get("Authority") ?? sp.get("authority");
  const statusRaw = sp.get("Status") ?? sp.get("status");
  const statusHint: "OK" | "NOK" | null =
    statusRaw === "OK" || statusRaw === "NOK" ? statusRaw : null;

  try {
    const outcome = await handleUserGatewayCallback({
      userId: user.id,
      authority,
      statusHint,
    });

    switch (outcome.kind) {
      case "SUCCESS":
      case "ALREADY_PAID":
        return NextResponse.redirect(
          new URL(
            resultUrl("/payment/result", { state: "success", order: outcome.orderId }),
            req.nextUrl
          )
        );
      case "CANCELLED":
        return NextResponse.redirect(
          new URL(
            resultUrl("/payment/result", {
              state: "cancelled",
              order: outcome.orderId,
              retry: "1",
            }),
            req.nextUrl
          )
        );
      case "FAILED":
        return NextResponse.redirect(
          new URL(
            resultUrl("/payment/result", {
              state: "failed",
              order: outcome.orderId,
              retry: "1",
            }),
            req.nextUrl
          )
        );
      case "VERIFY_ERROR":
        return NextResponse.redirect(
          new URL(
            resultUrl("/payment/result", { state: "verifying", order: outcome.orderId }),
            req.nextUrl
          )
        );
      case "INVALID":
        return NextResponse.redirect(
          new URL(resultUrl("/payment/result", { state: "gateway-error" }), req.nextUrl)
        );
    }
  } catch {
    // Unexpected failure — never claim success, never leak details.
    return NextResponse.redirect(
      new URL(resultUrl("/payment/result", { state: "gateway-error" }), req.nextUrl)
    );
  }
}
