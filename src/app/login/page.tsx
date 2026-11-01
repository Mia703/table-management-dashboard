"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";

function LoginInner() {
  const router = useRouter(),
    params = useSearchParams();
  const resetToken = params.get("token");
  const [mode, setMode] = useState<"signIn" | "signUp" | "newPassword">(
    resetToken ? "newPassword" : params.get("invite") ? "signUp" : "signIn",
  );
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "newPassword") {
        const r = await authClient.resetPassword({
          newPassword: password, // ggignore: form input, not a hard-coded secret
          token: resetToken ?? "", // ggignore
        });
        if (r.error)
          throw new Error(
            "This reset link is invalid, expired or already used. Ask your organization owner or a manager for a new one.",
          );
        setPassword("");
        setMode("signIn");
        setMessage("Password updated. Sign in with your new password.");
        router.replace("/login");
        return;
      }
      if (mode === "signUp") {
        const r = await authClient.signUp.email({ name, email, password });
        if (r.error) throw new Error(r.error.message);
      } else {
        const r = await authClient.signIn.email({ email, password });
        if (r.error) throw new Error(r.error.message);
      }
      const invite = params.get("invite");
      if (invite) await api("acceptInvite", { token: invite });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    }
  }
  return (
    <main id="main" className="auth">
      <div className="brand" style={{ color: "#123423" }}>
        GatherWell<small>Social Event Guest & Registration Management</small>
      </div>
      <div className="panel">
        <h1>
          {mode === "signIn"
            ? "Sign In"
            : mode === "signUp"
              ? "Create Account"
              : "Choose a New Password"}
        </h1>
        <p className="muted">
          {mode === "signUp"
            ? "Use the same email address your invitation was sent to."
            : "For organizers, event staff and invited guests."}
        </p>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        {message && <div className="notice">{message}</div>}
        <form onSubmit={submit}>
          {mode === "signUp" && (
            <div className="field">
              <label>
                Full name
                <input
                  required
                  autoComplete="name"
                  placeholder="e.g. Jordan Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            </div>
          )}
          {mode !== "newPassword" && (
            <div className="field">
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>
          )}
          {
            <div className="field">
              <label>
                {mode === "signIn" ? "Password" : "New password"}
                {mode !== "signIn" && (
                  <span className="hint">At least 12 characters.</span>
                )}
                <input
                  type="password"
                  required
                  minLength={mode === "signIn" ? 1 : 12}
                  autoComplete={
                    mode === "signIn" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>
          }
          <button type="submit">
            {mode === "signIn"
              ? "Sign In"
              : mode === "signUp"
                ? "Create Account"
                : "Save New Password"}
          </button>
        </form>
        <div className="actions">
          <button
            className="secondary"
            onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
          >
            {mode === "signIn"
              ? "Accept Invitation / Create Account"
              : "Back to Sign In"}
          </button>
        </div>
        <p className="muted">
          Forgot your password? Ask your organization owner or a manager for a
          one-time reset link.
        </p>
        <p className="muted">
          New accounts have no access until authorized or added using a valid
          invitation.
        </p>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
