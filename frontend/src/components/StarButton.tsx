import { useState, useEffect } from 'react'

export default function StarButton({ methodId, size = 'md' }: { methodId: number, size?: 'sm' | 'md' }) {
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    const stars = JSON.parse(localStorage.getItem('metabolc_stars') || '[]')
    setStarred(stars.includes(methodId))
  }, [methodId])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const stars: number[] = JSON.parse(localStorage.getItem('metabolc_stars') || '[]')
    const newStars = starred
      ? stars.filter(id => id !== methodId)
      : [...stars, methodId]
    localStorage.setItem('metabolc_stars', JSON.stringify(newStars))
    setStarred(!starred)
  }

  const s = size === 'sm' ? 14 : 18

  return (
    <button onClick={toggle} title={starred ? 'Remove from saved' : 'Save method'}
      style={{background:'none',border:'none',cursor:'pointer',padding:'2px',
        display:'flex',alignItems:'center',gap:'3px',
        color: starred ? '#EF9F27' : '#9ca3af',transition:'color 0.15s'}}>
      <svg width={s} height={s} viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      {size === 'md' && <span style={{fontSize:'11px',fontWeight:'500'}}>
        {starred ? 'Saved' : 'Save'}
      </span>}
    </button>
  )
}
