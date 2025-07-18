import { JSX, splitProps } from "solid-js";

export function PrimaryButton(props: JSX.HTMLAttributes<HTMLButtonElement>) {
  const [classProp, otherProps] = splitProps(props, ["class"]);
  return (
    <button
      type="button"
      {...otherProps}
      class={`inline-flex w-fit items-center rounded-md border border-transparent bg-accent-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ultraviolet-600 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 transition-colors duration-200 ${
        classProp.class ?? ""
      }`}
    >
      {props.children}
    </button>
  );
}

export function SecondaryButton(props: JSX.HTMLAttributes<HTMLButtonElement>) {
  const [classProp, otherProps] = splitProps(props, ["class"]);
  return (
    <button
      type="button"
      {...otherProps}
      class={`inline-flex w-fit items-center rounded-md border border-transparent bg-ecto-green-500 px-4 py-2 text-sm font-medium text-void-900 hover:bg-ecto-green-600 focus:outline-none focus:ring-2 focus:ring-ecto-green-500 focus:ring-offset-2 transition-colors duration-200 ${
        classProp.class ?? ""
      }`}
    >
      {props.children}
    </button>
  );
}

export function WhiteButton(props: JSX.HTMLAttributes<HTMLButtonElement>) {
  const [classProp, otherProps] = splitProps(props, ["class"]);
  return (
    <button
      type="button"
      {...otherProps}
      class={`inline-flex w-fit items-center rounded-md border border-theme-primary bg-theme-tertiary px-4 py-2 text-sm font-medium text-theme-primary shadow-sm hover:bg-charred-graphite-400 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 transition-colors duration-200 ${
        classProp.class ?? ""
      }`}
    >
      {props.children}
    </button>
  );
}
