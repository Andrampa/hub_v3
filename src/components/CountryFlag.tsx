interface CountryFlagProps {
  iso2?: string
  name: string
  decorative?: boolean
  className?: string
}

export function CountryFlag({ iso2, name, decorative = false, className }: CountryFlagProps) {
  if (!iso2) return null

  return (
    <img
      className={className}
      src={`https://flagcdn.com/w40/${iso2}.png`}
      srcSet={`https://flagcdn.com/w80/${iso2}.png 2x`}
      width="20"
      height="15"
      alt={decorative ? '' : `Flag of ${name}`}
      loading="lazy"
      onError={(event) => { event.currentTarget.style.display = 'none' }}
    />
  )
}
