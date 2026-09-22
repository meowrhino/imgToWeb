// Reordenación por drag & drop (SortableJS, cargado como global desde CDN).
// Tras soltar, se devuelve el nuevo orden como lista de ids leída del DOM:
// así el estado siempre se reconstruye a partir de lo que ve el usuario.

export function makeSortable(listEl, onReorder) {
  if (typeof Sortable === 'undefined') return null;
  return Sortable.create(listEl, {
    animation: 150,
    ghostClass: 'card-ghost',
    chosenClass: 'card-chosen',
    dragClass: 'card-dragging',
    filter: 'button',
    preventOnFilter: false,
    // En táctil, sin retardo cualquier scroll sobre la lista arrastraba items.
    delay: 180,
    delayOnTouchOnly: true,
    onEnd: ({ oldIndex, newIndex }) => {
      if (oldIndex === newIndex) return;
      const ids = Array.from(listEl.children, (el) => Number(el.dataset.id));
      onReorder(ids);
    },
  });
}

// Reordena `items` (con .id) según `ids`.
export function reorderById(items, ids) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
