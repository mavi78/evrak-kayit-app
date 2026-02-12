// ============================================================
// NewDocumentModal - Yeni evrak kayıt modali (placeholder)
// Gelen evrak formu sonra tasarlanacak; şimdilik boş.
// ============================================================

import { Modal } from '@mantine/core'

export interface NewDocumentModalProps {
  /** Modal açık mı? */
  opened: boolean
  /** Kapatma callback */
  onClose: () => void
  /** Modal başlığı */
  title?: string
}

/**
 * Yeni evrak kayıt modali.
 * İçerik sonra tasarlanacak; şimdilik boş placeholder.
 */
export function NewDocumentModal({
  opened,
  onClose,
  title = 'Yeni Evrak'
}: NewDocumentModalProps): React.JSX.Element {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg">
      {/* Sonra form içeriği eklenecek */}
    </Modal>
  )
}
