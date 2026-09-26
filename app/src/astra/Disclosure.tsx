import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
};

/** Native, keyboard-operable progressive disclosure with the Astra 48px target. */
export function Disclosure({ title, children, defaultOpen = false, id }: Props) {
  return (
    <details className="astra-disclosure" open={defaultOpen} id={id}>
      <summary>{title}</summary>
      <div className="astra-disclosure__content">{children}</div>
    </details>
  );
}
