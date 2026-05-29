import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const jsonHeaders = {
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");

    if (!verifyToken) {
      return new Response("Missing META_WEBHOOK_VERIFY_TOKEN", { status: 500 });
    }

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    const payload = await req.json().catch(() => null);
    console.log("Instagram webhook payload", JSON.stringify(payload));

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
