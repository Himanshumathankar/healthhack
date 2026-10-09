"use client";
import { useEffect, useState } from "react";
type Announcement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
};
export function PublishedAnnouncements({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
    void fetch(`${api}/api/v1/announcements`, {
      headers: {
        Authorization: `Bearer ${window.localStorage.getItem("healthhack.sessionToken") ?? ""}`,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load announcements.");
        setItems((await response.json()) as Announcement[]);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load announcements.",
          );
      });
    return () => {
      controller.abort();
    };
  }, []);
  if (error) return <p className="mt-5 text-sm text-red-700">{error}</p>;
  if (!items)
    return (
      <p className="mt-5 text-sm text-gray-500">Loading announcements...</p>
    );
  if (!items.length)
    return (
      <p className="mt-6 text-sm text-gray-400">
        No hackathon announcements yet.
      </p>
    );
  return (
    <div className="mt-5 divide-y divide-gray-200">
      {(compact ? items.slice(0, 3) : items).map((item) => (
        <article className="grid gap-2 py-4" key={item.id}>
          <h3 className="font-semibold">{item.title}</h3>
          <p
            className={
              compact
                ? "line-clamp-2 whitespace-pre-wrap break-words text-sm text-gray-600"
                : "whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600"
            }
          >
            {item.body}
          </p>
          {item.publishedAt && (
            <time className="text-xs text-gray-400" dateTime={item.publishedAt}>
              {new Date(item.publishedAt).toLocaleString()}
            </time>
          )}
        </article>
      ))}
    </div>
  );
}
