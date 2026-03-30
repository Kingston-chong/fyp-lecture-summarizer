"use client";

import styles from "./Button.module.css";

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

export default function Button({
  variant = "default",
  className = "",
  type = "button",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(styles.btn, styles[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
