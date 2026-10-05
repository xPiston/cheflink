import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { useAppEvents } from '#/hooks/use-app-events'
import { m } from '#/paraglide/messages'
import { createDish, deleteDish, listDishes, updateDish, type Dish } from '#/server/functions/dishes'

export const Route = createFileRoute('/_app/plats')({
  component: DishesPage,
})

type FormState = {
  id: string | null
  name: string
  description: string
  category: string
  available: boolean
}

const EMPTY: FormState = {
  id: null,
  name: '',
  description: '',
  category: '',
  available: true,
}

function DishesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Dish | null>(null)

  const dishes = useQuery({ queryKey: ['dishes'], queryFn: () => listDishes() })

  useAppEvents({
    onEvent: (event) => {
      if (event.type === 'dishes.changed') {
        void queryClient.invalidateQueries({ queryKey: ['dishes'] })
      }
    },
    onConnect: () => void queryClient.invalidateQueries({ queryKey: ['dishes'] }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dishes'] })

  const save = useMutation({
    mutationFn: (state: FormState) => {
      const payload = {
        name: state.name.trim(),
        description: state.description.trim(),
        category: state.category.trim(),
        available: state.available,
      }

      return state.id
        ? updateDish({ data: { ...payload, id: state.id } })
        : createDish({ data: payload })
    },
    onSuccess: async (dish) => {
      toast.success(m.dishes_saved({ dish: dish.name }))
      setForm(null)
      await invalidate()
    },
    /**
     * The server's message is used as-is rather than replaced by a generic
     * one: it says WHICH field is wrong, or that the dish was deleted from
     * another screen a moment ago. It is translated server-side, in the
     * language of this request - see the note in src/server/functions/dishes.ts.
     */
    onError: (error) => toast.error(error instanceof Error ? error.message : m.dishes_save_failed()),
  })

  const remove = useMutation({
    mutationFn: (dish: Dish) => deleteDish({ data: { id: dish.id } }),
    onSuccess: async () => {
      toast.success(m.dishes_deleted())
      setPendingDelete(null)
      await invalidate()
    },
    onError: () => toast.error(m.dishes_delete_failed()),
  })

  const rows = dishes.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <h1 className="mr-auto text-2xl font-semibold">{m.nav_dishes()}</h1>
        <Button onClick={() => setForm(EMPTY)}>
          <Plus className="size-4" aria-hidden />
          {m.dishes_new()}
        </Button>
      </div>

      {dishes.isLoading ? <p className="text-sm text-muted-foreground">{m.common_loading()}</p> : null}

      {dishes.isSuccess && rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            {m.dishes_empty()}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((dish) => (
          <Card key={dish.id}>
            <CardContent className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{dish.name}</span>
                  <Badge variant="outline">{dish.category}</Badge>
                  {dish.available ? null : <Badge variant="secondary">{m.dishes_unavailable()}</Badge>}
                </div>
                {dish.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{dish.description}</p>
                ) : null}
              </div>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={m.dishes_edit_one({ dish: dish.name })}
                  onClick={() =>
                    setForm({
                      id: dish.id,
                      name: dish.name,
                      description: dish.description ?? '',
                      category: dish.category,
                      available: dish.available,
                    })
                  }
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={m.dishes_delete_one({ dish: dish.name })}
                  onClick={() => setPendingDelete(dish)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={form !== null} onOpenChange={(open) => (open ? null : setForm(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? m.dishes_edit() : m.dishes_new()}</DialogTitle>
            <DialogDescription>{m.dishes_form_hint()}</DialogDescription>
          </DialogHeader>

          {form ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                save.mutate(form)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">{m.dishes_name()}</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{m.dishes_description()}</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{m.dishes_category()}</Label>
                <Input
                  id="category"
                  required
                  placeholder={m.dishes_category_placeholder()}
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.available}
                  onChange={(event) => setForm({ ...form, available: event.target.checked })}
                />
                {m.dishes_available()}
              </label>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                  {m.common_cancel()}
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? m.common_saving() : m.common_save()}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? null : setPendingDelete(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.dishes_delete_title({ dish: pendingDelete?.name ?? '' })}</DialogTitle>
            <DialogDescription>{m.dishes_delete_hint()}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {m.common_cancel()}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete)}
            >
              {m.common_delete()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
