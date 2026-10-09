export type AdminIdentity = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: string;
  superAdmin: boolean;
  permissions: string[];
};
export async function adminCall<T>(path: string, body?: unknown): Promise<T> {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${api}/api/v1/admin/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${window.localStorage.getItem("healthhack.sessionToken") ?? ""}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok)
    throw new Error(data.message ?? "Could not complete admin action.");
  return data;
}
