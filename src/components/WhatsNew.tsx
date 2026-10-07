import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useT } from '../i18n/useLang'
import { RELEASES, WHATS_NEW_TIP } from '../lib/changelog'
import { claimFirstUse, hasSeen, markSeen } from '../lib/firstUse'
import { ActionSheet } from './ActionSheet'
import { PrimaryButton } from './ui'

/** True once per release, for people who used the app before it. */
export function claimWhatsNew(): boolean {
  // A first visit has nothing to compare against; the welcome carousel covers it.
  if (!hasSeen('welcome')) {
    markSeen(WHATS_NEW_TIP)
    return false
  }
  return claimFirstUse(WHATS_NEW_TIP)
}

export function WhatsNew() {
  const t = useT()
  const [open, setOpen] = useState(claimWhatsNew)
  const close = () => setOpen(false)

  return (
    <ActionSheet open={open} onClose={close} title={t('whatsNew.title')}>
      <ul className="flex flex-col gap-3 px-1 pb-4">
        {RELEASES[0].items.map((key) => (
          <li key={key} className="flex items-start gap-3 text-sm text-text">
            <Sparkles size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end pb-2">
        <PrimaryButton onClick={close}>{t('whatsNew.done')}</PrimaryButton>
      </div>
    </ActionSheet>
  )
}
