import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Minus, Plus, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { useAppEvents } from '#/hooks/use-app-events'
import { createOrder } from '#/server/functions/orders'
import { listDishes, type Dish } from '#/server/functions/dishes'

export const Route = createFileRoute('/_app/bar/')({
  component: TakeOrderPage,
})

type Draft = Record<string, number>

function TakeOrderPage() {
  const queryClient = useQueryClient()
  const [tableLabel, setTableLabel] = useState('')
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState<Draft>({})

  const dishes = useQuery({ queryKey: ['dishes'], queryFn: () => listDishes() })

  // La carte peut changer pendant le service : si quelqu'un retire un plat
  // depuis /plats, le bar le voit disparaitre sans recharger la page.
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

  const byCategory = useMemo(() => {
    const groups = new Map<string, Dish[]>()
    for (const dish of available) {
      groups.set(dish.category, [...(groups.get(dish.category) ?? []), dish])
    }

    return [...groups.entries()]
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
          tableLabel: tableLabel.trim(),
          note: note.trim(),
          lines: lines.map((line) => ({ dishId: line.dish.id, quantity: line.quantity })),
        },
      }),
    onSuccess: (order) => {
      toast.success(`Commande envoyee en cuisine - ${order.tableLabel}`)
      setDraft({})
      setNote('')
      setTableLabel('')
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: () => toast.error("La commande n'est pas partie. Reessayez."),
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

  const canSend = lines.length > 0 && tableLabel.trim().length > 0 && !send.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">Prise de commande</h1>

        {dishes.isLoading ? <p className="text-sm text-muted-foreground">Chargement de la carte...</p> : null}

        {dishes.isSuccess && available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun plat disponible. Ajoutez-en depuis l&apos;onglet Plats.
          </p>
        ) : null}

        {byCategory.map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {category}
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
                        aria-label={`Retirer un ${dish.name}`}
                        disabled={!draft[dish.id]}
                        onClick={() => add(dish.id, -1)}
                      >
                        <Minus className="size-4" aria-hidden />
                      </Button>
                      <span className="w-6 text-center tabular-nums">{draft[dish.id] ?? 0}</span>
                      <Button
                        size="icon"
                        aria-label={`Ajouter un ${dish.name}`}
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

      {/* Le panier reste visible pendant qu'on fait defiler la carte. */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Commande
              <Badge variant="secondary">{totalDishes} plat(s)</Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="table">Table</Label>
              <Input
                id="table"
                placeholder="Table 4, comptoir..."
                value={tableLabel}
                onChange={(event) => setTableLabel(event.target.value)}
              />
            </div>

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ajoutez des plats depuis la carte.
              </p>
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
                      aria-label={`Enlever ${line.dish.name}`}
                      onClick={() => add(line.dish.id, -line.quantity)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <Label htmlFor="note">Note pour la cuisine</Label>
              <Textarea
                id="note"
                rows={2}
                placeholder="Sans oignons, allergie..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <Button className="w-full" disabled={!canSend} onClick={() => send.mutate()}>
              <Send className="size-4" aria-hidden />
              {send.isPending ? 'Envoi...' : 'Envoyer en cuisine'}
            </Button>

            {lines.length > 0 && tableLabel.trim().length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                Indiquez la table pour pouvoir envoyer.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
