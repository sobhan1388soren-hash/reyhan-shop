"use client";

import * as React from "react";
import { useAuthModal } from "./auth-modal-context";
import { AuthModalLoginForm } from "./auth-modal-login-form";
import { AuthModalRegisterForm } from "./auth-modal-register-form";
import { cn } from "@/lib/utils";

export function AuthModal() {
  const { isOpen, activeTab, closeModal, openModal } = useAuthModal();
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
  }, [isOpen, activeTab]);

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
          "relative w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_25px_60px_rgba(4,46,58,0.3)] backdrop-blur-2xl transition-transform duration-200 sm:p-8",
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

        <div className="relative mb-6 flex rounded-xl bg-muted/60 p-1" role="tablist" aria-label="نوع ورود">
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-l from-[#22d3ee] to-[#00f5a0] opacity-20 transition-transform duration-300 ease-out",
              activeTab === "login" ? "start-1" : "start-[calc(50%+3px)]"
            )}
          />
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "login"}
            onClick={() => openModal("login")}
            className={cn(
              "relative z-10 flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors duration-300",
              activeTab === "login" ? "text-[#042e3a]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            ورود
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "register"}
            onClick={() => openModal("register")}
            className={cn(
              "relative z-10 flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors duration-300",
              activeTab === "register" ? "text-[#042e3a]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            ثبت‌نام
          </button>
        </div>

        <div className={cn("transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")}>
          {activeTab === "login" ? <AuthModalLoginForm /> : <AuthModalRegisterForm />}
        </div>
      </div>
    </div>
  );
}
