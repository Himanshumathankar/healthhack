export async function teamCall<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/api/v1/teams/${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${window.localStorage.getItem("healthhack.sessionToken") ?? ""}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok)
    throw new Error(data.message ?? "Could not complete team action.");
  return data;
}
