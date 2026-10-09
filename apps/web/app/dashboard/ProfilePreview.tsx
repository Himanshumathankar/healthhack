"use client";

import { Eye, Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { teamCall } from "./team-api";

type Profile = {
  fullName: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  college: string | null;
  degree: string | null;
  branch: string | null;
  discipline: string | null;
  studyYear: number | null;
  passoutDate: string | null;
  graduationYear: number | null;
  city?: string | null;
  state?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  bio?: string | null;
  skillExpertise: Array<{ name: string; expertise: string }>;
};
type Participant = {
  participantId: string;
  username: string | null;
  profile: Profile | null;
};
type Team = { name: string; leader: Profile | null; members: string[] };

function Details({ profile, full }: { profile: Profile; full: boolean }) {
  const fields: Array<[string, string | number | null | undefined]> = [
    ["College", profile.college],
    ["Degree", profile.degree],
    ["Branch", profile.branch],
    ["Discipline", profile.discipline],
    ["Year of study", profile.studyYear],
    ["Pass-out date", profile.passoutDate?.slice(0, 10)],
    ["Graduation year", profile.graduationYear],
    ...(full
      ? ([
          ["First name", profile.firstName],
          ["Middle name", profile.middleName],
          ["Last name", profile.lastName],
          ["City", profile.city],
          ["State", profile.state],
          ["LinkedIn", profile.linkedinUrl],
          ["GitHub", profile.githubUrl],
          ["Portfolio", profile.portfolioUrl],
        ] as Array<[string, string | null | undefined]>)
      : []),
  ];
  return (
    <div className="grid gap-6">
      <dl className="grid gap-5 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-1 break-words text-sm">
              {value || "Not provided"}
            </dd>
          </div>
        ))}
      </dl>
      <section className="grid gap-3 border-t border-gray-200 pt-5">
        <h4 className="font-semibold">Skills and expertise</h4>
        {profile.skillExpertise.length ? (
          <ul className="divide-y divide-gray-200">
            {profile.skillExpertise.map((skill) => (
              <li
                className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                key={skill.name}
              >
                <strong className="break-words">{skill.name}</strong>
                <span className="capitalize text-gray-500">
                  {skill.expertise.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No skills added.</p>
        )}
      </section>
      {full && profile.bio && (
        <section className="grid gap-3">
          <h4 className="font-semibold">About</h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">
            {profile.bio}
          </p>
        </section>
      )}
    </div>
  );
}

export function ProfilePreview({
  kind,
  id,
  name,
  onInvite,
  invited = false,
}: {
  kind: "participant" | "team";
  id: string;
  name: string;
  onInvite?: () => Promise<void>;
  invited?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Participant | Team | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) {
      dialog.current?.close();
      return;
    }
    dialog.current?.showModal();
    setData(null);
    setError("");
    let active = true;
    void teamCall<Participant | Team>(
      kind === "participant" ? `teammates/${id}/profile` : `${id}/preview`,
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load details.",
          );
      });
    return () => {
      active = false;
    };
  }, [open, kind, id]);
  return (
    <>
      <button
        className="grid h-10 w-10 shrink-0 place-items-center rounded border border-gray-200 hover:bg-gray-50"
        type="button"
        title={
          kind === "participant"
            ? "View participant details"
            : "View team leader and members"
        }
        aria-label={`View ${name} details`}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Eye size={18} />
      </button>
      <dialog
        ref={dialog}
        onCancel={() => {
          setOpen(false);
        }}
        className="max-h-[85dvh] w-[calc(100%_-_32px)] max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-white p-0 text-[#242a30] backdrop:bg-black/40"
        aria-label={`${name} details`}
      >
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5">
            <h3 className="min-w-0 break-words text-xl font-semibold">
              {name}
            </h3>
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded hover:bg-gray-100"
              aria-label="Close details"
              title="Close details"
              type="button"
              onClick={() => {
                setOpen(false);
              }}
            >
              <X size={18} />
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto p-6 [scrollbar-gutter:stable]">
            {error ? (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            ) : !data ? (
              <Loader2
                className="animate-spin"
                size={24}
                aria-label="Loading details"
              />
            ) : "profile" in data ? (
              <>
                {data.profile && (
                  <>
                    <p className="mb-5 break-words text-sm text-gray-500">
                      {data.participantId}
                      {data.username ? ` / @${data.username}` : ""}
                    </p>
                    <Details profile={data.profile} full />
                  </>
                )}
                {onInvite && (
                  <button
                    className="mt-6 inline-flex min-h-10 items-center gap-2 rounded bg-[#106b5f] px-4 text-sm text-white disabled:opacity-50"
                    type="button"
                    disabled={invited || busy}
                    onClick={() => {
                      setBusy(true);
                      void onInvite()
                        .then(() => {
                          setOpen(false);
                        })
                        .catch((caught: unknown) => {
                          setError(
                            caught instanceof Error
                              ? caught.message
                              : "Could not send invitation.",
                          );
                        })
                        .finally(() => {
                          setBusy(false);
                        });
                    }}
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Send size={16} />
                    )}
                    {invited ? "Invitation sent" : "Send invitation"}
                  </button>
                )}
              </>
            ) : (
              <>
                {data.leader ? (
                  <section className="grid gap-5">
                    <h4 className="font-semibold">
                      Team leader: {data.leader.fullName}
                    </h4>
                    <Details profile={data.leader} full={false} />
                  </section>
                ) : (
                  <p className="text-sm text-gray-500">
                    No team leader details available.
                  </p>
                )}
                <section className="mt-6 grid gap-3 border-t border-gray-200 pt-5">
                  <h4 className="font-semibold">Other members</h4>
                  {data.members.length ? (
                    <ul className="grid gap-3 text-sm">
                      {data.members.map((member, index) => (
                        <li className="break-words" key={index}>
                          {member}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No other members yet.
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
