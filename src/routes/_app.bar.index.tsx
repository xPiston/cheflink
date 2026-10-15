import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Minus, Plus, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CategoryBadge } from '#/components/category-color'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { useAppEvents } from '#/hooks/use-app-events'
import { m } from '#/paraglide/messages'
import { createOrder } from '#/server/functions/orders'
import { listDishes, type Dish } from '#/server/functions/dishes'

export const Route = createFileRoute('/_app/bar/')({
  component: TakeOrderPage,
})

type Draft = Record<string, number>

function TakeOrderPage() {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState<Draft>({})
  /**
   * The number of the last order sent from this station, or none yet.
   *
   * The toast says it too, but a toast is gone in four seconds and this is
   * the number somebody has to call out, write on a ticket, or repeat to a
   * customer who asks. So it stays on the screen until the next one replaces
   * it.
   */
  const [lastNumber, setLastNumber] = useState<number | null>(null)

  const dishes = useQuery({ queryKey: ['dishes'], queryFn: () => listDishes() })

  // The menu can change mid-service: if someone pulls a dish from /plats, the
  // bar sees it disappear without reloading the page.
  useAppEvents({
    onEvent: (event) => {
      if (event.type === 'dishes.changed') {
        void queryClient.invalidateQueries({ queryKey: ['dishes'] })
      }
    },
    onConnect: () => void queryClient.invalidateQueries({ queryKey: ['dishes'] }),
  })

  const available = useMemo(
    () => (dishes.data ?? []).filter((dish) => dish.available),
    [dishes.data]
  )

  /**
   * The menu, in sections.
   *
   * Grouped on the category's id rather than its name: two categories can be
   * renamed into each other for a second while somebody is typing on the
   * dishes page, and the id is what says they are not the same section. The
   * server already sorts by category then by dish, so the order the groups
   * come out in is the order they go in.
   */
  const byCategory = useMemo(() => {
    const groups = new Map<string, { category: Dish['category']; dishes: Dish[] }>()
    for (const dish of available) {
      const group = groups.get(dish.category.id) ?? { category: dish.category, dishes: [] }
      group.dishes.push(dish)
      groups.set(dish.category.id, group)
    }

    return [...groups.values()]
  }, [available])

  const lines = useMemo(
    () =>
      Object.entries(draft)
        .filter(([, quantity]) => quantity > 0)
        .map(([dishId, quantity]) => ({
          dish: available.find((item) => item.id === dishId),
          quantity,
        }))
        .filter((line): line is { dish: Dish; quantity: number } => Boolean(line.dish)),
    [draft, available]
  )

  const totalDishes = lines.reduce((total, line) => total + line.quantity, 0)

  const send = useMutation({
    mutationFn: () =>
      createOrder({
        data: {
          note: note.trim(),
          lines: lines.map((line) => ({ dishId: line.dish.id, quantity: line.quantity })),
        },
      }),
    onSuccess: (order) => {
      toast.success(m.order_sent({ number: order.number }))
      setLastNumber(order.number)
      setDraft({})
      setNote('')
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: () => toast.error(m.order_send_failed()),
  })

  const add = (dishId: string, delta: number) =>
    setDraft((current) => {
      const next = Math.min(99, Math.max(0, (current[dishId] ?? 0) + delta))
      const copy = { ...current }

      if (next === 0) {
        delete copy[dishId]
      } else {
        copy[dishId] = next
      }

      return copy
    })

  const canSend = lines.length > 0 && !send.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">{m.nav_take_order()}</h1>

        {dishes.isLoading ? (
          <p className="text-sm text-muted-foreground">{m.order_menu_loading()}</p>
        ) : null}

        {dishes.isSuccess && available.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.order_no_dish_available()}</p>
        ) : null}

        {byCategory.map(({ category, dishes: items }) => (
          <div key={category.id} className="space-y-3">
            <h2>
              <CategoryBadge name={category.name} color={category.color} className="text-sm" />
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((dish) => (
                <Card key={dish.id} className="gap-3 py-4">
                  <CardContent className="flex items-start gap-3 px-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{dish.name}</p>
                      {dish.description ? (
                        <p className="text-sm text-muted-foreground">{dish.description}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={m.order_remove_one({ dish: dish.name })}
                        disabled={!draft[dish.id]}
                        onClick={() => add(dish.id, -1)}
                      >
                        <Minus className="size-4" aria-hidden />
                      </Button>
                      <span className="w-6 text-center tabular-nums">{draft[dish.id] ?? 0}</span>
                      <Button
                        size="icon"
                        aria-label={m.order_add_one({ dish: dish.name })}
                        onClick={() => add(dish.id, 1)}
                      >
                        <Plus className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* The basket stays visible while you scroll the menu. */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {m.order_basket_title()}
              <Badge variant="secondary">{m.order_dish_count({ count: totalDishes })}</Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{m.order_basket_empty()}</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((line) => (
                  <li key={line.dish.id} className="flex items-center gap-2 text-sm">
                    <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                      {line.quantity}x
                    </span>
                    <span className="min-w-0 flex-1 truncate">{line.dish.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={m.order_line_remove({ dish: line.dish.name })}
                      onClick={() => add(line.dish.id, -line.quantity)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <Label htmlFor="note">{m.order_note_label()}</Label>
              <Textarea
                id="note"
                rows={2}
                placeholder={m.order_note_placeholder()}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <Button className="w-full" disabled={!canSend} onClick={() => send.mutate()}>
              <Send className="size-4" aria-hidden />
              {send.isPending ? m.order_sending() : m.order_send()}
            </Button>

            {/*
              No table to fill in any more: the order is numbered as it lands,
              and the number comes back here so the counter can call it out.
            */}
            {lastNumber === null ? null : (
              <p className="text-center text-sm text-muted-foreground">
                {m.order_last_sent({ number: lastNumber })}
              </p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
