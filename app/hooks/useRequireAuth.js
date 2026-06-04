"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Gate actions that require a signed-in account (guest try mode).
 * @returns {{
 *   isGuest: boolean;
 *   authModalOpen: boolean;
 *   authModalFeature: string;
 *   closeAuthModal: () => void;
 *   requireAuth: (feature: string, onAllowed?: () => void) => boolean;
 * }}
 */
export function useRequireAuth() {
  const { status } = useSession();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalFeature, setAuthModalFeature] = useState("default");

  const isGuest = status === "unauthenticated";

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const requireAuth = useCallback(
    (feature, onAllowed) => {
      if (status === "authenticated") {
        onAllowed?.();
        return true;
      }
      if (status === "loading") return false;
      setAuthModalFeature(feature);
      setAuthModalOpen(true);
      return false;
    },
    [status],
  );

  return {
    isGuest,
    authModalOpen,
    authModalFeature,
    closeAuthModal,
    requireAuth,
  };
}
