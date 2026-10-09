"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type SyntheticEvent } from "react";

type Skill = { name: string; expertise: string };
export type RegistrationProfile = {
  fullName: string;
  college: string | null;
  passoutDate: string | null;
  studyYear: number | null;
  branch: string | null;
  discipline: string | null;
  registrationCompletedAt: string | null;
  skillExpertise: Skill[];
};
const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const field = "min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#106b5f] px-4 text-white disabled:opacity-60";

export function RegistrationSteps({
  profile,
  onComplete,
}: {
  profile: RegistrationProfile | null;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(
    profile?.college &&
      profile.passoutDate &&
      profile.studyYear &&
      profile.branch &&
      profile.discipline
      ? 2
      : 1,
  );
  const [skills, setSkills] = useState<Skill[]>(
    profile?.skillExpertise.length
      ? profile.skillExpertise
      : [{ name: "", expertise: "BEGINNER" }],
  );
  const [busy, setBusy] = useState(false);
  const [savedProfile, setSavedProfile] = useState(profile);
  const [error, setError] = useState("");
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const education = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(
        `${api}/api/v1/identity/${step === 1 ? "education" : "skills"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.localStorage.getItem("healthhack.sessionToken") ?? ""}`,
          },
          body: JSON.stringify(
            step === 1
              ? { ...education, studyYear: Number(education.studyYear) }
              : { skills },
          ),
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "Could not save registration.");
      }
      if (step === 1) setSavedProfile(await response.json() as RegistrationProfile);
      setStep(step + 1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save registration.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (step === 3)
    return (
      <section className="grid max-w-xl gap-4 py-8" role="status">
        <CheckCircle2 size={40} className="text-[#106b5f]" />
        <h2 className="text-3xl font-semibold">Well done!</h2>
        <p>Your registration is complete.</p>
        <button
          className={`${button} w-fit`}
          type="button"
          onClick={onComplete}
        >
          Go to dashboard
          <ArrowRight size={18} />
        </button>
      </section>
    );
  return (
    <section className="grid max-w-2xl gap-5">
      <ol className="flex gap-6 border-b border-slate-200 pb-4 text-sm">
        <li
          className={
            step === 1 ? "font-semibold text-[#106b5f]" : "text-slate-500"
          }
        >
          1. Education
        </li>
        <li
          className={
            step === 2 ? "font-semibold text-[#106b5f]" : "text-slate-500"
          }
        >
          2. Skills
        </li>
      </ol>
      <h2 className="text-2xl font-semibold">
        {step === 1 ? "Education details" : "Skills and expertise"}
      </h2>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          void save(event);
        }}
      >
        {step === 1 ? (
          <>
            <label className="grid gap-2">
              <span>College name</span>
              <input
                className={field}
                name="college"
                defaultValue={savedProfile?.college ?? ""}
                minLength={2}
                maxLength={200}
                required
              />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span>Pass-out date (actual or expected)</span>
                <input
                  className={field}
                  name="passoutDate"
                  type="date"
                  defaultValue={savedProfile?.passoutDate?.slice(0, 10) ?? ""}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span>Year of study</span>
                <select
                  className={field}
                  name="studyYear"
                  defaultValue={savedProfile?.studyYear ?? ""}
                  required
                >
                  <option value="" disabled>
                    Select year
                  </option>
                  {Array.from({ length: 8 }, (_, index) => (
                    <option key={index} value={index + 1}>
                      Year {index + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-2">
              <span>Branch</span>
              <input
                className={field}
                name="branch"
                defaultValue={savedProfile?.branch ?? ""}
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label className="grid gap-2">
              <span>Discipline</span>
              <input
                className={field}
                name="discipline"
                defaultValue={savedProfile?.discipline ?? ""}
                minLength={2}
                maxLength={120}
                required
              />
            </label>
          </>
        ) : (
          <>
            {skills.map((skill, index) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_40px] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px]"
                key={index}
              >
                <label className="col-span-2 grid min-w-0 gap-2 sm:col-span-1">
                  <span className="text-sm">Skill</span>
                  <input
                    className={field}
                    value={skill.name}
                    maxLength={80}
                    required
                    onChange={(event) => {
                      setSkills(
                        skills.map((item, i) =>
                          i === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      );
                    }}
                  />
                </label>
                <label className="grid min-w-0 gap-2">
                  <span className="text-sm">Expertise</span>
                  <select
                    className={field}
                    value={skill.expertise}
                    onChange={(event) => {
                      setSkills(
                        skills.map((item, i) =>
                          i === index
                            ? { ...item, expertise: event.target.value }
                            : item,
                        ),
                      );
                    }}
                  >
                    {["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"].map(
                      (level) => (
                        <option value={level} key={level}>
                          {level[0]}
                          {level.slice(1).toLowerCase()}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button
                  className="grid h-10 w-10 place-items-center text-red-700 disabled:opacity-30"
                  title="Remove skill"
                  aria-label={`Remove skill ${String(index + 1)}`}
                  disabled={skills.length === 1 || busy}
                  type="button"
                  onClick={() => {
                    setSkills(skills.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              className="inline-flex w-fit items-center gap-2 text-[#106b5f]"
              type="button"
              disabled={skills.length >= 30 || busy}
              onClick={() => {
                setSkills([...skills, { name: "", expertise: "BEGINNER" }]);
              }}
            >
              <Plus size={18} />
              Add skill
            </button>
          </>
        )}
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          {step === 2 && (
            <button
              className="inline-flex items-center gap-2"
              type="button"
              disabled={busy}
              onClick={() => {
                setStep(1);
              }}
            >
              <ArrowLeft size={18} />
              Back
            </button>
          )}
          <button className={button} type="submit" disabled={busy}>
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            {step === 1 ? "Save and continue" : "Complete registration"}
          </button>
        </div>
      </form>
    </section>
  );
}
