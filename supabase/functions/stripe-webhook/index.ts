import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { type, data } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (type === "checkout.session.completed") {
      const { client_reference_id, metadata } = data.object;
      const userId = client_reference_id;
      const courseId = metadata?.course_id;

      if (userId && courseId) {
        // Create enrollment after successful payment
        const { error } = await supabase.from("enrollments").upsert(
          {
            user_id: userId,
            course_id: courseId,
            enrolled_at: new Date().toISOString(),
          },
          { onConflict: "user_id,course_id" }
        );

        if (error) console.error("Enrollment error:", error);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
