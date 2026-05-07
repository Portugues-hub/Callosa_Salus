import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("cs_access_token")?.value;
  const isAuthenticated = Boolean(token);

  const isDashboardRoute = req.nextUrl.pathname.startsWith("/dashboard");
  const isLoginRoute = req.nextUrl.pathname.startsWith("/login");

  if (isDashboardRoute && !isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
