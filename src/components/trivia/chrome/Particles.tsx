export function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 34 }, (_, index) => (
        <span
          key={index}
          className="particle"
          style={{
            right: `${(index * 29) % 100}%`,
            animationDelay: `${-(index * 1.7)}s`,
            ['--duration' as string]: `${24 + (index % 8)}s`,
            ['--opacity' as string]: `${0.24 + (index % 6) * 0.08}`,
            ['--x' as string]: `${(index % 2 ? 80 : -70) + index}px`
          }}
        />
      ))}
    </div>
  );
}
