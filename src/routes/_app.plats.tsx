import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { CategoryBadge, CategoryColorPicker } from '#/components/category-color'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { useAppEvents } from '#/hooks/use-app-events'
import { DEFAULT_CATEGORY_COLOR, type CategoryColor } from '#/lib/categories'
import { m } from '#/paraglide/messages'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from '#/server/functions/categories'
import { createDish, deleteDish, listDishes, updateDish, type Dish } from '#/server/functions/dishes'

export const Route = createFileRoute('/_app/plats')({
  component: DishesPage,
})

type FormState = {
  id: string | null
  name: string
  description: string
  categoryId: string
  available: boolean
}

type CategoryFormState = {
  id: string | null
  name: string
  color: CategoryColor
}

const EMPTY: FormState = {
  id: null,
  name: '',
  description: '',
  categoryId: '',
  available: true,
}

const EMPTY_CATEGORY: CategoryFormState = {
  id: null,
  name: '',
  color: DEFAULT_CATEGORY_COLOR,
}

function DishesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Dish | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(null)
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<Category | null>(null)

  const dishes = useQuery({ queryKey: ['dishes'], queryFn: () => listDishes() })
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => listCategories() })

  /**
   * Both lists, always together.
   *
   * A category carries the colour the dishes are drawn in, so a recolour on
   * another tablet changes this screen without a single dish having moved.
   * One event covers both (see src/server/functions/categories.ts) and one
   * refresh has to follow it.
   */
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dishes'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
    ])
  }

  useAppEvents({
    onEvent: (event) => {
      if (event.type === 'dishes.changed') {
        void invalidate()
      }
    },
    onConnect: () => void invalidate(),
  })

  const save = useMutation({
    mutationFn: (state: FormState) => {
      const payload = {
        name: state.name.trim(),
        description: state.description.trim(),
        categoryId: state.categoryId,
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

  const saveCategory = useMutation({
    mutationFn: (state: CategoryFormState) => {
      const payload = { name: state.name.trim(), color: state.color }

      return state.id
        ? updateCategory({ data: { ...payload, id: state.id } })
        : createCategory({ data: payload })
    },
    onSuccess: async (category) => {
      toast.success(m.categories_saved({ category: category.name }))
      setCategoryForm(null)
      await invalidate()
    },
    // Same reasoning as for a dish: "there is already a Desserts" is the
    // whole point of the message, and a generic one would lose it.
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : m.categories_save_failed()),
  })

  const removeCategory = useMutation({
    mutationFn: (category: Category) => deleteCategory({ data: { id: category.id } }),
    onSuccess: async () => {
      toast.success(m.categories_deleted())
      setPendingCategoryDelete(null)
      await invalidate()
    },
    // A category that still holds dishes is refused by the server, and that
    // refusal is the message worth reading.
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : m.categories_delete_failed()),
  })

  const rows = dishes.data ?? []
  const sections = categories.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">{m.nav_dishes()}</h1>
        <Button variant="outline" onClick={() => setCategoryForm(EMPTY_CATEGORY)}>
          <Plus className="size-4" aria-hidden />
          {m.categories_new()}
        </Button>
        {/*
          A dish has to belong to a category, so on an empty card the button
          would open a dialog that cannot be saved. It says why instead.
        */}
        <Button disabled={sections.length === 0} onClick={() => setForm(EMPTY)}>
          <Plus className="size-4" aria-hidden />
          {m.dishes_new()}
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{m.categories_title()}</h2>

        {categories.isSuccess && sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.categories_empty()}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {sections.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-1 rounded-full border border-border/60 py-1 pr-1 pl-2"
              >
                <CategoryBadge name={category.name} color={category.color} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={m.categories_edit_one({ category: category.name })}
                  onClick={() =>
                    setCategoryForm({ id: category.id, name: category.name, color: category.color })
                  }
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={m.categories_delete_one({ category: category.name })}
                  onClick={() => setPendingCategoryDelete(category)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {dishes.isLoading ? <p className="text-sm text-muted-foreground">{m.common_loading()}</p> : null}

      {dishes.isSuccess && rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            {sections.length === 0 ? m.dishes_need_category() : m.dishes_empty()}
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
                  <CategoryBadge name={dish.category.name} color={dish.category.color} />
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
                      categoryId: dish.category.id,
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
                {/*
                  A list, not a text field. Typed by hand, "Desserts" and
                  "desserts" were two sections of the same card - and there
                  would be nothing to hang a colour on.
                */}
                <Select
                  value={form.categoryId}
                  onValueChange={(categoryId) => setForm({ ...form, categoryId })}
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder={m.dishes_category_choose()} />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <CategoryBadge name={category.name} color={category.color} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Button type="submit" disabled={save.isPending || form.categoryId === ''}>
                  {save.isPending ? m.common_saving() : m.common_save()}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={categoryForm !== null}
        onOpenChange={(open) => (open ? null : setCategoryForm(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {categoryForm?.id ? m.categories_edit() : m.categories_new()}
            </DialogTitle>
            <DialogDescription>{m.categories_form_hint()}</DialogDescription>
          </DialogHeader>

          {categoryForm ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                saveCategory.mutate(categoryForm)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="category-name">{m.categories_name()}</Label>
                <Input
                  id="category-name"
                  required
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm({ ...categoryForm, name: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{m.categories_color()}</Label>
                <CategoryColorPicker
                  value={categoryForm.color}
                  disabled={saveCategory.isPending}
                  onChange={(color) => setCategoryForm({ ...categoryForm, color })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCategoryForm(null)}>
                  {m.common_cancel()}
                </Button>
                <Button type="submit" disabled={saveCategory.isPending}>
                  {saveCategory.isPending ? m.common_saving() : m.common_save()}
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

      <Dialog
        open={pendingCategoryDelete !== null}
        onOpenChange={(open) => (open ? null : setPendingCategoryDelete(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {m.categories_delete_title({ category: pendingCategoryDelete?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>{m.categories_delete_hint()}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingCategoryDelete(null)}>
              {m.common_cancel()}
            </Button>
            <Button
              variant="destructive"
              disabled={removeCategory.isPending}
              onClick={() => pendingCategoryDelete && removeCategory.mutate(pendingCategoryDelete)}
            >
              {m.common_delete()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
