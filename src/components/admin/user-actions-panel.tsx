"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  setUserStatusAction,
  setUserRoleAction,
  type UserActionState,
} from "@/app/actions/users";
import { userRoleLabels, userStatusLabels } from "@/lib/admin/labels";
import { AdminFormFeedback, adminSelectClass } from "@/components/admin/admin-form";
import { cn } from "@/lib/utils";
import type { UserRole, UserStatus } from "@prisma/client";

// UserActionsPanel — block/unblock + role management. ADMIN-only (the
// server re-enforces this); self-account mutations are disabled in the UI
// and rejected server-side.

const ROLE_OPTIONS: UserRole[] = ["CUSTOMER", "STAFF", "ADMIN"];

function BlockPanel({
  userId,
  status,
  disabled,
}: {
  userId: string;
  status: UserStatus;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    setUserStatusAction,
    {}
  );
  const [armed, setArmed] = React.useState(false);
  const next = status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
  const isBlock = next === "BLOCKED";

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={next} />
      {disabled ? (
        <p className="text-xs text-muted-foreground">امکان تغییر وضعیت حساب خودتان وجود ندارد.</p>
      ) : armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isBlock ? "مسدودسازی حساب قطعی است؟" : "فعال‌سازی حساب انجام شود؟"}
          </span>
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "inline-flex h-9 items-center rounded-md px-4 text-xs font-semibold text-white transition-colors disabled:opacity-50",
              isBlock ? "bg-destructive hover:bg-red-600" : "bg-[var(--reyhan-green-600)] hover:bg-[var(--reyhan-green-700)]"
            )}
          >
            {pending ? "..." : isBlock ? "تأیید مسدودسازی" : "تأیید فعال‌سازی"}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            انصراف
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className={cn(
            "inline-flex h-9 items-center rounded-md border px-4 text-xs font-medium transition-colors",
            isBlock
              ? "border-destructive/40 text-destructive hover:bg-destructive/10"
              : "border-[var(--reyhan-green-300)] text-[var(--reyhan-green-700)] hover:bg-[var(--reyhan-green-50)]"
          )}
        >
          {isBlock ? "مسدودسازی حساب" : "فعال‌سازی حساب"}
        </button>
      )}
      <AdminFormFeedback message={state.message} error={state.error} />
    </form>
  );
}

function RolePanel({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    setUserRoleAction,
    {}
  );

  if (disabled) {
    return <p className="text-xs text-muted-foreground">امکان تغییر نقش حساب خودتان وجود ندارد.</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="user-role" className="text-xs font-medium text-muted-foreground">
          نقش کاربر
        </label>
        <select
          id="user-role"
          name="role"
          defaultValue={role}
          className={cn(adminSelectClass, "h-9 w-48")}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {userRoleLabels[r]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:opacity-50"
        >
          {pending ? "..." : "ذخیره نقش"}
        </button>
      </div>
      <AdminFormFeedback message={state.message} error={state.error} />
    </form>
  );
}

export function UserActionsPanel({
  userId,
  status,
  role,
  isSelf,
  canManage,
}: {
  userId: string;
  status: UserStatus;
  role: UserRole;
  isSelf: boolean;
  canManage: boolean;
}) {
  if (!canManage) {
    return (
      <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
        مدیریت کاربران (مسدودسازی و تغییر نقش) فقط برای مدیر کل امکان‌پذیر است.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          وضعیت حساب فعلی: {userStatusLabels[status] ?? status}
        </p>
        <BlockPanel userId={userId} status={status} disabled={isSelf} />
      </div>
      <div className="border-t pt-5">
        <RolePanel userId={userId} role={role} disabled={isSelf} />
      </div>
    </div>
  );
}