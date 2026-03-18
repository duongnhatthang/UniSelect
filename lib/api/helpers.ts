export function errorResponse(
  code: string,
  message: string,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: extraHeaders }
  );
}
