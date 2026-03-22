export async function GET() {
  return Response.json({
    ok: true,
    route: "ihale",
    message: "ihale route läuft"
  });
}