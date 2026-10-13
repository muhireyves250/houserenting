export function AuthHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2 text-center md:text-left">
      <h1 className="text-3xl font-bold tracking-[-0.02em] text-primary">{title}</h1>
      {body && <p className="text-sm text-muted">{body}</p>}
    </div>
  );
}
