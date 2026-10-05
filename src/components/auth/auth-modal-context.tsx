"use client";

import * as React from "react";

type AuthModalContextValue = {
  isOpen: boolean;
  authType: "phone" | "email";
  activeTab: "login" | "register";
  openModal: (tab?: "login" | "register", authType?: "phone" | "email") => void;
  closeModal: () => void;
};

const AuthModalContext = React.createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [authType, setAuthType] = React.useState<"phone" | "email">("phone");
  const [activeTab, setActiveTab] = React.useState<"login" | "register">("login");

  const openModal = React.useCallback((tab: "login" | "register" = "login", authType: "phone" | "email" = "phone") => {
    setActiveTab(tab);
    setAuthType(authType);
    setIsOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = React.useMemo(
    () => ({ isOpen, authType, activeTab, openModal, closeModal }),
    [isOpen, authType, activeTab, openModal, closeModal]
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = React.useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
