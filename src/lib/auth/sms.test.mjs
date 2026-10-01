// SMS provider tests — Phase 21 (Kavenegar integration).
//
// Covers provider selection, Kavenegar config resolution, request shaping,
// response mapping, and the full sender path against an injected fetch —
// so no real network call is ever made. Everything under test lives in the
// pure, DB-free ./sms-providers.ts module; the server-only ./sms.ts wiring
// delegates to it.
//
// Run: npm run test:sms

import test from "node:test";
import assert from "node:assert/strict";

import {
  SMS_PROVIDER_CONSOLE,
  SMS_PROVIDER_KAVENEGAR,
  SMS_DELIVERY_FAILED_RESULT,
  SMS_NOT_CONFIGURED_RESULT,
  buildOtpMessage,
  buildKavenegarRequestBody,
  createKavenegarSmsSender,
  kavenegarSendUrl,
  parseKavenegarResult,
  resolveKavenegarApiKey,
  resolveKavenegarReceptor,
  resolveKavenegarSender,
  resolveSmsProvider,
  sendKavenegarOtp,
} from "./sms-providers.ts";

const TEST_KEY = "test-api-key-DO-NOT-LOG-0123456789";
const PHONE = "989121234567";
const CODE = "482913";

/** A fetch double that records calls and replays a canned response. */
function recordingFetch(responder) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return responder(url, init);
  };
  impl.calls = calls;
  return impl;
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function successBody() {
  return {
    return: { status: 200, message: "توضیح" },
    entries: [
      {
        messageid: 1234,
        message: buildOtpMessage(CODE),
        status: 1,
        statustext: "در صف ارسال",
        sender: "1000555",
        receptor: PHONE,
        date: 1_700_000_000,
        cost: 100,
      },
    ],
  };
}

// ── Provider selection ──────────────────────────────────────────────────

test("provider selection: unset / empty / console resolves to console", () => {
  for (const env of [
    {},
    { SMS_PROVIDER: "" },
    { SMS_PROVIDER: "console" },
    { SMS_PROVIDER: "  console  " },
  ]) {
    const res = resolveSmsProvider(env);
    assert.equal(res.key, SMS_PROVIDER_CONSOLE, `env=${JSON.stringify(env)}`);
    assert.equal(res.unrecognized, false);
  }
});

test("provider selection: kavenegar resolves to kavenegar", () => {
  const res = resolveSmsProvider({ SMS_PROVIDER: "kavenegar" });
  assert.equal(res.key, SMS_PROVIDER_KAVENEGAR);
  assert.equal(res.unrecognized, false);
});

test("provider selection: unknown keys degrade to console and are flagged", () => {
  for (const raw of ["kavenegar.ir", "SMS_IR", "twilio", "Kavenegar", "true"]) {
    const res = resolveSmsProvider({ SMS_PROVIDER: raw });
    assert.equal(res.key, SMS_PROVIDER_CONSOLE, `provider=${raw}`);
    assert.equal(res.unrecognized, true, `provider=${raw}`);
  }
});

test("provider selection: production with kavenegar NEVER falls back to console", () => {
  // NODE_ENV must not change the selection — kavenegar stays kavenegar.
  for (const nodeEnv of ["production", "development", "test", undefined]) {
    const res = resolveSmsProvider({
      SMS_PROVIDER: "kavenegar",
      NODE_ENV: nodeEnv,
    });
    assert.equal(res.key, SMS_PROVIDER_KAVENEGAR, `NODE_ENV=${String(nodeEnv)}`);
  }

  // And with no API key configured, the kavenegar sender itself fails
  // closed instead of silently behaving like the console sender.
  const sender = createKavenegarSmsSender({
    SMS_PROVIDER: "kavenegar",
    NODE_ENV: "production",
  });
  return sender.sendOtp(PHONE, CODE).then((result) => {
    assert.equal(result.ok, false);
  });
});

// ── Kavenegar config resolution ──────────────────────────────────────────

test("kavenegar config: missing API key is not provisioned", () => {
  for (const env of [
    {},
    { KAVENEGAR_API_KEY: "" },
    { KAVENEGAR_API_KEY: "   " },
  ]) {
    assert.equal(resolveKavenegarApiKey(env).ok, false, `env=${JSON.stringify(env)}`);
  }
});

test("kavenegar config: present API key resolves trimmed", () => {
  const res = resolveKavenegarApiKey({ KAVENEGAR_API_KEY: `  ${TEST_KEY}  ` });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.apiKey, TEST_KEY);
});

test("kavenegar sender: unset by default — no line number is ever invented", () => {
  assert.equal(resolveKavenegarSender({}), undefined);
  assert.equal(resolveKavenegarSender({ KAVENEGAR_SENDER: "" }), undefined);
  assert.equal(resolveKavenegarSender({ KAVENEGAR_SENDER: "  " }), undefined);
  assert.equal(resolveKavenegarSender({ KAVENEGAR_SENDER: "1000555" }), "1000555");
});

