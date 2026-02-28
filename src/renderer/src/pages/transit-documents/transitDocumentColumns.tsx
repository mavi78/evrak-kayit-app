// ============================================================
// transitDocumentColumns - Gelen evrak tablosu sütun tanımları
// Sıra: K.NO, G.S.NO, SAYISI, MAKAM, KONUSU, E.TAR, GİZ, GÜV, Tür, K.TAR
// ============================================================

import { Badge, Tooltip } from '@mantine/core'
import type { DocumentTableColumn } from '@renderer/components/common'
import type { IncomingDocument, Classification } from '@shared/types'
import { formatDocumentDateForDisplay, formatIsoToDisplayWithTime } from '@shared/utils'

/**
 * Gelen evrak tablosu için sütun tanımlarını döndürür.
 * classifications lookup için kullanılır (GİZ sütunu).
 */
export function getIncomingDocumentColumns(
  classifications: Classification[]
): DocumentTableColumn<IncomingDocument>[] {
  return [
    { key: 'id', label: 'K.NO' },
    {
      key: 'day_sequence_no',
      label: (
        <>
          G.S.
          <br />
          NO
        </>
      )
    },
    { key: 'source_office', label: 'MAKAM', align: 'left' },
    { key: 'reference_number', label: 'SAYISI', align: 'left' },
    {
      key: 'subject',
      label: 'KONUSU',
      minWidth: '25ch',
      align: 'left'
    },
    {
      key: 'document_date',
      label: 'E.TAR',
      render: (row) => formatDocumentDateForDisplay(row.document_date)
    },
    {
      key: 'classification_id',
      label: 'GİZ',
      render: (row) => {
        const c = classifications.find((x) => x.id === row.classification_id)
        return c?.short_name ?? '—'
      }
    },
    {
      key: 'security_control_no',
      label: 'GÜV',
      minWidth: '6ch',
      noWrap: true,
      render: (row) => row.security_control_no || '—'
    },
    {
      key: 'document_type',
      label: 'Tür',
      render: (row) => {
        const isEvrak = row.document_type === 'EVRAK'
        const label = isEvrak ? 'E' : 'M'
        const tooltipLabel = isEvrak ? 'EVRAK' : 'MESAJ'
        const color = isEvrak ? 'blue' : 'orange'
        return (
          <Tooltip label={tooltipLabel} withArrow>
            <Badge size="xs" color={color}>
              {label}
            </Badge>
          </Tooltip>
        )
      }
    },
    {
      key: 'created_at',
      label: 'K.TAR',
      render: (row) => formatIsoToDisplayWithTime(row.created_at)
    }
  ]
}
