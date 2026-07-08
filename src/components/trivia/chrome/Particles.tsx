export function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 34 }, (_, index) => {
        // Every fifth spark leans azure — the design language's second ambient
        // color — so the field reads gold-with-blue depth instead of flat gold.
        const azure = index % 5 === 0;
        return (
          <span
            key={index}
            className="particle"
            style={{
              right: `${(index * 29) % 100}%`,
              animationDelay: `${-(index * 1.7)}s`,
              ['--duration' as string]: `${24 + (index % 8)}s`,
              ['--opacity' as string]: `${0.24 + (index % 6) * 0.08}`,
              ['--x' as string]: `${(index % 2 ? 80 : -70) + index}px`,
              ['--size' as string]: `${2 + (index % 3)}px`,
              ...(azure
                ? {
                    background: 'rgba(105, 205, 255, .72)',
                    boxShadow: '0 0 18px rgba(69, 194, 255, .6), 0 0 38px rgba(69, 194, 255, .18)'
                  }
                : {})
            }}
          />
        );
      })}
    </div>
  );
}
