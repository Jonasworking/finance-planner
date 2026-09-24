import { AnimatePresence, m } from 'motion/react'
import { toast } from 'sonner'
import type { Insight } from '@/lib/insights'
import { spring } from '@/shared/motion'
import { dismissInsight, restoreInsight } from '../dismissedInsights'
import { describeInsight, type InsightRefs } from '../insightCopy'
import { InsightCard } from './InsightCard'

export interface InsightCardsProps {
  /** Already filtered by `runInsights` (dismissed ones removed, at most three). */
  insights: readonly Insight[]
  refs: InsightRefs
}

/** The home screen's insight cards. Rendered only with content – an empty section says nothing. */
export function InsightCards({ insights, refs }: InsightCardsProps) {
  const dismiss = (insight: Insight) => {
    dismissInsight(insight.id)
    toast('Hinweis ausgeblendet', {
      action: { label: 'Rückgängig', onClick: () => restoreInsight(insight.id) },
    })
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Insights">
      <h2 className="px-1 text-caption text-fg-subtle uppercase">Insights</h2>
      {/* overflow-x-clip: a card mid-swipe must not widen the page; the height still animates. */}
      <div className="flex flex-col gap-3 overflow-x-clip">
        <AnimatePresence initial={false}>
          {insights.map((insight) => (
            /*
             * Height and opacity are staggered: the wrapper cannot clip (the card's shadow and
             * the swipe need room), so the content fades in only once the height has mostly
             * settled and fades out first – otherwise it overlaps the neighbouring card mid-way.
             */
            <m.div
              key={insight.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{
                opacity: 0,
                height: 0,
                transition: { height: spring.soft, opacity: { duration: 0.1 } },
              }}
              transition={{ height: spring.soft, opacity: { duration: 0.15, delay: 0.15 } }}
            >
              <InsightCard
                insight={insight}
                copy={describeInsight(insight, refs)}
                onDismiss={dismiss}
              />
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}
