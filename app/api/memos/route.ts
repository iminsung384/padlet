import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseServerAnon } from "@/lib/supabaseAdmin";
import { hashPassword, isFourDigitPassword } from "@/lib/password";

export const runtime = "nodejs";

const PASTEL_COLORS = [
  "#fef3c7",
  "#dbeafe",
  "#dcfce7",
  "#fce7f3",
  "#f3e8ff",
  "#fed7aa",
  "#e0f2fe",
  "#fae8ff",
];

function pickMemoColor(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  const index = Math.abs(Math.floor(Math.random() * PASTEL_COLORS.length));
  return PASTEL_COLORS[index] ?? PASTEL_COLORS[0];
}

export async function GET() {
  try {
    const supabase = getSupabaseServerAnon();
    const { data, error } = await supabase
      .from("memos")
      .select("id,title,content,color,position,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ memos: data ?? [] });
  } catch (error) {
    console.error("GET /api/memos", error);
    return NextResponse.json(
      { error: "메모 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const color = pickMemoColor(body.color);

    if (!title || !content) {
      return NextResponse.json(
        { error: "제목과 내용을 모두 입력해 주세요." },
        { status: 400 },
      );
    }

    if (title.length > 80 || content.length > 2000) {
      return NextResponse.json(
        { error: "메모가 허용된 길이를 초과했습니다." },
        { status: 400 },
      );
    }

    if (!isFourDigitPassword(body.password)) {
      return NextResponse.json(
        { error: "삭제 비밀번호는 숫자 4자리여야 합니다." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(body.password);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("create_memo_with_credentials", {
      p_title: title,
      p_content: content,
      p_color: color,
      p_password_hash: passwordHash,
    });

    if (error) throw error;

    return NextResponse.json({ memo: data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/memos", error);
    return NextResponse.json(
      { error: "메모를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
