/**
 * Jump links for a long form: a row of chips that scrolls sideways on phones, a list beside the form on computers.
 * (The page keeps it in view: see where it's placed.)
 */
export function SectionNav({ items, label }: { items: { id: string; label: string }[]; label: string }) {
  return (
    <nav aria-label={label}>
      <p className="mb-2 hidden text-[12px] font-semibold text-muted lg:block">{label}</p>
      <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-1 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              className="block rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-ink transition-colors hover:border-primary hover:text-primary lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-3 lg:py-2 lg:hover:bg-surface"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
