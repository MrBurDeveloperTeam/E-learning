import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { courseId, userId } = await req.json();

    if (!courseId || !userId) {
      return new Response(JSON.stringify({ error: "Missing courseId or userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify enrollment completion
    const { data: enrollment, error: enrollError } = await supabase
      .from("enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .single();

    if (enrollError || !enrollment?.completed_at) {
      return new Response(
        JSON.stringify({ error: "Course not completed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get course details for certificate
    const { data: course } = await supabase
      .from("courses")
      .select("title, ce_hours, accreditation_body")
      .eq("id", courseId)
      .single();

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, registration_number")
      .eq("user_id", userId)
      .single();

    // Generate certificate record
    const certNumber = `DL-${Date.now()}-${userId.slice(0, 8)}`;

    const { data: cert, error: certError } = await supabase
      .from("certificates")
      .insert({
        user_id: userId,
        course_id: courseId,
        certificate_number: certNumber,
        ce_hours_awarded: course?.ce_hours ?? 0,
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (certError) throw certError;

    return new Response(
      JSON.stringify({
        certificate: cert,
        recipientName: profile?.full_name,
        courseName: course?.title,
        ceHours: course?.ce_hours,
        accreditationBody: course?.accreditation_body,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Connection: "keep-alive",
        },
      }
    );
  } catch (err) {
    console.error("Certificate generation error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
