import { NextResponse, type NextRequest } from "next/server";
import { shareExists } from "@/lib/db";

// With Cache Components the page shell streams with a 200 before notFound() can run,
// so missing or expired share cards are checked here to return a real 404.
export const config = { matcher: "/r/:id" };

export async function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.split("/")[2] ?? "";
  const exists = process.env.DATABASE_URL ? await shareExists(id).catch(() => true) : false;
  if (exists) return NextResponse.next();
  return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
}
