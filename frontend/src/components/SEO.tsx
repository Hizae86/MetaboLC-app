import { useEffect } from 'react'

interface SEOProps {
  title: string
  description?: string
  image?: string
}

const SITE_NAME = 'MetaboLC'
const DEFAULT_DESCRIPTION = 'The open reference library of clinical LC-MS/MS methods — searchable by analyte, matrix, and instrument.'
const DEFAULT_IMAGE = '/ms-instrument.png'

function setMetaByName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Lightweight, dependency-free per-page SEO tag manager.
 * Sets document.title plus meta description / Open Graph / Twitter Card tags
 * on mount and whenever the props change. Render it once near the top of a
 * page component's JSX (it renders nothing itself).
 *
 * Note: this updates tags client-side, so it helps Google's own indexing
 * (which executes JS), but link-preview bots that don't run JS (LinkedIn,
 * Slack, WhatsApp) will still see the static index.html defaults. Fixing
 * that fully needs server-side rendering / pre-rendering of these pages.
 */
export default function SEO({ title, description, image }: SEOProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — LC-MS/MS Method Reference Library`
    const desc = description || DEFAULT_DESCRIPTION
    const img = image || DEFAULT_IMAGE

    document.title = fullTitle
    setMetaByName('description', desc)
    setMetaByProperty('og:title', fullTitle)
    setMetaByProperty('og:description', desc)
    setMetaByProperty('og:type', 'website')
    setMetaByProperty('og:site_name', SITE_NAME)
    setMetaByProperty('og:image', img)
    setMetaByName('twitter:card', 'summary_large_image')
    setMetaByName('twitter:title', fullTitle)
    setMetaByName('twitter:description', desc)
    setMetaByName('twitter:image', img)
  }, [title, description, image])

  return null
}
