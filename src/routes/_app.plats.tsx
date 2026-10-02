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
      toast.success(`"${dish.name}" enregistre.`)
      setForm(null)
      await invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer."),
  })

  const remove = useMutation({
    mutationFn: (dish: Dish) => deleteDish({ data: { id: dish.id } }),
    onSuccess: async () => {
      toast.success('Plat supprime.')
      setPendingDelete(null)
      await invalidate()
    },
    onError: () => toast.error('Impossible de supprimer ce plat.'),
  })

  const rows = dishes.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <h1 className="mr-auto text-2xl font-semibold">Plats</h1>
        <Button onClick={() => setForm(EMPTY)}>
          <Plus className="size-4" aria-hidden />
          Nouveau plat
        </Button>
      </div>

      {dishes.isLoading ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}

      {dishes.isSuccess && rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            La carte est vide. Ajoutez un premier plat.
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
                  {dish.available ? null : <Badge variant="secondary">Indisponible</Badge>}
                </div>
                {dish.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{dish.description}</p>
                ) : null}
              </div>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Modifier ${dish.name}`}
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
                  aria-label={`Supprimer ${dish.name}`}
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
            <DialogTitle>{form?.id ? 'Modifier le plat' : 'Nouveau plat'}</DialogTitle>
            <DialogDescription>
              Un plat indisponible reste dans la carte mais ne peut plus etre commande.
            </DialogDescription>
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
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categorie</Label>
                <Input
                  id="category"
                  required
                  placeholder="Plats, Desserts..."
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
                Disponible a la commande
              </label>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Enregistrement...' : 'Enregistrer'}
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
            <DialogTitle>Supprimer « {pendingDelete?.name} » ?</DialogTitle>
            <DialogDescription>
              Les commandes deja passees gardent le nom du plat : l&apos;historique n&apos;est pas
              touche.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete)}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