// ── Message + request shaping ────────────────────────────────────────────

test("otp message: single source of truth carries the issued code", () => {
  const message = buildOtpMessage(CODE);
  assert.ok(message.includes(CODE));
  assert.ok(message.length > CODE.length);
});

test("kavenegar body: sender omitted unless provisioned", () => {
  assert.deepEqual(buildKavenegarRequestBody({ phone: PHONE, message: "m" }), {
    receptor: PHONE,
    message: "m",
  });
  assert.deepEqual(
    buildKavenegarRequestBody({ phone: PHONE, message: "m", sender: "1000555" }),
    { receptor: PHONE, message: "m", sender: "1000555" }
  );
});

// ── Phone normalization (consistent with the auth flows) ─────────────────

test("kavenegar receptor: uses the shared Reyhan normalization", () => {
  assert.equal(resolveKavenegarReceptor("09121234567"), PHONE);
  assert.equal(resolveKavenegarReceptor("+989121234567"), PHONE);
  assert.equal(resolveKavenegarReceptor("00989121234567"), PHONE);
  assert.equal(resolveKavenegarReceptor("989121234567"), PHONE);
  assert.equal(resolveKavenegarReceptor("9121234567"), PHONE);
  assert.equal(resolveKavenegarReceptor("02112345678"), null); // landline
  assert.equal(resolveKavenegarReceptor("abc"), null);
  assert.equal(resolveKavenegarReceptor(""), null);
});

// ── Response mapping ─────────────────────────────────────────────────────

test("kavenegar response: accepted envelope with entries is a success", () => {
  assert.deepEqual(parseKavenegarResult(successBody()), { ok: true });
});

test("kavenegar response: provider rejections are failures", () => {
  // Kavenegar returns HTTP 200 with a non-200 return.status on rejection.
  for (const body of [
    { return: { status: 401, message: "Invalid API key" }, entries: [] },
    { return: { status: 402, message: "Insufficient credit" }, entries: [] },
    { return: { status: 406, message: "Bad receptor" }, entries: [] },
    { return: { status: 200 }, entries: [] }, // accepted but no entries
    { return: {}, entries: [{ messageid: 1 }] }, // missing status
    {},
    null,
    "not-an-object",
    [{ return: { status: 200 } }],
  ]) {
    assert.deepEqual(
      parseKavenegarResult(body),
      SMS_DELIVERY_FAILED_RESULT,
      `body=${JSON.stringify(body)}`
    );
  }
});

// ── Full sender path (injected fetch — no network) ───────────────────────

test("sender: success response delivers ok and posts the normalized receptor", async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(successBody()));
  const sender = createKavenegarSmsSender(
    { KAVENEGAR_API_KEY: TEST_KEY },
    fetchImpl
  );

  const result = await sender.sendOtp("09121234567", CODE); // un-normalized input

  assert.equal(result.ok, true);
  assert.equal(fetchImpl.calls.length, 1);
  const { url, init } = fetchImpl.calls[0];
  assert.equal(url, kavenegarSendUrl(TEST_KEY));
  assert.equal(init.method, "POST");
  assert.equal(init.cache, "no-store");
  const body = JSON.parse(init.body);
  assert.equal(body.receptor, PHONE); // normalized
  assert.equal(body.message, buildOtpMessage(CODE));
  assert.equal(body.sender, undefined); // not provisioned → omitted
});

test("sender: sender line is included when provisioned", async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(successBody()));
  const sender = createKavenegarSmsSender(
    { KAVENEGAR_API_KEY: TEST_KEY, KAVENEGAR_SENDER: "1000555" },
    fetchImpl
  );

  await sender.sendOtp(PHONE, CODE);

  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.equal(body.sender, "1000555");
});

test("sender: provider failure response is a generic failure", async () => {
  const fetchImpl = recordingFetch(() =>
    jsonResponse({ return: { status: 402, message: "Insufficient credit" }, entries: [] })
  );
  const sender = createKavenegarSmsSender({ KAVENEGAR_API_KEY: TEST_KEY }, fetchImpl);

  const result = await sender.sendOtp(PHONE, CODE);

  assert.equal(result.ok, false);
  assert.equal(result, SMS_DELIVERY_FAILED_RESULT);
});

test("sender: HTTP error is a generic failure", async () => {
  const fetchImpl = recordingFetch(() => jsonResponse({}, 500));
  const sender = createKavenegarSmsSender({ KAVENEGAR_API_KEY: TEST_KEY }, fetchImpl);

  const result = await sender.sendOtp(PHONE, CODE);

  assert.equal(result.ok, false);
});

