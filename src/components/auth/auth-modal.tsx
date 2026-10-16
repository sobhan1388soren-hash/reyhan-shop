"use client";

import * as React from "react";
import { useAuthModal } from "./auth-modal-context";
import { AuthModalLoginForm } from "./auth-modal-login-form";
import { AuthModalRegisterForm } from "./auth-modal-register-form";
import { AuthModalEmailLoginForm } from "./auth-modal-email-login-form";
import { AuthModalEmailRegisterForm } from "./auth-modal-email-register-form";
import { cn } from "@/lib/utils";

export function AuthModal() {
  const { isOpen, activeTab, authType, closeModal, openModal, setAuthType } = useAuthModal();
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const raf = requestAnimationFrame(() => {
        setMounted(true);
        requestAnimationFrame(() => setVisible(true));
      });
      document.body.style.overflow = "hidden";
      return () => cancelAnimationFrame(raf);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      document.body.style.overflow = "";
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  React.useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstInput = panelRef.current.querySelector<HTMLElement>("input");
      firstInput?.focus();
    }
  }, [isOpen, activeTab, authType]);

  React.useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="absolute inset-0 bg-[#042e3a]/40 backdrop-blur-sm"
        onClick={closeModal}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={cn(
          "relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_25px_60px_rgba(4,46,58,0.3)] backdrop-blur-2xl transition-transform duration-200 sm:p-8",
          visible ? "scale-100" : "scale-95"
        )}
      >
        <button
          type="button"
          onClick={closeModal}
          aria-label="بستن"
          className="absolute end-4 top-4 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <div className="mb-6 text-center">
          <h2 id="auth-modal-title" className="text-xl font-bold text-foreground">
            به ریحان خوش آمدید
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            برای ادامه، وارد حساب خود شوید یا ثبت‌نام کنید.
          </p>
        </div>

        <div className="relative mb-3 flex rounded-xl bg-muted/60 p-1" role="tablist" aria-label="روش ورود">
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-l from-[#22d3ee] to-[#00f5a0] opacity-20 transition-transform duration-300 ease-out",
              authType === "phone" ? "start-1" : "start-[calc(50%+3px)]"
            )}
          />
          <button
            type="button"
            role="tab"
            id="auth-tab-phone"
            aria-selected={authType === "phone"}
            aria-controls="auth-panel"
            onClick={() => setAuthType("phone")}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors duration-300",
              authType === "phone" ? "text-[#042e3a]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path
                d="M3 2.5h3l1.5 3.5-2 1.5a10 10 0 0 0 4 4l1.5-2 3.5 1.5v3a1.5 1.5 0 0 1-1.7 1.5C7.4 15.5.5 8.6.5 3.2A1.5 1.5 0 0 1 2 2.5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            شماره موبایل
          </button>
          <button
            type="button"
            role="tab"
            id="auth-tab-email"
            aria-selected={authType === "email"}
            aria-controls="auth-panel"
            onClick={() => setAuthType("email")}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors duration-300",
              authType === "email" ? "text-[#042e3a]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="m2 4.5 6 4 6-4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            ایمیل
          </button>
        </div>

        <div className="mb-6 flex rounded-lg bg-muted/40 p-0.5" role="group" aria-label="نوع حساب">
          <button
            type="button"
            aria-pressed={activeTab === "login"}
            onClick={() => openModal("login", authType)}
            className={cn(
              "flex-1 rounded-md py-1.5 text-xs font-semibold transition-all duration-300",
              activeTab === "login"
                ? "bg-white/80 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ورود
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "register"}
            onClick={() => openModal("register", authType)}
            className={cn(
              "flex-1 rounded-md py-1.5 text-xs font-semibold transition-all duration-300",
              activeTab === "register"
                ? "bg-white/80 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ثبت‌نام
          </button>
        </div>

        <div
          id="auth-panel"
          role="tabpanel"
          aria-labelledby={authType === "phone" ? "auth-tab-phone" : "auth-tab-email"}
          className={cn("transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")}
        >
          {authType === "phone" ? (
            activeTab === "login" ? (
              <AuthModalLoginForm />
            ) : (
              <AuthModalRegisterForm />
            )
          ) : activeTab === "login" ? (
            <AuthModalEmailLoginForm />
          ) : (
            <AuthModalEmailRegisterForm />
          )}
        </div>
      </div>
    </div>
  );
}
