/**
 * Tiptap Image extension that renders images from the local asset store.
 * Stores only the asset ID in the document — the actual binary lives in IndexedDB/SQLite.
 * Supports toolbar upload, paste, and drag-and-drop.
 */
import { Node } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { saveAsset, type LocalAsset } from '../localStore'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    assetImage: {
      insertAssetImage: (attrs: { assetId: string; alt?: string }) => ReturnType
    }
  }
}

export const AssetImage = Node.create({
  name: 'assetImage',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      assetId: { default: null },
      alt: { default: '' },
      title: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-asset-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'asset-image-wrapper', 'data-asset-id': HTMLAttributes.assetId }]
  },

  addCommands() {
    return {
      insertAssetImage: (attrs) => ({ chain }) => {
        return chain().insertContent({ type: this.name, attrs }).run()
      },
    }
  },

  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'asset-image-wrapper'
      wrapper.style.cssText = 'margin: 0.75rem 0; text-align: center;'

      const img = document.createElement('img')
      img.alt = node.attrs.alt || ''
      img.title = node.attrs.title || ''
      img.style.cssText = 'max-width: 100%; border-radius: var(--radius, 6px); border: 1px solid var(--color-border, #333);'
      img.draggable = false

      const assetId = node.attrs.assetId
      if (assetId) {
        import('../localStore').then(({ getAssetById }) => {
          getAssetById(assetId).then((asset) => {
            if (asset) {
              const url = URL.createObjectURL(asset.data)
              img.src = url
              const observer = new MutationObserver(() => {
                if (!document.contains(wrapper)) {
                  URL.revokeObjectURL(url)
                  observer.disconnect()
                }
              })
              observer.observe(document.body, { childList: true, subtree: true })
            } else {
              img.alt = `[Missing asset: ${assetId}]`
              img.style.cssText += 'opacity: 0.4; padding: 1rem; background: var(--color-surface, #1a1a1a);'
            }
          })
        })
      }

      wrapper.appendChild(img)
      return { dom: wrapper }
    }
  },

  addProseMirrorPlugins() {
    const nodeType = this.type

    return [
      new Plugin({
        key: new PluginKey('assetImagePasteDrop'),
        props: {
          handlePaste(view, event) {
            const items = event.clipboardData?.items
            if (!items) return false

            for (const item of items) {
              if (item.type.startsWith('image/')) {
                event.preventDefault()
                const file = item.getAsFile()
                if (!file) return false

                uploadAsset(file, null).then((assetId) => {
                  const node = nodeType.create({ assetId, alt: file.name })
                  const tr = view.state.tr.replaceSelectionWith(node)
                  view.dispatch(tr)
                })
                return true
              }
            }
            return false
          },

          handleDrop(view, event) {
            const files = event.dataTransfer?.files
            if (!files || files.length === 0) return false

            const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
            if (!imageFile) return false

            event.preventDefault()
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })

            uploadAsset(imageFile, null).then((assetId) => {
              const node = nodeType.create({ assetId, alt: imageFile.name })
              const tr = view.state.tr.insert(pos?.pos ?? view.state.doc.content.size, node)
              view.dispatch(tr)
            })
            return true
          },
        },
      }),
    ]
  },
})

/**
 * Upload a file to the local asset store and return the asset ID.
 */
export async function uploadAsset(file: File, noteId: string | null): Promise<string> {
  const id = crypto.randomUUID()
  const asset: LocalAsset = {
    id,
    noteId,
    fileName: file.name,
    mimeType: file.type,
    data: file as Blob,
    createdAt: new Date().toISOString(),
  }
  await saveAsset(asset)
  return id
}