test("sender: transport failure / timeout is a generic failure", async () => {
  // A rejecting fetch models a network error or an aborted (timed-out) request.
  const sender = createKavenegarSmsSender(
    { KAVENEGAR_API_KEY: TEST_KEY },
    async () => {
      throw new Error("network down");
    }
  );

  const result = await sender.sendOtp(PHONE, CODE);

  assert.equal(result.ok, false);
  assert.equal(result, SMS_DELIVERY_FAILED_RESULT);
});

test("sender: malformed JSON body is a generic failure", async () => {
  const fetchImpl = recordingFetch(() => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error("not json");
    },
  }));
  const sender = createKavenegarSmsSender({ KAVENEGAR_API_KEY: TEST_KEY }, fetchImpl);

  const result = await sender.sendOtp(PHONE, CODE);

  assert.equal(result.ok, false);
});

test("sender: missing API key fails closed and never calls the network", async () => {
  let called = false;
  const sender = createKavenegarSmsSender(
    {},
    async () => {
      called = true;
      return jsonResponse(successBody());
    }
  );

  const result = await sender.sendOtp(PHONE, CODE);

  assert.equal(result.ok, false);
  assert.equal(result, SMS_NOT_CONFIGURED_RESULT);
  assert.equal(called, false, "no network call without an API key");
});

test("sender: invalid phone fails closed and never calls the network", async () => {
  let called = false;
  const sender = createKavenegarSmsSender(
    { KAVENEGAR_API_KEY: TEST_KEY },
    async () => {
      called = true;
      return jsonResponse(successBody());
    }
  );

  const result = await sender.sendOtp("02112345678", CODE);

  assert.equal(result.ok, false);
  assert.equal(called, false, "no network call for an invalid receptor");
});

test("sender: abort signal is armed with a timeout before the request", async () => {
  let captured = undefined;
  const fetchImpl = recordingFetch((_url, init) => {
    captured = init.signal;
    return jsonResponse(successBody());
  });
  const sender = createKavenegarSmsSender({ KAVENEGAR_API_KEY: TEST_KEY }, fetchImpl);

  await sender.sendOtp(PHONE, CODE);

  assert.ok(captured, "an abort signal must be forwarded to fetch");
  assert.equal(captured.aborted, false, "signal must not be pre-aborted");
});

// ── No secret leakage ─────────────────────────────────────────────────────

test("secrecy: the API key never appears in any returned error text", async () => {
  const echoBody = {
    // A hostile provider payload that tries to echo the key back to us.
    return: { status: 401, message: `unauthorized for key=${TEST_KEY}` },
    entries: [],
  };
  const senders = [
    createKavenegarSmsSender(
      { KAVENEGAR_API_KEY: TEST_KEY },
      recordingFetch(() => jsonResponse(echoBody))
    ),
    createKavenegarSmsSender(
      { KAVENEGAR_API_KEY: TEST_KEY },
      recordingFetch(() => jsonResponse(echoBody, 401))
    ),
    createKavenegarSmsSender(
      { KAVENEGAR_API_KEY: TEST_KEY },
      recordingFetch(() => {
        throw new Error(`boom for ${TEST_KEY}`);
      })
    ),
    createKavenegarSmsSender({}), // missing key
  ];

  for (const sender of senders) {
    const result = await sender.sendOtp(PHONE, CODE);
    assert.equal(result.ok, false);
    assert.equal(
      typeof result.error === "string" && result.error.includes(TEST_KEY),
      false,
      `error leaked the API key: ${result.error}`
    );
  }
});

test("secrecy: parseKavenegarResult only ever yields the fixed generic failure", () => {
  const leaking = {
    return: { status: 402, message: `credit exhausted; key=${TEST_KEY}` },
    entries: [],
  };
  const result = parseKavenegarResult(leaking);
  assert.equal(result, SMS_DELIVERY_FAILED_RESULT);
  assert.equal(result.error, SMS_DELIVERY_FAILED_RESULT.error);
  assert.equal(result.error.includes(TEST_KEY), false);
});

test("secrecy: the endpoint embeds the key in the path (transport only) and is never surfaced", () => {
  const url = kavenegarSendUrl(TEST_KEY);
  assert.ok(url.startsWith("https://api.kavenegar.com/v1/"));
  assert.ok(url.endsWith("/sms/send.json"));
  assert.ok(url.includes(TEST_KEY)); // path-based auth — expected on the wire
  // But the generic results never carry it:
  assert.equal(SMS_DELIVERY_FAILED_RESULT.error.includes(TEST_KEY), false);
  assert.equal(SMS_NOT_CONFIGURED_RESULT.error.includes(TEST_KEY), false);
});

test("secrecy: sendKavenegarOtp maps every failure to the generic result", async () => {
  const result = await sendKavenegarOtp(
    { apiKey: TEST_KEY, phone: PHONE, message: buildOtpMessage(CODE) },
    recordingFetch(() => jsonResponse({ return: { status: 406 }, entries: [] }))
  );
  assert.equal(result, SMS_DELIVERY_FAILED_RESULT);
  assert.equal(result.error.includes(TEST_KEY), false);
});
