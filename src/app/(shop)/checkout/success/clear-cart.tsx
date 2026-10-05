"use client";

import * as React from "react";
import { useCart } from "@/hooks/use-cart";

export function ClearCartOnMount() {
  const { clearCart } = useCart();
  const cleared = React.useRef(false);

  React.useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    clearCart();
  }, [clearCart]);

  return null;
}
