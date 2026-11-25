import { NextResponse } from "next/server";
import { isAdminRequest, isSameSiteOrigin } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }

  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { error } = await getSupabaseAdmin()
      .from("memos")
      .delete()
      .not("id", "is", null);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/delete-all", error);
    return NextResponse.json(
      { error: "전체 메모를 삭제하지 못했습니다." },
      { status: 500 },
    );
  }
}
